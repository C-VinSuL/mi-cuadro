ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS aporte_periodicidad text NOT NULL DEFAULT 'semanal'
    CHECK (aporte_periodicidad IN ('semanal', 'quincenal', 'mensual'));

CREATE TABLE IF NOT EXISTS public.solicitudes_invitacion_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'invitacion_enviada', 'aceptada', 'rechazada')),
  creada_en timestamptz NOT NULL DEFAULT now(),
  revisada_en timestamptz,
  revisada_por uuid REFERENCES public.perfiles(id),
  UNIQUE (grupo_id, perfil_id)
);

CREATE TABLE IF NOT EXISTS public.invitaciones_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_invitacion_grupo(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  creada_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  aceptada_en timestamptz
);

CREATE TABLE IF NOT EXISTS public.auditoria_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  objetivo_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  evento text NOT NULL,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  direccion_ip inet,
  agente_usuario text,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.datos_personales_privados (
  perfil_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  cedula text,
  direccion text,
  fecha_nacimiento date,
  redes_sociales jsonb NOT NULL DEFAULT '{}'::jsonb,
  documento_verificado boolean NOT NULL DEFAULT false,
  verificado_por uuid REFERENCES public.perfiles(id),
  verificado_en timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT datos_personales_cedula_longitud CHECK (cedula IS NULL OR length(cedula) BETWEEN 6 AND 20)
);

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS biografia text;

CREATE OR REPLACE FUNCTION public.exigir_mfa_actual()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Completa la verificación MFA para continuar';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_solicitud_grupo(
  p_solicitud_id uuid,
  p_aprobar boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud public.solicitudes_grupo;
  v_grupo public.grupos;
  v_nombre text;
  v_posicion integer;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN RAISE EXCEPTION 'No tienes permiso para revisar solicitudes'; END IF;

  SELECT * INTO v_solicitud FROM public.solicitudes_grupo
  WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND OR v_solicitud.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue revisada o no existe';
  END IF;
  IF p_aprobar AND NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = v_solicitud.perfil_id AND lower(rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden pertenecer a un grupo'; END IF;
  IF NOT p_aprobar THEN
    UPDATE public.solicitudes_grupo
    SET estado = 'rechazada', revisada_en = now(), revisada_por = auth.uid()
    WHERE id = p_solicitud_id;
    RETURN;
  END IF;

  SELECT * INTO v_grupo FROM public.grupos
  WHERE id = v_solicitud.grupo_id FOR UPDATE;
  IF v_grupo.estado <> 'borrador' THEN RAISE EXCEPTION 'El grupo ya no admite integrantes'; END IF;
  IF (SELECT count(*) FROM public.participantes WHERE grupo_id = v_grupo.id) >= v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'El grupo ya completó sus cupos';
  END IF;
  SELECT coalesce(nullif(trim(concat_ws(' ', nombre, apellido)), ''), 'Socio')
  INTO v_nombre FROM public.perfiles WHERE id = v_solicitud.perfil_id;
  SELECT posiciones.slot INTO v_posicion
  FROM generate_series(1, v_grupo.numero_integrantes) AS posiciones(slot)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.participantes p
    WHERE p.grupo_id = v_grupo.id AND p.posicion = posiciones.slot
  )
  ORDER BY posiciones.slot LIMIT 1;
  IF v_posicion IS NULL THEN RAISE EXCEPTION 'No quedan posiciones libres'; END IF;
  INSERT INTO public.participantes (grupo_id, perfil_id, nombre, posicion, estado)
  VALUES (v_grupo.id, v_solicitud.perfil_id, v_nombre, v_posicion, 'pendiente');
  UPDATE public.solicitudes_grupo
  SET estado = 'aprobada', revisada_en = now(), revisada_por = auth.uid()
  WHERE id = p_solicitud_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_cuadro(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
  v_total integer;
  v_max_posicion integer;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN RAISE EXCEPTION 'Solo administración o tesorería puede aprobar el inicio'; END IF;
  SELECT * INTO v_grupo FROM public.grupos WHERE id = p_grupo_id FOR UPDATE;
  IF NOT FOUND OR v_grupo.estado <> 'borrador' THEN
    RAISE EXCEPTION 'El grupo no está disponible para iniciar';
  END IF;
  SELECT count(*), coalesce(max(posicion), 0) INTO v_total, v_max_posicion
  FROM public.participantes WHERE grupo_id = p_grupo_id;
  IF v_total <> v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'El grupo debe tener todos sus cupos aprobados antes del sorteo';
  END IF;
  WITH sorteo AS (
    SELECT id, row_number() OVER (ORDER BY gen_random_uuid()) AS nueva_posicion
    FROM public.participantes WHERE grupo_id = p_grupo_id
  )
  UPDATE public.participantes p
  SET posicion = v_max_posicion + v_grupo.numero_integrantes + sorteo.nueva_posicion
  FROM sorteo WHERE p.id = sorteo.id;
  WITH sorteo AS (
    SELECT id, row_number() OVER (ORDER BY posicion) AS nueva_posicion
    FROM public.participantes WHERE grupo_id = p_grupo_id
  )
  UPDATE public.participantes p
  SET posicion = sorteo.nueva_posicion
  FROM sorteo WHERE p.id = sorteo.id;
  UPDATE public.grupos
  SET estado = 'activo', fecha_inicio = now(), semana_actual = 1
  WHERE id = p_grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_grupo(
  p_nombre text,
  p_numero_integrantes integer,
  p_aporte numeric,
  p_aporte_periodicidad text
)
RETURNS public.grupos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_grupo public.grupos;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo un administrador puede crear grupos'; END IF;
  IF nullif(trim(p_nombre), '') IS NULL OR p_numero_integrantes IS NULL
    OR p_numero_integrantes NOT BETWEEN 2 AND 500
    OR p_aporte IS NULL OR p_aporte <= 0
    OR p_aporte_periodicidad IS NULL
    OR p_aporte_periodicidad NOT IN ('semanal', 'quincenal', 'mensual') THEN
    RAISE EXCEPTION 'Datos del grupo no válidos';
  END IF;
  INSERT INTO public.grupos (
    nombre, numero_integrantes, aporte_semanal, aporte_periodicidad, estado, semana_actual
  ) VALUES (
    trim(p_nombre), p_numero_integrantes, p_aporte, p_aporte_periodicidad, 'borrador', 0
  )
  RETURNING * INTO v_grupo;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (v_grupo.id, auth.uid(), 'grupo_creado',
    jsonb_build_object('capacidad', p_numero_integrantes, 'aporte', p_aporte,
      'periodicidad', p_aporte_periodicidad));
  RETURN v_grupo;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_documentos_pendientes_tesorero()
RETURNS TABLE (id uuid, nombre text, apellido text, telefono text, cedula text, direccion text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'tesorero'
  ) THEN RAISE EXCEPTION 'Solo tesorería puede revisar documentos'; END IF;
  RETURN QUERY
  SELECT p.id, p.nombre::text, p.apellido::text, p.telefono::text, d.cedula, d.direccion
  FROM public.perfiles p
  JOIN public.datos_personales_privados d ON d.perfil_id = p.id
  WHERE NOT d.documento_verificado
  ORDER BY p.apellido, p.nombre
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_auditoria_solicitud_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado IN ('aprobada', 'rechazada') THEN
    INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento, detalles)
    VALUES (NEW.grupo_id, NEW.revisada_por, NEW.perfil_id,
      CASE WHEN NEW.estado = 'aprobada' THEN 'socio_agregado_a_grupo' ELSE 'solicitud_grupo_rechazada' END,
      jsonb_build_object('solicitud_id', NEW.id, 'fecha_revision', NEW.revisada_en));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_grupo_auditoria ON public.solicitudes_grupo;
CREATE TRIGGER solicitudes_grupo_auditoria
AFTER UPDATE OF estado ON public.solicitudes_grupo
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_solicitud_grupo();

CREATE INDEX IF NOT EXISTS solicitudes_invitacion_estado_idx
  ON public.solicitudes_invitacion_grupo (estado, creada_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_grupo_fecha_idx
  ON public.auditoria_eventos (grupo_id, ocurrido_en DESC);

ALTER TABLE public.solicitudes_invitacion_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitudes_invitacion_grupo,
  public.invitaciones_grupo, public.auditoria_eventos FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.actualizar_configuracion_administrador(uuid, integer, numeric, numeric, integer, numeric, boolean);
CREATE FUNCTION public.actualizar_configuracion_administrador(
  p_grupo_id uuid,
  p_numero_integrantes integer,
  p_aporte numeric,
  p_aporte_periodicidad text,
  p_interes_prestamo numeric,
  p_max_cuotas_prestamo integer,
  p_monto_max_prestamo numeric,
  p_prestamos_solo_activo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
  v_total_participantes integer;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la configuración';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos WHERE id = p_grupo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El grupo no existe'; END IF;
  IF p_numero_integrantes IS NULL OR p_numero_integrantes < 2 OR p_numero_integrantes > 500 THEN
    RAISE EXCEPTION 'La capacidad debe estar entre 2 y 500 socios';
  END IF;
  IF p_aporte IS NULL OR p_aporte <= 0 THEN
    RAISE EXCEPTION 'El aporte debe ser mayor a cero';
  END IF;
  IF p_aporte_periodicidad NOT IN ('semanal', 'quincenal', 'mensual') THEN
    RAISE EXCEPTION 'La periodicidad del aporte no es válida';
  END IF;
  IF p_interes_prestamo IS NULL OR p_interes_prestamo < 0 OR p_interes_prestamo > 100 THEN
    RAISE EXCEPTION 'La tasa de interés debe estar entre 0 y 100';
  END IF;
  IF p_max_cuotas_prestamo IS NULL OR p_max_cuotas_prestamo < 1 OR p_max_cuotas_prestamo > 60 THEN
    RAISE EXCEPTION 'El máximo de cuotas debe estar entre 1 y 60';
  END IF;
  IF p_monto_max_prestamo IS NOT NULL AND p_monto_max_prestamo <= 0 THEN
    RAISE EXCEPTION 'El monto máximo debe ser mayor a cero';
  END IF;
  IF p_prestamos_solo_activo IS NULL THEN
    RAISE EXCEPTION 'La regla de préstamos activos es obligatoria';
  END IF;

  SELECT count(*) INTO v_total_participantes
  FROM public.participantes WHERE grupo_id = p_grupo_id;
  IF p_numero_integrantes < v_total_participantes THEN
    RAISE EXCEPTION 'La capacidad no puede ser menor al número de socios existentes';
  END IF;
  IF v_grupo.estado <> 'borrador' AND (
    p_numero_integrantes <> v_grupo.numero_integrantes
    OR p_aporte <> v_grupo.aporte_semanal
    OR p_aporte_periodicidad <> v_grupo.aporte_periodicidad
  ) THEN
    RAISE EXCEPTION 'La capacidad y el aporte solo se pueden cambiar antes de iniciar el cuadro';
  END IF;

  UPDATE public.grupos
  SET numero_integrantes = p_numero_integrantes,
      aporte_semanal = p_aporte,
      aporte_periodicidad = p_aporte_periodicidad,
      interes_prestamo = p_interes_prestamo,
      max_cuotas_prestamo = p_max_cuotas_prestamo,
      monto_max_prestamo = p_monto_max_prestamo,
      prestamos_solo_activo = p_prestamos_solo_activo
  WHERE id = p_grupo_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (p_grupo_id, auth.uid(), 'configuracion_grupo_actualizada',
    jsonb_build_object('capacidad', p_numero_integrantes, 'aporte', p_aporte,
      'periodicidad', p_aporte_periodicidad));

  RETURN jsonb_build_object(
    'grupo_id', p_grupo_id,
    'mensaje', 'Configuración del grupo guardada correctamente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, text, numeric, integer, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, text, numeric, integer, numeric, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_grupos_disponibles()
RETURNS TABLE (
  id uuid,
  nombre text,
  capacidad integer,
  integrantes integer,
  aporte numeric,
  periodicidad text,
  mi_estado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden consultar grupos disponibles';
  END IF;

  RETURN QUERY
  SELECT g.id, g.nombre::text, g.numero_integrantes,
    (SELECT count(*)::integer FROM public.participantes p WHERE p.grupo_id = g.id),
    g.aporte_semanal, g.aporte_periodicidad::text,
    CASE
      WHEN sg.estado = 'aprobada' THEN 'miembro'
      WHEN sg.estado = 'pendiente' THEN 'solicitud_aprobacion'
      WHEN si.estado IN ('pendiente', 'invitacion_enviada') THEN si.estado
      ELSE NULL
    END
  FROM public.grupos g
  LEFT JOIN public.solicitudes_invitacion_grupo si
    ON si.grupo_id = g.id AND si.perfil_id = auth.uid()
  LEFT JOIN public.solicitudes_grupo sg
    ON sg.grupo_id = g.id AND sg.perfil_id = auth.uid()
  WHERE g.estado = 'borrador'
    AND NOT EXISTS (
      SELECT 1 FROM public.participantes p
      WHERE p.grupo_id = g.id AND p.perfil_id = auth.uid()
    )
    AND (SELECT count(*) FROM public.participantes p WHERE p.grupo_id = g.id) < g.numero_integrantes
  ORDER BY g.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_invitacion_grupo(p_grupo_id uuid)
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
    RAISE EXCEPTION 'Solo los socios pueden solicitar una invitación';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.grupos g
    WHERE g.id = p_grupo_id AND g.estado = 'borrador'
      AND (SELECT count(*) FROM public.participantes p WHERE p.grupo_id = g.id) < g.numero_integrantes
  ) THEN
    RAISE EXCEPTION 'El grupo ya no tiene cupos disponibles';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.participantes
    WHERE grupo_id = p_grupo_id AND perfil_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.solicitudes_grupo
    WHERE grupo_id = p_grupo_id AND perfil_id = auth.uid() AND estado IN ('pendiente', 'aprobada')
  ) THEN
    RAISE EXCEPTION 'Ya perteneces al grupo o tienes una solicitud pendiente';
  END IF;

  INSERT INTO public.solicitudes_invitacion_grupo (grupo_id, perfil_id)
  VALUES (p_grupo_id, auth.uid())
  ON CONFLICT (grupo_id, perfil_id) DO UPDATE
  SET estado = 'pendiente', creada_en = now(), revisada_en = NULL, revisada_por = NULL
  WHERE public.solicitudes_invitacion_grupo.estado IN ('rechazada', 'aceptada')
  RETURNING id INTO v_solicitud_id;
  IF v_solicitud_id IS NULL THEN
    RAISE EXCEPTION 'Ya tienes una solicitud de invitación pendiente';
  END IF;

  INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente)
  SELECT perfil.id, 'Solicitud de invitación a grupo',
    (SELECT coalesce(nullif(trim(concat_ws(' ', nombre, apellido)), ''), 'Un socio')
      FROM public.perfiles WHERE id = auth.uid())
      || ' solicita una invitación para ' || g.nombre || '.',
    'info', '/grupo', 'Revisar solicitud',
    'invitacion-grupo:' || v_solicitud_id || ':pendiente'
  FROM public.perfiles perfil
  CROSS JOIN public.grupos g
  WHERE g.id = p_grupo_id AND lower(perfil.rol) = 'administrador'
  ON CONFLICT (usuario_id, fuente) DO NOTHING;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento, detalles)
  VALUES (p_grupo_id, auth.uid(), auth.uid(), 'solicitud_invitacion_creada',
    jsonb_build_object('solicitud_id', v_solicitud_id));

  RETURN v_solicitud_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_solicitudes_invitacion_admin()
RETURNS TABLE (
  id uuid,
  grupo_id uuid,
  grupo_nombre text,
  perfil_id uuid,
  nombre text,
  apellido text,
  creada_en timestamptz,
  estado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede revisar invitaciones';
  END IF;
  RETURN QUERY
  SELECT si.id, si.grupo_id, g.nombre::text, si.perfil_id,
    p.nombre::text, p.apellido::text, si.creada_en, si.estado::text
  FROM public.solicitudes_invitacion_grupo si
  JOIN public.grupos g ON g.id = si.grupo_id
  JOIN public.perfiles p ON p.id = si.perfil_id
  WHERE si.estado = 'pendiente'
  ORDER BY si.creada_en;
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_invitacion_grupo(
  p_solicitud_id uuid,
  p_token_hash text
)
RETURNS TABLE (perfil_id uuid, nombre text, grupo_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitud public.solicitudes_invitacion_grupo;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede enviar invitaciones';
  END IF;
  SELECT * INTO v_solicitud
  FROM public.solicitudes_invitacion_grupo
  WHERE id = p_solicitud_id AND estado = 'pendiente'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya fue revisada o no existe'; END IF;
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
    RAISE EXCEPTION 'El token de invitación no es válido';
  END IF;

  DELETE FROM public.invitaciones_grupo WHERE solicitud_id = p_solicitud_id;
  INSERT INTO public.invitaciones_grupo (solicitud_id, token_hash)
  VALUES (p_solicitud_id, p_token_hash);
  UPDATE public.solicitudes_invitacion_grupo
  SET estado = 'invitacion_enviada', revisada_en = now(), revisada_por = auth.uid()
  WHERE id = p_solicitud_id;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento)
  VALUES (v_solicitud.grupo_id, auth.uid(), v_solicitud.perfil_id, 'invitacion_grupo_enviada');

  RETURN QUERY
  SELECT v_solicitud.perfil_id,
    coalesce(nullif(trim(concat_ws(' ', p.nombre, p.apellido)), ''), 'Socio')::text,
    g.nombre::text
  FROM public.perfiles p
  CROSS JOIN public.grupos g
  WHERE p.id = v_solicitud.perfil_id AND g.id = v_solicitud.grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revertir_invitacion_grupo(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo un administrador puede revertir invitaciones'; END IF;
  DELETE FROM public.invitaciones_grupo i
  USING public.solicitudes_invitacion_grupo s
  WHERE i.solicitud_id = s.id AND s.id = p_solicitud_id AND s.estado = 'invitacion_enviada';
  UPDATE public.solicitudes_invitacion_grupo
  SET estado = 'pendiente', revisada_en = NULL, revisada_por = NULL
  WHERE id = p_solicitud_id AND estado = 'invitacion_enviada';
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_invitacion_grupo(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_solicitud public.solicitudes_invitacion_grupo;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo un administrador puede rechazar solicitudes'; END IF;
  UPDATE public.solicitudes_invitacion_grupo
  SET estado = 'rechazada', revisada_en = now(), revisada_por = auth.uid()
  WHERE id = p_solicitud_id AND estado = 'pendiente'
  RETURNING * INTO v_solicitud;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya fue revisada'; END IF;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento)
  VALUES (v_solicitud.grupo_id, auth.uid(), v_solicitud.perfil_id, 'solicitud_invitacion_rechazada');
END;
$$;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_grupo_backend(
  p_perfil_id uuid,
  p_token_hash text,
  p_direccion_ip inet,
  p_agente_usuario text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitacion public.invitaciones_grupo;
  v_solicitud public.solicitudes_invitacion_grupo;
  v_solicitud_grupo uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = p_perfil_id AND lower(rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo un socio puede aceptar una invitación'; END IF;
  SELECT i.* INTO v_invitacion
  FROM public.invitaciones_grupo i
  JOIN public.solicitudes_invitacion_grupo si ON si.id = i.solicitud_id
  WHERE i.token_hash = p_token_hash
    AND i.expira_en > now()
    AND i.aceptada_en IS NULL
    AND si.estado = 'invitacion_enviada'
    AND si.perfil_id = p_perfil_id
  FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'El enlace de invitación expiró o ya fue utilizado'; END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_invitacion_grupo
  WHERE id = v_invitacion.solicitud_id
  FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.participantes
    WHERE grupo_id = v_solicitud.grupo_id AND perfil_id = p_perfil_id
  ) THEN RAISE EXCEPTION 'Ya perteneces a este grupo'; END IF;

  INSERT INTO public.solicitudes_grupo (grupo_id, perfil_id)
  VALUES (v_solicitud.grupo_id, p_perfil_id)
  ON CONFLICT (grupo_id, perfil_id) DO UPDATE
    SET estado = 'pendiente', creada_en = now(), revisada_en = NULL, revisada_por = NULL
  WHERE public.solicitudes_grupo.estado = 'rechazada'
  RETURNING id INTO v_solicitud_grupo;
  IF v_solicitud_grupo IS NULL THEN
    RAISE EXCEPTION 'Ya hay una solicitud de ingreso pendiente o aprobada';
  END IF;

  UPDATE public.invitaciones_grupo SET aceptada_en = now() WHERE id = v_invitacion.id;
  UPDATE public.solicitudes_invitacion_grupo
  SET estado = 'aceptada', revisada_en = now()
  WHERE id = v_solicitud.id;
  INSERT INTO public.auditoria_eventos (
    grupo_id, actor_id, objetivo_id, evento, direccion_ip, agente_usuario, detalles
  ) VALUES (
    v_solicitud.grupo_id, p_perfil_id, p_perfil_id, 'invitacion_grupo_aceptada',
    p_direccion_ip, left(p_agente_usuario, 500),
    jsonb_build_object('aceptada_en', now())
  );
  RETURN v_solicitud_grupo;
END;
$$;

REVOKE ALL ON FUNCTION public.aceptar_invitacion_grupo_backend(uuid, text, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_grupo_backend(uuid, text, inet, text) TO service_role;

CREATE OR REPLACE FUNCTION public.buscar_perfiles_administrador(p_busqueda text)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  rol text,
  cedula text,
  direccion text,
  fecha_nacimiento date,
  documento_verificado boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo el administrador puede consultar el registro'; END IF;
  IF length(trim(coalesce(p_busqueda, ''))) < 2 THEN
    RAISE EXCEPTION 'Ingresa al menos dos caracteres para buscar';
  END IF;
  RETURN QUERY
  SELECT p.id, p.nombre::text, p.apellido::text, p.telefono::text, p.rol::text,
    d.cedula::text, d.direccion::text, d.fecha_nacimiento,
    coalesce(d.documento_verificado, false)
  FROM public.perfiles p
  LEFT JOIN public.datos_personales_privados d ON d.perfil_id = p.id
  WHERE p.nombre ILIKE '%' || trim(p_busqueda) || '%'
     OR p.apellido ILIKE '%' || trim(p_busqueda) || '%'
     OR p.telefono ILIKE '%' || trim(p_busqueda) || '%'
     OR d.cedula ILIKE '%' || trim(p_busqueda) || '%'
  ORDER BY p.apellido, p.nombre
  LIMIT 50;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read ON storage.objects
FOR SELECT USING (bucket_id = 'profile-avatars');
DROP POLICY IF EXISTS profile_avatars_owner_insert ON storage.objects;
CREATE POLICY profile_avatars_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS profile_avatars_owner_update ON storage.objects;
CREATE POLICY profile_avatars_owner_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS profile_avatars_owner_delete ON storage.objects;
CREATE POLICY profile_avatars_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.datos_personales_privados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.datos_personales_privados FROM anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS datos_personales_cedula_unique
  ON public.datos_personales_privados (lower(trim(cedula)))
  WHERE cedula IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guardar_datos_personales(
  p_cedula text,
  p_direccion text,
  p_fecha_nacimiento date,
  p_redes_sociales jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  IF nullif(trim(p_cedula), '') IS NULL THEN RAISE EXCEPTION 'El documento de identidad es obligatorio'; END IF;
  IF p_cedula IS NOT NULL AND length(trim(p_cedula)) NOT BETWEEN 6 AND 20 THEN
    RAISE EXCEPTION 'El documento debe tener entre 6 y 20 caracteres';
  END IF;
  IF p_fecha_nacimiento IS NOT NULL AND p_fecha_nacimiento > current_date THEN
    RAISE EXCEPTION 'La fecha de nacimiento no puede estar en el futuro';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.datos_personales_privados
    WHERE perfil_id = auth.uid()
      AND documento_verificado
      AND cedula IS DISTINCT FROM nullif(trim(p_cedula), '')
  ) THEN
    RAISE EXCEPTION 'No puedes cambiar un documento que ya fue verificado';
  END IF;
  INSERT INTO public.datos_personales_privados (
    perfil_id, cedula, direccion, fecha_nacimiento, redes_sociales, actualizado_en
  ) VALUES (
    auth.uid(), nullif(trim(p_cedula), ''), nullif(trim(p_direccion), ''),
    p_fecha_nacimiento, coalesce(p_redes_sociales, '{}'::jsonb), now()
  )
  ON CONFLICT (perfil_id) DO UPDATE SET
    cedula = excluded.cedula,
    direccion = excluded.direccion,
    fecha_nacimiento = excluded.fecha_nacimiento,
    redes_sociales = excluded.redes_sociales,
    actualizado_en = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_perfil_completo(
  p_nombre text,
  p_apellido text,
  p_telefono text,
  p_avatar_url text,
  p_biografia text,
  p_cedula text,
  p_direccion text,
  p_fecha_nacimiento date,
  p_redes_sociales jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.actualizar_perfil_propio(
    p_nombre, p_apellido, p_telefono, p_avatar_url, p_biografia
  );
  PERFORM public.guardar_datos_personales(
    p_cedula, p_direccion, p_fecha_nacimiento, p_redes_sociales
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_datos_personales(p_perfil_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  cedula text,
  direccion text,
  fecha_nacimiento date,
  redes_sociales jsonb,
  documento_verificado boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR (
    p_perfil_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
    )
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar estos datos personales'; END IF;
  RETURN QUERY
  SELECT d.cedula, d.direccion, d.fecha_nacimiento, d.redes_sociales, d.documento_verificado
  FROM public.datos_personales_privados d
  WHERE d.perfil_id = p_perfil_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_perfil_propio(
  p_nombre text,
  p_apellido text,
  p_telefono text,
  p_avatar_url text,
  p_biografia text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  IF nullif(trim(p_nombre), '') IS NULL THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;
  IF length(coalesce(p_biografia, '')) > 500 THEN RAISE EXCEPTION 'La biografía no puede superar 500 caracteres'; END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'La dirección del avatar no es válida';
  END IF;
  UPDATE public.perfiles
  SET nombre = trim(p_nombre),
      apellido = nullif(trim(p_apellido), ''),
      telefono = nullif(trim(p_telefono), ''),
      avatar_url = p_avatar_url,
      biografia = nullif(trim(p_biografia), '')
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'El perfil no existe'; END IF;
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
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'tesorero'
  ) THEN RAISE EXCEPTION 'Solo tesorería puede registrar la verificación documental'; END IF;
  IF p_perfil_id = auth.uid() THEN RAISE EXCEPTION 'No puedes verificar tu propio documento'; END IF;
  UPDATE public.datos_personales_privados
  SET documento_verificado = true, verificado_por = auth.uid(), verificado_en = now()
  WHERE perfil_id = p_perfil_id AND cedula IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'El socio no tiene un documento registrado'; END IF;
  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento)
  VALUES (auth.uid(), p_perfil_id, 'documento_personal_verificado');
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_rol_perfil_administrador(
  p_perfil_id uuid,
  p_nuevo_rol text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rol_anterior text;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN RAISE EXCEPTION 'Solo un administrador puede cambiar roles'; END IF;
  IF p_nuevo_rol NOT IN ('socio', 'tesorero', 'auditor', 'administrador') THEN
    RAISE EXCEPTION 'El rol solicitado no es válido';
  END IF;
  IF p_nuevo_rol <> 'socio' AND NOT EXISTS (
    SELECT 1 FROM public.datos_personales_privados
    WHERE perfil_id = p_perfil_id AND documento_verificado
  ) THEN
    RAISE EXCEPTION 'Tesorería debe verificar el documento antes de asignar un rol elevado';
  END IF;
  SELECT rol INTO v_rol_anterior FROM public.perfiles WHERE id = p_perfil_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El perfil no existe'; END IF;
  IF p_perfil_id = auth.uid() AND p_nuevo_rol <> v_rol_anterior THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;
  UPDATE public.perfiles SET rol = p_nuevo_rol WHERE id = p_perfil_id;
  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (auth.uid(), p_perfil_id, 'rol_perfil_actualizado',
    jsonb_build_object('rol_anterior', v_rol_anterior, 'rol_nuevo', p_nuevo_rol));
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_auditoria_administrador(
  p_grupo_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT NULL,
  p_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  grupo_nombre text,
  evento text,
  actor text,
  objetivo text,
  ocurrido_en timestamptz,
  direccion_ip text,
  agente_usuario text,
  detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'auditor')
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar auditoría'; END IF;
  RETURN QUERY
  SELECT a.id, coalesce(g.nombre, a.detalles ->> 'grupo_nombre')::text, a.evento,
    coalesce(nullif(trim(concat_ws(' ', actor.nombre, actor.apellido)), ''), 'Sistema')::text,
    nullif(trim(concat_ws(' ', objetivo.nombre, objetivo.apellido)), '')::text,
    a.ocurrido_en, host(a.direccion_ip)::text, a.agente_usuario, a.detalles
  FROM public.auditoria_eventos a
  LEFT JOIN public.grupos g ON g.id = a.grupo_id
  LEFT JOIN public.perfiles actor ON actor.id = a.actor_id
  LEFT JOIN public.perfiles objetivo ON objetivo.id = a.objetivo_id
  WHERE (p_grupo_id IS NULL OR a.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR a.ocurrido_en >= p_desde)
    AND (p_hasta IS NULL OR a.ocurrido_en < p_hasta)
  ORDER BY a.ocurrido_en DESC
  LIMIT 5000;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_auditoria_inicio_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'activo' THEN
    INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
    VALUES (NEW.id, auth.uid(), 'grupo_iniciado',
      jsonb_build_object('integrantes', NEW.numero_integrantes, 'fecha', now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupos_auditoria_inicio ON public.grupos;
CREATE TRIGGER grupos_auditoria_inicio
AFTER UPDATE OF estado ON public.grupos
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_inicio_grupo();

REVOKE ALL ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, text, numeric, integer, numeric, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exigir_mfa_actual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_grupo(text, integer, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_grupos_disponibles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitar_invitacion_grupo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitar_union_grupo(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_solicitudes_invitacion_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preparar_invitacion_grupo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revertir_invitacion_grupo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_invitacion_grupo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_perfiles_administrador(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardar_datos_personales(text, text, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_datos_personales(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_perfil_propio(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardar_perfil_completo(text, text, text, text, text, text, text, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verificar_documento_tesorero(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_documentos_pendientes_tesorero() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cambiar_rol_perfil_administrador(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_auditoria_administrador(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, text, numeric, integer, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_grupo(text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_grupos_disponibles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_invitacion_grupo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_invitacion_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_invitacion_grupo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_invitacion_grupo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_invitacion_grupo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_perfiles_administrador(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_datos_personales(text, text, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_datos_personales(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_perfil_propio(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_perfil_completo(text, text, text, text, text, text, text, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_documento_tesorero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_documentos_pendientes_tesorero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_perfil_administrador(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_auditoria_administrador(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.eliminar_grupo(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar grupos';
  END IF;

  SELECT * INTO v_grupo
  FROM public.grupos
  WHERE id = p_grupo_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El grupo no existe'; END IF;

  IF EXISTS (SELECT 1 FROM public.aportes WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.entregas WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.prestamos WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.movimientos_fondo WHERE grupo_id = p_grupo_id) THEN
    RAISE EXCEPTION 'No se puede eliminar un grupo que ya tiene movimientos financieros';
  END IF;

  UPDATE public.auditoria_eventos
  SET detalles = detalles || jsonb_build_object(
    'grupo_id_original', p_grupo_id,
    'grupo_nombre', v_grupo.nombre
  )
  WHERE grupo_id = p_grupo_id;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (p_grupo_id, auth.uid(), 'grupo_eliminado',
    jsonb_build_object('grupo_id_original', p_grupo_id,
      'grupo_nombre', v_grupo.nombre, 'estado', v_grupo.estado));
  DELETE FROM public.participantes WHERE grupo_id = p_grupo_id;
  DELETE FROM public.grupos WHERE id = p_grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.exigir_mfa_escritura_sensible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.exigir_mfa_actual();
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.exigir_mfa_escritura_sensible() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eliminar_grupo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_grupo(uuid) TO authenticated;

DROP TRIGGER IF EXISTS grupos_exigir_mfa_escritura ON public.grupos;
CREATE TRIGGER grupos_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.grupos
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS participantes_exigir_mfa_escritura ON public.participantes;
CREATE TRIGGER participantes_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.participantes
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS aportes_exigir_mfa_escritura ON public.aportes;
CREATE TRIGGER aportes_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.aportes
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS entregas_exigir_mfa_escritura ON public.entregas;
CREATE TRIGGER entregas_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.entregas
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS prestamos_exigir_mfa_escritura ON public.prestamos;
CREATE TRIGGER prestamos_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.prestamos
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS cuotas_prestamo_exigir_mfa_escritura ON public.cuotas_prestamo;
CREATE TRIGGER cuotas_prestamo_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.cuotas_prestamo
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

DROP TRIGGER IF EXISTS movimientos_fondo_exigir_mfa_escritura ON public.movimientos_fondo;
CREATE TRIGGER movimientos_fondo_exigir_mfa_escritura
BEFORE INSERT OR UPDATE OR DELETE ON public.movimientos_fondo
FOR EACH ROW EXECUTE FUNCTION public.exigir_mfa_escritura_sensible();

NOTIFY pgrst, 'reload schema';
