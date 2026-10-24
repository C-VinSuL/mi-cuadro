CREATE OR REPLACE FUNCTION public.registrar_aporte_miembro(
  p_grupo_id uuid,
  p_participante_id uuid,
  p_monto numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
  v_aporte_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede registrar aportes de miembros';
  END IF;

  IF p_grupo_id IS NULL OR p_participante_id IS NULL
    OR p_monto IS NULL OR round(p_monto, 2) <= 0 THEN
    RAISE EXCEPTION 'Selecciona un miembro e ingresa un monto mayor que cero';
  END IF;

  SELECT *
  INTO v_grupo
  FROM public.grupos AS grupo
  WHERE grupo.id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND OR v_grupo.estado IS DISTINCT FROM 'activo'
    OR v_grupo.semana_actual IS NULL OR v_grupo.semana_actual < 1 THEN
    RAISE EXCEPTION 'El grupo debe estar activo para registrar aportes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participantes AS participante
    WHERE participante.id = p_participante_id
      AND participante.grupo_id = p_grupo_id
  ) THEN
    RAISE EXCEPTION 'El miembro seleccionado no pertenece a este grupo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.aportes AS aporte
    WHERE aporte.participante_id = p_participante_id
      AND aporte.grupo_id = p_grupo_id
      AND aporte.semana = v_grupo.semana_actual
  ) THEN
    RAISE EXCEPTION 'Este miembro ya tiene un aporte registrado para el periodo actual';
  END IF;

  INSERT INTO public.aportes (
    participante_id,
    grupo_id,
    semana,
    monto,
    comision_app,
    estado
  ) VALUES (
    p_participante_id,
    p_grupo_id,
    v_grupo.semana_actual,
    round(p_monto, 2),
    0,
    'pagado'
  )
  RETURNING id INTO v_aporte_id;

  RETURN v_aporte_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_aporte_miembro(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_aporte_miembro(uuid, uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
