-- Amplía el seguimiento de auditoría con plazos, evidencia privada e informes.
ALTER TABLE public.auditoria_revisiones
  ADD COLUMN IF NOT EXISTS fecha_limite date,
  ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conclusion text NOT NULL DEFAULT '';

ALTER TABLE public.auditoria_hallazgos
  ADD COLUMN IF NOT EXISTS fecha_limite date,
  ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.auditoria_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES public.auditoria_revisiones(id) ON DELETE CASCADE,
  hallazgo_id uuid REFERENCES public.auditoria_hallazgos(id) ON DELETE CASCADE,
  ruta text NOT NULL UNIQUE,
  nombre_archivo text NOT NULL CHECK (length(trim(nombre_archivo)) BETWEEN 1 AND 180),
  tipo_contenido text NOT NULL CHECK (
    tipo_contenido IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 10485760),
  creado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  creada_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_evidencias_ubicacion_unica
    CHECK ((revision_id IS NOT NULL) <> (hallazgo_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS auditoria_evidencias_revision_fecha_idx
  ON public.auditoria_evidencias (revision_id, creada_en DESC)
  WHERE revision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS auditoria_evidencias_hallazgo_fecha_idx
  ON public.auditoria_evidencias (hallazgo_id, creada_en DESC)
  WHERE hallazgo_id IS NOT NULL;

ALTER TABLE public.auditoria_evidencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_evidencias FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'auditoria-evidencias',
  'auditoria-evidencias',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.auditoria_evidencia_carga_permitida(p_ruta text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $$
DECLARE
  v_partes text[];
  v_objetivo uuid;
BEGIN
  IF auth.uid() IS NULL
    OR coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor'
    OR p_ruta IS NULL
    OR p_ruta !~ '^(revision|hallazgo)/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,180}$' THEN
    RETURN false;
  END IF;

  v_partes := storage.foldername(p_ruta);
  v_objetivo := v_partes[2]::uuid;
  IF v_partes[1] = 'revision' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.auditoria_revisiones AS revision
      WHERE revision.id = v_objetivo
    );
  END IF;
  IF v_partes[1] = 'hallazgo' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.auditoria_hallazgos AS hallazgo
      WHERE hallazgo.id = v_objetivo
    );
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_evidencia_lectura_permitida(p_ruta text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.seguridad_perfil_activo()
    AND public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
    AND EXISTS (
      SELECT 1 FROM public.auditoria_evidencias AS evidencia
      WHERE evidencia.ruta = p_ruta
    )
$$;

CREATE OR REPLACE FUNCTION public.auditoria_evidencia_huerfana_permitida(p_ruta text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.auditoria_evidencia_carga_permitida(p_ruta)
    AND NOT EXISTS (
      SELECT 1 FROM public.auditoria_evidencias AS evidencia
      WHERE evidencia.ruta = p_ruta
    )
$$;

REVOKE ALL ON FUNCTION public.auditoria_evidencia_carga_permitida(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_evidencia_lectura_permitida(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_evidencia_huerfana_permitida(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_evidencia_carga_permitida(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_evidencia_lectura_permitida(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_evidencia_huerfana_permitida(text) TO authenticated;

DROP POLICY IF EXISTS auditoria_evidencias_private_read ON storage.objects;
CREATE POLICY auditoria_evidencias_private_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'auditoria-evidencias'
  AND public.auditoria_evidencia_lectura_permitida(name)
);

DROP POLICY IF EXISTS auditoria_evidencias_auditor_upload ON storage.objects;
CREATE POLICY auditoria_evidencias_auditor_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'auditoria-evidencias'
  AND public.auditoria_evidencia_carga_permitida(name)
);

DROP POLICY IF EXISTS auditoria_evidencias_auditor_cleanup ON storage.objects;
CREATE POLICY auditoria_evidencias_auditor_cleanup
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'auditoria-evidencias'
  AND public.auditoria_evidencia_huerfana_permitida(name)
);

CREATE OR REPLACE FUNCTION public.auditoria_listar_responsables()
RETURNS TABLE (
  perfil_id uuid,
  nombre text,
  rol text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar responsables';
  END IF;

  RETURN QUERY
  SELECT perfil.id,
    coalesce(nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''), 'Personal autorizado')::text,
    lower(perfil.rol)::text
  FROM public.perfiles AS perfil
  WHERE coalesce(perfil.activo, false)
    AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
  ORDER BY lower(perfil.rol), perfil.nombre, perfil.apellido;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_revisiones_v2()
RETURNS TABLE (
  id uuid,
  grupo_id uuid,
  grupo_nombre text,
  periodo_desde date,
  periodo_hasta date,
  estado text,
  notas text,
  actualizada_en timestamptz,
  completada_en timestamptz,
  fecha_limite date,
  responsable_id uuid,
  responsable_nombre text,
  conclusion text,
  evidencias jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar las revisiones';
  END IF;

  RETURN QUERY
  SELECT revision.id, revision.grupo_id, grupo.nombre::text,
    revision.periodo_desde, revision.periodo_hasta, revision.estado,
    revision.notas, revision.actualizada_en, revision.completada_en,
    revision.fecha_limite, revision.responsable_id,
    nullif(trim(concat_ws(' ', responsable.nombre, responsable.apellido)), '')::text,
    revision.conclusion,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', evidencia.id,
        'ruta', evidencia.ruta,
        'nombre_archivo', evidencia.nombre_archivo,
        'tipo_contenido', evidencia.tipo_contenido,
        'bytes', evidencia.bytes,
        'creada_en', evidencia.creada_en
      ) ORDER BY evidencia.creada_en DESC)
      FROM public.auditoria_evidencias AS evidencia
      WHERE evidencia.revision_id = revision.id
    ), '[]'::jsonb)
  FROM public.auditoria_revisiones AS revision
  JOIN public.grupos AS grupo ON grupo.id = revision.grupo_id
  LEFT JOIN public.perfiles AS responsable ON responsable.id = revision.responsable_id
  ORDER BY revision.actualizada_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_guardar_revision_v2(
  p_grupo_id uuid,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_estado text,
  p_notas text,
  p_fecha_limite date,
  p_responsable_id uuid,
  p_conclusion text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede actualizar su plan de revisiones';
  END IF;
  IF p_grupo_id IS NULL OR p_periodo_desde IS NULL OR p_periodo_hasta IS NULL
    OR p_periodo_hasta < p_periodo_desde
    OR p_estado IS NULL OR p_estado NOT IN ('pendiente', 'en_revision', 'completada')
    OR length(coalesce(p_notas, '')) > 4000
    OR length(coalesce(p_conclusion, '')) > 4000
    OR (p_estado = 'completada' AND length(trim(coalesce(p_conclusion, ''))) < 3) THEN
    RAISE EXCEPTION 'Los datos de la revisión no son válidos';
  END IF;
  IF p_responsable_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = p_responsable_id
      AND coalesce(perfil.activo, false)
      AND lower(coalesce(perfil.rol, '')) = 'auditor'
  ) THEN
    RAISE EXCEPTION 'El responsable debe ser un auditor activo';
  END IF;

  INSERT INTO public.auditoria_revisiones AS revision_actual (
    grupo_id, periodo_desde, periodo_hasta, estado, notas, fecha_limite,
    responsable_id, conclusion, iniciada_por, actualizada_por, completada_en
  )
  VALUES (
    p_grupo_id, p_periodo_desde, p_periodo_hasta, p_estado, coalesce(p_notas, ''),
    p_fecha_limite, p_responsable_id, coalesce(p_conclusion, ''),
    auth.uid(), auth.uid(), CASE WHEN p_estado = 'completada' THEN now() ELSE NULL END
  )
  ON CONFLICT (grupo_id, periodo_desde, periodo_hasta) DO UPDATE SET
    estado = excluded.estado,
    notas = excluded.notas,
    fecha_limite = excluded.fecha_limite,
    responsable_id = excluded.responsable_id,
    conclusion = excluded.conclusion,
    actualizada_por = auth.uid(),
    actualizada_en = now(),
    completada_en = CASE
      WHEN excluded.estado = 'completada'
        THEN coalesce(revision_actual.completada_en, now())
      ELSE NULL
    END
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_revision_actualizada',
    jsonb_build_object(
      'revision_id', v_id, 'periodo_desde', p_periodo_desde,
      'periodo_hasta', p_periodo_hasta, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_hallazgos_v2(p_grupo_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  grupo_id uuid,
  grupo_nombre text,
  titulo text,
  descripcion text,
  evidencia text,
  severidad text,
  estado text,
  respuesta text,
  creado_por_nombre text,
  creado_en timestamptz,
  actualizado_en timestamptz,
  respondido_en timestamptz,
  respuestas jsonb,
  fecha_limite date,
  responsable_id uuid,
  responsable_nombre text,
  responsable_rol text,
  evidencias jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar hallazgos';
  END IF;

  RETURN QUERY
  SELECT hallazgo.id, hallazgo.grupo_id, grupo.nombre::text, hallazgo.titulo,
    hallazgo.descripcion, hallazgo.evidencia, hallazgo.severidad, hallazgo.estado,
    hallazgo.respuesta,
    coalesce(nullif(trim(concat_ws(' ', autor.nombre, autor.apellido)), ''), 'Auditor')::text,
    hallazgo.creado_en, hallazgo.actualizado_en, hallazgo.respondido_en,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'respuesta', respuesta.respuesta,
        'autor', coalesce(nullif(trim(concat_ws(' ', perfil_respuesta.nombre, perfil_respuesta.apellido)), ''), 'Personal autorizado'),
        'creada_en', respuesta.creada_en
      ) ORDER BY respuesta.creada_en)
      FROM public.auditoria_hallazgo_respuestas AS respuesta
      LEFT JOIN public.perfiles AS perfil_respuesta ON perfil_respuesta.id = respuesta.respondido_por
      WHERE respuesta.hallazgo_id = hallazgo.id
    ), '[]'::jsonb),
    hallazgo.fecha_limite, hallazgo.responsable_id,
    nullif(trim(concat_ws(' ', responsable.nombre, responsable.apellido)), '')::text,
    lower(responsable.rol)::text,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', evidencia.id,
        'ruta', evidencia.ruta,
        'nombre_archivo', evidencia.nombre_archivo,
        'tipo_contenido', evidencia.tipo_contenido,
        'bytes', evidencia.bytes,
        'creada_en', evidencia.creada_en
      ) ORDER BY evidencia.creada_en DESC)
      FROM public.auditoria_evidencias AS evidencia
      WHERE evidencia.hallazgo_id = hallazgo.id
    ), '[]'::jsonb)
  FROM public.auditoria_hallazgos AS hallazgo
  JOIN public.grupos AS grupo ON grupo.id = hallazgo.grupo_id
  LEFT JOIN public.perfiles AS autor ON autor.id = hallazgo.creado_por
  LEFT JOIN public.perfiles AS responsable ON responsable.id = hallazgo.responsable_id
  WHERE p_grupo_id IS NULL OR hallazgo.grupo_id = p_grupo_id
  ORDER BY CASE hallazgo.severidad
      WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
    hallazgo.creado_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_crear_hallazgo_v2(
  p_grupo_id uuid,
  p_titulo text,
  p_descripcion text,
  p_evidencia text,
  p_severidad text,
  p_estado text,
  p_fecha_limite date,
  p_responsable_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede registrar hallazgos';
  END IF;
  IF p_grupo_id IS NULL OR length(trim(coalesce(p_titulo, ''))) NOT BETWEEN 3 AND 160
    OR length(trim(coalesce(p_descripcion, ''))) NOT BETWEEN 3 AND 4000
    OR length(coalesce(p_evidencia, '')) > 2000
    OR p_severidad IS NULL OR p_severidad NOT IN ('baja', 'media', 'alta', 'critica')
    OR p_estado IS NULL OR p_estado NOT IN ('abierto', 'aclaracion_solicitada', 'en_seguimiento') THEN
    RAISE EXCEPTION 'Los datos del hallazgo no son válidos';
  END IF;
  IF p_responsable_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = p_responsable_id
      AND coalesce(perfil.activo, false)
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'El responsable debe ser administrador o tesorero activo';
  END IF;

  INSERT INTO public.auditoria_hallazgos (
    grupo_id, titulo, descripcion, evidencia, severidad, estado, fecha_limite,
    responsable_id, creado_por, actualizado_por
  )
  VALUES (
    p_grupo_id, trim(p_titulo), trim(p_descripcion), coalesce(p_evidencia, ''),
    p_severidad, p_estado, p_fecha_limite, p_responsable_id, auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_hallazgo_creado',
    jsonb_build_object(
      'hallazgo_id', v_id, 'severidad', p_severidad, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_actualizar_hallazgo_v2(
  p_hallazgo_id uuid,
  p_estado text,
  p_descripcion text,
  p_evidencia text,
  p_fecha_limite date,
  p_responsable_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede actualizar el seguimiento';
  END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('abierto', 'aclaracion_solicitada', 'en_seguimiento', 'cerrado')
    OR length(trim(coalesce(p_descripcion, ''))) NOT BETWEEN 3 AND 4000
    OR length(coalesce(p_evidencia, '')) > 2000 THEN
    RAISE EXCEPTION 'Los datos del seguimiento no son válidos';
  END IF;
  IF p_responsable_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = p_responsable_id
      AND coalesce(perfil.activo, false)
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'El responsable debe ser administrador o tesorero activo';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET estado = p_estado, descripcion = trim(p_descripcion),
      evidencia = coalesce(p_evidencia, ''), fecha_limite = p_fecha_limite,
      responsable_id = p_responsable_id, actualizado_por = auth.uid(),
      actualizado_en = now()
  WHERE id = p_hallazgo_id
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El hallazgo no existe'; END IF;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_hallazgo_actualizado',
    jsonb_build_object(
      'hallazgo_id', p_hallazgo_id, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_agregar_evidencia(
  p_revision_id uuid,
  p_hallazgo_id uuid,
  p_ruta text,
  p_nombre_archivo text,
  p_tipo_contenido text,
  p_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_grupo_id uuid;
  v_ubicacion text;
  v_object_bytes bigint;
  v_object_type text;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede adjuntar evidencia';
  END IF;
  IF (p_revision_id IS NOT NULL) = (p_hallazgo_id IS NOT NULL)
    OR p_ruta IS NULL
    OR length(trim(coalesce(p_nombre_archivo, ''))) NOT BETWEEN 1 AND 180
    OR p_tipo_contenido IS NULL OR p_tipo_contenido NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR p_bytes IS NULL OR p_bytes NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'Los datos de la evidencia no son válidos';
  END IF;

  IF p_revision_id IS NOT NULL THEN
    v_ubicacion := 'revision/' || p_revision_id::text || '/';
    SELECT revision.grupo_id INTO v_grupo_id
    FROM public.auditoria_revisiones AS revision
    WHERE revision.id = p_revision_id;
  ELSE
    v_ubicacion := 'hallazgo/' || p_hallazgo_id::text || '/';
    SELECT hallazgo.grupo_id INTO v_grupo_id
    FROM public.auditoria_hallazgos AS hallazgo
    WHERE hallazgo.id = p_hallazgo_id;
  END IF;
  IF v_grupo_id IS NULL OR left(p_ruta, length(v_ubicacion)) <> v_ubicacion
    OR NOT public.auditoria_evidencia_carga_permitida(p_ruta) THEN
    RAISE EXCEPTION 'La evidencia o su ubicación no son válidas';
  END IF;
  SELECT nullif(objeto.metadata ->> 'size', '')::bigint,
    objeto.metadata ->> 'mimetype'
  INTO v_object_bytes, v_object_type
  FROM storage.objects AS objeto
  WHERE objeto.bucket_id = 'auditoria-evidencias'
    AND objeto.name = p_ruta;
  IF NOT FOUND OR v_object_bytes IS DISTINCT FROM p_bytes
    OR v_object_type IS DISTINCT FROM p_tipo_contenido THEN
    RAISE EXCEPTION 'El archivo no coincide con los datos declarados';
  END IF;

  INSERT INTO public.auditoria_evidencias (
    revision_id, hallazgo_id, ruta, nombre_archivo, tipo_contenido, bytes, creado_por
  )
  VALUES (
    p_revision_id, p_hallazgo_id, p_ruta, trim(p_nombre_archivo),
    p_tipo_contenido, p_bytes, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_evidencia_agregada',
    jsonb_build_object(
      'evidencia_id', v_id, 'revision_id', p_revision_id, 'hallazgo_id', p_hallazgo_id
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_conciliaciones_fondo(p_grupo_id uuid)
RETURNS TABLE (
  movimiento_id text,
  conciliado_en timestamptz,
  observacion text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede consultar el estado de conciliación';
  END IF;
  IF p_grupo_id IS NULL THEN RAISE EXCEPTION 'El grupo es obligatorio'; END IF;

  RETURN QUERY
  SELECT conciliacion.movimiento_id, conciliacion.conciliado_en, conciliacion.observacion
  FROM public.conciliaciones_fondo AS conciliacion
  WHERE conciliacion.grupo_id = p_grupo_id
  ORDER BY conciliacion.conciliado_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_auditoria_paginada(
  p_grupo_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT NULL,
  p_hasta timestamptz DEFAULT NULL,
  p_evento text DEFAULT NULL,
  p_busqueda text DEFAULT NULL,
  p_antes_de timestamptz DEFAULT NULL,
  p_antes_id bigint DEFAULT NULL,
  p_limite integer DEFAULT 101
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar auditoría';
  END IF;
  IF p_limite NOT BETWEEN 1 AND 101
    OR (p_antes_de IS NULL) <> (p_antes_id IS NULL)
    OR length(coalesce(p_busqueda, '')) > 200 THEN
    RAISE EXCEPTION 'Los filtros de auditoría no son válidos';
  END IF;

  RETURN QUERY
  SELECT a.id, coalesce(g.nombre, a.detalles ->> 'grupo_nombre')::text, a.evento,
    coalesce(nullif(trim(concat_ws(' ', actor.nombre, actor.apellido)), ''), 'Sistema')::text,
    nullif(trim(concat_ws(' ', objetivo.nombre, objetivo.apellido)), '')::text,
    a.ocurrido_en, host(a.direccion_ip)::text, a.agente_usuario, a.detalles
  FROM public.auditoria_eventos AS a
  LEFT JOIN public.grupos AS g ON g.id = a.grupo_id
  LEFT JOIN public.perfiles AS actor ON actor.id = a.actor_id
  LEFT JOIN public.perfiles AS objetivo ON objetivo.id = a.objetivo_id
  WHERE (p_grupo_id IS NULL OR a.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR a.ocurrido_en >= p_desde)
    AND (p_hasta IS NULL OR a.ocurrido_en < p_hasta)
    AND (p_evento IS NULL OR a.evento = p_evento)
    AND (
      nullif(trim(p_busqueda), '') IS NULL
      OR concat_ws(' ', a.evento, actor.nombre, actor.apellido,
        objetivo.nombre, objetivo.apellido, g.nombre, a.detalles::text)
        ILIKE '%' || trim(p_busqueda) || '%'
    )
    AND (
      p_antes_de IS NULL
      OR (a.ocurrido_en, a.id) < (p_antes_de, p_antes_id)
    )
  ORDER BY a.ocurrido_en DESC, a.id DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_tipos_auditoria(
  p_grupo_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT NULL,
  p_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (evento text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar auditoría';
  END IF;
  RETURN QUERY
  SELECT DISTINCT a.evento::text
  FROM public.auditoria_eventos AS a
  WHERE (p_grupo_id IS NULL OR a.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR a.ocurrido_en >= p_desde)
    AND (p_hasta IS NULL OR a.ocurrido_en < p_hasta)
  ORDER BY a.evento::text;
END;
$$;

CREATE INDEX IF NOT EXISTS auditoria_eventos_ocurrido_id_idx
  ON public.auditoria_eventos (ocurrido_en DESC, id DESC);

CREATE OR REPLACE FUNCTION public.auditoria_actualizar_hallazgo(
  p_hallazgo_id uuid,
  p_estado text,
  p_descripcion text,
  p_evidencia text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo el auditor puede actualizar el seguimiento';
  END IF;
  IF p_estado IS NULL
    OR p_estado NOT IN ('abierto', 'aclaracion_solicitada', 'en_seguimiento', 'cerrado')
    OR length(trim(coalesce(p_descripcion, ''))) NOT BETWEEN 3 AND 4000
    OR length(coalesce(p_evidencia, '')) > 2000 THEN
    RAISE EXCEPTION 'Los datos del seguimiento no son válidos';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET estado = p_estado, descripcion = trim(p_descripcion),
      evidencia = coalesce(p_evidencia, ''), actualizado_por = auth.uid(),
      actualizado_en = now()
  WHERE id = p_hallazgo_id
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El hallazgo no existe'; END IF;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_hallazgo_actualizado',
    jsonb_build_object('hallazgo_id', p_hallazgo_id, 'estado', p_estado)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_responder_hallazgo(
  p_hallazgo_id uuid,
  p_respuesta text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero') THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede responder a solicitudes del auditor';
  END IF;
  IF length(trim(coalesce(p_respuesta, ''))) NOT BETWEEN 3 AND 4000 THEN
    RAISE EXCEPTION 'La respuesta debe tener entre 3 y 4.000 caracteres';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET respuesta = trim(p_respuesta), respondido_por = auth.uid(),
      respondido_en = now(), actualizado_en = now()
  WHERE id = p_hallazgo_id
    AND (responsable_id IS NULL OR responsable_id = auth.uid())
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El hallazgo no existe o está asignado a otra persona';
  END IF;

  INSERT INTO public.auditoria_hallazgo_respuestas (hallazgo_id, respuesta, respondido_por)
  VALUES (p_hallazgo_id, trim(p_respuesta), auth.uid());
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_hallazgo_respondido',
    jsonb_build_object('hallazgo_id', p_hallazgo_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_listar_responsables() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_revisiones_v2() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_guardar_revision_v2(uuid, date, date, text, text, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_hallazgos_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_crear_hallazgo_v2(uuid, text, text, text, text, text, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_actualizar_hallazgo_v2(uuid, text, text, text, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_agregar_evidencia(uuid, uuid, text, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_conciliaciones_fondo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_auditoria_paginada(uuid, timestamptz, timestamptz, text, text, timestamptz, bigint, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_tipos_auditoria(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_actualizar_hallazgo(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_responder_hallazgo(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auditoria_listar_responsables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_revisiones_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_guardar_revision_v2(uuid, date, date, text, text, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_hallazgos_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_crear_hallazgo_v2(uuid, text, text, text, text, text, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_actualizar_hallazgo_v2(uuid, text, text, text, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_agregar_evidencia(uuid, uuid, text, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_conciliaciones_fondo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_auditoria_paginada(uuid, timestamptz, timestamptz, text, text, timestamptz, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_tipos_auditoria(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_actualizar_hallazgo(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_responder_hallazgo(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
