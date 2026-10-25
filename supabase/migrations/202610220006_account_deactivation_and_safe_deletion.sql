ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.exigir_mfa_actual()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Completa la verificación MFA para continuar';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND perfil.activo
  ) THEN
    RAISE EXCEPTION 'La cuenta está desactivada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.seguridad_cuenta_activa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = auth.uid()
      AND perfil.activo
  )
$$;

REVOKE ALL ON FUNCTION public.seguridad_cuenta_activa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguridad_cuenta_activa() TO authenticated;

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
    AND perfil.activo
$$;

DO $$
DECLARE
  tabla record;
BEGIN
  FOR tabla IN
    SELECT esquema.nspname AS esquema, relacion.relname AS nombre
    FROM pg_class AS relacion
    JOIN pg_namespace AS esquema ON esquema.oid = relacion.relnamespace
    WHERE esquema.nspname = 'public'
      AND relacion.relkind IN ('r', 'p')
      AND relacion.relrowsecurity
      AND relacion.relname <> 'perfiles'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS cuenta_activa_obligatoria ON %I.%I',
      tabla.esquema,
      tabla.nombre
    );
    EXECUTE format(
      'CREATE POLICY cuenta_activa_obligatoria ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.seguridad_cuenta_activa()) WITH CHECK (public.seguridad_cuenta_activa())',
      tabla.esquema,
      tabla.nombre
    );
  END LOOP;
END;
$$;

DROP FUNCTION public.listar_perfiles_administrador(text, integer, integer);
CREATE FUNCTION public.listar_perfiles_administrador(
  p_busqueda text DEFAULT NULL,
  p_limite integer DEFAULT 50,
  p_desplazamiento integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  correo text,
  telefono text,
  rol text,
  cedula text,
  direccion text,
  fecha_nacimiento date,
  documento_verificado boolean,
  tiene_datos_privados boolean,
  activo boolean,
  creado_en timestamptz,
  total_registros bigint
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
      AND lower(perfil_actual.rol) = 'administrador'
      AND perfil_actual.activo
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede consultar el registro de socios';
  END IF;

  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100
    OR p_desplazamiento IS NULL OR p_desplazamiento < 0 THEN
    RAISE EXCEPTION 'Los parámetros de paginación no son válidos';
  END IF;
  IF nullif(trim(coalesce(p_busqueda, '')), '') IS NOT NULL
    AND length(trim(p_busqueda)) < 2 THEN
    RAISE EXCEPTION 'Ingresa al menos dos caracteres para buscar';
  END IF;

  RETURN QUERY
  SELECT
    perfil.id,
    perfil.nombre::text,
    perfil.apellido::text,
    cuenta.email::text,
    perfil.telefono::text,
    perfil.rol::text,
    datos.cedula::text,
    datos.direccion::text,
    datos.fecha_nacimiento,
    coalesce(datos.documento_verificado, false),
    datos.perfil_id IS NOT NULL,
    perfil.activo,
    cuenta.created_at,
    count(*) OVER ()
  FROM public.perfiles AS perfil
  JOIN auth.users AS cuenta ON cuenta.id = perfil.id
  LEFT JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE p_busqueda IS NULL
     OR nullif(trim(p_busqueda), '') IS NULL
     OR perfil.nombre ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.apellido ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.telefono ILIKE '%' || trim(p_busqueda) || '%'
     OR cuenta.email ILIKE '%' || trim(p_busqueda) || '%'
     OR datos.cedula ILIKE '%' || trim(p_busqueda) || '%'
  ORDER BY cuenta.created_at DESC, perfil.id
  LIMIT p_limite
  OFFSET p_desplazamiento;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_perfiles_administrador(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_perfiles_administrador(text, integer, integer) TO authenticated;

DROP FUNCTION public.validar_eliminacion_perfil_administrador(uuid);
CREATE FUNCTION public.validar_eliminacion_perfil_administrador(p_perfil_id uuid)
RETURNS TABLE (
  puede_eliminar boolean,
  mensaje text,
  usuario_nombre text,
  correo text,
  rol text,
  tiene_datos_privados boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.perfiles;
  v_correo text;
  v_referencias record;
  v_tiene_registros boolean;
  v_tiene_datos_privados boolean;
  v_tablas_bloqueantes text[] := ARRAY[]::text[];
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS administrador
    WHERE administrador.id = auth.uid()
      AND lower(administrador.rol) = 'administrador'
      AND administrador.activo
  ) THEN
    RAISE EXCEPTION 'Solo un administrador con MFA puede eliminar cuentas';
  END IF;

  IF p_perfil_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta seleccionada no es válida';
  END IF;
  IF p_perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta';
  END IF;

  SELECT perfil.*
  INTO v_target
  FROM public.perfiles AS perfil
  WHERE perfil.id = p_perfil_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la cuenta seleccionada';
  END IF;

  IF lower(v_target.rol) = 'administrador'
    AND (
      SELECT count(*)
      FROM public.perfiles AS administrador
      WHERE lower(administrador.rol) = 'administrador'
        AND administrador.activo
    ) <= 1
  THEN
    RAISE EXCEPTION 'No se puede eliminar al último administrador';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.datos_personales_privados AS datos
    WHERE datos.perfil_id = p_perfil_id
  )
  INTO v_tiene_datos_privados;

  FOR v_referencias IN
    SELECT DISTINCT
      esquema.nspname AS esquema,
      tabla.relname AS tabla,
      columna.attname AS columna
    FROM pg_constraint AS restriccion
    JOIN pg_class AS tabla ON tabla.oid = restriccion.conrelid
    JOIN pg_namespace AS esquema ON esquema.oid = tabla.relnamespace
    JOIN LATERAL unnest(restriccion.conkey) WITH ORDINALITY AS llave_hija(attnum, orden)
      ON true
    JOIN LATERAL unnest(restriccion.confkey) WITH ORDINALITY AS llave_padre(attnum, orden)
      ON llave_padre.orden = llave_hija.orden
    JOIN pg_attribute AS columna
      ON columna.attrelid = tabla.oid
      AND columna.attnum = llave_hija.attnum
    WHERE restriccion.contype = 'f'
      AND restriccion.confrelid = 'public.perfiles'::regclass
      AND esquema.nspname = 'public'
      AND llave_padre.attnum = (
        SELECT atributo.attnum
        FROM pg_attribute AS atributo
        WHERE atributo.attrelid = 'public.perfiles'::regclass
          AND atributo.attname = 'id'
      )
      AND tabla.relname NOT IN ('notificaciones', 'datos_personales_privados', 'auditoria_eventos')
  LOOP
    IF v_referencias.tabla = 'saldos_socios' AND v_referencias.columna = 'perfil_id' THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1 AND saldo <> 0)',
        v_referencias.esquema,
        v_referencias.tabla,
        v_referencias.columna
      )
      INTO v_tiene_registros
      USING p_perfil_id;
    ELSE
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
        v_referencias.esquema,
        v_referencias.tabla,
        v_referencias.columna
      )
      INTO v_tiene_registros
      USING p_perfil_id;
    END IF;

    IF v_tiene_registros
      AND array_position(v_tablas_bloqueantes, format('%I', v_referencias.tabla)) IS NULL
    THEN
      v_tablas_bloqueantes := array_append(v_tablas_bloqueantes, format('%I', v_referencias.tabla));
    END IF;
  END LOOP;

  SELECT cuenta.email::text
  INTO v_correo
  FROM auth.users AS cuenta
  WHERE cuenta.id = p_perfil_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta de autenticación no existe';
  END IF;

  IF cardinality(v_tablas_bloqueantes) > 0 THEN
    RETURN QUERY SELECT
      false,
      ('La cuenta tiene registros operativos que deben conservarse: ' || array_to_string(v_tablas_bloqueantes, ', ') || '.')::text,
      trim(concat_ws(' ', v_target.nombre, v_target.apellido))::text,
      v_correo,
      v_target.rol::text,
      v_tiene_datos_privados;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    NULL::text,
    trim(concat_ws(' ', v_target.nombre, v_target.apellido))::text,
    v_correo,
    v_target.rol::text,
    v_tiene_datos_privados;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_eliminacion_perfil_administrador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_eliminacion_perfil_administrador(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cambiar_estado_perfil_administrador(
  p_perfil_id uuid,
  p_activo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.perfiles;
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS administrador
    WHERE administrador.id = auth.uid()
      AND lower(administrador.rol) = 'administrador'
      AND administrador.activo
  ) THEN
    RAISE EXCEPTION 'Solo un administrador con MFA puede cambiar el estado de una cuenta';
  END IF;
  IF p_perfil_id IS NULL OR p_activo IS NULL THEN
    RAISE EXCEPTION 'La cuenta seleccionada no es válida';
  END IF;
  IF p_perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes cambiar el estado de tu propia cuenta';
  END IF;

  SELECT perfil.*
  INTO v_target
  FROM public.perfiles AS perfil
  WHERE perfil.id = p_perfil_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la cuenta seleccionada';
  END IF;
  IF v_target.activo = p_activo THEN
    RETURN;
  END IF;
  IF NOT p_activo AND lower(v_target.rol) = 'administrador'
    AND (
      SELECT count(*)
      FROM public.perfiles AS administrador
      WHERE lower(administrador.rol) = 'administrador'
        AND administrador.activo
    ) <= 1
  THEN
    RAISE EXCEPTION 'No se puede desactivar al último administrador activo';
  END IF;

  UPDATE public.perfiles
  SET activo = p_activo
  WHERE id = p_perfil_id;

  INSERT INTO public.auditoria_eventos (
    actor_id,
    objetivo_id,
    evento,
    detalles
  )
  VALUES (
    auth.uid(),
    p_perfil_id,
    CASE WHEN p_activo THEN 'reactivacion_usuario' ELSE 'desactivacion_usuario' END,
    jsonb_build_object(
      'usuario_nombre', trim(concat_ws(' ', v_target.nombre, v_target.apellido)),
      'usuario_correo', (SELECT cuenta.email FROM auth.users AS cuenta WHERE cuenta.id = p_perfil_id),
      'usuario_rol', v_target.rol,
      'resultado', CASE WHEN p_activo THEN 'reactivada' ELSE 'desactivada' END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_estado_perfil_administrador(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_perfil_administrador(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
