CREATE TABLE IF NOT EXISTS public.auditoria_revisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  periodo_desde date NOT NULL,
  periodo_hasta date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_revision', 'completada')),
  notas text NOT NULL DEFAULT '',
  iniciada_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  actualizada_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  completada_en timestamptz,
  CONSTRAINT auditoria_revisiones_periodo_valido CHECK (periodo_hasta >= periodo_desde),
  CONSTRAINT auditoria_revisiones_grupo_periodo_unique UNIQUE (grupo_id, periodo_desde, periodo_hasta)
);

CREATE INDEX IF NOT EXISTS auditoria_revisiones_grupo_periodo_idx
  ON public.auditoria_revisiones (grupo_id, periodo_hasta DESC);

CREATE TABLE IF NOT EXISTS public.auditoria_hallazgos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 3 AND 160),
  descripcion text NOT NULL CHECK (length(trim(descripcion)) BETWEEN 3 AND 4000),
  evidencia text NOT NULL DEFAULT '' CHECK (length(evidencia) <= 2000),
  severidad text NOT NULL CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  estado text NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'aclaracion_solicitada', 'en_seguimiento', 'cerrado')),
  respuesta text NOT NULL DEFAULT '' CHECK (length(respuesta) <= 4000),
  creado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  actualizado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  respondido_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  respondido_en timestamptz
);

CREATE TABLE IF NOT EXISTS public.auditoria_hallazgo_respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hallazgo_id uuid NOT NULL REFERENCES public.auditoria_hallazgos(id) ON DELETE CASCADE,
  respuesta text NOT NULL CHECK (length(trim(respuesta)) BETWEEN 3 AND 4000),
  respondido_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  creada_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditoria_hallazgos_grupo_estado_idx
  ON public.auditoria_hallazgos (grupo_id, estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS auditoria_hallazgo_respuestas_id_fecha_idx
  ON public.auditoria_hallazgo_respuestas (hallazgo_id, creada_en);

ALTER TABLE public.auditoria_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_hallazgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_hallazgo_respuestas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_revisiones, public.auditoria_hallazgos,
  public.auditoria_hallazgo_respuestas FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seguridad_perfil_activo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce((
    SELECT perfil.activo
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
  ), false)
$$;

REVOKE ALL ON FUNCTION public.seguridad_perfil_activo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguridad_perfil_activo() TO authenticated;

CREATE OR REPLACE FUNCTION public.seguridad_comprobante_billetera_vinculado(p_object_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.solicitudes_billetera AS solicitud
    WHERE solicitud.comprobante_path = p_object_path
  )
$$;

REVOKE ALL ON FUNCTION public.seguridad_comprobante_billetera_vinculado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguridad_comprobante_billetera_vinculado(text) TO authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'grupos', 'participantes', 'aportes', 'entregas',
    'prestamos', 'cuotas_prestamo', 'movimientos_fondo'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS auditor_mfa_scope_%1$s ON public.%1$I',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY auditor_mfa_scope_%1$s ON public.%1$I AS RESTRICTIVE FOR SELECT TO authenticated
       USING (
         public.seguridad_rol_actual() <> ''auditor''
         OR (
           coalesce(auth.jwt() ->> ''aal'', ''aal1'') = ''aal2''
           AND public.seguridad_perfil_activo()
         )
       )',
      table_name
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS egresos_select_tesoreria ON public.egresos;
CREATE POLICY egresos_select_staff_auditor
ON public.egresos
FOR SELECT TO authenticated
USING (
  coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  AND public.seguridad_perfil_activo()
);

DROP POLICY IF EXISTS contribution_receipts_owner_and_staff_read ON storage.objects;
CREATE POLICY contribution_receipts_owner_staff_auditor_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contribution-receipts'
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND public.seguridad_perfil_activo()
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
      AND EXISTS (
        SELECT 1
        FROM public.aportes AS aporte
        WHERE aporte.comprobante_path = name
      )
    )
  )
);

DROP POLICY IF EXISTS wallet_receipts_owner_read ON storage.objects;
CREATE POLICY wallet_receipts_owner_staff_auditor_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'wallet-receipts'
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND public.seguridad_perfil_activo()
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
      AND public.seguridad_comprobante_billetera_vinculado(name)
    )
  )
);

CREATE OR REPLACE FUNCTION public.obtener_saldo_fondo(p_grupo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric(12, 2);
  v_es_personal_autorizado boolean;
  v_perfil_activo boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesi?n.'; END IF;

  SELECT coalesce(perfil.activo, false),
    lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
  INTO v_perfil_activo, v_es_personal_autorizado
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid();

  IF NOT coalesce(v_perfil_activo, false) THEN
    RAISE EXCEPTION 'La cuenta no est? activa.';
  END IF;
  IF public.seguridad_rol_actual() = 'auditor' THEN
    PERFORM public.exigir_mfa_actual();
  END IF;
  IF NOT v_es_personal_autorizado AND NOT EXISTS (
    SELECT 1 FROM public.participantes AS participante
    WHERE participante.grupo_id = p_grupo_id AND participante.perfil_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes acceso al fondo de este grupo.';
  END IF;

  SELECT coalesce(sum(CASE
    WHEN movimiento.tipo = 'ingreso' THEN movimiento.monto
    WHEN movimiento.tipo = 'egreso' THEN -movimiento.monto
    ELSE 0
  END), 0)
  INTO v_saldo
  FROM public.movimientos_fondo AS movimiento
  WHERE movimiento.grupo_id = p_grupo_id;
  RETURN round(v_saldo, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_total_egresos_tesoreria()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo() OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) IN ('administrador', 'tesorero', 'auditor')
      AND coalesce(perfil.activo, false)
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar los egresos'; END IF;
  RETURN (SELECT coalesce(sum(egreso.monto), 0) FROM public.egresos AS egreso);
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_resumen_grupos()
RETURNS TABLE (
  grupo_id uuid,
  grupo_nombre text,
  grupo_estado text,
  periodo_actual integer,
  participantes bigint,
  aportes_pagados bigint,
  comprobantes_pendientes bigint,
  aportes_total numeric,
  egresos_total numeric,
  saldo_fondo numeric,
  movimientos_billetera numeric,
  ultima_revision timestamptz,
  hallazgos_abiertos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo() OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
      AND coalesce(perfil.activo, false)
  ) THEN
    RAISE EXCEPTION 'Solo administraci?n o auditor?a puede consultar el resumen global';
  END IF;

  RETURN QUERY
  WITH participantes_por_grupo AS (
    SELECT participante.grupo_id, count(*) AS total
    FROM public.participantes AS participante
    GROUP BY participante.grupo_id
  ),
  aportes_por_grupo AS (
    SELECT aporte.grupo_id,
      count(*) FILTER (WHERE lower(coalesce(aporte.estado, '')) = 'pagado') AS pagados,
      count(*) FILTER (
        WHERE aporte.estado_revision = 'pendiente'
          AND aporte.comprobante_path IS NOT NULL
      ) AS pendientes,
      coalesce(sum(aporte.monto) FILTER (WHERE lower(coalesce(aporte.estado, '')) = 'pagado'), 0) AS total
    FROM public.aportes AS aporte
    GROUP BY aporte.grupo_id
  ),
  egresos_por_grupo AS (
    SELECT egreso.grupo_id, coalesce(sum(egreso.monto), 0) AS total
    FROM public.egresos AS egreso
    GROUP BY egreso.grupo_id
  ),
  fondo_por_grupo AS (
    SELECT movimiento.grupo_id,
      coalesce(sum(CASE
        WHEN movimiento.tipo = 'ingreso' THEN movimiento.monto
        WHEN movimiento.tipo = 'egreso' THEN -movimiento.monto
        ELSE 0
      END), 0) AS saldo
    FROM public.movimientos_fondo AS movimiento
    GROUP BY movimiento.grupo_id
  ),
  billetera_por_grupo AS (
    SELECT movimiento.grupo_id, coalesce(sum(movimiento.delta), 0) AS total
    FROM public.movimientos_billetera AS movimiento
    WHERE movimiento.grupo_id IS NOT NULL
    GROUP BY movimiento.grupo_id
  ),
  ultima_revision_por_grupo AS (
    SELECT revision.grupo_id, max(revision.completada_en) AS completada_en
    FROM public.auditoria_revisiones AS revision
    WHERE revision.estado = 'completada'
    GROUP BY revision.grupo_id
  ),
  hallazgos_por_grupo AS (
    SELECT hallazgo.grupo_id, count(*) AS total
    FROM public.auditoria_hallazgos AS hallazgo
    WHERE hallazgo.estado <> 'cerrado'
    GROUP BY hallazgo.grupo_id
  )
  SELECT grupo.id,
    grupo.nombre::text,
    grupo.estado::text,
    grupo.semana_actual,
    coalesce(participantes_por_grupo.total, 0),
    coalesce(aportes_por_grupo.pagados, 0),
    coalesce(aportes_por_grupo.pendientes, 0),
    coalesce(aportes_por_grupo.total, 0)::numeric,
    coalesce(egresos_por_grupo.total, 0)::numeric,
    coalesce(fondo_por_grupo.saldo, 0)::numeric,
    coalesce(billetera_por_grupo.total, 0)::numeric,
    ultima_revision_por_grupo.completada_en,
    coalesce(hallazgos_por_grupo.total, 0)
  FROM public.grupos AS grupo
  LEFT JOIN participantes_por_grupo ON participantes_por_grupo.grupo_id = grupo.id
  LEFT JOIN aportes_por_grupo ON aportes_por_grupo.grupo_id = grupo.id
  LEFT JOIN egresos_por_grupo ON egresos_por_grupo.grupo_id = grupo.id
  LEFT JOIN fondo_por_grupo ON fondo_por_grupo.grupo_id = grupo.id
  LEFT JOIN billetera_por_grupo ON billetera_por_grupo.grupo_id = grupo.id
  LEFT JOIN ultima_revision_por_grupo ON ultima_revision_por_grupo.grupo_id = grupo.id
  LEFT JOIN hallazgos_por_grupo ON hallazgos_por_grupo.grupo_id = grupo.id
  ORDER BY grupo.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_movimientos_billetera(
  p_grupo_id uuid DEFAULT NULL,
  p_limite integer DEFAULT 100,
  p_desplazamiento integer DEFAULT 0
)
RETURNS TABLE (
  movimiento_id bigint,
  grupo_id uuid,
  grupo_nombre text,
  socio text,
  tipo text,
  delta numeric,
  periodo integer,
  creado_en timestamptz,
  estado_solicitud text,
  comprobante_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo() OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
      AND coalesce(perfil.activo, false)
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar movimientos de billetera'; END IF;
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 500
    OR p_desplazamiento IS NULL OR p_desplazamiento < 0 THEN
    RAISE EXCEPTION 'La paginaci?n solicitada no es v?lida';
  END IF;

  RETURN QUERY
  SELECT movimiento.id, movimiento.grupo_id, grupo.nombre::text,
    coalesce(nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''), 'Socio')::text,
    movimiento.tipo, movimiento.delta, movimiento.periodo, movimiento.creado_en,
    solicitud.estado, solicitud.comprobante_path
  FROM public.movimientos_billetera AS movimiento
  LEFT JOIN public.grupos AS grupo ON grupo.id = movimiento.grupo_id
  JOIN public.perfiles AS perfil ON perfil.id = movimiento.perfil_id
  LEFT JOIN public.solicitudes_billetera AS solicitud ON solicitud.id = movimiento.solicitud_id
  WHERE p_grupo_id IS NULL OR movimiento.grupo_id = p_grupo_id
  ORDER BY movimiento.creado_en DESC, movimiento.id DESC
  LIMIT p_limite OFFSET p_desplazamiento;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_revisiones()
RETURNS TABLE (
  id uuid,
  grupo_id uuid,
  grupo_nombre text,
  periodo_desde date,
  periodo_hasta date,
  estado text,
  notas text,
  actualizada_en timestamptz,
  completada_en timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo() OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
      AND coalesce(perfil.activo, false)
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar las revisiones'; END IF;

  RETURN QUERY
  SELECT revision.id, revision.grupo_id, grupo.nombre::text,
    revision.periodo_desde, revision.periodo_hasta, revision.estado,
    revision.notas, revision.actualizada_en, revision.completada_en
  FROM public.auditoria_revisiones AS revision
  JOIN public.grupos AS grupo ON grupo.id = revision.grupo_id
  ORDER BY revision.actualizada_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_guardar_revision(
  p_grupo_id uuid,
  p_periodo_desde date,
  p_periodo_hasta date,
  p_estado text,
  p_notas text DEFAULT ''
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
    OR p_estado IS NULL
    OR p_estado NOT IN ('pendiente', 'en_revision', 'completada')
    OR length(coalesce(p_notas, '')) > 4000 THEN
    RAISE EXCEPTION 'Los datos de la revisi?n no son v?lidos';
  END IF;

  INSERT INTO public.auditoria_revisiones AS revision_actual (
    grupo_id, periodo_desde, periodo_hasta, estado, notas,
    iniciada_por, actualizada_por, completada_en
  )
  VALUES (
    p_grupo_id, p_periodo_desde, p_periodo_hasta, p_estado, coalesce(p_notas, ''),
    auth.uid(), auth.uid(), CASE WHEN p_estado = 'completada' THEN now() ELSE NULL END
  )
  ON CONFLICT (grupo_id, periodo_desde, periodo_hasta) DO UPDATE SET
    estado = excluded.estado,
    notas = excluded.notas,
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
      'periodo_hasta', p_periodo_hasta, 'estado', p_estado
    )
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_hallazgos(p_grupo_id uuid DEFAULT NULL)
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
  respuestas jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo() OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
  ) THEN RAISE EXCEPTION 'No tienes permiso para consultar hallazgos'; END IF;

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
    ), '[]'::jsonb)
  FROM public.auditoria_hallazgos AS hallazgo
  JOIN public.grupos AS grupo ON grupo.id = hallazgo.grupo_id
  LEFT JOIN public.perfiles AS autor ON autor.id = hallazgo.creado_por
  WHERE p_grupo_id IS NULL OR hallazgo.grupo_id = p_grupo_id
  ORDER BY CASE hallazgo.severidad
      WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
    hallazgo.creado_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_crear_hallazgo(
  p_grupo_id uuid,
  p_titulo text,
  p_descripcion text,
  p_evidencia text,
  p_severidad text,
  p_estado text DEFAULT 'abierto'
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
    OR p_severidad IS NULL
    OR p_severidad NOT IN ('baja', 'media', 'alta', 'critica')
    OR p_estado IS NULL
    OR p_estado NOT IN ('abierto', 'aclaracion_solicitada', 'en_seguimiento') THEN
    RAISE EXCEPTION 'Los datos del hallazgo no son v?lidos';
  END IF;

  INSERT INTO public.auditoria_hallazgos (
    grupo_id, titulo, descripcion, evidencia, severidad, estado, creado_por, actualizado_por
  )
  VALUES (
    p_grupo_id, trim(p_titulo), trim(p_descripcion), coalesce(p_evidencia, ''),
    p_severidad, p_estado, auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    p_grupo_id, auth.uid(), 'auditoria_hallazgo_creado',
    jsonb_build_object('hallazgo_id', v_id, 'severidad', p_severidad, 'estado', p_estado)
  );
  RETURN v_id;
END;
$$;

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
    RAISE EXCEPTION 'Los datos del seguimiento no son v?lidos';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET estado = p_estado, descripcion = trim(p_descripcion),
      evidencia = coalesce(p_evidencia, ''), actualizado_por = auth.uid(),
      actualizado_en = now()
  WHERE id = p_hallazgo_id
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El hallazgo no existe'; END IF;

  INSERT INTO public.auditoria_hallazgo_respuestas (hallazgo_id, respuesta, respondido_por)
  VALUES (p_hallazgo_id, trim(p_respuesta), auth.uid());

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
    RAISE EXCEPTION 'Solo administraci?n o tesorer?a puede responder a solicitudes del auditor';
  END IF;
  IF length(trim(coalesce(p_respuesta, ''))) NOT BETWEEN 3 AND 4000 THEN
    RAISE EXCEPTION 'La respuesta debe tener entre 3 y 4.000 caracteres';
  END IF;

  UPDATE public.auditoria_hallazgos
  SET respuesta = trim(p_respuesta), respondido_por = auth.uid(),
      respondido_en = now(), actualizado_en = now()
  WHERE id = p_hallazgo_id
  RETURNING grupo_id INTO v_grupo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El hallazgo no existe'; END IF;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    v_grupo_id, auth.uid(), 'auditoria_hallazgo_respondido',
    jsonb_build_object('hallazgo_id', p_hallazgo_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_resumen_grupos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_movimientos_billetera(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_revisiones() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_guardar_revision(uuid, date, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_hallazgos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_crear_hallazgo(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_actualizar_hallazgo(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_responder_hallazgo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_resumen_grupos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_movimientos_billetera(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_revisiones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_guardar_revision(uuid, date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_hallazgos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_crear_hallazgo(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_actualizar_hallazgo(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_responder_hallazgo(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
