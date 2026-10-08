CREATE OR REPLACE FUNCTION public.listar_documentos_pendientes_tesorero()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  cedula text,
  direccion text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede revisar documentos';
  END IF;

  RETURN QUERY
  SELECT perfil.id,
    perfil.nombre::text,
    perfil.apellido::text,
    perfil.telefono::text,
    datos.cedula,
    datos.direccion
  FROM public.perfiles AS perfil
  JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE NOT datos.documento_verificado
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
    SELECT 1
    FROM public.perfiles AS perfil_actual
    WHERE perfil_actual.id = auth.uid()
      AND lower(perfil_actual.rol) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede registrar la verificación documental';
  END IF;
  IF p_perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes verificar tu propio documento';
  END IF;

  UPDATE public.datos_personales_privados
  SET documento_verificado = true,
      verificado_por = auth.uid(),
      verificado_en = now()
  WHERE perfil_id = p_perfil_id
    AND cedula IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El socio no tiene un documento registrado';
  END IF;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento)
  VALUES (auth.uid(), p_perfil_id, 'documento_personal_verificado');
END;
$$;

REVOKE ALL ON FUNCTION public.listar_documentos_pendientes_tesorero() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verificar_documento_tesorero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_documentos_pendientes_tesorero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_documento_tesorero(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
