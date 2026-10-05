CREATE OR REPLACE FUNCTION public.actualizar_configuracion_administrador(
  p_grupo_id uuid,
  p_numero_integrantes integer,
  p_aporte_semanal numeric,
  p_interes_prestamo numeric,
  p_max_cuotas_prestamo integer,
  p_monto_max_prestamo numeric,
  p_prestamos_solo_activo boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos;
  v_total_participantes integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la configuración';
  END IF;

  SELECT * INTO v_grupo
  FROM public.grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El grupo no existe';
  END IF;

  IF p_numero_integrantes IS NULL OR p_numero_integrantes < 2 OR p_numero_integrantes > 500 THEN
    RAISE EXCEPTION 'La capacidad debe estar entre 2 y 500 socios';
  END IF;

  IF p_aporte_semanal IS NULL OR p_aporte_semanal <= 0 THEN
    RAISE EXCEPTION 'El aporte semanal debe ser mayor a cero';
  END IF;

  IF p_interes_prestamo IS NULL OR p_interes_prestamo < 0 OR p_interes_prestamo > 100 THEN
    RAISE EXCEPTION 'La tasa de interés debe estar entre 0 y 100';
  END IF;

  IF p_max_cuotas_prestamo IS NULL OR p_max_cuotas_prestamo < 1 OR p_max_cuotas_prestamo > 60 THEN
    RAISE EXCEPTION 'El máximo de cuotas debe estar entre 1 y 60';
  END IF;

  IF p_monto_max_prestamo IS NOT NULL AND p_monto_max_prestamo <= 0 THEN
    RAISE EXCEPTION 'El monto máximo debe ser mayor a cero';
  END IF;

  IF p_prestamos_solo_activo IS NULL THEN
    RAISE EXCEPTION 'La regla de préstamos activos es obligatoria';
  END IF;

  SELECT count(*) INTO v_total_participantes
  FROM public.participantes
  WHERE grupo_id = p_grupo_id;

  IF p_numero_integrantes < v_total_participantes THEN
    RAISE EXCEPTION 'La capacidad no puede ser menor al número de socios existentes';
  END IF;

  IF v_grupo.estado <> 'borrador' AND (
    p_numero_integrantes <> v_grupo.numero_integrantes
    OR p_aporte_semanal <> v_grupo.aporte_semanal
  ) THEN
    RAISE EXCEPTION 'La capacidad y el aporte semanal solo se pueden cambiar antes de iniciar el cuadro';
  END IF;

  UPDATE public.grupos
  SET numero_integrantes = p_numero_integrantes,
      aporte_semanal = p_aporte_semanal,
      interes_prestamo = p_interes_prestamo,
      max_cuotas_prestamo = p_max_cuotas_prestamo,
      monto_max_prestamo = p_monto_max_prestamo,
      prestamos_solo_activo = p_prestamos_solo_activo
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object(
    'grupo_id', p_grupo_id,
    'mensaje', 'Configuración del grupo guardada correctamente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, numeric, integer, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_configuracion_administrador(uuid, integer, numeric, numeric, integer, numeric, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';