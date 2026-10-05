UPDATE public.participantes participante
SET perfil_id = NULL
FROM public.perfiles perfil
WHERE participante.perfil_id = perfil.id
  AND lower(perfil.rol) = 'administrador';

DELETE FROM public.solicitudes_grupo solicitud
USING public.perfiles perfil
WHERE solicitud.perfil_id = perfil.id
  AND lower(perfil.rol) = 'administrador';

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
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden solicitar ingreso a un grupo';
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
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) IN ('administrador', 'tesorero')
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

  IF p_aprobar AND NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = v_solicitud.perfil_id AND lower(rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden pertenecer a un grupo';
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
    SELECT 1 FROM public.participantes participante
    WHERE participante.grupo_id = v_grupo.id AND participante.posicion = posiciones.slot
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

CREATE OR REPLACE FUNCTION public.eliminar_grupo(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
BEGIN
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El grupo no existe';
  END IF;

  DELETE FROM public.movimientos_fondo WHERE grupo_id = p_grupo_id;
  DELETE FROM public.cuotas_prestamo
  WHERE prestamo_id IN (SELECT id FROM public.prestamos WHERE grupo_id = p_grupo_id);
  DELETE FROM public.aportes WHERE grupo_id = p_grupo_id;
  DELETE FROM public.entregas WHERE grupo_id = p_grupo_id;
  DELETE FROM public.prestamos WHERE grupo_id = p_grupo_id;
  DELETE FROM public.solicitudes_grupo WHERE grupo_id = p_grupo_id;
  DELETE FROM public.participantes WHERE grupo_id = p_grupo_id;
  DELETE FROM public.grupos WHERE id = p_grupo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_union_grupo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolver_solicitud_grupo(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_grupo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_union_grupo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_grupo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_grupo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';