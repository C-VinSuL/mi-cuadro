CREATE OR REPLACE FUNCTION public.listar_participantes_grupo_admin(p_grupo_id uuid)
RETURNS TABLE (
  id uuid,
  nombre text,
  posicion integer,
  estado text,
  perfil_id uuid
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
    RAISE EXCEPTION 'Solo administración o tesorería puede consultar los participantes del grupo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.grupos AS grupo_actual WHERE grupo_actual.id = p_grupo_id
  ) THEN
    RAISE EXCEPTION 'El grupo no existe';
  END IF;

  RETURN QUERY
  SELECT participante.id,
    participante.nombre::text,
    participante.posicion,
    participante.estado::text,
    participante.perfil_id
  FROM public.participantes AS participante
  WHERE participante.grupo_id = p_grupo_id
  ORDER BY participante.posicion NULLS LAST, participante.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aportes_requieren_grupo_activo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_semana_actual integer;
BEGIN
  SELECT grupo.estado, grupo.semana_actual
  INTO v_estado, v_semana_actual
  FROM public.grupos AS grupo
  WHERE grupo.id = NEW.grupo_id;

  IF NOT FOUND OR v_estado IS DISTINCT FROM 'activo' THEN
    RAISE EXCEPTION 'No se pueden registrar aportes hasta que el grupo esté activo';
  END IF;

  IF v_semana_actual IS NULL OR v_semana_actual < 1
    OR NEW.semana IS DISTINCT FROM v_semana_actual THEN
    RAISE EXCEPTION 'El aporte debe corresponder al periodo actual del grupo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aportes_requieren_grupo_activo ON public.aportes;
CREATE TRIGGER aportes_requieren_grupo_activo
BEFORE INSERT ON public.aportes
FOR EACH ROW
EXECUTE FUNCTION public.aportes_requieren_grupo_activo();

REVOKE ALL ON FUNCTION public.listar_participantes_grupo_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_participantes_grupo_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.aportes_requieren_grupo_activo() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
