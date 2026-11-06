ALTER TABLE public.auditoria_evidencias
  ADD COLUMN IF NOT EXISTS entrega_id uuid REFERENCES public.entregas(id) ON DELETE CASCADE;

ALTER TABLE public.auditoria_evidencias
  DROP CONSTRAINT IF EXISTS auditoria_evidencias_ubicacion_unica;
ALTER TABLE public.auditoria_evidencias
  ADD CONSTRAINT auditoria_evidencias_ubicacion_unica
  CHECK (num_nonnulls(revision_id, hallazgo_id, entrega_id) = 1);

CREATE INDEX IF NOT EXISTS auditoria_evidencias_entrega_fecha_idx
  ON public.auditoria_evidencias (entrega_id, creada_en DESC)
  WHERE entrega_id IS NOT NULL;

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
    OR p_ruta !~ '^(revision|hallazgo|entrega)/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,180}$' THEN
    RETURN false;
  END IF;

  v_partes := storage.foldername(p_ruta);
  v_objetivo := v_partes[2]::uuid;
  IF v_partes[1] = 'revision' THEN
    RETURN EXISTS (SELECT 1 FROM public.auditoria_revisiones WHERE id = v_objetivo);
  ELSIF v_partes[1] = 'hallazgo' THEN
    RETURN EXISTS (SELECT 1 FROM public.auditoria_hallazgos WHERE id = v_objetivo);
  ELSIF v_partes[1] = 'entrega' THEN
    RETURN EXISTS (SELECT 1 FROM public.entregas WHERE id = v_objetivo);
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_agregar_evidencia_entrega(
  p_entrega_id uuid,
  p_ruta text,
  p_nombre_archivo text,
  p_tipo_contenido text,
  p_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_grupo_id uuid;
  v_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'auditor' THEN
    RAISE EXCEPTION 'Solo auditoría puede adjuntar evidencia a una entrega';
  END IF;
  IF p_entrega_id IS NULL
    OR p_ruta !~ ('^entrega/' || p_entrega_id::text || '/[A-Za-z0-9._-]{1,180}$')
    OR length(trim(coalesce(p_nombre_archivo, ''))) NOT BETWEEN 1 AND 180
    OR p_tipo_contenido NOT IN ('application/pdf', 'image/jpeg', 'image/png')
    OR p_bytes NOT BETWEEN 1 AND 10485760
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects AS objeto
      WHERE objeto.bucket_id = 'auditoria-evidencias' AND objeto.name = p_ruta
    ) THEN
    RAISE EXCEPTION 'La evidencia o los datos de la entrega no son válidos';
  END IF;

  SELECT entrega.grupo_id INTO v_grupo_id
  FROM public.entregas AS entrega WHERE entrega.id = p_entrega_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La entrega no existe'; END IF;

  INSERT INTO public.auditoria_evidencias (
    entrega_id, ruta, nombre_archivo, tipo_contenido, bytes, creado_por
  ) VALUES (
    p_entrega_id, p_ruta, trim(p_nombre_archivo), p_tipo_contenido, p_bytes, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_evidencia_entrega_agregada',
    jsonb_build_object('entrega_id', p_entrega_id, 'evidencia_id', v_id)
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_entregas_ronda(
  p_grupo_id uuid DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE (
  entrega_id uuid,
  grupo_id uuid,
  grupo_nombre text,
  participante text,
  periodo integer,
  monto numeric,
  fecha_entrega date,
  socios_grupo bigint,
  aportes_ronda numeric,
  aportes_pagados_ronda bigint,
  diferencia_pozo numeric,
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
    RAISE EXCEPTION 'No tienes permiso para consultar las entregas del cuadro';
  END IF;
  IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta < p_desde THEN
    RAISE EXCEPTION 'El período de consulta no es válido';
  END IF;

  RETURN QUERY
  SELECT entrega.id, entrega.grupo_id, grupo.nombre::text, participante.nombre::text,
    entrega.semana, entrega.monto, entrega.fecha_entrega,
    coalesce(participantes.total, 0),
    coalesce(aportes.total, 0),
    coalesce(aportes.pagados, 0),
    coalesce(aportes.total, 0) - entrega.monto,
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
      WHERE evidencia.entrega_id = entrega.id
    ), '[]'::jsonb)
  FROM public.entregas AS entrega
  JOIN public.grupos AS grupo ON grupo.id = entrega.grupo_id
  JOIN public.participantes AS participante ON participante.id = entrega.participante_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS total
    FROM public.participantes AS miembro
    WHERE miembro.grupo_id = entrega.grupo_id
  ) AS participantes ON true
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT aporte.participante_id)::bigint AS pagados,
      coalesce(sum(aporte.monto), 0)::numeric AS total
    FROM public.aportes AS aporte
    WHERE aporte.grupo_id = entrega.grupo_id
      AND aporte.semana = entrega.semana
      AND lower(coalesce(aporte.estado, '')) = 'pagado'
      AND aporte.fecha_pago::date <= entrega.fecha_entrega::date
  ) AS aportes ON true
  WHERE (p_grupo_id IS NULL OR entrega.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR entrega.fecha_entrega::date >= p_desde)
    AND (p_hasta IS NULL OR entrega.fecha_entrega::date <= p_hasta)
  ORDER BY entrega.fecha_entrega DESC, entrega.semana DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_listar_entregas_ronda(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_agregar_evidencia_entrega(uuid, text, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_entregas_ronda(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_agregar_evidencia_entrega(uuid, text, text, text, bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
