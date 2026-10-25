CREATE OR REPLACE FUNCTION public.solicitar_deposito_billetera(
  p_monto numeric,
  p_referencia text,
  p_comprobante_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden solicitar depósitos';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > 100000
    OR p_comprobante_path IS NULL
    OR p_comprobante_path !~ ('^' || auth.uid()::text || '/[^/]+$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects AS objeto
      WHERE objeto.bucket_id = 'wallet-receipts' AND objeto.name = p_comprobante_path
    ) THEN
    RAISE EXCEPTION 'El monto o el comprobante del depósito no son válidos';
  END IF;

  INSERT INTO public.solicitudes_billetera (perfil_id, tipo, monto, referencia, comprobante_path)
  VALUES (auth.uid(), 'deposito', round(p_monto, 2), NULL, p_comprobante_path)
  RETURNING id INTO v_solicitud_id;
  RETURN v_solicitud_id;
END;
$$;

DROP FUNCTION IF EXISTS public.resolver_solicitud_billetera(uuid, boolean, text);

CREATE FUNCTION public.resolver_solicitud_billetera(
  p_solicitud_id uuid,
  p_aprobar boolean,
  p_nota text DEFAULT NULL,
  p_referencia text DEFAULT NULL
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
  v_referencia text := nullif(trim(p_referencia), '');
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede resolver movimientos';
  END IF;
  IF p_aprobar IS NULL OR length(coalesce(p_nota, '')) > 500
    OR length(coalesce(v_referencia, '')) > 120 THEN
    RAISE EXCEPTION 'La decisión, nota o referencia de revisión no son válidas';
  END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_billetera
  WHERE id = p_solicitud_id AND estado = 'pendiente'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud ya fue revisada o no existe';
  END IF;
  IF v_solicitud.perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes aprobar ni rechazar tus propios movimientos';
  END IF;
  IF p_aprobar AND v_solicitud.tipo = 'deposito' AND v_referencia IS NULL THEN
    RAISE EXCEPTION 'Registra la referencia bancaria verificada antes de aprobar el depósito';
  END IF;

  IF p_aprobar THEN
    INSERT INTO public.saldos_socios (perfil_id)
    VALUES (v_solicitud.perfil_id)
    ON CONFLICT DO NOTHING;
    SELECT saldo INTO v_saldo
    FROM public.saldos_socios
    WHERE perfil_id = v_solicitud.perfil_id
    FOR UPDATE;

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
        RAISE EXCEPTION 'El retiro dejaría el saldo por debajo de la garantía mínima de $%',
          to_char(v_garantia_minima, 'FM999999990.00');
      END IF;
    END IF;

    UPDATE public.saldos_socios
    SET saldo = saldo + CASE
          WHEN v_solicitud.tipo = 'deposito' THEN v_solicitud.monto
          ELSE -v_solicitud.monto
        END,
        actualizado_en = now()
    WHERE perfil_id = v_solicitud.perfil_id;

    UPDATE public.solicitudes_billetera
    SET estado = 'aprobada',
        referencia = CASE WHEN tipo = 'deposito' THEN v_referencia ELSE referencia END,
        revisada_en = now(),
        revisada_por = auth.uid(),
        nota_revision = nullif(trim(p_nota), '')
    WHERE id = v_solicitud.id;

    INSERT INTO public.movimientos_billetera (perfil_id, tipo, delta, solicitud_id, detalles)
    VALUES (
      v_solicitud.perfil_id,
      v_solicitud.tipo,
      CASE WHEN v_solicitud.tipo = 'deposito' THEN v_solicitud.monto ELSE -v_solicitud.monto END,
      v_solicitud.id,
      jsonb_build_object('referencia', v_referencia, 'aprobado_por', auth.uid())
    );
  ELSE
    UPDATE public.solicitudes_billetera
    SET estado = 'rechazada',
        referencia = NULL,
        revisada_en = now(),
        revisada_por = auth.uid(),
        nota_revision = nullif(trim(p_nota), '')
    WHERE id = v_solicitud.id;
  END IF;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (
    auth.uid(),
    v_solicitud.perfil_id,
    CASE WHEN p_aprobar THEN 'movimiento_billetera_aprobado' ELSE 'movimiento_billetera_rechazado' END,
    jsonb_build_object(
      'solicitud_id', v_solicitud.id,
      'tipo', v_solicitud.tipo,
      'monto', v_solicitud.monto,
      'nota', nullif(trim(p_nota), ''),
      'referencia_validada', CASE WHEN p_aprobar THEN v_referencia ELSE NULL END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_deposito_billetera(numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_deposito_billetera(numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.resolver_solicitud_billetera(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_billetera(uuid, boolean, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notificar_solicitud_billetera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre_socio text;
  v_estado text;
BEGIN
  SELECT coalesce(nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''), 'Un socio')
  INTO v_nombre_socio
  FROM public.perfiles AS perfil
  WHERE perfil.id = NEW.perfil_id;

  IF TG_OP = 'INSERT' AND NEW.estado = 'pendiente' THEN
    INSERT INTO public.notificaciones (
      usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente
    )
    SELECT
      perfil.id,
      'Nueva solicitud de billetera',
      v_nombre_socio || ' envió una solicitud de '
        || CASE WHEN NEW.tipo = 'deposito' THEN 'depósito' ELSE 'retiro' END
        || ' por $' || to_char(NEW.monto, 'FM999999990.00') || '.',
      'info',
      '/admin/billetera',
      'Revisar solicitud',
      'solicitud-billetera:' || NEW.id || ':pendiente'
    FROM public.perfiles AS perfil
    WHERE lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
      AND perfil.id <> NEW.perfil_id
    ON CONFLICT (usuario_id, fuente) DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    v_estado := CASE
      WHEN NEW.estado = 'aprobada' THEN 'aprobada'
      ELSE 'rechazada'
    END;
    INSERT INTO public.notificaciones (
      usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente
    ) VALUES (
      NEW.perfil_id,
      CASE WHEN v_estado = 'aprobada' THEN 'Movimiento aprobado' ELSE 'Movimiento rechazado' END,
      'Tu solicitud de '
        || CASE WHEN NEW.tipo = 'deposito' THEN 'depósito' ELSE 'retiro' END
        || ' por $' || to_char(NEW.monto, 'FM999999990.00')
        || CASE
          WHEN v_estado = 'aprobada' AND NEW.tipo = 'deposito'
            THEN ' fue aprobada y el saldo fue acreditado a tu billetera.'
          WHEN v_estado = 'aprobada'
            THEN ' fue aprobada.'
          ELSE ' fue rechazada.'
        END
        || CASE WHEN NEW.nota_revision IS NOT NULL THEN ' Motivo: ' || NEW.nota_revision ELSE '' END,
      CASE WHEN v_estado = 'aprobada' THEN 'success' ELSE 'info' END,
      '/billetera',
      'Ver billetera',
      'solicitud-billetera:' || NEW.id || ':' || NEW.estado
    )
    ON CONFLICT (usuario_id, fuente) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_billetera_notificacion ON public.solicitudes_billetera;
CREATE TRIGGER solicitudes_billetera_notificacion
AFTER INSERT OR UPDATE OF estado ON public.solicitudes_billetera
FOR EACH ROW
EXECUTE FUNCTION public.notificar_solicitud_billetera();

REVOKE ALL ON FUNCTION public.notificar_solicitud_billetera() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.moki_conversaciones REPLICA IDENTITY FULL;
ALTER TABLE public.moki_mensajes REPLICA IDENTITY FULL;
ALTER TABLE public.moki_mensajes ALTER COLUMN remitente_id DROP NOT NULL;
ALTER TABLE public.moki_mensajes
  DROP CONSTRAINT IF EXISTS moki_mensajes_remitente_rol_check;
ALTER TABLE public.moki_mensajes
  ADD CONSTRAINT moki_mensajes_remitente_rol_check
  CHECK (
    (remitente_rol = 'moki' AND remitente_id IS NULL)
    OR (
      remitente_rol IN ('socio', 'administrador')
      AND remitente_id IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.moki_confirmar_mensaje_socio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.remitente_rol = 'socio' THEN
    INSERT INTO public.moki_mensajes (
      conversacion_id, remitente_id, remitente_rol, contenido
    ) VALUES (
      NEW.conversacion_id,
      NULL,
      'moki',
      'Tu mensaje quedó registrado. El equipo de administración te responderá por este chat.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moki_confirmar_mensaje_socio ON public.moki_mensajes;
CREATE TRIGGER moki_confirmar_mensaje_socio
AFTER INSERT ON public.moki_mensajes
FOR EACH ROW
WHEN (NEW.remitente_rol = 'socio')
EXECUTE FUNCTION public.moki_confirmar_mensaje_socio();

REVOKE ALL ON FUNCTION public.moki_confirmar_mensaje_socio() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['moki_conversaciones', 'moki_mensajes']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
