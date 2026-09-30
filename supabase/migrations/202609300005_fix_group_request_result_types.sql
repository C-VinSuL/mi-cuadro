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
    FROM public.perfiles AS perfil_admin
    WHERE perfil_admin.id = auth.uid()
      AND lower(perfil_admin.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para consultar solicitudes';
  END IF;

  RETURN QUERY
  SELECT solicitud.id::uuid,
         solicitud.perfil_id::uuid,
         perfil_socio.nombre::text,
         perfil_socio.apellido::text,
         solicitud.creada_en::timestamptz
  FROM public.solicitudes_grupo AS solicitud
  JOIN public.perfiles AS perfil_socio
    ON perfil_socio.id = solicitud.perfil_id
  WHERE solicitud.grupo_id = p_grupo_id
    AND solicitud.estado = 'pendiente'
  ORDER BY solicitud.creada_en;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_solicitudes_grupo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_solicitudes_grupo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';