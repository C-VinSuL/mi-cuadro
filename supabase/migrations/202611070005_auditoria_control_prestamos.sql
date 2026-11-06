CREATE OR REPLACE FUNCTION public.auditoria_listar_prestamos_control(
  p_grupo_id uuid DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE (
  prestamo_id uuid,
  grupo_nombre text,
  participante text,
  monto numeric,
  interes_porcentaje numeric,
  total_pactado numeric,
  estado text,
  fecha_solicitud timestamptz,
  fecha_aprobacion timestamptz,
  cuotas_totales bigint,
  cuotas_pagadas bigint,
  cuotas_vencidas bigint,
  total_pagado numeric,
  saldo_pendiente numeric,
  aprobado_por text,
  movimiento_fondo_asociado numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT public.seguridad_perfil_activo()
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero', 'auditor') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar el control de préstamos';
  END IF;
  IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta < p_desde THEN
    RAISE EXCEPTION 'El período de consulta no es válido';
  END IF;

  RETURN QUERY
  SELECT prestamo.id, grupo.nombre::text, participante.nombre::text,
    prestamo.monto, prestamo.interes_porcentaje, prestamo.total_pagar,
    prestamo.estado::text, prestamo.fecha_solicitud, prestamo.fecha_aprobacion,
    coalesce(cuotas.cantidad, 0), coalesce(cuotas.pagadas, 0),
    coalesce(cuotas.vencidas, 0), coalesce(cuotas.total_pagado, 0),
    CASE
      WHEN prestamo.estado IN ('aprobado', 'pagado')
        THEN greatest(coalesce(prestamo.total_pagar, prestamo.monto) - coalesce(cuotas.total_pagado, 0), 0)
      ELSE 0
    END,
    nullif(trim(concat_ws(' ', aprobador.nombre, aprobador.apellido)), '')::text,
    coalesce(movimientos.total, 0)::numeric
  FROM public.prestamos AS prestamo
  JOIN public.grupos AS grupo ON grupo.id = prestamo.grupo_id
  JOIN public.participantes AS participante ON participante.id = prestamo.participante_id
  LEFT JOIN public.perfiles AS aprobador ON aprobador.id = prestamo.aprobado_por
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS cantidad,
      count(*) FILTER (WHERE cuota.estado = 'pagado')::bigint AS pagadas,
      count(*) FILTER (
        WHERE cuota.estado <> 'pagado'
          AND cuota.fecha_vencimiento < current_date
      )::bigint AS vencidas,
      coalesce(sum(cuota.monto) FILTER (WHERE cuota.estado = 'pagado'), 0)::numeric AS total_pagado
    FROM public.cuotas_prestamo AS cuota
    WHERE cuota.prestamo_id = prestamo.id
  ) AS cuotas ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(movimiento.monto), 0)::numeric AS total
    FROM public.movimientos_fondo AS movimiento
    WHERE movimiento.prestamo_id = prestamo.id
  ) AS movimientos ON true
  WHERE (p_grupo_id IS NULL OR prestamo.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR prestamo.fecha_solicitud::date >= p_desde)
    AND (p_hasta IS NULL OR prestamo.fecha_solicitud::date <= p_hasta)
  ORDER BY prestamo.fecha_solicitud DESC, prestamo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_listar_prestamos_control(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_prestamos_control(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
