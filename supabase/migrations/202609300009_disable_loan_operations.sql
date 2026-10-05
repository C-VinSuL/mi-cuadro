DO $$
DECLARE
  function_signature regprocedure;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN (
        'solicitar_prestamo',
        'aprobar_prestamo',
        'rechazar_prestamo',
        'pagar_cuota_prestamo'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';