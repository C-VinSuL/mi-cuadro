CREATE TABLE public.chat_escribiendo (
  canal_id uuid NOT NULL REFERENCES public.chat_canales(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, usuario_id)
);

CREATE INDEX chat_escribiendo_canal_actualizado_idx
  ON public.chat_escribiendo (canal_id, actualizado_en DESC);

ALTER TABLE public.chat_escribiendo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_escribiendo FROM anon, authenticated;
GRANT SELECT ON public.chat_escribiendo TO authenticated;

DROP POLICY IF EXISTS chat_escribiendo_accesible ON public.chat_escribiendo;
CREATE POLICY chat_escribiendo_accesible
  ON public.chat_escribiendo
  FOR SELECT TO authenticated
  USING (
    public.chat_puede_acceder(canal_id)
    AND actualizado_en > now() - interval '5 seconds'
  );

CREATE OR REPLACE FUNCTION public.chat_establecer_escribiendo(
  p_canal_id uuid,
  p_escribiendo boolean
)
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

  IF p_escribiendo THEN
    INSERT INTO public.chat_escribiendo (canal_id, usuario_id, actualizado_en)
    VALUES (p_canal_id, auth.uid(), now())
    ON CONFLICT (canal_id, usuario_id)
    DO UPDATE SET actualizado_en = EXCLUDED.actualizado_en;
  ELSE
    DELETE FROM public.chat_escribiendo
    WHERE canal_id = p_canal_id
      AND usuario_id = auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_listar_escribiendo(p_canal_id uuid)
RETURNS TABLE (
  usuario_id uuid,
  nombre text,
  rol text
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

  RETURN QUERY
  SELECT
    perfil.id,
    public.chat_nombre_visible(perfil.nombre, perfil.apellido),
    lower(coalesce(perfil.rol, 'socio'))
  FROM public.chat_escribiendo AS escribiendo
  JOIN public.perfiles AS perfil ON perfil.id = escribiendo.usuario_id
  WHERE escribiendo.canal_id = p_canal_id
    AND escribiendo.usuario_id <> auth.uid()
    AND escribiendo.actualizado_en > now() - interval '5 seconds'
    AND perfil.activo;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_establecer_escribiendo(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_listar_escribiendo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_establecer_escribiendo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_listar_escribiendo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_listar_miembros(p_canal_id uuid)
RETURNS TABLE (
  usuario_id uuid,
  nombre text,
  rol text
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND perfil.activo
      AND lower(coalesce(perfil.rol, '')) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo administración puede consultar miembros para moderación';
  END IF;

  RETURN QUERY
  SELECT
    perfil.id,
    public.chat_nombre_visible(perfil.nombre, perfil.apellido),
    lower(perfil.rol)
  FROM public.perfiles AS perfil
  JOIN public.chat_canales AS canal ON canal.id = p_canal_id
  WHERE perfil.activo
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
  ORDER BY perfil.nombre, perfil.apellido;
END;
$$;

REVOKE ALL ON FUNCTION public.chat_listar_miembros(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_listar_miembros(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_escribiendo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_escribiendo;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
