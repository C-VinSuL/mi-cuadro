CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  tipo text NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'success', 'error')),
  ruta_accion text,
  etiqueta_accion text,
  fuente text,
  creada_en timestamptz NOT NULL DEFAULT now(),
  leida boolean NOT NULL DEFAULT false,
  UNIQUE (usuario_id, fuente)
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_creada_idx
  ON public.notificaciones (usuario_id, creada_en DESC);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select_own ON public.notificaciones;
CREATE POLICY notificaciones_select_own
  ON public.notificaciones
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS notificaciones_insert_own ON public.notificaciones;
CREATE POLICY notificaciones_insert_own
  ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS notificaciones_update_own ON public.notificaciones;
CREATE POLICY notificaciones_update_own
  ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS notificaciones_delete_own ON public.notificaciones;
CREATE POLICY notificaciones_delete_own
  ON public.notificaciones
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificaciones TO authenticated;
REVOKE ALL ON public.notificaciones FROM anon;

CREATE OR REPLACE FUNCTION public.notificar_solicitud_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre_grupo text;
  v_nombre_socio text;
  v_fuente text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT nombre INTO v_nombre_grupo
  FROM public.grupos
  WHERE id = NEW.grupo_id;

  SELECT coalesce(nullif(trim(concat_ws(' ', nombre, apellido)), ''), 'Un socio')
  INTO v_nombre_socio
  FROM public.perfiles
  WHERE id = NEW.perfil_id;

  IF NEW.estado = 'pendiente' THEN
    v_fuente := 'solicitud-grupo:' || NEW.id || ':pendiente:' || NEW.creada_en::text;
    INSERT INTO public.notificaciones (
      usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente
    )
    SELECT
      perfil.id,
      'Nueva solicitud de acceso',
      v_nombre_socio || ' solicita unirse a ' || coalesce(v_nombre_grupo, 'un grupo') || '.',
      'info',
      '/grupo',
      'Revisar solicitud',
      v_fuente
    FROM public.perfiles perfil
    WHERE lower(perfil.rol) IN ('administrador', 'tesorero')
    ON CONFLICT (usuario_id, fuente) DO NOTHING;
  ELSIF NEW.estado IN ('aprobada', 'rechazada') THEN
    v_fuente := 'solicitud-grupo:' || NEW.id || ':' || NEW.estado || ':' || coalesce(NEW.revisada_en, now())::text;
    INSERT INTO public.notificaciones (
      usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente
    ) VALUES (
      NEW.perfil_id,
      CASE WHEN NEW.estado = 'aprobada' THEN 'Solicitud aprobada' ELSE 'Solicitud rechazada' END,
      CASE
        WHEN NEW.estado = 'aprobada'
          THEN 'Tu solicitud para unirte a ' || coalesce(v_nombre_grupo, 'el grupo') || ' fue aprobada.'
        ELSE 'Tu solicitud para unirte a ' || coalesce(v_nombre_grupo, 'el grupo') || ' fue rechazada.'
      END,
      CASE WHEN NEW.estado = 'aprobada' THEN 'success' ELSE 'info' END,
      '/grupo',
      'Ver grupo',
      v_fuente
    )
    ON CONFLICT (usuario_id, fuente) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_grupo_notificacion ON public.solicitudes_grupo;
CREATE TRIGGER solicitudes_grupo_notificacion
AFTER INSERT OR UPDATE OF estado ON public.solicitudes_grupo
FOR EACH ROW
EXECUTE FUNCTION public.notificar_solicitud_grupo();

REVOKE ALL ON FUNCTION public.notificar_solicitud_grupo() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
