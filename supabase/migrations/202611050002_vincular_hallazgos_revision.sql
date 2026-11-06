ALTER TABLE public.auditoria_hallazgos
  ADD COLUMN IF NOT EXISTS revision_id uuid
    REFERENCES public.auditoria_revisiones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS auditoria_hallazgos_revision_idx
  ON public.auditoria_hallazgos (revision_id, creado_en DESC)
  WHERE revision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auditoria_listar_hallazgos_v3(p_grupo_id uuid DEFAULT NULL)
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
  evidencias jsonb,
  revision_id uuid,
  revision_periodo_desde date,
  revision_periodo_hasta date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hallazgo.id, hallazgo.grupo_id, hallazgo.grupo_nombre,
    hallazgo.titulo, hallazgo.descripcion, hallazgo.evidencia,
    hallazgo.severidad, hallazgo.estado, hallazgo.respuesta,
    hallazgo.creado_por_nombre, hallazgo.creado_en, hallazgo.actualizado_en,
    hallazgo.respondido_en, hallazgo.respuestas, hallazgo.fecha_limite,
    hallazgo.responsable_id, hallazgo.responsable_nombre,
    hallazgo.responsable_rol, hallazgo.evidencias,
    registro.revision_id, revision.periodo_desde, revision.periodo_hasta
  FROM public.auditoria_listar_hallazgos_v2(p_grupo_id) AS hallazgo
  JOIN public.auditoria_hallazgos AS registro ON registro.id = hallazgo.id
  LEFT JOIN public.auditoria_revisiones AS revision ON revision.id = registro.revision_id
  ORDER BY CASE hallazgo.severidad
      WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
    hallazgo.creado_en DESC;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_crear_hallazgo_v3(
  p_grupo_id uuid,
  p_titulo text,
  p_descripcion text,
  p_evidencia text,
  p_severidad text,
  p_estado text,
  p_fecha_limite date,
  p_responsable_id uuid,
  p_revision_id uuid DEFAULT NULL
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
  IF p_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.auditoria_revisiones AS revision
    WHERE revision.id = p_revision_id AND revision.grupo_id = p_grupo_id
  ) THEN
    RAISE EXCEPTION 'La revisión debe pertenecer al mismo grupo del hallazgo';
  END IF;

  INSERT INTO public.auditoria_hallazgos (
    grupo_id, titulo, descripcion, evidencia, severidad, estado, fecha_limite,
    responsable_id, revision_id, creado_por, actualizado_por
  )
  VALUES (
    p_grupo_id, trim(p_titulo), trim(p_descripcion), coalesce(p_evidencia, ''),
    p_severidad, p_estado, p_fecha_limite, p_responsable_id, p_revision_id,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_hallazgo_creado',
    jsonb_build_object(
      'hallazgo_id', v_id, 'severidad', p_severidad, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id,
      'revision_id', p_revision_id
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_actualizar_hallazgo_v3(
  p_hallazgo_id uuid,
  p_estado text,
  p_descripcion text,
  p_evidencia text,
  p_fecha_limite date,
  p_responsable_id uuid,
  p_revision_id uuid
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

  SELECT hallazgo.grupo_id INTO v_grupo_id
  FROM public.auditoria_hallazgos AS hallazgo
  WHERE hallazgo.id = p_hallazgo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El hallazgo no existe'; END IF;
  IF p_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.auditoria_revisiones AS revision
    WHERE revision.id = p_revision_id AND revision.grupo_id = v_grupo_id
  ) THEN
    RAISE EXCEPTION 'La revisión debe pertenecer al mismo grupo del hallazgo';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET estado = p_estado, descripcion = trim(p_descripcion),
      evidencia = coalesce(p_evidencia, ''), fecha_limite = p_fecha_limite,
      responsable_id = p_responsable_id, revision_id = p_revision_id,
      actualizado_por = auth.uid(), actualizado_en = now()
  WHERE id = p_hallazgo_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_hallazgo_actualizado',
    jsonb_build_object(
      'hallazgo_id', p_hallazgo_id, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id,
      'revision_id', p_revision_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_listar_hallazgos_v3(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_crear_hallazgo_v3(uuid, text, text, text, text, text, date, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_actualizar_hallazgo_v3(uuid, text, text, text, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_hallazgos_v3(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_crear_hallazgo_v3(uuid, text, text, text, text, text, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_actualizar_hallazgo_v3(uuid, text, text, text, date, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
