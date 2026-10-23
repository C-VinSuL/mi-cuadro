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

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (
    auth.uid(),
    p_perfil_id,
    'documento_personal_verificado',
    jsonb_build_object(
      'mensaje', 'Se verificó el documento de identidad del socio. No se incluyen datos del documento.',
      'estado_anterior', 'pendiente',
      'estado_nuevo', 'verificado'
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
