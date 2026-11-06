CREATE OR REPLACE FUNCTION public.cerrar_ronda(p_grupo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_usuario uuid;
  v_rol text;
  v_grupo public.grupos%ROWTYPE;
  v_total_participantes integer;
  v_total_pagados integer;
  v_beneficiario_id uuid;
  v_beneficiario_perfil_id uuid;
  v_beneficiario_nombre text;
  v_beneficiario_posicion integer;
  v_entrega_id uuid;
  v_pozo numeric(12, 2);
  v_ya_recibio boolean;
BEGIN
  v_usuario := auth.uid();
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  PERFORM public.exigir_mfa_actual();

  SELECT lower(perfil.rol)
  INTO v_rol
  FROM public.perfiles AS perfil
  WHERE perfil.id = v_usuario;

  IF v_rol IS NULL OR v_rol NOT IN ('administrador', 'tesorero') THEN
    RAISE EXCEPTION 'No tienes permisos para cerrar una ronda.';
  END IF;

  IF p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar un grupo válido.';
  END IF;

  SELECT *
  INTO v_grupo
  FROM public.grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El grupo no existe.';
  END IF;

  IF v_grupo.estado <> 'activo' THEN
    RAISE EXCEPTION 'El cuadro debe estar activo para cerrar una ronda.';
  END IF;

  IF coalesce(v_grupo.numero_integrantes, 0) <= 0
    OR coalesce(v_grupo.semana_actual, 0) <= 0
    OR coalesce(v_grupo.aporte_semanal, 0) <= 0 THEN
    RAISE EXCEPTION 'La configuración del cuadro no permite cerrar esta ronda.';
  END IF;

  SELECT count(*)
  INTO v_total_participantes
  FROM public.participantes
  WHERE grupo_id = p_grupo_id;

  IF v_total_participantes <> v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'La cantidad real de participantes no coincide con la capacidad del cuadro.';
  END IF;

  SELECT participante.id, participante.perfil_id, participante.nombre, participante.posicion
  INTO v_beneficiario_id, v_beneficiario_perfil_id, v_beneficiario_nombre, v_beneficiario_posicion
  FROM public.participantes AS participante
  WHERE participante.grupo_id = p_grupo_id
    AND participante.posicion = v_grupo.semana_actual;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un participante asignado a la posición de esta ronda.';
  END IF;

  IF v_beneficiario_perfil_id IS NULL THEN
    RAISE EXCEPTION 'El beneficiario de esta ronda no tiene una cuenta vinculada para recibir el saldo.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.entregas AS entrega
    WHERE entrega.grupo_id = p_grupo_id
      AND entrega.participante_id = v_beneficiario_id
  )
  INTO v_ya_recibio;

  IF v_ya_recibio THEN
    RAISE EXCEPTION 'El beneficiario de esta ronda ya recibió anteriormente.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.entregas AS entrega
    WHERE entrega.grupo_id = p_grupo_id
      AND entrega.semana = v_grupo.semana_actual
  ) THEN
    RAISE EXCEPTION 'Ya existe una entrega registrada para esta ronda.';
  END IF;

  SELECT count(DISTINCT aporte.participante_id)
  INTO v_total_pagados
  FROM public.aportes AS aporte
  WHERE aporte.grupo_id = p_grupo_id
    AND aporte.semana = v_grupo.semana_actual
    AND aporte.estado = 'pagado';

  IF v_total_pagados <> v_grupo.numero_integrantes THEN
    RAISE EXCEPTION 'No todos los integrantes han realizado el aporte de esta ronda.';
  END IF;

  v_pozo := round(v_grupo.numero_integrantes * v_grupo.aporte_semanal, 2);
  IF v_pozo <= 0 THEN
    RAISE EXCEPTION 'El monto de la entrega debe ser mayor a cero.';
  END IF;

  INSERT INTO public.entregas (
    grupo_id,
    participante_id,
    semana,
    monto,
    fecha_entrega
  )
  VALUES (
    p_grupo_id,
    v_beneficiario_id,
    v_grupo.semana_actual,
    v_pozo,
    current_date
  )
  RETURNING id INTO v_entrega_id;

  INSERT INTO public.saldos_socios (perfil_id)
  VALUES (v_beneficiario_perfil_id)
  ON CONFLICT (perfil_id) DO NOTHING;

  UPDATE public.saldos_socios
  SET saldo = saldo + v_pozo,
      actualizado_en = now()
  WHERE perfil_id = v_beneficiario_perfil_id;

  INSERT INTO public.movimientos_billetera (
    perfil_id,
    tipo,
    delta,
    grupo_id,
    periodo,
    detalles,
    entrega_id
  )
  VALUES (
    v_beneficiario_perfil_id,
    'entrega_cuadro',
    v_pozo,
    p_grupo_id,
    v_grupo.semana_actual,
    jsonb_build_object(
      'origen', 'entrega_ronda',
      'entrega_id', v_entrega_id,
      'participante_id', v_beneficiario_id,
      'semana', v_grupo.semana_actual
    ),
    v_entrega_id
  );

  IF v_grupo.semana_actual >= v_grupo.numero_integrantes THEN
    UPDATE public.grupos
    SET estado = 'finalizado'
    WHERE id = p_grupo_id;

    RETURN jsonb_build_object(
      'ok', true,
      'semana_cerrada', v_grupo.semana_actual,
      'beneficiario_id', v_beneficiario_id,
      'beneficiario', v_beneficiario_nombre,
      'posicion', v_beneficiario_posicion,
      'monto_entregado', v_pozo,
      'estado', 'finalizado',
      'mensaje', 'Última ronda cerrada. La entrega fue acreditada en la billetera del beneficiario y el cuadro ha finalizado.'
    );
  END IF;

  UPDATE public.grupos
  SET semana_actual = v_grupo.semana_actual + 1
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'semana_cerrada', v_grupo.semana_actual,
    'beneficiario_id', v_beneficiario_id,
    'beneficiario', v_beneficiario_nombre,
    'posicion', v_beneficiario_posicion,
    'monto_entregado', v_pozo,
    'semana_actual', v_grupo.semana_actual + 1,
    'estado', 'activo',
    'mensaje', 'Ronda cerrada y entrega acreditada en la billetera del beneficiario.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cerrar_ronda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_ronda(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
