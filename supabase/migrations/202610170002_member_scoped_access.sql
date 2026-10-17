CREATE OR REPLACE FUNCTION public.seguridad_rol_actual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT lower(perfil.rol)
  FROM public.perfiles AS perfil
  WHERE perfil.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.seguridad_socio_pertenece_grupo(p_grupo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.participantes AS participante
    WHERE participante.perfil_id = auth.uid()
      AND participante.grupo_id = p_grupo_id
  )
$$;

CREATE OR REPLACE FUNCTION public.seguridad_socio_es_participante(p_participante_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.participantes AS participante
    WHERE participante.id = p_participante_id
      AND participante.perfil_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.seguridad_socio_es_prestamo(p_prestamo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.prestamos AS prestamo
    JOIN public.participantes AS participante
      ON participante.id = prestamo.participante_id
    WHERE prestamo.id = p_prestamo_id
      AND participante.perfil_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.seguridad_rol_actual() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seguridad_socio_pertenece_grupo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seguridad_socio_es_participante(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seguridad_socio_es_prestamo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguridad_rol_actual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seguridad_socio_pertenece_grupo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seguridad_socio_es_participante(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seguridad_socio_es_prestamo(uuid) TO authenticated;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas_prestamo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_fondo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.perfiles, public.grupos, public.participantes,
  public.aportes, public.entregas, public.prestamos,
  public.cuotas_prestamo, public.movimientos_fondo
FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.perfiles, public.grupos,
  public.participantes, public.aportes, public.entregas, public.prestamos,
  public.cuotas_prestamo, public.movimientos_fondo
FROM anon, authenticated;
GRANT SELECT ON public.perfiles, public.grupos, public.participantes,
  public.aportes, public.entregas, public.prestamos,
  public.cuotas_prestamo, public.movimientos_fondo
TO authenticated;

DROP POLICY IF EXISTS socio_scope_perfiles_select ON public.perfiles;
CREATE POLICY socio_scope_perfiles_select
ON public.perfiles AS PERMISSIVE FOR SELECT TO authenticated
USING (id = auth.uid());
DROP POLICY IF EXISTS socio_scope_perfiles_select_guard ON public.perfiles;
CREATE POLICY socio_scope_perfiles_select_guard
ON public.perfiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS socio_scope_grupos_select ON public.grupos;
CREATE POLICY socio_scope_grupos_select
ON public.grupos AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(id)
  )
);
DROP POLICY IF EXISTS socio_scope_grupos_select_guard ON public.grupos;
CREATE POLICY socio_scope_grupos_select_guard
ON public.grupos AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(id)
  )
);

DROP POLICY IF EXISTS socio_scope_participantes_select ON public.participantes;
CREATE POLICY socio_scope_participantes_select
ON public.participantes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);
DROP POLICY IF EXISTS socio_scope_participantes_select_guard ON public.participantes;
CREATE POLICY socio_scope_participantes_select_guard
ON public.participantes AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);

DROP POLICY IF EXISTS socio_scope_aportes_select ON public.aportes;
CREATE POLICY socio_scope_aportes_select
ON public.aportes AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);
DROP POLICY IF EXISTS socio_scope_aportes_select_guard ON public.aportes;
CREATE POLICY socio_scope_aportes_select_guard
ON public.aportes AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);

DROP POLICY IF EXISTS socio_scope_entregas_select ON public.entregas;
CREATE POLICY socio_scope_entregas_select
ON public.entregas AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);
DROP POLICY IF EXISTS socio_scope_entregas_select_guard ON public.entregas;
CREATE POLICY socio_scope_entregas_select_guard
ON public.entregas AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_pertenece_grupo(grupo_id)
  )
);

DROP POLICY IF EXISTS socio_scope_prestamos_select ON public.prestamos;
CREATE POLICY socio_scope_prestamos_select
ON public.prestamos AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_es_participante(participante_id)
  )
);
DROP POLICY IF EXISTS socio_scope_prestamos_select_guard ON public.prestamos;
CREATE POLICY socio_scope_prestamos_select_guard
ON public.prestamos AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_es_participante(participante_id)
  )
);

DROP POLICY IF EXISTS socio_scope_cuotas_select ON public.cuotas_prestamo;
CREATE POLICY socio_scope_cuotas_select
ON public.cuotas_prestamo AS PERMISSIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_es_prestamo(prestamo_id)
  )
);
DROP POLICY IF EXISTS socio_scope_cuotas_select_guard ON public.cuotas_prestamo;
CREATE POLICY socio_scope_cuotas_select_guard
ON public.cuotas_prestamo AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor')
  OR (
    public.seguridad_rol_actual() = 'socio'
    AND public.seguridad_socio_es_prestamo(prestamo_id)
  )
);

DROP POLICY IF EXISTS socio_scope_movimientos_fondo_select ON public.movimientos_fondo;
CREATE POLICY socio_scope_movimientos_fondo_select
ON public.movimientos_fondo AS PERMISSIVE FOR SELECT TO authenticated
USING (public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor'));
DROP POLICY IF EXISTS socio_scope_movimientos_fondo_select_guard ON public.movimientos_fondo;
CREATE POLICY socio_scope_movimientos_fondo_select_guard
ON public.movimientos_fondo AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.seguridad_rol_actual() IN ('administrador', 'tesorero', 'auditor'));

CREATE OR REPLACE FUNCTION public.registrar_aporte_propio(p_participante_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participante public.participantes;
  v_aporte numeric;
  v_semana integer;
  v_aporte_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR public.seguridad_rol_actual() IS DISTINCT FROM 'socio' THEN
    RAISE EXCEPTION 'Solo un socio puede registrar su propio aporte';
  END IF;
  PERFORM public.exigir_mfa_actual();

  SELECT participante.*
  INTO v_participante
  FROM public.participantes AS participante
  JOIN public.grupos AS grupo ON grupo.id = participante.grupo_id
  WHERE participante.id = p_participante_id
    AND participante.perfil_id = auth.uid()
    AND grupo.estado = 'activo'
    AND grupo.semana_actual >= 1
  FOR UPDATE OF participante, grupo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes un grupo activo disponible para registrar el aporte';
  END IF;

  SELECT grupo.aporte_semanal, grupo.semana_actual
  INTO v_aporte, v_semana
  FROM public.grupos AS grupo
  WHERE grupo.id = v_participante.grupo_id;

  IF EXISTS (
    SELECT 1
    FROM public.aportes AS aporte
    WHERE aporte.participante_id = v_participante.id
      AND aporte.grupo_id = v_participante.grupo_id
      AND aporte.semana = v_semana
  ) THEN
    RAISE EXCEPTION 'Ya registraste el aporte de este periodo';
  END IF;

  INSERT INTO public.aportes (
    participante_id, grupo_id, semana, monto, comision_app, estado
  ) VALUES (
    v_participante.id, v_participante.grupo_id, v_semana, v_aporte, 0, 'pagado'
  )
  RETURNING id INTO v_aporte_id;

  INSERT INTO public.auditoria_eventos (
    grupo_id, actor_id, objetivo_id, evento, detalles
  ) VALUES (
    v_participante.grupo_id,
    auth.uid(),
    auth.uid(),
    'aporte_socio_registrado',
    jsonb_build_object(
      'aporte_id', v_aporte_id,
      'periodo', v_semana,
      'monto', v_aporte
    )
  );

  RETURN v_aporte_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_aporte_propio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_aporte_propio(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
