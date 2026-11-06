CREATE OR REPLACE FUNCTION public.auditoria_registrar_egreso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    NEW.grupo_id,
    coalesce(auth.uid(), NEW.creado_por),
    'egreso_registrado',
    jsonb_build_object(
      'egreso_id', NEW.id,
      'concepto', NEW.concepto,
      'categoria', NEW.categoria,
      'monto', NEW.monto,
      'fecha', NEW.fecha,
      'comprobante_adjunto', NEW.comprobante_path IS NOT NULL
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS egresos_auditoria_registro ON public.egresos;
CREATE TRIGGER egresos_auditoria_registro
AFTER INSERT ON public.egresos
FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar_egreso();

CREATE OR REPLACE FUNCTION public.auditoria_registrar_entrega_ronda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  VALUES (
    NEW.grupo_id,
    auth.uid(),
    'entrega_ronda_registrada',
    jsonb_build_object(
      'entrega_id', NEW.id,
      'participante_id', NEW.participante_id,
      'periodo', NEW.semana,
      'monto', NEW.monto,
      'fecha_entrega', NEW.fecha_entrega
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entregas_auditoria_registro ON public.entregas;
CREATE TRIGGER entregas_auditoria_registro
AFTER INSERT ON public.entregas
FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar_entrega_ronda();

CREATE OR REPLACE FUNCTION public.auditoria_registrar_ciclo_prestamo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento text;
  v_estado_anterior text;
BEGIN
  IF TG_TABLE_NAME = 'prestamos' THEN
    v_estado_anterior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado::text END;
    v_evento := CASE
      WHEN TG_OP = 'INSERT' THEN 'prestamo_solicitado'
      WHEN NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado = 'aprobado' THEN 'prestamo_aprobado'
      WHEN NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado = 'rechazado' THEN 'prestamo_rechazado'
      ELSE 'prestamo_actualizado'
    END;
    INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
    VALUES (
      NEW.grupo_id, auth.uid(), v_evento,
      jsonb_build_object(
        'prestamo_id', NEW.id,
        'monto', NEW.monto,
        'interes_porcentaje', NEW.interes_porcentaje,
        'numero_cuotas', NEW.numero_cuotas,
        'total_pactado', NEW.total_pagar,
        'aprobado_por', NEW.aprobado_por,
        'fecha_aprobacion', NEW.fecha_aprobacion,
        'estado_anterior', v_estado_anterior,
        'estado_nuevo', NEW.estado
      )
    );
    RETURN NEW;
  END IF;

  v_estado_anterior := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado::text END;
  v_evento := CASE
    WHEN NEW.estado = 'pagado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado)
      THEN 'cuota_prestamo_pagada'
    ELSE 'cuota_prestamo_actualizada'
  END;
  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, evento, detalles)
  SELECT prestamo.grupo_id, auth.uid(), v_evento,
    jsonb_build_object(
      'prestamo_id', NEW.prestamo_id,
      'cuota_id', NEW.id,
      'monto', NEW.monto,
      'fecha_vencimiento', NEW.fecha_vencimiento,
      'estado_anterior', v_estado_anterior,
      'estado_nuevo', NEW.estado
    )
  FROM public.prestamos AS prestamo
  WHERE prestamo.id = NEW.prestamo_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prestamos_auditoria_ciclo ON public.prestamos;
CREATE TRIGGER prestamos_auditoria_ciclo
AFTER INSERT OR UPDATE ON public.prestamos
FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar_ciclo_prestamo();

DROP TRIGGER IF EXISTS cuotas_prestamo_auditoria_ciclo ON public.cuotas_prestamo;
CREATE TRIGGER cuotas_prestamo_auditoria_ciclo
AFTER INSERT OR UPDATE ON public.cuotas_prestamo
FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar_ciclo_prestamo();

NOTIFY pgrst, 'reload schema';
