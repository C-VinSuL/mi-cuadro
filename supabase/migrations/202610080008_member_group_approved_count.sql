CREATE OR REPLACE FUNCTION public.contar_participantes_grupo_propio(p_grupo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cantidad integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid() AND lower(perfil_actual.rol) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo los socios pueden consultar el total de integrantes del grupo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participantes AS miembro_actual
    WHERE miembro_actual.grupo_id = p_grupo_id
      AND miembro_actual.perfil_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Solo puedes consultar el total de un grupo al que perteneces';
  END IF;

  SELECT count(*)::integer
  INTO v_cantidad
  FROM public.participantes AS miembro
  WHERE miembro.grupo_id = p_grupo_id;

  RETURN v_cantidad;
END;
$$;

REVOKE ALL ON FUNCTION public.contar_participantes_grupo_propio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_participantes_grupo_propio(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
