CREATE TABLE IF NOT EXISTS public.egresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  creado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES public.perfiles(id),
  concepto text NOT NULL CHECK (length(trim(concepto)) BETWEEN 1 AND 500),
  categoria text NOT NULL CHECK (length(trim(categoria)) BETWEEN 1 AND 80),
  monto numeric(12, 2) NOT NULL CHECK (monto > 0),
  fecha date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS egresos_grupo_fecha_idx
  ON public.egresos (grupo_id, fecha DESC, created_at DESC);

ALTER TABLE public.egresos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.egresos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.egresos TO authenticated;

DROP POLICY IF EXISTS egresos_select_tesoreria ON public.egresos;
CREATE POLICY egresos_select_tesoreria
ON public.egresos
FOR SELECT
TO authenticated
USING (
  coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) IN ('administrador', 'tesorero')
  )
);

DROP POLICY IF EXISTS egresos_insert_tesoreria ON public.egresos;
CREATE POLICY egresos_insert_tesoreria
ON public.egresos
FOR INSERT
TO authenticated
WITH CHECK (
  creado_por = auth.uid()
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) IN ('administrador', 'tesorero')
  )
);

CREATE OR REPLACE FUNCTION public.obtener_total_egresos_tesoreria()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede consultar los egresos';
  END IF;

  RETURN (
    SELECT coalesce(sum(egreso.monto), 0)
    FROM public.egresos AS egreso
  );
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_total_egresos_tesoreria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_total_egresos_tesoreria() TO authenticated;

NOTIFY pgrst, 'reload schema';
