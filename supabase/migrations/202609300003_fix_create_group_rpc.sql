DO $$
BEGIN
  DELETE FROM public.participantes p
  USING public.perfiles f
  WHERE p.perfil_id = f.id
    AND lower(f.rol) = 'administrador'
    AND EXISTS (
      SELECT 1 FROM public.grupos g
      WHERE g.id = p.grupo_id AND g.estado = 'borrador'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.aportes a WHERE a.participante_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.entregas e WHERE e.participante_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.prestamos pr WHERE pr.participante_id = p.id
    );

    UPDATE public.participantes p
    SET perfil_id = NULL
    FROM public.perfiles f
    WHERE p.perfil_id = f.id
      AND lower(f.rol) = 'administrador';
END;
$$;

DROP FUNCTION IF EXISTS public.crear_grupo(text, integer, numeric);

CREATE FUNCTION public.crear_grupo(
  p_nombre text,
  p_numero_integrantes integer,
  p_aporte_semanal numeric
)
RETURNS public.grupos
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
    RAISE EXCEPTION 'Solo un administrador puede crear grupos';
  END IF;

  IF nullif(trim(p_nombre), '') IS NULL
    OR p_numero_integrantes IS NULL
    OR p_numero_integrantes < 2
    OR p_numero_integrantes > 500
    OR p_aporte_semanal IS NULL
    OR p_aporte_semanal <= 0 THEN
    RAISE EXCEPTION 'Datos del grupo no válidos';
  END IF;

  INSERT INTO public.grupos (
    nombre,
    numero_integrantes,
    aporte_semanal,
    estado,
    semana_actual
  ) VALUES (
    trim(p_nombre),
    p_numero_integrantes,
    p_aporte_semanal,
    'borrador',
    0
  )
  RETURNING * INTO v_grupo;

  RETURN v_grupo;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_grupo(text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_grupo(text, integer, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';