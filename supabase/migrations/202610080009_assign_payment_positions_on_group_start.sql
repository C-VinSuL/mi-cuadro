ALTER TABLE public.participantes
  ALTER COLUMN posicion DROP NOT NULL;

UPDATE public.participantes AS participante
SET posicion = NULL
FROM public.grupos AS grupo
WHERE grupo.id = participante.grupo_id
  AND grupo.estado = 'borrador'
  AND participante.posicion IS NOT NULL;

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
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
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
    SELECT 1 FROM public.perfiles AS perfil_socio
    WHERE perfil_socio.id = v_solicitud.perfil_id
      AND lower(perfil_socio.rol) = 'socio'
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

  SELECT coalesce(nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''), 'Socio')
  INTO v_nombre
  FROM public.perfiles AS perfil
  WHERE perfil.id = v_solicitud.perfil_id;

  INSERT INTO public.participantes (grupo_id, perfil_id, nombre, posicion, estado)
  VALUES (v_grupo.id, v_solicitud.perfil_id, v_nombre, NULL, 'pendiente');

  UPDATE public.solicitudes_grupo
  SET estado = 'aprobada', revisada_en = now(), revisada_por = auth.uid()
  WHERE id = p_solicitud_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
