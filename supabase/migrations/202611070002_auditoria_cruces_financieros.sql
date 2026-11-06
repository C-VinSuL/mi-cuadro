CREATE OR REPLACE FUNCTION public.auditoria_resumen_control_financiero(
  p_grupo_id uuid DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE (
  grupo_id uuid,
  grupo_nombre text,
  aportes_aprobados numeric,
  cantidad_aportes_aprobados bigint,
  egresos_registrados numeric,
  cantidad_egresos bigint,
  egresos_con_comprobante bigint,
  ingresos_fondo numeric,
  salidas_fondo numeric,
  saldo_neto_fondo numeric,
  billetera_neta numeric,
  entregas_pozo numeric,
  cantidad_entregas bigint,
  diferencia_aportes_ingresos_fondo numeric,
  diferencia_egresos_salidas_fondo numeric
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
    RAISE EXCEPTION 'No tienes permiso para consultar el control financiero';
  END IF;
  IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta < p_desde THEN
    RAISE EXCEPTION 'El período de consulta no es válido';
  END IF;

  RETURN QUERY
  WITH aportes AS (
    SELECT aporte.grupo_id,
      coalesce(sum(aporte.monto), 0)::numeric AS total,
      count(*)::bigint AS cantidad
    FROM public.aportes AS aporte
    WHERE lower(coalesce(aporte.estado, '')) = 'pagado'
      AND (p_grupo_id IS NULL OR aporte.grupo_id = p_grupo_id)
      AND (p_desde IS NULL OR aporte.fecha_pago::date >= p_desde)
      AND (p_hasta IS NULL OR aporte.fecha_pago::date <= p_hasta)
    GROUP BY aporte.grupo_id
  ),
  egresos AS (
    SELECT egreso.grupo_id,
      coalesce(sum(egreso.monto), 0)::numeric AS total,
      count(*)::bigint AS cantidad,
      count(*) FILTER (WHERE egreso.comprobante_path IS NOT NULL)::bigint AS respaldados
    FROM public.egresos AS egreso
    WHERE (p_grupo_id IS NULL OR egreso.grupo_id = p_grupo_id)
      AND (p_desde IS NULL OR egreso.fecha >= p_desde)
      AND (p_hasta IS NULL OR egreso.fecha <= p_hasta)
    GROUP BY egreso.grupo_id
  ),
  fondo AS (
    SELECT movimiento.grupo_id,
      coalesce(sum(movimiento.monto) FILTER (WHERE movimiento.tipo = 'ingreso'), 0)::numeric AS ingresos,
      coalesce(sum(movimiento.monto) FILTER (WHERE movimiento.tipo = 'egreso'), 0)::numeric AS salidas
    FROM public.movimientos_fondo AS movimiento
    WHERE (p_grupo_id IS NULL OR movimiento.grupo_id = p_grupo_id)
      AND (p_desde IS NULL OR movimiento.created_at::date >= p_desde)
      AND (p_hasta IS NULL OR movimiento.created_at::date <= p_hasta)
    GROUP BY movimiento.grupo_id
  ),
  billetera AS (
    SELECT movimiento.grupo_id,
      coalesce(sum(movimiento.delta), 0)::numeric AS neto
    FROM public.movimientos_billetera AS movimiento
    WHERE movimiento.grupo_id IS NOT NULL
      AND (p_grupo_id IS NULL OR movimiento.grupo_id = p_grupo_id)
      AND (p_desde IS NULL OR movimiento.creado_en::date >= p_desde)
      AND (p_hasta IS NULL OR movimiento.creado_en::date <= p_hasta)
    GROUP BY movimiento.grupo_id
  ),
  entregas AS (
    SELECT entrega.grupo_id,
      coalesce(sum(entrega.monto), 0)::numeric AS total,
      count(*)::bigint AS cantidad
    FROM public.entregas AS entrega
    WHERE (p_grupo_id IS NULL OR entrega.grupo_id = p_grupo_id)
      AND (p_desde IS NULL OR entrega.fecha_entrega::date >= p_desde)
      AND (p_hasta IS NULL OR entrega.fecha_entrega::date <= p_hasta)
    GROUP BY entrega.grupo_id
  )
  SELECT grupo.id,
    grupo.nombre::text,
    coalesce(aportes.total, 0),
    coalesce(aportes.cantidad, 0),
    coalesce(egresos.total, 0),
    coalesce(egresos.cantidad, 0),
    coalesce(egresos.respaldados, 0),
    coalesce(fondo.ingresos, 0),
    coalesce(fondo.salidas, 0),
    coalesce(fondo.ingresos, 0) - coalesce(fondo.salidas, 0),
    coalesce(billetera.neto, 0),
    coalesce(entregas.total, 0),
    coalesce(entregas.cantidad, 0),
    coalesce(aportes.total, 0) - coalesce(fondo.ingresos, 0),
    coalesce(egresos.total, 0) - coalesce(fondo.salidas, 0)
  FROM public.grupos AS grupo
  LEFT JOIN aportes ON aportes.grupo_id = grupo.id
  LEFT JOIN egresos ON egresos.grupo_id = grupo.id
  LEFT JOIN fondo ON fondo.grupo_id = grupo.id
  LEFT JOIN billetera ON billetera.grupo_id = grupo.id
  LEFT JOIN entregas ON entregas.grupo_id = grupo.id
  WHERE p_grupo_id IS NULL OR grupo.id = p_grupo_id
  ORDER BY grupo.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_listar_egresos_control(
  p_grupo_id uuid DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE (
  egreso_id uuid,
  grupo_id uuid,
  grupo_nombre text,
  concepto text,
  categoria text,
  monto numeric,
  fecha date,
  comprobante_path text
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
    RAISE EXCEPTION 'No tienes permiso para consultar los egresos de auditoría';
  END IF;
  IF p_desde IS NOT NULL AND p_hasta IS NOT NULL AND p_hasta < p_desde THEN
    RAISE EXCEPTION 'El período de consulta no es válido';
  END IF;

  RETURN QUERY
  SELECT egreso.id, egreso.grupo_id, grupo.nombre::text, egreso.concepto,
    egreso.categoria, egreso.monto, egreso.fecha, egreso.comprobante_path
  FROM public.egresos AS egreso
  JOIN public.grupos AS grupo ON grupo.id = egreso.grupo_id
  WHERE (p_grupo_id IS NULL OR egreso.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR egreso.fecha >= p_desde)
    AND (p_hasta IS NULL OR egreso.fecha <= p_hasta)
  ORDER BY egreso.fecha DESC, egreso.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_resumen_control_financiero(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_listar_egresos_control(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_resumen_control_financiero(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_listar_egresos_control(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
