CREATE OR REPLACE FUNCTION public.registrar_agente_usuario_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_request_headers jsonb;
BEGIN
  v_request_headers := nullif(current_setting('request.headers', true), '')::jsonb;

  NEW.agente_usuario := left(
    coalesce(
      nullif(btrim(NEW.agente_usuario), ''),
      nullif(btrim(v_request_headers ->> 'x-browser-user-agent'), ''),
      nullif(btrim(v_request_headers ->> 'user-agent'), '')
    ),
    500
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_agente_usuario_auditoria() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auditoria_eventos_registrar_agente_usuario ON public.auditoria_eventos;
CREATE TRIGGER auditoria_eventos_registrar_agente_usuario
BEFORE INSERT ON public.auditoria_eventos
FOR EACH ROW
EXECUTE FUNCTION public.registrar_agente_usuario_auditoria();
