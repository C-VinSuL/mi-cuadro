ALTER TABLE public.aportes
  ADD COLUMN IF NOT EXISTS comprobante_path text,
  ADD COLUMN IF NOT EXISTS estado_revision text,
  ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_en timestamptz,
  ADD COLUMN IF NOT EXISTS nota_revision text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.aportes'::regclass
      AND conname = 'aportes_estado_revision_check'
  ) THEN
    ALTER TABLE public.aportes
      ADD CONSTRAINT aportes_estado_revision_check
      CHECK (estado_revision IS NULL OR estado_revision IN ('pendiente', 'aprobado', 'rechazado'));
  END IF;
END;
$$;

UPDATE public.aportes
SET estado_revision = 'aprobado'
WHERE estado_revision IS NULL
  AND lower(coalesce(estado, '')) = 'pagado';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contribution-receipts', 'contribution-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

DROP POLICY IF EXISTS contribution_receipts_owner_insert ON storage.objects;
CREATE POLICY contribution_receipts_owner_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contribution-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

DROP POLICY IF EXISTS contribution_receipts_owner_and_staff_read ON storage.objects;
CREATE POLICY contribution_receipts_owner_and_staff_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contribution-receipts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.seguridad_rol_actual() IN ('administrador', 'tesorero')
      AND EXISTS (
        SELECT 1
        FROM public.aportes AS aporte
        WHERE aporte.comprobante_path = name
      )
    )
  )
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

DROP POLICY IF EXISTS contribution_receipts_owner_delete_unlinked ON storage.objects;
CREATE POLICY contribution_receipts_owner_delete_unlinked ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contribution-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  AND NOT EXISTS (
    SELECT 1
    FROM public.aportes AS aporte
    WHERE aporte.comprobante_path = name
  )
);

DROP FUNCTION IF EXISTS public.registrar_aporte_propio(uuid);
CREATE FUNCTION public.registrar_aporte_propio(
  p_participante_id uuid,
  p_comprobante_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participante public.participantes;
  v_aporte numeric;
  v_semana integer;
  v_aporte_id uuid;
  v_estado text;
  v_estado_revision text;
BEGIN
  IF auth.uid() IS NULL
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'socio' THEN
    RAISE EXCEPTION 'Solo un socio puede registrar su propio aporte';
  END IF;
  PERFORM public.exigir_mfa_actual();

  IF p_comprobante_path IS NULL
    OR (storage.foldername(p_comprobante_path))[1] IS DISTINCT FROM auth.uid()::text
    OR p_comprobante_path !~ ('^' || auth.uid()::text || '/[^/]+\.(jpg|png|pdf)$')
    OR NOT EXISTS (
      SELECT 1
      FROM storage.objects AS objeto
      WHERE objeto.bucket_id = 'contribution-receipts'
        AND objeto.name = p_comprobante_path
    ) THEN
    RAISE EXCEPTION 'El comprobante no existe o no pertenece a tu cuenta';
  END IF;

  SELECT participante.*
  INTO v_participante
  FROM public.participantes AS participante
  JOIN public.grupos AS grupo ON grupo.id = participante.grupo_id
  WHERE participante.id = p_participante_id
    AND participante.perfil_id = auth.uid()
    AND grupo.estado = 'activo'
    AND grupo.semana_actual >= 1
  FOR UPDATE OF participante, grupo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes un grupo activo disponible para registrar el aporte';
  END IF;

  SELECT grupo.aporte_semanal, grupo.semana_actual
  INTO v_aporte, v_semana
  FROM public.grupos AS grupo
  WHERE grupo.id = v_participante.grupo_id;

  SELECT aporte.id, aporte.estado, aporte.estado_revision
  INTO v_aporte_id, v_estado, v_estado_revision
  FROM public.aportes AS aporte
  WHERE aporte.participante_id = v_participante.id
    AND aporte.grupo_id = v_participante.grupo_id
    AND aporte.semana = v_semana
  FOR UPDATE;

  IF FOUND AND (
    lower(coalesce(v_estado, '')) = 'pagado'
    OR v_estado_revision IN ('pendiente', 'aprobado')
  ) THEN
    RAISE EXCEPTION 'Ya existe un aporte registrado para este periodo';
  END IF;

  IF v_aporte_id IS NULL THEN
    INSERT INTO public.aportes (
      participante_id, grupo_id, semana, monto, comision_app, estado,
      fecha_pago, comprobante_path, estado_revision, revisado_por, revisado_en, nota_revision
    ) VALUES (
      v_participante.id, v_participante.grupo_id, v_semana, v_aporte, 0, 'pendiente',
      NULL, p_comprobante_path, 'pendiente', NULL, NULL, NULL
    )
    RETURNING id INTO v_aporte_id;
  ELSE
    UPDATE public.aportes
    SET monto = v_aporte,
        comision_app = 0,
        estado = 'pendiente',
        fecha_pago = NULL,
        comprobante_path = p_comprobante_path,
        estado_revision = 'pendiente',
        revisado_por = NULL,
        revisado_en = NULL,
        nota_revision = NULL
    WHERE id = v_aporte_id;
  END IF;

  INSERT INTO public.auditoria_eventos (
    grupo_id, actor_id, objetivo_id, evento, detalles
  ) VALUES (
    v_participante.grupo_id,
    auth.uid(),
    auth.uid(),
    'aporte_comprobante_enviado',
    jsonb_build_object(
      'aporte_id', v_aporte_id,
      'periodo', v_semana,
      'monto', v_aporte
    )
  );

  RETURN v_aporte_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolver_aporte_comprobante(
  p_aporte_id uuid,
  p_aprobar boolean,
  p_nota text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_aporte public.aportes;
  v_participante_perfil_id uuid;
  v_estado_revision text;
BEGIN
  IF auth.uid() IS NULL
    OR public.seguridad_rol_actual() NOT IN ('administrador', 'tesorero') THEN
    RAISE EXCEPTION 'Solo tesorería o administración pueden revisar comprobantes';
  END IF;
  PERFORM public.exigir_mfa_actual();

  IF p_aprobar IS NULL OR length(coalesce(p_nota, '')) > 500 THEN
    RAISE EXCEPTION 'La decisión o nota de revisión no es válida';
  END IF;

  SELECT aporte.*
  INTO v_aporte
  FROM public.aportes AS aporte
  WHERE aporte.id = p_aporte_id
  FOR UPDATE;

  IF NOT FOUND OR v_aporte.estado_revision IS DISTINCT FROM 'pendiente'
    OR v_aporte.comprobante_path IS NULL THEN
    RAISE EXCEPTION 'El aporte no está pendiente de revisión';
  END IF;

  SELECT participante.perfil_id
  INTO v_participante_perfil_id
  FROM public.participantes AS participante
  WHERE participante.id = v_aporte.participante_id;

  v_estado_revision := CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END;

  UPDATE public.aportes
  SET estado = CASE WHEN p_aprobar THEN 'pagado' ELSE 'pendiente' END,
      estado_revision = v_estado_revision,
      fecha_pago = CASE WHEN p_aprobar THEN now() ELSE fecha_pago END,
      revisado_por = auth.uid(),
      revisado_en = now(),
      nota_revision = CASE
        WHEN p_aprobar THEN nullif(trim(p_nota), '')
        ELSE coalesce(nullif(trim(p_nota), ''), 'Comprobante rechazado. Contacta a tesorería para más información.')
      END
  WHERE id = p_aporte_id;

  INSERT INTO public.auditoria_eventos (
    grupo_id, actor_id, objetivo_id, evento, detalles
  ) VALUES (
    v_aporte.grupo_id,
    auth.uid(),
    v_participante_perfil_id,
    CASE WHEN p_aprobar THEN 'aporte_comprobante_aprobado' ELSE 'aporte_comprobante_rechazado' END,
    jsonb_build_object(
      'aporte_id', p_aporte_id,
      'periodo', v_aporte.semana,
      'nota', nullif(trim(p_nota), '')
    )
  );

  RETURN p_aporte_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_aporte_propio(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_aporte_propio(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.resolver_aporte_comprobante(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_aporte_comprobante(uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
