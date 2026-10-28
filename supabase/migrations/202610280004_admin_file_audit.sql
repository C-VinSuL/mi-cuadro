CREATE OR REPLACE FUNCTION public.listar_archivos_auditoria_administrador(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  bucket_id text,
  object_path text,
  nombre_archivo text,
  categoria text,
  propietario text,
  creado_en timestamptz,
  contexto text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(perfil.rol) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el archivo de auditoría';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
    OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'La paginación solicitada no es válida';
  END IF;

  RETURN QUERY
  SELECT
    objeto.bucket_id::text,
    objeto.name::text,
    CASE WHEN objeto.bucket_id = 'moki-attachments' THEN coalesce((
      SELECT mensaje.archivo_nombre
      FROM public.moki_mensajes AS mensaje
      WHERE mensaje.archivo_path = objeto.name
      LIMIT 1
    ), regexp_replace(objeto.name, '^.*/', ''))
    ELSE regexp_replace(objeto.name, '^.*/', '') END::text,
    CASE objeto.bucket_id
      WHEN 'identity-documents' THEN 'Documento de identidad'
      WHEN 'wallet-receipts' THEN 'Comprobante de billetera'
      WHEN 'contribution-receipts' THEN 'Comprobante de aporte'
      WHEN 'moki-attachments' THEN 'Adjunto de Moki'
      ELSE 'Avatar de perfil'
    END::text,
    coalesce(nullif(trim(concat_ws(' ', perfil.nombre, perfil.apellido)), ''), 'Cuenta no disponible')::text,
    objeto.created_at,
    CASE objeto.bucket_id
      WHEN 'identity-documents' THEN coalesce((
        SELECT CASE WHEN datos.documento_verificado THEN 'Verificado' ELSE 'Pendiente de verificación' END
        FROM public.datos_personales_privados AS datos
        WHERE datos.documento_identidad_path = objeto.name
        LIMIT 1
      ), 'Archivo sin registro vinculado')
      WHEN 'wallet-receipts' THEN coalesce((
        SELECT initcap(solicitud.tipo) || ' · ' || initcap(solicitud.estado) || ' · $'
          || to_char(solicitud.monto, 'FM999999990.00')
        FROM public.solicitudes_billetera AS solicitud
        WHERE solicitud.comprobante_path = objeto.name
        LIMIT 1
      ), 'Archivo sin registro vinculado')
      WHEN 'contribution-receipts' THEN coalesce((
        SELECT coalesce(grupo.nombre, 'Grupo') || ' · Periodo ' || aporte.semana::text
          || ' · ' || initcap(coalesce(aporte.estado_revision, aporte.estado, 'pendiente'))
        FROM public.aportes AS aporte
        LEFT JOIN public.grupos AS grupo ON grupo.id = aporte.grupo_id
        WHERE aporte.comprobante_path = objeto.name
        LIMIT 1
      ), 'Archivo sin registro vinculado')
      WHEN 'moki-attachments' THEN coalesce((
        SELECT 'Conversación con '
          || coalesce(nullif(trim(concat_ws(' ', socio.nombre, socio.apellido)), ''), 'socio')
        FROM public.moki_mensajes AS mensaje
        JOIN public.moki_conversaciones AS conversacion
          ON conversacion.id = mensaje.conversacion_id
        JOIN public.perfiles AS socio ON socio.id = conversacion.socio_id
        WHERE mensaje.archivo_path = objeto.name
        LIMIT 1
      ), 'Adjunto sin registro de conversación')
      ELSE 'Imagen de perfil pública'
    END::text,
    count(*) OVER ()::bigint
  FROM storage.objects AS objeto
  LEFT JOIN public.perfiles AS perfil
    ON perfil.id::text = CASE
      WHEN objeto.bucket_id = 'moki-attachments'
        THEN (storage.foldername(objeto.name))[2]
      ELSE (storage.foldername(objeto.name))[1]
    END
  WHERE objeto.bucket_id IN (
    'identity-documents',
    'wallet-receipts',
    'contribution-receipts',
    'moki-attachments',
    'profile-avatars'
  )
  ORDER BY objeto.created_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_archivos_auditoria_administrador(integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_archivos_auditoria_administrador(integer, integer)
  TO authenticated;
