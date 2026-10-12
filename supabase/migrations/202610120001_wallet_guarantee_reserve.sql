INSERT INTO public.configuracion_billetera (singleton, garantia_minima)
VALUES (true, 20)
ON CONFLICT (singleton) DO NOTHING;

UPDATE public.configuracion_billetera
SET garantia_minima = 20,
    actualizado_en = now()
WHERE singleton;

CREATE OR REPLACE FUNCTION public.garantia_minima_billetera_admin()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo administración puede consultar la garantía mínima';
  END IF;

  RETURN (
    SELECT garantia_minima
    FROM public.configuracion_billetera
    WHERE singleton
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_retiro_billetera(p_monto numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric;
  v_garantia_minima numeric;
  v_retiros_pendientes numeric;
  v_solicitud_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden solicitar retiros'; END IF;
  IF p_monto IS NULL OR round(p_monto, 2) <= 0 THEN RAISE EXCEPTION 'El monto del retiro debe ser mayor a cero'; END IF;

  INSERT INTO public.saldos_socios (perfil_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT saldo INTO v_saldo
  FROM public.saldos_socios
  WHERE perfil_id = auth.uid()
  FOR UPDATE;

  SELECT garantia_minima INTO v_garantia_minima
  FROM public.configuracion_billetera
  WHERE singleton
  FOR SHARE;

  SELECT coalesce(sum(monto), 0) INTO v_retiros_pendientes
  FROM public.solicitudes_billetera
  WHERE perfil_id = auth.uid() AND tipo = 'retiro' AND estado = 'pendiente';

  IF round(p_monto, 2) > greatest(v_saldo - v_garantia_minima - v_retiros_pendientes, 0) THEN
    RAISE EXCEPTION 'El retiro excede tu saldo disponible después de reservar la garantía de $%', to_char(v_garantia_minima, 'FM999999990.00');
  END IF;

  INSERT INTO public.solicitudes_billetera (perfil_id, tipo, monto)
  VALUES (auth.uid(), 'retiro', round(p_monto, 2))
  RETURNING id INTO v_solicitud_id;
  RETURN v_solicitud_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_solicitud_billetera(
  p_solicitud_id uuid,
  p_aprobar boolean,
  p_nota text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud public.solicitudes_billetera;
  v_saldo numeric;
  v_garantia_minima numeric;
  v_otros_retiros_pendientes numeric;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN RAISE EXCEPTION 'Solo administración o tesorería puede resolver movimientos'; END IF;
  IF p_aprobar IS NULL THEN RAISE EXCEPTION 'Debes indicar si apruebas o rechazas el movimiento'; END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_billetera
  WHERE id = p_solicitud_id AND estado = 'pendiente'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya fue revisada o no existe'; END IF;
  IF v_solicitud.perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes aprobar ni rechazar tus propios movimientos';
  END IF;

  IF p_aprobar THEN
    INSERT INTO public.saldos_socios (perfil_id) VALUES (v_solicitud.perfil_id) ON CONFLICT DO NOTHING;
    SELECT saldo INTO v_saldo FROM public.saldos_socios
    WHERE perfil_id = v_solicitud.perfil_id FOR UPDATE;

    IF v_solicitud.tipo = 'retiro' THEN
      SELECT garantia_minima INTO v_garantia_minima
      FROM public.configuracion_billetera
      WHERE singleton
      FOR SHARE;

      SELECT coalesce(sum(monto), 0) INTO v_otros_retiros_pendientes
      FROM public.solicitudes_billetera
      WHERE perfil_id = v_solicitud.perfil_id
        AND tipo = 'retiro'
        AND estado = 'pendiente'
        AND id <> v_solicitud.id;

      IF v_saldo - v_solicitud.monto - v_otros_retiros_pendientes < v_garantia_minima THEN
        RAISE EXCEPTION 'El retiro dejaría el saldo por debajo de la garantía mínima de $%', to_char(v_garantia_minima, 'FM999999990.00');
      END IF;
    END IF;

    UPDATE public.saldos_socios
    SET saldo = saldo + CASE WHEN v_solicitud.tipo = 'deposito' THEN v_solicitud.monto ELSE -v_solicitud.monto END,
        actualizado_en = now()
    WHERE perfil_id = v_solicitud.perfil_id;

    INSERT INTO public.movimientos_billetera (perfil_id, tipo, delta, solicitud_id, detalles)
    VALUES (
      v_solicitud.perfil_id,
      v_solicitud.tipo,
      CASE WHEN v_solicitud.tipo = 'deposito' THEN v_solicitud.monto ELSE -v_solicitud.monto END,
      v_solicitud.id,
      jsonb_build_object('referencia', v_solicitud.referencia, 'aprobado_por', auth.uid())
    );

    UPDATE public.solicitudes_billetera
    SET estado = 'aprobada', revisada_en = now(), revisada_por = auth.uid(),
        nota_revision = nullif(trim(p_nota), '')
    WHERE id = v_solicitud.id;
  ELSE
    UPDATE public.solicitudes_billetera
    SET estado = 'rechazada', revisada_en = now(), revisada_por = auth.uid(),
        nota_revision = nullif(trim(p_nota), '')
    WHERE id = v_solicitud.id;
  END IF;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (
    auth.uid(), v_solicitud.perfil_id,
    CASE WHEN p_aprobar THEN 'movimiento_billetera_aprobado' ELSE 'movimiento_billetera_rechazado' END,
    jsonb_build_object('solicitud_id', v_solicitud.id, 'tipo', v_solicitud.tipo,
      'monto', v_solicitud.monto, 'nota', nullif(trim(p_nota), ''))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.procesar_aportes_billetera_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
  v_participante public.participantes;
  v_saldo numeric;
  v_total numeric;
  v_procesados integer := 0;
  v_vencimiento timestamptz;
  v_periodicidad interval;
BEGIN
  FOR v_grupo IN
    SELECT grupo.*
    FROM public.grupos AS grupo
    WHERE grupo.estado = 'activo'
      AND grupo.fecha_inicio IS NOT NULL
      AND grupo.semana_actual BETWEEN 1 AND grupo.numero_integrantes
    ORDER BY grupo.fecha_inicio
    FOR UPDATE SKIP LOCKED
  LOOP
    v_periodicidad := CASE v_grupo.aporte_periodicidad
      WHEN 'quincenal' THEN interval '14 days'
      WHEN 'mensual' THEN interval '1 month'
      ELSE interval '7 days'
    END;
    v_vencimiento := v_grupo.fecha_inicio + (v_grupo.semana_actual * v_periodicidad);
    IF now() < v_vencimiento THEN CONTINUE; END IF;

    v_total := round(v_grupo.aporte_semanal, 2);
    FOR v_participante IN
      SELECT participante.*
      FROM public.participantes AS participante
      WHERE participante.grupo_id = v_grupo.id
        AND participante.perfil_id IS NOT NULL
      ORDER BY participante.id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.aportes AS aporte
        WHERE aporte.participante_id = v_participante.id
          AND aporte.grupo_id = v_grupo.id
          AND aporte.semana = v_grupo.semana_actual
      ) THEN CONTINUE; END IF;

      INSERT INTO public.saldos_socios (perfil_id)
      VALUES (v_participante.perfil_id)
      ON CONFLICT (perfil_id) DO NOTHING;
      SELECT saldo INTO v_saldo
      FROM public.saldos_socios
      WHERE perfil_id = v_participante.perfil_id
      FOR UPDATE;
      IF v_saldo IS NULL OR v_saldo < v_total THEN CONTINUE; END IF;

      INSERT INTO public.aportes (
        participante_id, grupo_id, semana, monto, comision_app, estado
      ) VALUES (
        v_participante.id, v_grupo.id, v_grupo.semana_actual,
        v_grupo.aporte_semanal, 0, 'pagado'
      );
      UPDATE public.saldos_socios
      SET saldo = saldo - v_total, actualizado_en = now()
      WHERE perfil_id = v_participante.perfil_id;
      INSERT INTO public.movimientos_billetera (
        perfil_id, tipo, delta, grupo_id, periodo, detalles
      ) VALUES (
        v_participante.perfil_id, 'aporte_programado', -v_total,
        v_grupo.id, v_grupo.semana_actual,
        jsonb_build_object('vencido_en', v_vencimiento, 'aporte', v_grupo.aporte_semanal,
          'garantia_utilizada', true)
      );
      INSERT INTO public.auditoria_eventos (grupo_id, objetivo_id, evento, detalles)
      VALUES (
        v_grupo.id, v_participante.perfil_id, 'aporte_cubierto_desde_billetera',
        jsonb_build_object('periodo', v_grupo.semana_actual, 'monto', v_total,
          'vencido_en', v_vencimiento, 'garantia_utilizada', true)
      );
      v_procesados := v_procesados + 1;
    END LOOP;
  END LOOP;
  RETURN v_procesados;
END;
$$;

REVOKE ALL ON FUNCTION public.garantia_minima_billetera_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantia_minima_billetera_admin() TO authenticated;
