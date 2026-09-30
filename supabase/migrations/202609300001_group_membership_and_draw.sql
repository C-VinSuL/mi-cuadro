ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS codigo_acceso text;

UPDATE public.grupos
SET codigo_acceso = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE codigo_acceso IS NULL;

ALTER TABLE public.grupos
  ALTER COLUMN codigo_acceso SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  ALTER COLUMN codigo_acceso SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS grupos_codigo_acceso_unique
  ON public.grupos (codigo_acceso);

DO $$
DECLARE
  constraint_record record;
  index_record record;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.participantes'::regclass
      AND contype = 'u'
      AND regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g') = 'UNIQUE (perfil_id)'
  LOOP
    EXECUTE format('ALTER TABLE public.participantes DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;

  FOR index_record IN
    SELECT index_class.relname
    FROM pg_index index_data
    JOIN pg_class table_class ON table_class.oid = index_data.indrelid
    JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
    WHERE table_class.oid = 'public.participantes'::regclass
      AND index_data.indisunique
      AND NOT index_data.indisprimary
      AND index_data.indnkeyatts = 1
      AND index_data.indkey[0] = (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = table_class.oid AND attname = 'perfil_id'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conindid = index_data.indexrelid
      )
  LOOP
    EXECUTE format('DROP INDEX public.%I', index_record.relname);
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS participantes_grupo_perfil_unique
  ON public.participantes (grupo_id, perfil_id)
  WHERE perfil_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.solicitudes_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  creada_en timestamptz NOT NULL DEFAULT now(),
  revisada_en timestamptz,
  revisada_por uuid REFERENCES public.perfiles(id),
  UNIQUE (grupo_id, perfil_id)
);

ALTER TABLE public.solicitudes_grupo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.solicitudes_grupo FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.crear_grupo(
  p_nombre text,
  p_numero_integrantes integer,
  p_aporte_semanal numeric
)
RETURNS public.grupos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede crear grupos';
  END IF;

  IF nullif(trim(p_nombre), '') IS NULL
    OR p_numero_integrantes IS NULL
    OR p_numero_integrantes < 2
    OR p_numero_integrantes > 500
    OR p_aporte_semanal IS NULL
    OR p_aporte_semanal <= 0 THEN
    RAISE EXCEPTION 'Datos del grupo no válidos';
  END IF;

  INSERT INTO public.grupos (
    nombre,
    numero_integrantes,
    aporte_semanal,
    estado,
    semana_actual
  ) VALUES (
    trim(p_nombre),
    p_numero_integrantes,
    p_aporte_semanal,
    'borrador',
    0
  )
  RETURNING * INTO v_grupo;

  RETURN v_grupo;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_union_grupo(p_codigo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
  v_solicitud_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Debes iniciar sesión con un perfil válido';
  END IF;

  SELECT id INTO v_grupo_id
  FROM public.grupos
  WHERE codigo_acceso = upper(trim(p_codigo))
    AND estado = 'borrador';

  IF v_grupo_id IS NULL THEN
    RAISE EXCEPTION 'El código no existe o el grupo ya inició';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.participantes
    WHERE grupo_id = v_grupo_id AND perfil_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Ya perteneces a este grupo';
  END IF;

  INSERT INTO public.solicitudes_grupo (grupo_id, perfil_id)
  VALUES (v_grupo_id, auth.uid())
  ON CONFLICT (grupo_id, perfil_id) DO UPDATE
    SET estado = 'pendiente', creada_en = now(), revisada_en = NULL, revisada_por = NULL
  WHERE public.solicitudes_grupo.estado = 'rechazada'
  RETURNING id INTO v_solicitud_id;

  IF v_solicitud_id IS NULL THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente o aprobada';
  END IF;

  RETURN v_solicitud_id;
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para revisar solicitudes';
  END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_grupo
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF NOT FOUND OR v_solicitud.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya fue revisada o no existe';
  END IF;

  IF NOT p_aprobar THEN
    UPDATE public.solicitudes_grupo
    SET estado = 'rechazada', revisada_en = now(), revisada_por = auth.uid()
    WHERE id = p_solicitud_id;
    RETURN;
  END IF;

  SELECT * INTO v_grupo
  FROM public.grupos
  WHERE id = v_solicitud.grupo_id
  FOR UPDATE;

  IF v_grupo.estado <> 'borrador' THEN
    RAISE EXCEPTION 'El grupo ya no admite integrantes';
  END IF;

  IF (SELECT count(*) FROM public.participantes WHERE grupo_id = v_grupo.id)
    >= v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'El grupo ya completó sus cupos';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', nombre, apellido)), ''), 'Socio')
  INTO v_nombre
  FROM public.perfiles
  WHERE id = v_solicitud.perfil_id;

  SELECT posiciones.slot INTO v_posicion
  FROM generate_series(1, v_grupo.numero_integrantes) AS posiciones(slot)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.participantes p
    WHERE p.grupo_id = v_grupo.id AND p.posicion = posiciones.slot
  )
  ORDER BY posiciones.slot
  LIMIT 1;

  IF v_posicion IS NULL THEN
    RAISE EXCEPTION 'No quedan posiciones libres';
  END IF;

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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede aprobar el inicio';
  END IF;

  SELECT * INTO v_grupo
  FROM public.grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND OR v_grupo.estado <> 'borrador' THEN
    RAISE EXCEPTION 'El grupo no está disponible para iniciar';
  END IF;

  SELECT count(*), coalesce(max(posicion), 0)
  INTO v_total, v_max_posicion
  FROM public.participantes
  WHERE grupo_id = p_grupo_id;

  IF v_total <> v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'El grupo debe tener todos sus cupos aprobados antes del sorteo';
  END IF;

  WITH sorteo AS (
    SELECT id, row_number() OVER (ORDER BY gen_random_uuid()) AS nueva_posicion
    FROM public.participantes
    WHERE grupo_id = p_grupo_id
  )
  UPDATE public.participantes p
  SET posicion = v_max_posicion + v_grupo.numero_integrantes + sorteo.nueva_posicion
  FROM sorteo
  WHERE p.id = sorteo.id;

  WITH sorteo AS (
    SELECT id, row_number() OVER (ORDER BY posicion) AS nueva_posicion
    FROM public.participantes
    WHERE grupo_id = p_grupo_id
  )
  UPDATE public.participantes p
  SET posicion = sorteo.nueva_posicion
  FROM sorteo
  WHERE p.id = sorteo.id;

  UPDATE public.grupos
  SET estado = 'activo', fecha_inicio = now(), semana_actual = 1
  WHERE id = p_grupo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_solicitudes_grupo(p_grupo_id uuid)
RETURNS TABLE (
  id uuid,
  perfil_id uuid,
  nombre text,
  apellido text,
  creada_en timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND lower(rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para consultar solicitudes';
  END IF;

  RETURN QUERY
  SELECT s.id, s.perfil_id, p.nombre, p.apellido, s.creada_en
  FROM public.solicitudes_grupo s
  JOIN public.perfiles p ON p.id = s.perfil_id
  WHERE s.grupo_id = p_grupo_id AND s.estado = 'pendiente'
  ORDER BY s.creada_en;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_grupo(text, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitar_union_grupo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolver_solicitud_grupo(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.iniciar_cuadro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_solicitudes_grupo(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crear_grupo(text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_union_grupo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_grupo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_cuadro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_solicitudes_grupo(uuid) TO authenticated;
