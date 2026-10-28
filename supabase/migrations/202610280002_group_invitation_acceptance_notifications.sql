CREATE OR REPLACE FUNCTION public.notificar_invitacion_grupo_aceptada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre_grupo text;
  v_nombre_socio text;
BEGIN
  IF NEW.evento <> 'invitacion_grupo_aceptada' THEN
    RETURN NEW;
  END IF;

  SELECT nombre INTO v_nombre_grupo
  FROM public.grupos
  WHERE id = NEW.grupo_id;

  SELECT coalesce(nullif(trim(concat_ws(' ', nombre, apellido)), ''), 'Un socio')
  INTO v_nombre_socio
  FROM public.perfiles
  WHERE id = NEW.objetivo_id;

  UPDATE public.notificaciones AS notificacion
  SET titulo = 'Invitación de grupo aceptada',
      mensaje = v_nombre_socio || ' aceptó la invitación para unirse a '
        || coalesce(v_nombre_grupo, 'un grupo')
        || '. La solicitud de ingreso está pendiente de revisión.'
  FROM public.solicitudes_grupo AS solicitud,
       public.perfiles AS perfil
  WHERE solicitud.grupo_id = NEW.grupo_id
    AND solicitud.perfil_id = NEW.objetivo_id
    AND solicitud.estado = 'pendiente'
    AND lower(perfil.rol) IN ('administrador', 'tesorero')
    AND notificacion.usuario_id = perfil.id
    AND notificacion.fuente LIKE 'solicitud-grupo:' || solicitud.id::text || ':pendiente:%'
    AND notificacion.titulo = 'Nueva solicitud de acceso';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_invitacion_aceptada_notificacion
  ON public.auditoria_eventos;
CREATE TRIGGER auditoria_invitacion_aceptada_notificacion
AFTER INSERT ON public.auditoria_eventos
FOR EACH ROW
WHEN (NEW.evento = 'invitacion_grupo_aceptada')
EXECUTE FUNCTION public.notificar_invitacion_grupo_aceptada();

REVOKE ALL ON FUNCTION public.notificar_invitacion_grupo_aceptada()
  FROM PUBLIC, anon, authenticated;
