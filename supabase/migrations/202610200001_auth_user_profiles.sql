CREATE OR REPLACE FUNCTION public.crear_perfil_desde_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metadata jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_nombre_completo text := coalesce(
    nullif(btrim(v_metadata ->> 'full_name'), ''),
    nullif(btrim(v_metadata ->> 'name'), '')
  );
  v_nombre text := coalesce(
    nullif(btrim(v_metadata ->> 'nombre'), ''),
    nullif(btrim(v_metadata ->> 'given_name'), '')
  );
  v_apellido text := coalesce(
    nullif(btrim(v_metadata ->> 'apellido'), ''),
    nullif(btrim(v_metadata ->> 'family_name'), '')
  );
  v_telefono text := coalesce(
    nullif(btrim(v_metadata ->> 'telefono'), ''),
    nullif(btrim(v_metadata ->> 'phone'), '')
  );
BEGIN
  IF v_nombre IS NULL AND v_nombre_completo IS NOT NULL THEN
    v_nombre := split_part(v_nombre_completo, ' ', 1);
  END IF;

  IF v_apellido IS NULL AND v_nombre_completo IS NOT NULL THEN
    v_apellido := nullif(
      btrim(substr(v_nombre_completo, length(split_part(v_nombre_completo, ' ', 1)) + 1)),
      ''
    );
  END IF;

  v_nombre := coalesce(
    v_nombre,
    nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'Usuario'
  );

  INSERT INTO public.perfiles (id, nombre, apellido, telefono, rol)
  VALUES (NEW.id, v_nombre, v_apellido, v_telefono, 'socio')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_perfil_desde_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auth_user_profile_bootstrap ON auth.users;
CREATE TRIGGER auth_user_profile_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.crear_perfil_desde_auth();

INSERT INTO public.perfiles (id, nombre, apellido, telefono, rol)
SELECT
  cuenta.id,
  coalesce(
    nullif(btrim(cuenta.raw_user_meta_data ->> 'nombre'), ''),
    nullif(btrim(cuenta.raw_user_meta_data ->> 'given_name'), ''),
    nullif(split_part(coalesce(
      cuenta.raw_user_meta_data ->> 'full_name',
      cuenta.raw_user_meta_data ->> 'name',
      ''
    ), ' ', 1), ''),
    nullif(split_part(coalesce(cuenta.email, ''), '@', 1), ''),
    'Usuario'
  ),
  coalesce(
    nullif(btrim(cuenta.raw_user_meta_data ->> 'apellido'), ''),
    nullif(btrim(cuenta.raw_user_meta_data ->> 'family_name'), ''),
    nullif(btrim(substr(
      coalesce(
        cuenta.raw_user_meta_data ->> 'full_name',
        cuenta.raw_user_meta_data ->> 'name',
        ''
      ),
      length(split_part(coalesce(
        cuenta.raw_user_meta_data ->> 'full_name',
        cuenta.raw_user_meta_data ->> 'name',
        ''
      ), ' ', 1)) + 1
    )), '')
  ),
  coalesce(
    nullif(btrim(cuenta.raw_user_meta_data ->> 'telefono'), ''),
    nullif(btrim(cuenta.raw_user_meta_data ->> 'phone'), '')
  ),
  'socio'
FROM auth.users AS cuenta
ON CONFLICT (id) DO NOTHING;
