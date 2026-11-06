ALTER TABLE public.egresos
  ADD COLUMN IF NOT EXISTS comprobante_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.egreso_comprobante_carga_permitida(p_ruta text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.seguridad_perfil_activo()
    AND public.seguridad_rol_actual() IN ('administrador', 'tesorero')
    AND p_ruta ~ (
      '^' || auth.uid()::text || '/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,180}$'
    )
$$;

CREATE OR REPLACE FUNCTION public.egreso_comprobante_lectura_permitida(p_ruta text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.seguridad_perfil_activo()
    AND public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
    AND EXISTS (
      SELECT 1
      FROM public.egresos AS egreso
      WHERE egreso.comprobante_path = p_ruta
    )
$$;

REVOKE ALL ON FUNCTION public.egreso_comprobante_carga_permitida(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.egreso_comprobante_lectura_permitida(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.egreso_comprobante_carga_permitida(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.egreso_comprobante_lectura_permitida(text) TO authenticated;

DROP POLICY IF EXISTS egreso_comprobantes_privados_read ON storage.objects;
CREATE POLICY egreso_comprobantes_privados_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.egreso_comprobante_lectura_permitida(name)
);

DROP POLICY IF EXISTS egreso_comprobantes_tesoreria_upload ON storage.objects;
CREATE POLICY egreso_comprobantes_tesoreria_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.egreso_comprobante_carga_permitida(name)
);

DROP POLICY IF EXISTS egreso_comprobantes_huerfanos_cleanup ON storage.objects;
CREATE POLICY egreso_comprobantes_huerfanos_cleanup
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.egreso_comprobante_carga_permitida(name)
  AND NOT EXISTS (
    SELECT 1 FROM public.egresos AS egreso
    WHERE egreso.comprobante_path = name
  )
);

CREATE OR REPLACE FUNCTION public.validar_comprobante_egreso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $$
BEGIN
  IF NEW.comprobante_path IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM storage.objects AS objeto
    WHERE objeto.bucket_id = 'expense-receipts'
      AND objeto.name = NEW.comprobante_path
      AND split_part(objeto.name, '/', 1) = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'El comprobante del egreso no existe o no pertenece a la sesión actual';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS egreso_validar_comprobante ON public.egresos;
CREATE TRIGGER egreso_validar_comprobante
BEFORE INSERT ON public.egresos
FOR EACH ROW EXECUTE FUNCTION public.validar_comprobante_egreso();

NOTIFY pgrst, 'reload schema';
