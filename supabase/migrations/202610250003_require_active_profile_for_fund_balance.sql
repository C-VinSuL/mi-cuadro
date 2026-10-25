CREATE OR REPLACE FUNCTION public.obtener_saldo_fondo(p_grupo_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric(12, 2);
  v_es_personal_autorizado boolean;
  v_perfil_activo boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT
    coalesce(perfil.activo, false),
    lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  INTO v_perfil_activo, v_es_personal_autorizado
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid();

  IF NOT coalesce(v_perfil_activo, false) THEN
    RAISE EXCEPTION 'La cuenta no está activa.';
  END IF;

  IF NOT v_es_personal_autorizado AND NOT EXISTS (
    SELECT 1
    FROM public.participantes AS participante
    WHERE participante.grupo_id = p_grupo_id
      AND participante.perfil_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes acceso al fondo de este grupo.';
  END IF;

  SELECT coalesce(
    sum(
      CASE
        WHEN movimiento.tipo = 'ingreso' THEN movimiento.monto
        WHEN movimiento.tipo = 'egreso' THEN -movimiento.monto
        ELSE 0
      END
    ),
    0
  )
  INTO v_saldo
  FROM public.movimientos_fondo AS movimiento
  WHERE movimiento.grupo_id = p_grupo_id;

  RETURN round(v_saldo, 2);
END;
$$;

NOTIFY pgrst, 'reload schema';
