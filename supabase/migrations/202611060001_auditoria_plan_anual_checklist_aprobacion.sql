ALTER TABLE public.auditoria_revisiones
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS informe_estado text NOT NULL DEFAULT 'borrador',
  ADD COLUMN IF NOT EXISTS informe_enviado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS informe_enviado_en timestamptz,
  ADD COLUMN IF NOT EXISTS informe_aprobado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS informe_aprobado_en timestamptz,
  ADD COLUMN IF NOT EXISTS informe_observaciones text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auditoria_revisiones_checklist_array'
      AND conrelid = 'public.auditoria_revisiones'::regclass
  ) THEN
    ALTER TABLE public.auditoria_revisiones
      ADD CONSTRAINT auditoria_revisiones_checklist_array
      CHECK (jsonb_typeof(checklist) = 'array');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auditoria_revisiones_informe_estado_valido'
      AND conrelid = 'public.auditoria_revisiones'::regclass
  ) THEN
    ALTER TABLE public.auditoria_revisiones
      ADD CONSTRAINT auditoria_revisiones_informe_estado_valido
      CHECK (informe_estado IN ('borrador', 'pendiente_aprobacion', 'devuelto', 'aprobado'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.auditoria_planes_anuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL CHECK (anio BETWEEN 2000 AND 2200),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  objetivo text NOT NULL CHECK (length(trim(objetivo)) BETWEEN 3 AND 500),
  alcance text NOT NULL CHECK (length(trim(alcance)) BETWEEN 3 AND 4000),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  responsable_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  revision_id uuid UNIQUE REFERENCES public.auditoria_revisiones(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'planificada'
    CHECK (estado IN ('planificada', 'en_curso', 'completada')),
  creado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_planes_anuales_fechas_validas CHECK (
    fecha_fin >= fecha_inicio
    AND extract(year FROM fecha_inicio) = anio
    AND extract(year FROM fecha_fin) = anio
  )
);

CREATE INDEX IF NOT EXISTS auditoria_planes_anuales_anio_idx
  ON public.auditoria_planes_anuales (anio, fecha_inicio, grupo_id);
ALTER TABLE public.auditoria_planes_anuales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_planes_anuales FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auditoria_listar_revisiones_v3()
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
  evidencias jsonb,
  checklist jsonb,
  informe_estado text,
  informe_enviado_en timestamptz,
  informe_aprobado_en timestamptz,
  informe_aprobado_por_nombre text,
  informe_observaciones text
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
    ), '[]'::jsonb),
    revision.checklist,
    revision.informe_estado,
    revision.informe_enviado_en,
    revision.informe_aprobado_en,
    nullif(trim(concat_ws(' ', aprobador.nombre, aprobador.apellido)), '')::text,
    revision.informe_observaciones
  FROM public.auditoria_revisiones AS revision
  JOIN public.grupos AS grupo ON grupo.id = revision.grupo_id
  LEFT JOIN public.perfiles AS responsable ON responsable.id = revision.responsable_id
  LEFT JOIN public.perfiles AS aprobador ON aprobador.id = revision.informe_aprobado_por
  ORDER BY revision.actualizada_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_guardar_revision_v3(
  p_grupo_id uuid,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_estado text,
  p_notas text,
  p_fecha_limite date,
  p_responsable_id uuid,
  p_conclusion text,
  p_checklist jsonb,
  p_plan_anual_id uuid DEFAULT NULL
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
    RAISE EXCEPTION 'Los datos de la revisión o su lista de verificación no son válidos';
  END IF;
  IF jsonb_typeof(coalesce(p_checklist, '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La lista de verificación no es válida';
  END IF;
  IF jsonb_array_length(coalesce(p_checklist, '[]'::jsonb)) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'La lista de verificación debe contener entre 1 y 40 puntos';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) AS checklist_item(value)
    WHERE length(trim(coalesce(checklist_item.value ->> 'texto', ''))) NOT BETWEEN 3 AND 300
      OR coalesce(checklist_item.value ->> 'estado', '') NOT IN ('pendiente', 'conforme', 'observacion', 'no_aplica')
      OR length(coalesce(checklist_item.value ->> 'notas', '')) > 1000
  ) OR (p_estado = 'completada' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_checklist, '[]'::jsonb)) AS checklist_item(value)
    WHERE checklist_item.value ->> 'estado' = 'pendiente'
  )) THEN
    RAISE EXCEPTION 'Completa los puntos de la lista de verificación antes de cerrar la revisión';
  END IF;
  IF p_responsable_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = p_responsable_id
      AND coalesce(perfil.activo, false)
      AND lower(coalesce(perfil.rol, '')) = 'auditor'
  ) THEN
    RAISE EXCEPTION 'El responsable debe ser un auditor activo';
  END IF;
  IF p_plan_anual_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.auditoria_planes_anuales AS plan
    WHERE plan.id = p_plan_anual_id
      AND plan.grupo_id = p_grupo_id
      AND plan.anio = extract(year FROM p_periodo_desde)
      AND extract(year FROM p_periodo_hasta) = plan.anio
  ) THEN
    RAISE EXCEPTION 'El plan anual no corresponde al grupo y período de revisión';
  END IF;

  INSERT INTO public.auditoria_revisiones AS revision_actual (
    grupo_id, periodo_desde, periodo_hasta, estado, notas, fecha_limite,
    responsable_id, conclusion, checklist, iniciada_por, actualizada_por, completada_en
  )
  VALUES (
    p_grupo_id, p_periodo_desde, p_periodo_hasta, p_estado, coalesce(p_notas, ''),
    p_fecha_limite, p_responsable_id, coalesce(p_conclusion, ''),
    coalesce(p_checklist, '[]'::jsonb),
    auth.uid(), auth.uid(), CASE WHEN p_estado = 'completada' THEN now() ELSE NULL END
  )
  ON CONFLICT (grupo_id, periodo_desde, periodo_hasta) DO UPDATE SET
    estado = excluded.estado,
    notas = excluded.notas,
    fecha_limite = excluded.fecha_limite,
    responsable_id = excluded.responsable_id,
    conclusion = excluded.conclusion,
    checklist = excluded.checklist,
    actualizada_por = auth.uid(),
    actualizada_en = now(),
    completada_en = CASE
      WHEN excluded.estado = 'completada'
        THEN coalesce(revision_actual.completada_en, now())
      ELSE NULL
    END,
    informe_estado = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN 'borrador'
      ELSE revision_actual.informe_estado
    END,
    informe_enviado_por = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN NULL
      ELSE revision_actual.informe_enviado_por
    END,
    informe_enviado_en = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN NULL
      ELSE revision_actual.informe_enviado_en
    END,
    informe_aprobado_por = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN NULL
      ELSE revision_actual.informe_aprobado_por
    END,
    informe_aprobado_en = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN NULL
      ELSE revision_actual.informe_aprobado_en
    END,
    informe_observaciones = CASE
      WHEN revision_actual.estado IS DISTINCT FROM excluded.estado
        OR revision_actual.notas IS DISTINCT FROM excluded.notas
        OR revision_actual.fecha_limite IS DISTINCT FROM excluded.fecha_limite
        OR revision_actual.responsable_id IS DISTINCT FROM excluded.responsable_id
        OR revision_actual.conclusion IS DISTINCT FROM excluded.conclusion
        OR revision_actual.checklist IS DISTINCT FROM excluded.checklist
        THEN ''
      ELSE revision_actual.informe_observaciones
    END
  RETURNING id INTO v_id;

  UPDATE public.auditoria_planes_anuales
  SET revision_id = NULL, estado = 'planificada', actualizada_en = now()
  WHERE revision_id = v_id
    AND (p_plan_anual_id IS NULL OR id <> p_plan_anual_id);

  IF p_plan_anual_id IS NOT NULL THEN
    UPDATE public.auditoria_planes_anuales
    SET revision_id = v_id,
        estado = CASE WHEN p_estado = 'completada' THEN 'completada' ELSE 'en_curso' END,
        actualizada_en = now()
    WHERE id = p_plan_anual_id AND (revision_id IS NULL OR revision_id = v_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El plan anual ya está vinculado a otra revisión';
    END IF;
  END IF;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_revision_actualizada',
    jsonb_build_object(
      'revision_id', v_id, 'periodo_desde', p_periodo_desde,
      'periodo_hasta', p_periodo_hasta, 'estado', p_estado,
      'fecha_limite', p_fecha_limite, 'responsable_id', p_responsable_id,
      'plan_anual_id', p_plan_anual_id
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_planes_anuales()
RETURNS TABLE (
  id uuid,
  anio integer,
  grupo_id uuid,
  grupo_nombre text,
  objetivo text,
  alcance text,
  fecha_inicio date,
  fecha_fin date,
  responsable_id uuid,
  responsable_nombre text,
  revision_id uuid,
  estado text
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
    RAISE EXCEPTION 'No tienes permiso para consultar el plan anual';
  END IF;
  RETURN QUERY
  SELECT plan.id, plan.anio, plan.grupo_id, grupo.nombre::text,
    plan.objetivo, plan.alcance, plan.fecha_inicio, plan.fecha_fin,
    plan.responsable_id,
    nullif(trim(concat_ws(' ', responsable.nombre, responsable.apellido)), '')::text,
    plan.revision_id, plan.estado
  FROM public.auditoria_planes_anuales AS plan
  JOIN public.grupos AS grupo ON grupo.id = plan.grupo_id
  LEFT JOIN public.perfiles AS responsable ON responsable.id = plan.responsable_id
  ORDER BY plan.anio DESC, plan.fecha_inicio, grupo.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_guardar_plan_anual(
  p_id uuid,
  p_anio integer,
  p_grupo_id uuid,
  p_objetivo text,
  p_alcance text,
  p_fecha_inicio date,
  p_fecha_fin date,
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
    RAISE EXCEPTION 'Solo auditoría puede modificar el plan anual';
  END IF;
  IF p_anio IS NULL OR p_anio NOT BETWEEN 2000 AND 2200
    OR p_grupo_id IS NULL
    OR length(trim(coalesce(p_objetivo, ''))) NOT BETWEEN 3 AND 500
    OR length(trim(coalesce(p_alcance, ''))) NOT BETWEEN 3 AND 4000
    OR p_fecha_inicio IS NULL OR p_fecha_fin IS NULL
    OR p_fecha_fin < p_fecha_inicio
    OR extract(year FROM p_fecha_inicio) <> p_anio
    OR extract(year FROM p_fecha_fin) <> p_anio
    OR p_responsable_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.perfiles AS perfil
      WHERE perfil.id = p_responsable_id
        AND coalesce(perfil.activo, false)
        AND lower(coalesce(perfil.rol, '')) = 'auditor'
    ) THEN
    RAISE EXCEPTION 'Los datos del plan anual no son válidos';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.auditoria_planes_anuales (
      anio, grupo_id, objetivo, alcance, fecha_inicio, fecha_fin,
      responsable_id, creado_por
    )
    VALUES (
      p_anio, p_grupo_id, trim(p_objetivo), trim(p_alcance),
      p_fecha_inicio, p_fecha_fin, p_responsable_id, auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.auditoria_planes_anuales
    SET anio = p_anio, grupo_id = p_grupo_id, objetivo = trim(p_objetivo),
        alcance = trim(p_alcance), fecha_inicio = p_fecha_inicio,
        fecha_fin = p_fecha_fin, responsable_id = p_responsable_id,
        actualizada_en = now()
    WHERE id = p_id
      AND revision_id IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'El plan no existe o ya tiene una revisión vinculada';
    END IF;
  END IF;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_plan_anual_actualizado',
    jsonb_build_object('plan_id', v_id, 'anio', p_anio, 'responsable_id', p_responsable_id)
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_enviar_informe_aprobacion(p_revision_id uuid)
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
    RAISE EXCEPTION 'Solo la auditora responsable puede enviar el informe';
  END IF;
  UPDATE public.auditoria_revisiones
  SET informe_estado = 'pendiente_aprobacion',
      informe_enviado_por = auth.uid(),
      informe_enviado_en = now(),
      informe_observaciones = '',
      actualizada_por = auth.uid(),
      actualizada_en = now()
  WHERE id = p_revision_id
    AND responsable_id = auth.uid()
    AND estado = 'completada'
    AND length(trim(conclusion)) >= 3
    AND jsonb_array_length(checklist) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(checklist) AS checklist_item(value)
      WHERE checklist_item.value ->> 'estado' = 'pendiente'
    )
    AND informe_estado IN ('borrador', 'devuelto')
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El informe no está completo o no eres su responsable';
  END IF;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (v_grupo_id, auth.uid(), 'auditoria_informe_enviado_aprobacion',
    jsonb_build_object('revision_id', p_revision_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_resolver_aprobacion_informe(
  p_revision_id uuid,
  p_aprobar boolean,
  p_observaciones text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
  v_estado text;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'administrador' THEN
    RAISE EXCEPTION 'Solo administración puede resolver la aprobación del informe';
  END IF;
  IF p_aprobar IS NULL OR length(coalesce(p_observaciones, '')) > 2000
    OR (NOT p_aprobar AND length(trim(coalesce(p_observaciones, ''))) < 3) THEN
    RAISE EXCEPTION 'Incluye observaciones para devolver el informe';
  END IF;
  v_estado := CASE WHEN p_aprobar THEN 'aprobado' ELSE 'devuelto' END;
  UPDATE public.auditoria_revisiones
  SET informe_estado = v_estado,
      informe_aprobado_por = CASE WHEN p_aprobar THEN auth.uid() ELSE NULL END,
      informe_aprobado_en = CASE WHEN p_aprobar THEN now() ELSE NULL END,
      informe_observaciones = trim(coalesce(p_observaciones, '')),
      actualizada_por = auth.uid(),
      actualizada_en = now()
  WHERE id = p_revision_id
    AND estado = 'completada'
    AND informe_estado = 'pendiente_aprobacion'
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El informe no está pendiente de aprobación';
  END IF;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (v_grupo_id, auth.uid(), 'auditoria_informe_aprobacion_resuelta',
    jsonb_build_object(
      'revision_id', p_revision_id, 'aprobado', p_aprobar,
      'observaciones', trim(coalesce(p_observaciones, ''))
    ));
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_listar_revisiones_v3() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_guardar_revision_v3(uuid, date, date, text, text, date, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_planes_anuales() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_guardar_plan_anual(uuid, integer, uuid, text, text, date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_enviar_informe_aprobacion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_resolver_aprobacion_informe(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_revisiones_v3() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_guardar_revision_v3(uuid, date, date, text, text, date, uuid, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_planes_anuales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_guardar_plan_anual(uuid, integer, uuid, text, text, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_enviar_informe_aprobacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_resolver_aprobacion_informe(uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
