CREATE OR REPLACE FUNCTION public.crear_saldo_socio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.rol) = 'socio' THEN
    INSERT INTO public.saldos_socios (perfil_id)
    VALUES (NEW.id)
    ON CONFLICT (perfil_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_billetera_propio()
RETURNS TABLE (saldo numeric, garantia_minima numeric, garantia_cumplida boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT coalesce(cartera.saldo, 0)::numeric,
    configuracion.garantia_minima::numeric,
    coalesce(cartera.saldo, 0) >= configuracion.garantia_minima
  FROM public.configuracion_billetera AS configuracion
  LEFT JOIN public.saldos_socios AS cartera ON cartera.perfil_id = auth.uid()
  WHERE configuracion.singleton;
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_billetera_propio()
RETURNS TABLE (
  id bigint,
  tipo text,
  delta numeric,
  grupo_id uuid,
  periodo integer,
  creado_en timestamptz,
  detalles jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT movimiento.id, movimiento.tipo, movimiento.delta, movimiento.grupo_id,
    movimiento.periodo, movimiento.creado_en, movimiento.detalles
  FROM public.movimientos_billetera AS movimiento
  WHERE movimiento.perfil_id = auth.uid()
  ORDER BY movimiento.creado_en DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitudes_billetera_propias()
RETURNS TABLE (
  id uuid,
  tipo text,
  monto numeric,
  estado text,
  referencia text,
  creada_en timestamptz,
  revisada_en timestamptz,
  nota_revision text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid() AND lower(perfil_auth.rol) = 'socio'
  ) THEN RAISE EXCEPTION 'Solo los socios pueden consultar su billetera'; END IF;
  RETURN QUERY
  SELECT solicitud.id, solicitud.tipo, solicitud.monto, solicitud.estado,
    solicitud.referencia, solicitud.creada_en, solicitud.revisada_en, solicitud.nota_revision
  FROM public.solicitudes_billetera AS solicitud
  WHERE solicitud.perfil_id = auth.uid()
  ORDER BY solicitud.creada_en DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_solicitudes_billetera_admin()
RETURNS TABLE (
  id uuid,
  perfil_id uuid,
  nombre text,
  apellido text,
  tipo text,
  monto numeric,
  referencia text,
  comprobante_path text,
  creada_en timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_auth
    WHERE perfil_auth.id = auth.uid()
      AND lower(perfil_auth.rol) IN ('administrador', 'tesorero')
  ) THEN RAISE EXCEPTION 'Solo administración o tesorería puede revisar movimientos'; END IF;
  RETURN QUERY
  SELECT solicitud.id, solicitud.perfil_id, perfil.nombre::text, perfil.apellido::text,
    solicitud.tipo, solicitud.monto, solicitud.referencia, solicitud.comprobante_path, solicitud.creada_en
  FROM public.solicitudes_billetera AS solicitud
  JOIN public.perfiles AS perfil ON perfil.id = solicitud.perfil_id
  WHERE solicitud.estado = 'pendiente'
  ORDER BY solicitud.creada_en;
END;
$$;

REVOKE ALL ON FUNCTION public.resumen_billetera_propio() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.historial_billetera_propio() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.solicitudes_billetera_propias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_solicitudes_billetera_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_billetera_propio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.historial_billetera_propio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.solicitudes_billetera_propias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_billetera_admin() TO authenticated;
