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
    SELECT 1
    FROM public.perfiles
    WHERE id = auth.uid()
      AND lower(rol) = 'administrador'
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

  IF v_grupo.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar grupos que aún no han iniciado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.aportes WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.entregas WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.prestamos WHERE grupo_id = p_grupo_id)
    OR EXISTS (SELECT 1 FROM public.movimientos_fondo WHERE grupo_id = p_grupo_id) THEN
    RAISE EXCEPTION 'No se puede eliminar un grupo que ya tiene movimientos financieros';
  END IF;

  DELETE FROM public.participantes WHERE grupo_id = p_grupo_id;
  DELETE FROM public.grupos WHERE id = p_grupo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_grupo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_grupo(uuid) TO authenticated;