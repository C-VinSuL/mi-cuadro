INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'moki-attachments',
  'moki-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS moki_attachments_upload ON storage.objects;
CREATE POLICY moki_attachments_upload
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'moki-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.moki_conversaciones AS conversacion
      WHERE conversacion.id::text = (storage.foldername(name))[1]
        AND conversacion.archivado_en IS NULL
        AND conversacion.actualizado_en > now() - interval '14 days'
        AND conversacion.estado IN ('abierta', 'en_atencion')
        AND (
          conversacion.socio_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.perfiles AS perfil
            WHERE perfil.id = auth.uid()
              AND lower(coalesce(perfil.rol, '')) = 'administrador'
          )
        )
    )
  );

DROP POLICY IF EXISTS moki_attachments_read ON storage.objects;
CREATE POLICY moki_attachments_read
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'moki-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.moki_conversaciones AS conversacion
      WHERE conversacion.id::text = (storage.foldername(name))[1]
        AND (
          (conversacion.socio_id = auth.uid() AND conversacion.archivado_en IS NULL)
          OR EXISTS (
            SELECT 1
            FROM public.perfiles AS perfil
            WHERE perfil.id = auth.uid()
              AND lower(coalesce(perfil.rol, '')) = 'administrador'
          )
        )
    )
  );

DROP POLICY IF EXISTS moki_attachments_delete_own ON storage.objects;
CREATE POLICY moki_attachments_delete_own
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'moki-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

ALTER TABLE public.moki_mensajes
  ADD COLUMN IF NOT EXISTS archivo_path text,
  ADD COLUMN IF NOT EXISTS archivo_nombre text,
  ADD COLUMN IF NOT EXISTS archivo_mime text,
  ADD COLUMN IF NOT EXISTS archivo_tamano bigint;

ALTER TABLE public.moki_mensajes
  ALTER COLUMN contenido DROP NOT NULL;

ALTER TABLE public.moki_mensajes
  DROP CONSTRAINT IF EXISTS moki_mensajes_contenido_check;

ALTER TABLE public.moki_mensajes
  ADD CONSTRAINT moki_mensajes_contenido_o_archivo_check
  CHECK (
    (contenido IS NOT NULL AND length(trim(contenido)) BETWEEN 1 AND 2000)
    OR
    (archivo_path IS NOT NULL AND archivo_nombre IS NOT NULL
      AND archivo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
      AND archivo_tamano BETWEEN 1 AND 5242880)
  );

CREATE OR REPLACE FUNCTION public.moki_enviar_mensaje(
  p_conversacion_id uuid,
  p_mensaje text,
  p_archivo_path text,
  p_archivo_nombre text,
  p_archivo_mime text,
  p_archivo_tamano bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_socio_id uuid;
  v_estado text;
  v_actualizado_en timestamptz;
  v_archivado_en timestamptz;
  v_mensaje text := nullif(trim(coalesce(p_mensaje, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para enviar mensajes';
  END IF;

  IF v_mensaje IS NULL AND p_archivo_path IS NULL THEN
    RAISE EXCEPTION 'Escribe un mensaje o adjunta un archivo';
  END IF;
  IF v_mensaje IS NOT NULL AND length(v_mensaje) > 2000 THEN
    RAISE EXCEPTION 'El mensaje no puede superar 2000 caracteres';
  END IF;

  SELECT lower(coalesce(perfil.rol, ''))
  INTO v_rol
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid();
  IF coalesce(v_rol, '') NOT IN ('socio', 'administrador') THEN
    RAISE EXCEPTION 'Tu rol no puede enviar mensajes a Moki';
  END IF;

  SELECT conversacion.socio_id, conversacion.estado, conversacion.actualizado_en, conversacion.archivado_en
  INTO v_socio_id, v_estado, v_actualizado_en, v_archivado_en
  FROM public.moki_conversaciones AS conversacion
  WHERE conversacion.id = p_conversacion_id
  FOR UPDATE;

  IF NOT FOUND OR v_estado = 'resuelta' OR v_archivado_en IS NOT NULL
    OR v_actualizado_en <= now() - interval '14 days' THEN
    RAISE EXCEPTION 'La conversación finalizó; inicia una nueva consulta si necesitas ayuda';
  END IF;
  IF NOT (
    (v_rol = 'socio' AND v_socio_id = auth.uid())
    OR v_rol = 'administrador'
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para escribir en esta conversación';
  END IF;

  IF p_archivo_path IS NOT NULL THEN
    IF p_archivo_nombre IS NULL
      OR p_archivo_mime IS NULL
      OR p_archivo_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
      OR p_archivo_tamano IS NULL
      OR p_archivo_tamano NOT BETWEEN 1 AND 5242880
      OR p_archivo_path NOT LIKE p_conversacion_id::text || '/' || auth.uid()::text || '/%'
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects AS objeto
        WHERE objeto.bucket_id = 'moki-attachments'
          AND objeto.name = p_archivo_path
          AND objeto.owner_id = auth.uid()::text
      ) THEN
      RAISE EXCEPTION 'El archivo adjunto no es válido o no te pertenece';
    END IF;
  ELSIF p_archivo_nombre IS NOT NULL OR p_archivo_mime IS NOT NULL OR p_archivo_tamano IS NOT NULL THEN
    RAISE EXCEPTION 'Los datos del archivo están incompletos';
  END IF;

  INSERT INTO public.moki_mensajes (
    conversacion_id,
    remitente_id,
    remitente_rol,
    contenido,
    archivo_path,
    archivo_nombre,
    archivo_mime,
    archivo_tamano
  )
  VALUES (
    p_conversacion_id,
    auth.uid(),
    CASE WHEN v_rol = 'administrador' THEN 'administrador' ELSE 'socio' END,
    v_mensaje,
    p_archivo_path,
    p_archivo_nombre,
    p_archivo_mime,
    p_archivo_tamano
  );

  UPDATE public.moki_conversaciones
  SET actualizado_en = now(),
      asignada_a = CASE
        WHEN v_rol = 'administrador' THEN coalesce(asignada_a, auth.uid())
        ELSE asignada_a
      END,
      estado = CASE
        WHEN v_rol = 'administrador' THEN 'en_atencion'
        ELSE estado
      END
  WHERE id = p_conversacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moki_enviar_mensaje(uuid, text, text, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moki_enviar_mensaje(uuid, text, text, text, text, bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
