CREATE OR REPLACE FUNCTION public.validar_eliminacion_perfil_administrador(p_perfil_id uuid)
RETURNS TABLE (
  puede_eliminar boolean,
  mensaje text,
  usuario_nombre text,
  correo text,
  rol text
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
  v_tablas_bloqueantes text[] := ARRAY[]::text[];
BEGIN
  PERFORM public.exigir_mfa_actual();

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS administrador
    WHERE administrador.id = auth.uid()
      AND lower(administrador.rol) = 'administrador'
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
    ) <= 1
  THEN
    RAISE EXCEPTION 'No se puede eliminar al último administrador';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.datos_personales_privados AS datos
    WHERE datos.perfil_id = p_perfil_id
      AND (datos.documento_identidad_path IS NOT NULL OR datos.documento_verificado)
  ) THEN
    v_tablas_bloqueantes := array_append(v_tablas_bloqueantes, 'documentos de identidad');
  END IF;

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
      false::boolean,
      ('La cuenta tiene registros operativos que deben conservarse: ' || array_to_string(v_tablas_bloqueantes, ', ') || '.')::text,
      trim(concat_ws(' ', v_target.nombre, v_target.apellido))::text,
      v_correo::text,
      v_target.rol::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true::boolean,
    NULL::text,
    trim(concat_ws(' ', v_target.nombre, v_target.apellido))::text,
    v_correo::text,
    v_target.rol::text;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_eliminacion_perfil_administrador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_eliminacion_perfil_administrador(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
