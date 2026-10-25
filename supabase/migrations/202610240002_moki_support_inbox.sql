CREATE TABLE IF NOT EXISTS public.moki_conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'en_atencion', 'resuelta')),
  asignada_a uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moki_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES public.moki_conversaciones(id) ON DELETE CASCADE,
  remitente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  remitente_rol text NOT NULL CHECK (remitente_rol IN ('socio', 'administrador')),
  contenido text NOT NULL CHECK (length(trim(contenido)) BETWEEN 1 AND 2000),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moki_conversaciones_socio_actualizado_idx
  ON public.moki_conversaciones (socio_id, actualizado_en DESC);
CREATE INDEX IF NOT EXISTS moki_conversaciones_estado_actualizado_idx
  ON public.moki_conversaciones (estado, actualizado_en DESC);
CREATE INDEX IF NOT EXISTS moki_mensajes_conversacion_creado_idx
  ON public.moki_mensajes (conversacion_id, creado_en);

ALTER TABLE public.moki_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moki_mensajes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moki_conversaciones, public.moki_mensajes
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.moki_conversaciones, public.moki_mensajes TO authenticated;

DROP POLICY IF EXISTS moki_conversaciones_select_visible ON public.moki_conversaciones;
CREATE POLICY moki_conversaciones_select_visible
  ON public.moki_conversaciones
  FOR SELECT TO authenticated
  USING (
    socio_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.perfiles AS perfil
      WHERE perfil.id = auth.uid()
        AND lower(coalesce(perfil.rol, '')) = 'administrador'
    )
  );

DROP POLICY IF EXISTS moki_mensajes_select_visible ON public.moki_mensajes;
CREATE POLICY moki_mensajes_select_visible
  ON public.moki_mensajes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.moki_conversaciones AS conversacion
      WHERE conversacion.id = moki_mensajes.conversacion_id
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

CREATE OR REPLACE FUNCTION public.moki_iniciar_conversacion(p_mensaje text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversacion_id uuid;
  v_mensaje text := trim(coalesce(p_mensaje, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) = 'socio'
  ) THEN
    RAISE EXCEPTION 'Solo un socio puede iniciar una conversación con administración';
  END IF;

  IF length(v_mensaje) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 2000 caracteres';
  END IF;

  INSERT INTO public.moki_conversaciones (socio_id)
  VALUES (auth.uid())
  RETURNING id INTO v_conversacion_id;

  INSERT INTO public.moki_mensajes (conversacion_id, remitente_id, remitente_rol, contenido)
  VALUES (v_conversacion_id, auth.uid(), 'socio', v_mensaje);

  RETURN v_conversacion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.moki_enviar_mensaje(
  p_conversacion_id uuid,
  p_mensaje text
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
  v_mensaje text := trim(coalesce(p_mensaje, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para enviar mensajes';
  END IF;
  IF length(v_mensaje) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'El mensaje debe tener entre 1 y 2000 caracteres';
  END IF;

  SELECT lower(coalesce(perfil.rol, ''))
  INTO v_rol
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid();
  IF coalesce(v_rol, '') NOT IN ('socio', 'administrador') THEN
    RAISE EXCEPTION 'Tu rol no puede enviar mensajes a Moki';
  END IF;

  SELECT conversacion.socio_id, conversacion.estado
  INTO v_socio_id, v_estado
  FROM public.moki_conversaciones AS conversacion
  WHERE conversacion.id = p_conversacion_id
  FOR UPDATE;

  IF NOT FOUND OR v_estado = 'resuelta' THEN
    RAISE EXCEPTION 'La conversación no existe o ya fue resuelta';
  END IF;

  IF NOT (
    (v_rol = 'socio' AND v_socio_id = auth.uid())
    OR v_rol = 'administrador'
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para escribir en esta conversación';
  END IF;

  INSERT INTO public.moki_mensajes (conversacion_id, remitente_id, remitente_rol, contenido)
  VALUES (
    p_conversacion_id,
    auth.uid(),
    CASE WHEN v_rol = 'administrador' THEN 'administrador' ELSE 'socio' END,
    v_mensaje
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

CREATE OR REPLACE FUNCTION public.moki_cambiar_estado_conversacion(
  p_conversacion_id uuid,
  p_estado text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de conversaciones';
  END IF;
  IF coalesce(p_estado, '') NOT IN ('abierta', 'en_atencion', 'resuelta') THEN
    RAISE EXCEPTION 'El estado de conversación no es válido';
  END IF;

  UPDATE public.moki_conversaciones
  SET estado = p_estado,
      actualizado_en = now(),
      asignada_a = CASE WHEN p_estado = 'abierta' THEN NULL ELSE coalesce(asignada_a, auth.uid()) END
  WHERE id = p_conversacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La conversación no existe';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.moki_listar_bandeja()
RETURNS TABLE (
  id uuid,
  socio_id uuid,
  socio_nombre text,
  grupo_nombre text,
  estado text,
  actualizado_en timestamptz,
  ultimo_mensaje text,
  ultimo_remitente_rol text,
  total_mensajes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar la bandeja de Moki';
  END IF;

  RETURN QUERY
  SELECT
    conversacion.id,
    conversacion.socio_id,
    coalesce(nullif(trim(concat_ws(' ', socio.nombre, socio.apellido)), ''), 'Socio'),
    grupos.nombre,
    conversacion.estado,
    conversacion.actualizado_en,
    ultimo.contenido,
    ultimo.remitente_rol,
    coalesce(conteo.total, 0)
  FROM public.moki_conversaciones AS conversacion
  JOIN public.perfiles AS socio ON socio.id = conversacion.socio_id
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT grupo.nombre, ', ' ORDER BY grupo.nombre) AS nombre
    FROM public.participantes AS participante
    JOIN public.grupos AS grupo ON grupo.id = participante.grupo_id
    WHERE participante.perfil_id = conversacion.socio_id
  ) AS grupos ON true
  LEFT JOIN LATERAL (
    SELECT mensaje.contenido, mensaje.remitente_rol
    FROM public.moki_mensajes AS mensaje
    WHERE mensaje.conversacion_id = conversacion.id
      AND mensaje.remitente_rol <> 'moki'
    ORDER BY mensaje.creado_en DESC
    LIMIT 1
  ) AS ultimo ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS total
    FROM public.moki_mensajes AS mensaje
    WHERE mensaje.conversacion_id = conversacion.id
      AND mensaje.remitente_rol <> 'moki'
  ) AS conteo ON true
  ORDER BY conversacion.actualizado_en DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.moki_iniciar_conversacion(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_enviar_mensaje(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_cambiar_estado_conversacion(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_listar_bandeja() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moki_iniciar_conversacion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_enviar_mensaje(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_cambiar_estado_conversacion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_listar_bandeja() TO authenticated;

NOTIFY pgrst, 'reload schema';
