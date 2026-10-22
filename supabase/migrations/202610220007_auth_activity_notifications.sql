CREATE OR REPLACE FUNCTION public.notificar_nueva_cuenta_administradores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text := coalesce(
    nullif(btrim(NEW.raw_user_meta_data ->> 'nombre'), ''),
    nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'Nuevo usuario'
  );
BEGIN
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
    'Nueva cuenta registrada',
    v_nombre || ' (' || coalesce(NEW.email, 'sin correo') || ') creó una cuenta.',
    'info',
    '/usuarios',
    'Ver socios y roles',
    'nueva-cuenta:' || NEW.id::text
  FROM public.perfiles AS administrador
  WHERE lower(administrador.rol) = 'administrador'
    AND administrador.activo
  ON CONFLICT (usuario_id, fuente) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_nueva_cuenta_administradores() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auth_user_new_account_notification ON auth.users;
CREATE TRIGGER auth_user_new_account_notification
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.notificar_nueva_cuenta_administradores();
