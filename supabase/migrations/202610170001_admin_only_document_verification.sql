CREATE OR REPLACE FUNCTION public.listar_documentos_pendientes_tesorero()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  cedula text,
  direccion text,
  documento_identidad_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede revisar documentos';
  END IF;

  RETURN QUERY
  SELECT perfil.id, perfil.nombre::text, perfil.apellido::text, perfil.telefono::text,
    datos.cedula, datos.direccion, datos.documento_identidad_path
  FROM public.perfiles AS perfil
  JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE NOT datos.documento_verificado
    AND datos.documento_identidad_path IS NOT NULL
  ORDER BY perfil.apellido, perfil.nombre
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_documento_tesorero(p_perfil_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede registrar la verificación documental';
  END IF;
  IF p_perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes verificar tu propio documento';
  END IF;

  UPDATE public.datos_personales_privados
  SET documento_verificado = true,
      verificado_por = auth.uid(),
      verificado_en = now()
  WHERE perfil_id = p_perfil_id
    AND cedula IS NOT NULL
    AND documento_identidad_path IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El socio no tiene cédula y documento cargados';
  END IF;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento)
  VALUES (auth.uid(), p_perfil_id, 'documento_personal_verificado');
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_rol_perfil_administrador(
  p_perfil_id uuid,
  p_nuevo_rol text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rol_anterior text;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND lower(rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles';
  END IF;
  IF p_nuevo_rol NOT IN ('socio', 'tesorero', 'auditor', 'administrador') THEN
    RAISE EXCEPTION 'El rol solicitado no es válido';
  END IF;
  IF p_nuevo_rol <> 'socio' AND NOT EXISTS (
    SELECT 1 FROM public.datos_personales_privados
    WHERE perfil_id = p_perfil_id AND documento_verificado
  ) THEN
    RAISE EXCEPTION 'El administrador debe verificar el documento antes de asignar un rol elevado';
  END IF;

  SELECT rol INTO v_rol_anterior FROM public.perfiles WHERE id = p_perfil_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El perfil no existe';
  END IF;
  IF p_perfil_id = auth.uid() AND p_nuevo_rol <> v_rol_anterior THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;

  UPDATE public.perfiles SET rol = p_nuevo_rol WHERE id = p_perfil_id;
  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (auth.uid(), p_perfil_id, 'rol_perfil_actualizado',
    jsonb_build_object('rol_anterior', v_rol_anterior, 'rol_nuevo', p_nuevo_rol));
END;
$$;

DROP POLICY IF EXISTS identity_documents_owner_read ON storage.objects;
CREATE POLICY identity_documents_owner_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'identity-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.perfiles AS perfil_actual
      WHERE perfil_actual.id = auth.uid()
        AND lower(perfil_actual.rol) = 'administrador'
    )
  )
  AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
);

NOTIFY pgrst, 'reload schema';
