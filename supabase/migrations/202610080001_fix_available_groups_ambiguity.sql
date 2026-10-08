CREATE OR REPLACE FUNCTION public.listar_grupos_disponibles()
RETURNS TABLE (
  id uuid,
  nombre text,
  capacidad integer,
  integrantes integer,
  aporte numeric,
  periodicidad text,
  mi_estado text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden consultar grupos disponibles';
  END IF;

  RETURN QUERY
  SELECT
    grupo.id,
    grupo.nombre::text,
    grupo.numero_integrantes,
    (
      SELECT count(*)::integer
      FROM public.participantes AS integrante
      WHERE integrante.grupo_id = grupo.id
    ),
    grupo.aporte_semanal,
    grupo.aporte_periodicidad::text,
    CASE
      WHEN solicitud_grupo.estado = 'aprobada' THEN 'miembro'
      WHEN solicitud_grupo.estado = 'pendiente' THEN 'solicitud_aprobacion'
      WHEN solicitud_invitacion.estado IN ('pendiente', 'invitacion_enviada')
        THEN solicitud_invitacion.estado
      ELSE NULL
    END
  FROM public.grupos AS grupo
  LEFT JOIN public.solicitudes_invitacion_grupo AS solicitud_invitacion
    ON solicitud_invitacion.grupo_id = grupo.id
    AND solicitud_invitacion.perfil_id = auth.uid()
  LEFT JOIN public.solicitudes_grupo AS solicitud_grupo
    ON solicitud_grupo.grupo_id = grupo.id
    AND solicitud_grupo.perfil_id = auth.uid()
  WHERE grupo.estado = 'borrador'
    AND NOT EXISTS (
      SELECT 1
      FROM public.participantes AS integrante_actual
      WHERE integrante_actual.grupo_id = grupo.id
        AND integrante_actual.perfil_id = auth.uid()
    )
    AND (
      SELECT count(*)
      FROM public.participantes AS integrante_actual
      WHERE integrante_actual.grupo_id = grupo.id
    ) < grupo.numero_integrantes
  ORDER BY grupo.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_grupos_disponibles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_grupos_disponibles() TO authenticated;

NOTIFY pgrst, 'reload schema';
