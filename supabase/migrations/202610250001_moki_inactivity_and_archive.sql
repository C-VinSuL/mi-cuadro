ALTER TABLE public.moki_conversaciones
  ADD COLUMN IF NOT EXISTS archivado_en timestamptz,
  ADD COLUMN IF NOT EXISTS archivado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS moki_conversaciones_archivadas_idx
  ON public.moki_conversaciones (archivado_en DESC)
  WHERE archivado_en IS NOT NULL;

DROP POLICY IF EXISTS moki_conversaciones_select_visible ON public.moki_conversaciones;
CREATE POLICY moki_conversaciones_select_visible
  ON public.moki_conversaciones
  FOR SELECT TO authenticated
  USING (
    (socio_id = auth.uid() AND archivado_en IS NULL)
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

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron no está disponible en este proyecto; habilita la extensión antes de aplicar esta migración';
  END IF;

  EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''moki-close-inactive-conversations''';
  PERFORM cron.schedule(
    'moki-close-inactive-conversations',
    '*/15 * * * *',
    $job$
      UPDATE public.moki_conversaciones
      SET estado = 'resuelta'
      WHERE estado IN ('abierta', 'en_atencion')
        AND archivado_en IS NULL
        AND actualizado_en <= now() - interval '14 days'
    $job$
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.moki_cerrar_conversaciones_inactivas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_cerradas integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para actualizar conversaciones';
  END IF;

  SELECT lower(coalesce(perfil.rol, ''))
  INTO v_rol
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid();

  IF v_rol = 'administrador' THEN
    UPDATE public.moki_conversaciones
    SET estado = 'resuelta'
    WHERE estado IN ('abierta', 'en_atencion')
      AND archivado_en IS NULL
      AND actualizado_en <= now() - interval '14 days';
  ELSIF v_rol = 'socio' THEN
    UPDATE public.moki_conversaciones
    SET estado = 'resuelta'
    WHERE socio_id = auth.uid()
      AND estado IN ('abierta', 'en_atencion')
      AND archivado_en IS NULL
      AND actualizado_en <= now() - interval '14 days';
  ELSE
    RAISE EXCEPTION 'Tu rol no puede actualizar conversaciones';
  END IF;

  GET DIAGNOSTICS v_cerradas = ROW_COUNT;
  RETURN v_cerradas;
END;
$$;

CREATE OR REPLACE FUNCTION public.moki_archivar_conversacion(p_conversacion_id uuid)
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
    RAISE EXCEPTION 'Solo un administrador puede archivar conversaciones';
  END IF;

  UPDATE public.moki_conversaciones
  SET archivado_en = coalesce(archivado_en, now()),
      archivado_por = coalesce(archivado_por, auth.uid())
  WHERE id = p_conversacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La conversación no existe';
  END IF;
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
  v_actualizado_en timestamptz;
  v_archivado_en timestamptz;
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

CREATE OR REPLACE FUNCTION public.moki_restaurar_conversacion(p_conversacion_id uuid)
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
    RAISE EXCEPTION 'Solo un administrador puede restaurar conversaciones';
  END IF;

  UPDATE public.moki_conversaciones
  SET archivado_en = NULL,
      archivado_por = NULL
  WHERE id = p_conversacion_id
    AND archivado_en IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La conversación archivada no existe';
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

  PERFORM public.moki_cerrar_conversaciones_inactivas();

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
  WHERE conversacion.archivado_en IS NULL
  ORDER BY conversacion.actualizado_en DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.moki_listar_conversaciones_archivadas()
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
    RAISE EXCEPTION 'Solo un administrador puede consultar conversaciones archivadas';
  END IF;

  PERFORM public.moki_cerrar_conversaciones_inactivas();

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
  WHERE conversacion.archivado_en IS NOT NULL
  ORDER BY conversacion.archivado_en DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.moki_cerrar_conversaciones_inactivas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_archivar_conversacion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_restaurar_conversacion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moki_listar_conversaciones_archivadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moki_cerrar_conversaciones_inactivas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_archivar_conversacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_restaurar_conversacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moki_listar_conversaciones_archivadas() TO authenticated;

NOTIFY pgrst, 'reload schema';
