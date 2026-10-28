CREATE OR REPLACE FUNCTION public.registrar_agente_usuario_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_headers jsonb;
  v_ip text;
BEGIN
  v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);

  IF NEW.direccion_ip IS NULL THEN
    v_ip := coalesce(
      nullif(v_headers ->> 'x-real-ip', ''),
      nullif(split_part(v_headers ->> 'x-forwarded-for', ',', 1), '')
    );
    IF v_ip IS NOT NULL THEN
      BEGIN
        NEW.direccion_ip := v_ip::inet;
      EXCEPTION WHEN invalid_text_representation THEN
        NEW.direccion_ip := NULL;
      END;
    END IF;
  END IF;

  NEW.agente_usuario := left(coalesce(
    nullif(btrim(NEW.agente_usuario), ''),
    nullif(btrim(v_headers ->> 'x-browser-user-agent'), ''),
    nullif(btrim(v_headers ->> 'user-agent'), '')
  ), 500);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_agente_usuario_auditoria()
  FROM PUBLIC, anon, authenticated;
