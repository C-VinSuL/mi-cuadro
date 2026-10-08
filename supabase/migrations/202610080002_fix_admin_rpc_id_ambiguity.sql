CREATE OR REPLACE FUNCTION public.listar_solicitudes_invitacion_admin()
RETURNS TABLE (
  id uuid,
  grupo_id uuid,
  grupo_nombre text,
  perfil_id uuid,
  nombre text,
  apellido text,
  creada_en timestamptz,
  estado text
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
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede revisar invitaciones';
  END IF;

  RETURN QUERY
  SELECT solicitud.id,
    solicitud.grupo_id,
    grupo.nombre::text,
    solicitud.perfil_id,
    perfil.nombre::text,
    perfil.apellido::text,
    solicitud.creada_en,
    solicitud.estado::text
  FROM public.solicitudes_invitacion_grupo AS solicitud
  JOIN public.grupos AS grupo ON grupo.id = solicitud.grupo_id
  JOIN public.perfiles AS perfil ON perfil.id = solicitud.perfil_id
  WHERE solicitud.estado = 'pendiente'
  ORDER BY solicitud.creada_en;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_documentos_pendientes_tesorero()
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  cedula text,
  direccion text
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
      AND lower(perfil_actual.rol) = 'tesorero'
  ) THEN
    RAISE EXCEPTION 'Solo tesorería puede revisar documentos';
  END IF;

  RETURN QUERY
  SELECT perfil.id,
    perfil.nombre::text,
    perfil.apellido::text,
    perfil.telefono::text,
    datos.cedula,
    datos.direccion
  FROM public.perfiles AS perfil
  JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE NOT datos.documento_verificado
  ORDER BY perfil.apellido, perfil.nombre
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_perfiles_administrador(p_busqueda text)
RETURNS TABLE (
  id uuid,
  nombre text,
  apellido text,
  telefono text,
  rol text,
  cedula text,
  direccion text,
  fecha_nacimiento date,
  documento_verificado boolean
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
  ) THEN
    RAISE EXCEPTION 'Solo el administrador puede consultar el registro';
  END IF;
  IF length(trim(coalesce(p_busqueda, ''))) < 2 THEN
    RAISE EXCEPTION 'Ingresa al menos dos caracteres para buscar';
  END IF;

  RETURN QUERY
  SELECT perfil.id,
    perfil.nombre::text,
    perfil.apellido::text,
    perfil.telefono::text,
    perfil.rol::text,
    datos.cedula::text,
    datos.direccion::text,
    datos.fecha_nacimiento,
    coalesce(datos.documento_verificado, false)
  FROM public.perfiles AS perfil
  LEFT JOIN public.datos_personales_privados AS datos ON datos.perfil_id = perfil.id
  WHERE perfil.nombre ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.apellido ILIKE '%' || trim(p_busqueda) || '%'
     OR perfil.telefono ILIKE '%' || trim(p_busqueda) || '%'
     OR datos.cedula ILIKE '%' || trim(p_busqueda) || '%'
  ORDER BY perfil.apellido, perfil.nombre
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_auditoria_administrador(
  p_grupo_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT NULL,
  p_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  grupo_nombre text,
  evento text,
  actor text,
  objetivo text,
  ocurrido_en timestamptz,
  direccion_ip text,
  agente_usuario text,
  detalles jsonb
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
      AND lower(perfil_actual.rol) IN ('administrador', 'auditor')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para consultar auditoría';
  END IF;

  RETURN QUERY
  SELECT evento_auditoria.id,
    coalesce(grupo.nombre, evento_auditoria.detalles ->> 'grupo_nombre')::text,
    evento_auditoria.evento,
    coalesce(
      nullif(trim(concat_ws(' ', actor.nombre, actor.apellido)), ''),
      'Sistema'
    )::text,
    nullif(trim(concat_ws(' ', objetivo.nombre, objetivo.apellido)), '')::text,
    evento_auditoria.ocurrido_en,
    host(evento_auditoria.direccion_ip)::text,
    evento_auditoria.agente_usuario,
    evento_auditoria.detalles
  FROM public.auditoria_eventos AS evento_auditoria
  LEFT JOIN public.grupos AS grupo ON grupo.id = evento_auditoria.grupo_id
  LEFT JOIN public.perfiles AS actor ON actor.id = evento_auditoria.actor_id
  LEFT JOIN public.perfiles AS objetivo ON objetivo.id = evento_auditoria.objetivo_id
  WHERE (p_grupo_id IS NULL OR evento_auditoria.grupo_id = p_grupo_id)
    AND (p_desde IS NULL OR evento_auditoria.ocurrido_en >= p_desde)
    AND (p_hasta IS NULL OR evento_auditoria.ocurrido_en < p_hasta)
  ORDER BY evento_auditoria.ocurrido_en DESC
  LIMIT 5000;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_solicitudes_invitacion_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_documentos_pendientes_tesorero() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buscar_perfiles_administrador(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_auditoria_administrador(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_invitacion_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_documentos_pendientes_tesorero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_perfiles_administrador(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_auditoria_administrador(uuid, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
