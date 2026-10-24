ALTER TABLE public.aportes
  ADD COLUMN IF NOT EXISTS comprobante_en timestamptz;

UPDATE public.aportes AS aporte
SET comprobante_en = coalesce(
  (
    SELECT max(evento.ocurrido_en)
    FROM public.auditoria_eventos AS evento
    WHERE evento.evento = 'aporte_comprobante_enviado'
      AND evento.detalles ->> 'aporte_id' = aporte.id::text
  ),
  aporte.fecha_pago
)
WHERE aporte.comprobante_path IS NOT NULL
  AND aporte.comprobante_en IS NULL;

CREATE OR REPLACE FUNCTION public.establecer_fecha_comprobante_aporte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.comprobante_path IS NULL THEN
    NEW.comprobante_en := NULL;
  ELSIF TG_OP = 'INSERT'
    OR NEW.comprobante_path IS DISTINCT FROM OLD.comprobante_path
    OR NEW.comprobante_en IS NULL THEN
    NEW.comprobante_en := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aportes_comprobante_timestamp ON public.aportes;
CREATE TRIGGER aportes_comprobante_timestamp
BEFORE INSERT OR UPDATE OF comprobante_path, comprobante_en
ON public.aportes
FOR EACH ROW
EXECUTE FUNCTION public.establecer_fecha_comprobante_aporte();
