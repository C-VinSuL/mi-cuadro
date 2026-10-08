CREATE OR REPLACE FUNCTION public.listar_perfiles_administrador(
  p_busqueda text DEFAULT NULL,
  p_limite integer DEFAULT 50,
  p_desplazamiento integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  correo text,
  telefono text,
  rol text,
  cedula text,
  direccion text,
  fecha_nacimiento date,
  documento_verificado boolean,
  creado_en timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede consultar el registro de socios';
  END IF;

  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100
    OR p_desplazamiento IS NULL OR p_desplazamiento < 0 THEN
    RAISE EXCEPTION 'Los parámetros de paginación no son válidos';
  END IF;
  IF nullif(trim(coalesce(p_busqueda, '')), '') IS NOT NULL
    AND length(trim(p_busqueda)) < 2 THEN
    RAISE EXCEPTION 'Ingresa al menos dos caracteres para buscar';
  END IF;

  RETURN QUERY
  SELECT
    perfil.id,
    perfil.nombre::text,
    perfil.apellido::text,
    cuenta.email::text,
    perfil.telefono::text,
    perfil.rol::text,
    datos.cedula::text,
    datos.direccion::text,
    datos.fecha_nacimiento,
    coalesce(datos.documento_verificado, false),
    cuenta.created_at,
    count(*) OVER ()
  FROM public.perfiles AS perfil
  JOIN auth.users AS cuenta ON cuenta.id = perfil.id
  LEFT JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE p_busqueda IS NULL
     OR nullif(trim(p_busqueda), '') IS NULL
     OR perfil.nombre ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.apellido ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.telefono ILIKE '%' || trim(p_busqueda) || '%'
     OR cuenta.email ILIKE '%' || trim(p_busqueda) || '%'
     OR datos.cedula ILIKE '%' || trim(p_busqueda) || '%'
  ORDER BY cuenta.created_at DESC, perfil.id
  LIMIT p_limite
  OFFSET p_desplazamiento;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_perfiles_administrador(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_perfiles_administrador(text, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
