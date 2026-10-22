CREATE OR REPLACE FUNCTION public.solicitar_restablecimiento_mfa()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitante uuid := auth.uid();
  v_nombre text := 'Un usuario';
  v_correo text := 'correo no disponible';
  v_fuente text;
  v_notificaciones integer;
BEGIN
  IF v_solicitante IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para solicitar el restablecimiento';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_solicitante::text));

  IF EXISTS (
    SELECT 1
    FROM public.notificaciones AS notificacion
    JOIN public.perfiles AS administrador
      ON administrador.id = notificacion.usuario_id
    WHERE lower(administrador.rol) = 'administrador'
      AND notificacion.fuente LIKE 'mfa-reset:' || v_solicitante::text || ':%'
      AND notificacion.creada_en > now() - interval '24 hours'
  ) THEN
    RETURN 'already_sent';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles
    WHERE lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'No hay administradores disponibles para recibir la solicitud';
  END IF;

  SELECT coalesce(
    nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''),
    'Un usuario'
  )
  INTO v_nombre
  FROM public.perfiles AS perfil
  WHERE perfil.id = v_solicitante;
  v_nombre := coalesce(v_nombre, 'Un usuario');

  SELECT coalesce(cuenta.email, 'correo no disponible')
  INTO v_correo
  FROM auth.users AS cuenta
  WHERE cuenta.id = v_solicitante;
  v_correo := coalesce(v_correo, 'correo no disponible');

  v_fuente := 'mfa-reset:' || v_solicitante::text || ':' || floor(extract(epoch FROM now()))::bigint::text;

  INSERT INTO public.notificaciones (
    usuario_id,
    titulo,
    mensaje,
    tipo,
    ruta_accion,
    etiqueta_accion,
    fuente
  )
  SELECT
    administrador.id,
    'Solicitud de restablecimiento MFA',
    v_nombre || ' (' || v_correo || ') solicita restablecer su segundo factor. Verifica su identidad antes de ayudarle.',
    'info',
    '/usuarios',
    'Revisar usuarios',
    v_fuente
  FROM public.perfiles AS administrador
  WHERE lower(administrador.rol) = 'administrador'
  ON CONFLICT (usuario_id, fuente) DO NOTHING;

  GET DIAGNOSTICS v_notificaciones = ROW_COUNT;
  IF v_notificaciones = 0 THEN
    RETURN 'already_sent';
  END IF;

  RETURN 'sent';
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_restablecimiento_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_restablecimiento_mfa() TO authenticated;

NOTIFY pgrst, 'reload schema';
