ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS bienvenida_completada boolean NOT NULL DEFAULT false;

UPDATE public.perfiles
SET bienvenida_completada = true
WHERE bienvenida_completada = false;

ALTER TABLE public.datos_personales_privados
  ADD COLUMN IF NOT EXISTS documento_identidad_path text;

CREATE TABLE IF NOT EXISTS public.saldos_socios (
  perfil_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  saldo numeric(12, 2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.configuracion_billetera (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  garantia_minima numeric(12, 2) NOT NULL DEFAULT 10 CHECK (garantia_minima >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.configuracion_billetera (singleton, garantia_minima)
VALUES (true, 10)
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.saldos_socios (perfil_id)
SELECT id FROM public.perfiles
ON CONFLICT (perfil_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.solicitudes_billetera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('deposito', 'retiro')),
  monto numeric(12, 2) NOT NULL CHECK (monto > 0),
  referencia text,
  comprobante_path text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  creada_en timestamptz NOT NULL DEFAULT now(),
  revisada_en timestamptz,
  revisada_por uuid REFERENCES public.perfiles(id),
  nota_revision text
);

CREATE INDEX IF NOT EXISTS solicitudes_billetera_estado_creada_idx
  ON public.solicitudes_billetera (estado, creada_en);

CREATE TABLE IF NOT EXISTS public.movimientos_billetera (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('deposito', 'retiro', 'aporte_programado')),
  delta numeric(12, 2) NOT NULL CHECK (delta <> 0),
  solicitud_id uuid UNIQUE REFERENCES public.solicitudes_billetera(id),
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  periodo integer,
  creado_en timestamptz NOT NULL DEFAULT now(),
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_billetera_aporte_periodo_unique
  ON public.movimientos_billetera (perfil_id, grupo_id, periodo)
  WHERE tipo = 'aporte_programado';
CREATE INDEX IF NOT EXISTS movimientos_billetera_perfil_creado_idx
  ON public.movimientos_billetera (perfil_id, creado_en DESC);

ALTER TABLE public.saldos_socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_billetera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_billetera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_billetera ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.saldos_socios, public.configuracion_billetera,
  public.solicitudes_billetera, public.movimientos_billetera FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('identity-documents', 'identity-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('wallet-receipts', 'wallet-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

DROP POLICY IF EXISTS identity_documents_owner_insert ON storage.objects;
CREATE POLICY identity_documents_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'identity-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

DROP POLICY IF EXISTS identity_documents_owner_read ON storage.objects;
CREATE POLICY identity_documents_owner_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'identity-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.perfiles AS perfil_actual
      WHERE perfil_actual.id = auth.uid()
        AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
    )
  )
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

DROP POLICY IF EXISTS wallet_receipts_owner_insert ON storage.objects;
CREATE POLICY wallet_receipts_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'wallet-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

DROP POLICY IF EXISTS wallet_receipts_owner_read ON storage.objects;
CREATE POLICY wallet_receipts_owner_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'wallet-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.perfiles AS perfil_actual
      WHERE perfil_actual.id = auth.uid()
        AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
    )
  )
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

CREATE OR REPLACE FUNCTION public.crear_saldo_socio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.rol) = 'socio' THEN
    INSERT INTO public.saldos_socios (perfil_id)
    VALUES (NEW.id)
    ON CONFLICT (perfil_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfiles_crear_saldo_socio ON public.perfiles;
CREATE TRIGGER perfiles_crear_saldo_socio
AFTER INSERT ON public.perfiles
FOR EACH ROW EXECUTE FUNCTION public.crear_saldo_socio();

CREATE OR REPLACE FUNCTION public.estado_documento_propio()
RETURNS TABLE (documento_identidad_path text, documento_verificado boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  RETURN QUERY
  SELECT datos.documento_identidad_path, datos.documento_verificado
  FROM public.datos_personales_privados AS datos
  WHERE datos.perfil_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_documento_identidad(p_object_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR p_object_path IS NULL
    OR p_object_path !~ ('^' || auth.uid()::text || '/[^/]+$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects AS objeto
      WHERE objeto.bucket_id = 'identity-documents'
        AND objeto.name = p_object_path
    ) THEN
    RAISE EXCEPTION 'El documento de identidad no es válido';
  END IF;

  INSERT INTO public.datos_personales_privados (
    perfil_id, documento_identidad_path, documento_verificado, verificado_por, verificado_en
  ) VALUES (auth.uid(), p_object_path, false, NULL, NULL)
  ON CONFLICT (perfil_id) DO UPDATE
  SET documento_identidad_path = EXCLUDED.documento_identidad_path,
      documento_verificado = false,
      verificado_por = NULL,
      verificado_en = NULL,
      actualizado_en = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.completar_bienvenida_flashmonkey()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) = 'socio'
      AND nullif(trim(perfil.nombre), '') IS NOT NULL
      AND nullif(trim(perfil.telefono), '') IS NOT NULL
      AND nullif(trim(datos.cedula), '') IS NOT NULL
      AND nullif(trim(datos.direccion), '') IS NOT NULL
      AND datos.documento_identidad_path IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Completa tus datos y carga el documento de identidad antes de continuar';
  END IF;

  UPDATE public.perfiles SET bienvenida_completada = true WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_billetera_propio()
RETURNS TABLE (saldo numeric, garantia_minima numeric, garantia_cumplida boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT coalesce(cartera.saldo, 0)::numeric,
    configuracion.garantia_minima::numeric,
    coalesce(cartera.saldo, 0) >= configuracion.garantia_minima
  FROM public.configuracion_billetera AS configuracion
  LEFT JOIN public.saldos_socios AS cartera ON cartera.perfil_id = auth.uid()
  WHERE configuracion.singleton;
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_billetera_propio()
RETURNS TABLE (
  id bigint,
  tipo text,
  delta numeric,
  grupo_id uuid,
  periodo integer,
  creado_en timestamptz,
  detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT movimiento.id, movimiento.tipo, movimiento.delta, movimiento.grupo_id,
    movimiento.periodo, movimiento.creado_en, movimiento.detalles
  FROM public.movimientos_billetera AS movimiento
  WHERE movimiento.perfil_id = auth.uid()
  ORDER BY movimiento.creado_en DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitudes_billetera_propias()
RETURNS TABLE (
  id uuid,
  tipo text,
  monto numeric,
  estado text,
  referencia text,
  creada_en timestamptz,
  revisada_en timestamptz,
  nota_revision text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT solicitud.id, solicitud.tipo, solicitud.monto, solicitud.estado,
    solicitud.referencia, solicitud.creada_en, solicitud.revisada_en, solicitud.nota_revision
  FROM public.solicitudes_billetera AS solicitud
  WHERE solicitud.perfil_id = auth.uid()
  ORDER BY solicitud.creada_en DESC
  LIMIT 100;
END;
$$;

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
  ) THEN RAISE EXCEPTION 'Solo los socios pueden solicitar depósitos'; END IF;
  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > 100000
    OR length(coalesce(p_referencia, '')) > 120
    OR p_comprobante_path IS NULL
    OR p_comprobante_path !~ ('^' || auth.uid()::text || '/[^/]+$')
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects AS objeto
      WHERE objeto.bucket_id = 'wallet-receipts' AND objeto.name = p_comprobante_path
    ) THEN
    RAISE EXCEPTION 'El monto o el comprobante del depósito no son válidos';
  END IF;
  INSERT INTO public.solicitudes_billetera (perfil_id, tipo, monto, referencia, comprobante_path)
  VALUES (auth.uid(), 'deposito', round(p_monto, 2), nullif(trim(p_referencia), ''), p_comprobante_path)
  RETURNING id INTO v_solicitud_id;
  RETURN v_solicitud_id;
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
  v_retiros_pendientes numeric;
  v_solicitud_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden solicitar retiros'; END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El monto del retiro debe ser mayor a cero'; END IF;

  INSERT INTO public.saldos_socios (perfil_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT saldo INTO v_saldo FROM public.saldos_socios WHERE perfil_id = auth.uid() FOR UPDATE;
  SELECT coalesce(sum(monto), 0) INTO v_retiros_pendientes
  FROM public.solicitudes_billetera
  WHERE perfil_id = auth.uid() AND tipo = 'retiro' AND estado = 'pendiente';
  IF round(p_monto, 2) > v_saldo - v_retiros_pendientes THEN
    RAISE EXCEPTION 'El saldo disponible no cubre este retiro ni los retiros pendientes';
  END IF;
  INSERT INTO public.solicitudes_billetera (perfil_id, tipo, monto)
  VALUES (auth.uid(), 'retiro', round(p_monto, 2))
  RETURNING id INTO v_solicitud_id;
  RETURN v_solicitud_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_solicitudes_billetera_admin()
RETURNS TABLE (
  id uuid,
  perfil_id uuid,
  nombre text,
  apellido text,
  tipo text,
  monto numeric,
  referencia text,
  comprobante_path text,
  creada_en timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) IN ('administrador', 'tesorero')
  ) THEN RAISE EXCEPTION 'Solo administración o tesorería puede revisar movimientos'; END IF;
  RETURN QUERY
  SELECT solicitud.id, solicitud.perfil_id, perfil.nombre::text, perfil.apellido::text,
    solicitud.tipo, solicitud.monto, solicitud.referencia, solicitud.comprobante_path, solicitud.creada_en
  FROM public.solicitudes_billetera AS solicitud
  JOIN public.perfiles AS perfil ON perfil.id = solicitud.perfil_id
  WHERE solicitud.estado = 'pendiente'
  ORDER BY solicitud.creada_en;
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

    IF v_solicitud.tipo = 'retiro' AND v_saldo < v_solicitud.monto THEN
      RAISE EXCEPTION 'El saldo ya no cubre el retiro solicitado';
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

CREATE OR REPLACE FUNCTION public.actualizar_garantia_minima_billetera(p_monto numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo administración puede cambiar la garantía mínima'; END IF;
  IF p_monto IS NULL OR p_monto < 0 OR p_monto > 100000 THEN
    RAISE EXCEPTION 'La garantía mínima debe estar entre $0 y $100000';
  END IF;
  UPDATE public.configuracion_billetera
  SET garantia_minima = round(p_monto, 2), actualizado_en = now()
  WHERE singleton;
END;
$$;

CREATE OR REPLACE FUNCTION public.exigir_garantia_socio_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric;
  v_minimo numeric;
BEGIN
  IF NEW.perfil_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = NEW.perfil_id AND lower(rol) = 'socio'
  ) THEN RETURN NEW; END IF;
  SELECT coalesce(cartera.saldo, 0), configuracion.garantia_minima
  INTO v_saldo, v_minimo
  FROM public.configuracion_billetera AS configuracion
  LEFT JOIN public.saldos_socios AS cartera ON cartera.perfil_id = NEW.perfil_id
  WHERE configuracion.singleton;
  IF coalesce(v_saldo, 0) < coalesce(v_minimo, 10) THEN
    RAISE EXCEPTION 'Debes tener al menos $% de saldo aprobado para unirte a un grupo', to_char(coalesce(v_minimo, 10), 'FM999999990.00');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_grupo_exigir_garantia ON public.solicitudes_grupo;
CREATE TRIGGER solicitudes_grupo_exigir_garantia
BEFORE INSERT ON public.solicitudes_grupo
FOR EACH ROW EXECUTE FUNCTION public.exigir_garantia_socio_grupo();

DROP TRIGGER IF EXISTS participantes_exigir_garantia ON public.participantes;
CREATE TRIGGER participantes_exigir_garantia
BEFORE INSERT ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.exigir_garantia_socio_grupo();

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

    v_total := v_grupo.aporte_semanal + 1;
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
        v_grupo.aporte_semanal, 1, 'pagado'
      );
      UPDATE public.saldos_socios
      SET saldo = saldo - v_total, actualizado_en = now()
      WHERE perfil_id = v_participante.perfil_id;
      INSERT INTO public.movimientos_billetera (
        perfil_id, tipo, delta, grupo_id, periodo, detalles
      ) VALUES (
        v_participante.perfil_id, 'aporte_programado', -v_total,
        v_grupo.id, v_grupo.semana_actual,
        jsonb_build_object('vencido_en', v_vencimiento, 'aporte', v_grupo.aporte_semanal, 'comision', 1)
      );
      INSERT INTO public.auditoria_eventos (grupo_id, objetivo_id, evento, detalles)
      VALUES (
        v_grupo.id, v_participante.perfil_id, 'aporte_cubierto_desde_billetera',
        jsonb_build_object('periodo', v_grupo.semana_actual, 'monto', v_total, 'vencido_en', v_vencimiento)
      );
      v_procesados := v_procesados + 1;
    END LOOP;
  END LOOP;
  RETURN v_procesados;
END;
$$;

DROP FUNCTION IF EXISTS public.listar_documentos_pendientes_tesorero();
CREATE FUNCTION public.listar_documentos_pendientes_tesorero()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  cedula text,
  direccion text,
  documento_identidad_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede revisar documentos';
  END IF;

  RETURN QUERY
  SELECT perfil.id, perfil.nombre::text, perfil.apellido::text, perfil.telefono::text,
    datos.cedula, datos.direccion, datos.documento_identidad_path
  FROM public.perfiles AS perfil
  JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE NOT datos.documento_verificado
    AND datos.documento_identidad_path IS NOT NULL
  ORDER BY perfil.apellido, perfil.nombre
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_documento_tesorero(p_perfil_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede registrar la verificación documental';
  END IF;
  IF p_perfil_id = auth.uid() THEN RAISE EXCEPTION 'No puedes verificar tu propio documento'; END IF;

  UPDATE public.datos_personales_privados
  SET documento_verificado = true,
      verificado_por = auth.uid(),
      verificado_en = now()
  WHERE perfil_id = p_perfil_id
    AND cedula IS NOT NULL
    AND documento_identidad_path IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'El socio no tiene cédula y documento cargados'; END IF;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento)
  VALUES (auth.uid(), p_perfil_id, 'documento_personal_verificado');
END;
$$;

REVOKE ALL ON FUNCTION public.crear_saldo_socio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estado_documento_propio() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guardar_documento_identidad(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.completar_bienvenida_flashmonkey() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resumen_billetera_propio() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.historial_billetera_propio() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.solicitudes_billetera_propias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.solicitar_deposito_billetera(numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.solicitar_retiro_billetera(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_solicitudes_billetera_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolver_solicitud_billetera(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_garantia_minima_billetera(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.exigir_garantia_socio_grupo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.procesar_aportes_billetera_vencidos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estado_documento_propio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_documento_identidad(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.completar_bienvenida_flashmonkey() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_billetera_propio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.historial_billetera_propio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitudes_billetera_propias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_deposito_billetera(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_retiro_billetera(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_billetera_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_billetera(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_garantia_minima_billetera(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_documentos_pendientes_tesorero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_documento_tesorero(uuid) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'flashmonkey-billetera-aportes-vencidos'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule(
    'flashmonkey-billetera-aportes-vencidos',
    '*/5 * * * *',
    'SELECT public.procesar_aportes_billetera_vencidos();'
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
