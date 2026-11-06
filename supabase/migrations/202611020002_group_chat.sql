CREATE TABLE public.chat_canales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('grupo', 'equipo')),
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_canales_tipo_grupo_check
    CHECK (
      (tipo = 'grupo' AND grupo_id IS NOT NULL)
      OR (tipo = 'equipo' AND grupo_id IS NULL)
    )
);

CREATE UNIQUE INDEX chat_canales_grupo_unique
  ON public.chat_canales (grupo_id)
  WHERE tipo = 'grupo';

CREATE UNIQUE INDEX chat_canales_equipo_unique
  ON public.chat_canales (tipo)
  WHERE tipo = 'equipo';

CREATE TABLE public.chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.chat_canales(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  contenido text NOT NULL CHECK (length(trim(contenido)) BETWEEN 1 AND 2000),
  tipo text NOT NULL CHECK (tipo IN ('texto', 'imagen')),
  adjunto_path text,
  responde_a uuid REFERENCES public.chat_mensajes(id) ON DELETE SET NULL,
  eliminado boolean NOT NULL DEFAULT false,
  eliminado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_mensajes_adjunto_tipo_check
    CHECK ((tipo = 'imagen' AND adjunto_path IS NOT NULL) OR (tipo = 'texto' AND adjunto_path IS NULL))
);

CREATE INDEX chat_mensajes_canal_creado_idx
  ON public.chat_mensajes (canal_id, creado_en DESC, id DESC);

CREATE INDEX chat_mensajes_autor_creado_idx
  ON public.chat_mensajes (autor_id, creado_en DESC);

CREATE TABLE public.chat_lecturas (
  canal_id uuid NOT NULL REFERENCES public.chat_canales(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  ultima_lectura timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, usuario_id)
);

CREATE TABLE public.chat_silenciados (
  canal_id uuid NOT NULL REFERENCES public.chat_canales(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  hasta timestamptz NOT NULL,
  motivo text NOT NULL CHECK (length(trim(motivo)) BETWEEN 1 AND 500),
  silenciado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  PRIMARY KEY (canal_id, usuario_id)
);

ALTER TABLE public.chat_canales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_lecturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_silenciados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_canales, public.chat_mensajes,
  public.chat_lecturas, public.chat_silenciados
FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_puede_acceder(p_canal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.chat_canales AS canal
      JOIN public.perfiles AS perfil ON perfil.id = auth.uid()
      WHERE canal.id = p_canal_id
        AND perfil.activo
        AND (
          (
            canal.tipo = 'equipo'
            AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
          )
          OR (
            canal.tipo = 'grupo'
            AND (
              lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
              OR (
                lower(coalesce(perfil.rol, '')) = 'socio'
                AND EXISTS (
                  SELECT 1
                  FROM public.participantes AS participante
                  WHERE participante.grupo_id = canal.grupo_id
                    AND participante.perfil_id = perfil.id
                )
              )
            )
          )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.chat_nombre_visible(p_nombre text, p_apellido text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.perfiles AS perfil
      WHERE perfil.id = auth.uid()
        AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
    )
    THEN coalesce(
      nullif(trim(concat_ws(' ', nullif(trim(p_nombre), ''), nullif(trim(p_apellido), ''))), ''),
      'Usuario'
    )
    ELSE trim(
      coalesce(nullif(trim(p_nombre), ''), 'Usuario')
      || CASE
        WHEN nullif(trim(p_apellido), '') IS NULL THEN ''
        ELSE ' ' || left(trim(p_apellido), 1) || '.'
      END
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.chat_puede_acceder_ruta(p_nombre text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canal_texto text := split_part(coalesce(p_nombre, ''), '/', 1);
BEGIN
  IF v_canal_texto !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN false;
  END IF;

  RETURN public.chat_puede_acceder(v_canal_texto::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.chat_puede_acceder(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_nombre_visible(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_puede_acceder_ruta(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_puede_acceder(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_nombre_visible(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_puede_acceder_ruta(text) TO authenticated;

DROP POLICY IF EXISTS chat_canales_accesibles ON public.chat_canales;
CREATE POLICY chat_canales_accesibles
  ON public.chat_canales
  FOR SELECT TO authenticated
  USING (public.chat_puede_acceder(id));

DROP POLICY IF EXISTS chat_mensajes_accesibles ON public.chat_mensajes;
CREATE POLICY chat_mensajes_accesibles
  ON public.chat_mensajes
  FOR SELECT TO authenticated
  USING (public.chat_puede_acceder(canal_id));

DROP POLICY IF EXISTS chat_lecturas_propias ON public.chat_lecturas;
CREATE POLICY chat_lecturas_propias
  ON public.chat_lecturas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND public.chat_puede_acceder(canal_id));

DROP POLICY IF EXISTS chat_silenciados_propios ON public.chat_silenciados;
CREATE POLICY chat_silenciados_propios
  ON public.chat_silenciados
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND public.chat_puede_acceder(canal_id));

GRANT SELECT ON public.chat_canales, public.chat_mensajes,
  public.chat_lecturas, public.chat_silenciados
TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_crear_canal_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.chat_canales (tipo, grupo_id, nombre)
  VALUES ('grupo', NEW.id, NEW.nombre)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_renombrar_canal_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.chat_canales
  SET nombre = NEW.nombre
  WHERE tipo = 'grupo' AND grupo_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_crear_canal_grupo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_renombrar_canal_grupo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_crear_canal_grupo ON public.grupos;
CREATE TRIGGER chat_crear_canal_grupo
  AFTER INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.chat_crear_canal_grupo();

DROP TRIGGER IF EXISTS chat_renombrar_canal_grupo ON public.grupos;
CREATE TRIGGER chat_renombrar_canal_grupo
  AFTER UPDATE OF nombre ON public.grupos
  FOR EACH ROW
  WHEN (OLD.nombre IS DISTINCT FROM NEW.nombre)
  EXECUTE FUNCTION public.chat_renombrar_canal_grupo();

INSERT INTO public.chat_canales (tipo, grupo_id, nombre)
SELECT 'grupo', grupo.id, grupo.nombre
FROM public.grupos AS grupo
ON CONFLICT DO NOTHING;

INSERT INTO public.chat_canales (tipo, grupo_id, nombre)
VALUES ('equipo', NULL, 'Equipo')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.chat_listar_canales()
RETURNS TABLE (
  canal_id uuid,
  tipo text,
  grupo_id uuid,
  nombre text,
  ultimo_mensaje text,
  ultima_hora timestamptz,
  no_leidos bigint,
  integrantes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();

  RETURN QUERY
  SELECT
    canal.id,
    canal.tipo,
    canal.grupo_id,
    canal.nombre,
    CASE
      WHEN ultimo.eliminado THEN 'Mensaje eliminado por moderación'
      WHEN ultimo.adjunto_path IS NOT NULL THEN 'Imagen'
      ELSE ultimo.contenido
    END,
    ultimo.creado_en,
    (
      SELECT count(*)::bigint
      FROM public.chat_mensajes AS mensaje
      LEFT JOIN public.chat_lecturas AS lectura
        ON lectura.canal_id = canal.id
        AND lectura.usuario_id = auth.uid()
      WHERE mensaje.canal_id = canal.id
        AND mensaje.autor_id IS DISTINCT FROM auth.uid()
        AND NOT mensaje.eliminado
        AND mensaje.creado_en > coalesce(lectura.ultima_lectura, '-infinity'::timestamptz)
    ),
    (
      SELECT count(*)::bigint
      FROM public.perfiles AS perfil_staff
      WHERE perfil_staff.activo
        AND lower(coalesce(perfil_staff.rol, '')) IN ('administrador', 'tesorero')
    ) + CASE
      WHEN canal.tipo = 'grupo' THEN (
        SELECT count(*)::bigint
        FROM public.participantes AS participante
        JOIN public.perfiles AS perfil_socio ON perfil_socio.id = participante.perfil_id
        WHERE participante.grupo_id = canal.grupo_id
          AND lower(coalesce(perfil_socio.rol, '')) = 'socio'
          AND perfil_socio.activo
      )
      ELSE 0
    END
  FROM public.chat_canales AS canal
  LEFT JOIN LATERAL (
    SELECT mensaje.contenido, mensaje.adjunto_path, mensaje.eliminado, mensaje.creado_en
    FROM public.chat_mensajes AS mensaje
    WHERE mensaje.canal_id = canal.id
    ORDER BY mensaje.creado_en DESC, mensaje.id DESC
    LIMIT 1
  ) AS ultimo ON true
  WHERE public.chat_puede_acceder(canal.id)
  ORDER BY coalesce(ultimo.creado_en, canal.creado_en) DESC, canal.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_listar_mensajes(
  p_canal_id uuid,
  p_antes timestamptz DEFAULT NULL,
  p_limite integer DEFAULT 30,
  p_antes_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  canal_id uuid,
  autor_id uuid,
  autor_nombre text,
  autor_rol text,
  contenido text,
  tipo text,
  adjunto_path text,
  responde_a uuid,
  respuesta_contenido text,
  respuesta_autor_nombre text,
  eliminado boolean,
  eliminado_por uuid,
  creado_en timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF NOT public.chat_puede_acceder(p_canal_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este canal';
  END IF;
  IF p_limite NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'El límite de mensajes debe estar entre 1 y 100';
  END IF;

  RETURN QUERY
  SELECT
    mensaje.id,
    mensaje.canal_id,
    mensaje.autor_id,
    CASE
      WHEN autor.id IS NULL THEN 'Usuario eliminado'
      ELSE public.chat_nombre_visible(autor.nombre, autor.apellido)
    END,
    coalesce(lower(autor.rol), 'usuario'),
    CASE
      WHEN mensaje.eliminado THEN 'Mensaje eliminado por moderación'
      ELSE mensaje.contenido
    END,
    mensaje.tipo,
    CASE WHEN mensaje.eliminado THEN NULL ELSE mensaje.adjunto_path END,
    mensaje.responde_a,
    CASE
      WHEN respuesta.eliminado THEN 'Mensaje eliminado por moderación'
      ELSE respuesta.contenido
    END,
    CASE
      WHEN autor_respuesta.id IS NULL THEN NULL
      ELSE public.chat_nombre_visible(autor_respuesta.nombre, autor_respuesta.apellido)
    END,
    mensaje.eliminado,
    mensaje.eliminado_por,
    mensaje.creado_en
  FROM public.chat_mensajes AS mensaje
  LEFT JOIN public.perfiles AS autor ON autor.id = mensaje.autor_id
  LEFT JOIN public.chat_mensajes AS respuesta ON respuesta.id = mensaje.responde_a
  LEFT JOIN public.perfiles AS autor_respuesta ON autor_respuesta.id = respuesta.autor_id
  WHERE mensaje.canal_id = p_canal_id
    AND (
      p_antes IS NULL
      OR (
        p_antes_id IS NULL
        AND mensaje.creado_en < p_antes
      )
      OR (
        p_antes_id IS NOT NULL
        AND (mensaje.creado_en, mensaje.id) < (p_antes, p_antes_id)
      )
    )
  ORDER BY mensaje.creado_en DESC, mensaje.id DESC
  LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_enviar_mensaje(
  p_canal_id uuid,
  p_contenido text,
  p_responde_a uuid DEFAULT NULL,
  p_adjunto_path text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contenido text := trim(coalesce(p_contenido, ''));
  v_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF NOT public.chat_puede_acceder(p_canal_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este canal';
  END IF;
  IF length(v_contenido) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 2000 caracteres';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.chat_silenciados AS silencio
    WHERE silencio.canal_id = p_canal_id
      AND silencio.usuario_id = auth.uid()
      AND silencio.hasta > now()
  ) THEN
    RAISE EXCEPTION 'No puedes enviar mensajes en este canal mientras dure el silencio';
  END IF;

  IF p_responde_a IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.chat_mensajes AS mensaje_original
    WHERE mensaje_original.id = p_responde_a
      AND mensaje_original.canal_id = p_canal_id
  ) THEN
    RAISE EXCEPTION 'El mensaje citado no pertenece a este canal';
  END IF;

  IF p_adjunto_path IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM storage.objects AS objeto
    WHERE objeto.bucket_id = 'chat-adjuntos'
      AND objeto.name = p_adjunto_path
      AND objeto.name LIKE p_canal_id::text || '/' || auth.uid()::text || '/%'
      AND objeto.owner_id = auth.uid()::text
      AND objeto.metadata ->> 'mimetype' IN ('image/jpeg', 'image/png', 'image/webp')
      AND (objeto.metadata ->> 'size') ~ '^[0-9]+$'
      AND (objeto.metadata ->> 'size')::bigint BETWEEN 1 AND 2097152
  ) THEN
    RAISE EXCEPTION 'La imagen adjunta no es válida o no te pertenece';
  END IF;

  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  IF EXISTS (
    SELECT 1
    FROM public.chat_mensajes AS mensaje
    WHERE mensaje.autor_id = auth.uid()
      AND mensaje.creado_en > now() - interval '1 second'
  ) THEN
    RAISE EXCEPTION 'Espera un segundo antes de enviar otro mensaje';
  END IF;

  INSERT INTO public.chat_mensajes (
    canal_id,
    autor_id,
    contenido,
    tipo,
    adjunto_path,
    responde_a
  )
  VALUES (
    p_canal_id,
    auth.uid(),
    v_contenido,
    CASE WHEN p_adjunto_path IS NULL THEN 'texto' ELSE 'imagen' END,
    p_adjunto_path,
    p_responde_a
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_marcar_leido(p_canal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF NOT public.chat_puede_acceder(p_canal_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este canal';
  END IF;

  INSERT INTO public.chat_lecturas (canal_id, usuario_id, ultima_lectura)
  VALUES (p_canal_id, auth.uid(), now())
  ON CONFLICT (canal_id, usuario_id)
  DO UPDATE SET ultima_lectura = EXCLUDED.ultima_lectura;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_eliminar_mensaje(p_mensaje_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canal_id uuid;
  v_grupo_id uuid;
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND perfil.activo
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede moderar mensajes';
  END IF;

  SELECT mensaje.canal_id, canal.grupo_id
  INTO v_canal_id, v_grupo_id
  FROM public.chat_mensajes AS mensaje
  JOIN public.chat_canales AS canal ON canal.id = mensaje.canal_id
  WHERE mensaje.id = p_mensaje_id
    AND NOT mensaje.eliminado
  FOR UPDATE OF mensaje;

  IF NOT FOUND OR NOT public.chat_puede_acceder(v_canal_id) THEN
    RAISE EXCEPTION 'El mensaje no existe o no tienes acceso a su canal';
  END IF;

  UPDATE public.chat_mensajes
  SET eliminado = true,
      eliminado_por = auth.uid(),
      contenido = 'Mensaje eliminado por moderación'
  WHERE id = p_mensaje_id;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento, detalles)
  SELECT
    v_grupo_id,
    auth.uid(),
    mensaje.autor_id,
    'chat_mensaje_eliminado',
    jsonb_build_object('mensaje_id', mensaje.id, 'canal_id', v_canal_id)
  FROM public.chat_mensajes AS mensaje
  WHERE mensaje.id = p_mensaje_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_silenciar_usuario(
  p_canal_id uuid,
  p_usuario_id uuid,
  p_minutos integer,
  p_motivo text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canal public.chat_canales;
  v_hasta timestamptz;
  v_motivo text := trim(coalesce(p_motivo, ''));
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND perfil.activo
      AND lower(coalesce(perfil.rol, '')) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo administración puede silenciar usuarios';
  END IF;
  IF NOT public.chat_puede_acceder(p_canal_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este canal';
  END IF;
  IF p_usuario_id IS NULL OR p_usuario_id = auth.uid()
    OR p_minutos IS NULL OR p_minutos NOT BETWEEN 1 AND 10080
    OR length(v_motivo) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'El usuario, duración o motivo del silencio no son válidos';
  END IF;

  SELECT canal.* INTO v_canal
  FROM public.chat_canales AS canal
  WHERE canal.id = p_canal_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_objetivo
    WHERE perfil_objetivo.id = p_usuario_id
      AND perfil_objetivo.activo
      AND (
        (
          v_canal.tipo = 'equipo'
          AND lower(coalesce(perfil_objetivo.rol, '')) IN ('administrador', 'tesorero')
        )
        OR (
          v_canal.tipo = 'grupo'
          AND (
            lower(coalesce(perfil_objetivo.rol, '')) IN ('administrador', 'tesorero')
            OR (
              lower(coalesce(perfil_objetivo.rol, '')) = 'socio'
              AND EXISTS (
                SELECT 1
                FROM public.participantes AS participante
                WHERE participante.grupo_id = v_canal.grupo_id
                  AND participante.perfil_id = perfil_objetivo.id
              )
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a este canal o su cuenta está desactivada';
  END IF;

  v_hasta := now() + make_interval(mins => p_minutos);
  INSERT INTO public.chat_silenciados (
    canal_id, usuario_id, hasta, motivo, silenciado_por
  )
  VALUES (p_canal_id, p_usuario_id, v_hasta, v_motivo, auth.uid())
  ON CONFLICT (canal_id, usuario_id)
  DO UPDATE SET
    hasta = EXCLUDED.hasta,
    motivo = EXCLUDED.motivo,
    silenciado_por = EXCLUDED.silenciado_por;

  INSERT INTO public.auditoria_eventos (grupo_id, actor_id, objetivo_id, evento, detalles)
  VALUES (
    v_canal.grupo_id,
    auth.uid(),
    p_usuario_id,
    'chat_usuario_silenciado',
    jsonb_build_object(
      'canal_id', p_canal_id,
      'hasta', v_hasta,
      'minutos', p_minutos,
      'motivo', v_motivo
    )
  );

  RETURN v_hasta;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_listar_canales() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_listar_mensajes(uuid, timestamptz, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_enviar_mensaje(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_marcar_leido(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_eliminar_mensaje(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_silenciar_usuario(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_listar_canales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_listar_mensajes(uuid, timestamptz, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_enviar_mensaje(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_marcar_leido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_eliminar_mensaje(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_silenciar_usuario(uuid, uuid, integer, text) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-adjuntos',
  'chat-adjuntos',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS chat_adjuntos_upload ON storage.objects;
CREATE POLICY chat_adjuntos_upload
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-adjuntos'
    AND split_part(name, '/', 2) = auth.uid()::text
    AND public.chat_puede_acceder_ruta(name)
  );

DROP POLICY IF EXISTS chat_adjuntos_read ON storage.objects;
CREATE POLICY chat_adjuntos_read
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-adjuntos'
    AND public.chat_puede_acceder_ruta(name)
    AND EXISTS (
      SELECT 1
      FROM public.chat_mensajes AS mensaje
      WHERE mensaje.adjunto_path = storage.objects.name
        AND mensaje.tipo = 'imagen'
        AND NOT mensaje.eliminado
        AND public.chat_puede_acceder(mensaje.canal_id)
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_mensajes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
