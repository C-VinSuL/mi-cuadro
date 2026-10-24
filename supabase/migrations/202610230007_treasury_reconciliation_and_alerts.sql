CREATE TABLE IF NOT EXISTS public.conciliaciones_fondo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id text NOT NULL UNIQUE,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE RESTRICT,
  conciliado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  conciliado_en timestamptz NOT NULL DEFAULT now(),
  observacion text CHECK (observacion IS NULL OR length(observacion) <= 500)
);

CREATE INDEX IF NOT EXISTS conciliaciones_fondo_grupo_fecha_idx
  ON public.conciliaciones_fondo (grupo_id, conciliado_en DESC);

ALTER TABLE public.conciliaciones_fondo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conciliaciones_fondo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conciliaciones_fondo TO authenticated;

DROP POLICY IF EXISTS conciliaciones_fondo_staff_select ON public.conciliaciones_fondo;
CREATE POLICY conciliaciones_fondo_staff_select
  ON public.conciliaciones_fondo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.perfiles AS perfil
      WHERE perfil.id = auth.uid()
        AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
    )
  );

CREATE OR REPLACE FUNCTION public.conciliar_movimiento_fondo(
  p_movimiento_id text,
  p_observacion text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
  v_conciliacion_id uuid;
  v_observacion text := nullif(trim(p_observacion), '');
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede conciliar movimientos';
  END IF;

  IF p_movimiento_id IS NULL OR length(p_movimiento_id) > 100
    OR length(coalesce(v_observacion, '')) > 500 THEN
    RAISE EXCEPTION 'El movimiento o la observación no son válidos';
  END IF;

  SELECT movimiento.grupo_id
  INTO v_grupo_id
  FROM public.movimientos_fondo AS movimiento
  WHERE movimiento.id::text = p_movimiento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El movimiento ya no existe o no está disponible';
  END IF;

  INSERT INTO public.conciliaciones_fondo (
    movimiento_id, grupo_id, conciliado_por, observacion
  )
  VALUES (
    p_movimiento_id, v_grupo_id, auth.uid(), v_observacion
  )
  ON CONFLICT (movimiento_id) DO NOTHING
  RETURNING id INTO v_conciliacion_id;

  IF v_conciliacion_id IS NULL THEN
    RAISE EXCEPTION 'Este movimiento ya fue conciliado';
  END IF;

  INSERT INTO public.auditoria_eventos (
    grupo_id, actor_id, evento, detalles
  )
  VALUES (
    v_grupo_id,
    auth.uid(),
    'movimiento_fondo_conciliado',
    jsonb_build_object(
      'movimiento_id', p_movimiento_id,
      'conciliacion_id', v_conciliacion_id,
      'observacion', v_observacion
    )
  );

  RETURN v_conciliacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliar_movimiento_fondo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conciliar_movimiento_fondo(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resumen_tesoreria_grupos()
RETURNS TABLE (
  grupo_id uuid,
  grupo_nombre text,
  estado text,
  semana_actual integer,
  socios bigint,
  aportes_aprobados bigint,
  aportes_pendientes_revision bigint,
  recaudado_periodo numeric,
  saldo_fondo numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.exigir_mfa_actual();
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ) THEN
    RAISE EXCEPTION 'Solo administración o tesorería puede consultar el resumen financiero';
  END IF;

  RETURN QUERY
  WITH participantes_por_grupo AS (
    SELECT participante.grupo_id, count(*) AS socios
    FROM public.participantes AS participante
    GROUP BY participante.grupo_id
  ),
  aportes_por_grupo AS (
    SELECT aporte.grupo_id,
      count(*) FILTER (
        WHERE aporte.semana = grupo.semana_actual
          AND lower(coalesce(aporte.estado, '')) = 'pagado'
      ) AS aportes_aprobados,
      count(*) FILTER (
        WHERE aporte.estado_revision = 'pendiente'
          AND aporte.comprobante_path IS NOT NULL
      ) AS aportes_pendientes_revision,
      coalesce(sum(aporte.monto) FILTER (
        WHERE aporte.semana = grupo.semana_actual
          AND lower(coalesce(aporte.estado, '')) = 'pagado'
      ), 0) AS recaudado_periodo
    FROM public.aportes AS aporte
    JOIN public.grupos AS grupo ON grupo.id = aporte.grupo_id
    GROUP BY aporte.grupo_id
  ),
  fondos_por_grupo AS (
    SELECT movimiento.grupo_id,
      coalesce(sum(
        CASE
          WHEN movimiento.tipo = 'ingreso' THEN movimiento.monto
          WHEN movimiento.tipo = 'egreso' THEN -movimiento.monto
          ELSE 0
        END
      ), 0) AS saldo_fondo
    FROM public.movimientos_fondo AS movimiento
    GROUP BY movimiento.grupo_id
  )
  SELECT grupo.id,
    grupo.nombre::text,
    grupo.estado::text,
    grupo.semana_actual,
    coalesce(participantes_por_grupo.socios, 0),
    coalesce(aportes_por_grupo.aportes_aprobados, 0),
    coalesce(aportes_por_grupo.aportes_pendientes_revision, 0),
    coalesce(aportes_por_grupo.recaudado_periodo, 0)::numeric,
    coalesce(fondos_por_grupo.saldo_fondo, 0)::numeric
  FROM public.grupos AS grupo
  LEFT JOIN participantes_por_grupo ON participantes_por_grupo.grupo_id = grupo.id
  LEFT JOIN aportes_por_grupo ON aportes_por_grupo.grupo_id = grupo.id
  LEFT JOIN fondos_por_grupo ON fondos_por_grupo.grupo_id = grupo.id
  ORDER BY grupo.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.resumen_tesoreria_grupos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_tesoreria_grupos() TO authenticated;

CREATE OR REPLACE FUNCTION public.notificar_revision_financiera()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fuente text;
  v_titulo text;
  v_mensaje text;
  v_ruta text;
BEGIN
  IF TG_TABLE_NAME = 'aportes' THEN
    IF NEW.estado_revision IS DISTINCT FROM 'pendiente'
      OR NEW.comprobante_path IS NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.estado_revision IS NOT DISTINCT FROM NEW.estado_revision
        AND OLD.comprobante_path IS NOT DISTINCT FROM NEW.comprobante_path THEN
        RETURN NEW;
      END IF;
    END IF;

    v_fuente := 'aporte-pendiente:' || NEW.id::text || ':' || clock_timestamp()::text;
    v_titulo := 'Nuevo comprobante de aporte';
    v_mensaje := 'Hay un comprobante pendiente de revisión en el grupo ' || coalesce(
      (SELECT grupo.nombre FROM public.grupos AS grupo WHERE grupo.id = NEW.grupo_id),
      'sin nombre'
    ) || ', periodo ' || NEW.semana::text || '.';
    v_ruta := '/aportes';
  ELSIF TG_TABLE_NAME = 'solicitudes_billetera' THEN
    IF TG_OP <> 'INSERT' OR NEW.estado <> 'pendiente' THEN
      RETURN NEW;
    END IF;

    v_fuente := 'billetera-pendiente:' || NEW.id::text;
    v_titulo := 'Nueva solicitud de billetera';
    v_mensaje := 'Hay un ' || CASE WHEN NEW.tipo = 'deposito' THEN 'depósito' ELSE 'retiro' END
      || ' pendiente de revisión por $' || to_char(NEW.monto, 'FM999999990.00') || '.';
    v_ruta := '/admin/billetera';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notificaciones (
    usuario_id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, fuente
  )
  SELECT perfil.id, v_titulo, v_mensaje, 'info', v_ruta, 'Revisar solicitud', v_fuente
  FROM public.perfiles AS perfil
  WHERE lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero')
  ON CONFLICT (usuario_id, fuente) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aportes_notificar_revision_financiera ON public.aportes;
CREATE TRIGGER aportes_notificar_revision_financiera
  AFTER INSERT OR UPDATE OF estado_revision, comprobante_path ON public.aportes
  FOR EACH ROW EXECUTE FUNCTION public.notificar_revision_financiera();

DROP TRIGGER IF EXISTS billetera_notificar_revision_financiera ON public.solicitudes_billetera;
CREATE TRIGGER billetera_notificar_revision_financiera
  AFTER INSERT ON public.solicitudes_billetera
  FOR EACH ROW EXECUTE FUNCTION public.notificar_revision_financiera();

REVOKE ALL ON FUNCTION public.notificar_revision_financiera() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'solicitudes_billetera'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_billetera;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'movimientos_fondo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimientos_fondo;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conciliaciones_fondo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conciliaciones_fondo;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
