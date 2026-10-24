CREATE TABLE public.administradores_principales (
  usuario_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.administradores_principales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.administradores_principales FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  v_super_admin_id uuid;
  v_previous_role text;
BEGIN
  SELECT cuenta.id
  INTO v_super_admin_id
  FROM auth.users AS cuenta
  WHERE lower(cuenta.email) = 'vinsul1225@gmail.com';

  IF v_super_admin_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la cuenta vinsul1225@gmail.com en Supabase Auth';
  END IF;

  SELECT perfil.rol
  INTO v_previous_role
  FROM public.perfiles AS perfil
  WHERE perfil.id = v_super_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta vinsul1225@gmail.com no tiene un perfil asociado';
  END IF;

  INSERT INTO public.administradores_principales (usuario_id)
  VALUES (v_super_admin_id)
  ON CONFLICT (usuario_id) DO NOTHING;

  IF lower(v_previous_role) <> 'administrador' THEN
    UPDATE public.perfiles
    SET rol = 'administrador'
    WHERE id = v_super_admin_id;

    INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
    VALUES (
      v_super_admin_id,
      v_super_admin_id,
      'gran_administrador_designado',
      jsonb_build_object(
        'correo', 'vinsul1225@gmail.com',
        'rol_anterior', v_previous_role,
        'rol_nuevo', 'administrador'
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_rol_perfil_administrador(
  p_perfil_id uuid,
  p_nuevo_rol text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol_anterior text;
  v_es_gran_administrador boolean;
BEGIN
  PERFORM public.exigir_mfa_actual();

  SELECT EXISTS (
    SELECT 1
    FROM public.administradores_principales AS principal
    WHERE principal.usuario_id = auth.uid()
  )
  INTO v_es_gran_administrador;

  IF auth.uid() IS NULL OR (
    NOT v_es_gran_administrador
    AND NOT EXISTS (
      SELECT 1
      FROM public.perfiles AS perfil_actual
      WHERE perfil_actual.id = auth.uid()
        AND lower(perfil_actual.rol) = 'administrador'
    )
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles';
  END IF;

  IF p_nuevo_rol IS NULL OR p_nuevo_rol NOT IN ('socio', 'tesorero', 'auditor', 'administrador') THEN
    RAISE EXCEPTION 'El rol solicitado no es válido';
  END IF;
  IF p_nuevo_rol <> 'socio'
    AND NOT v_es_gran_administrador
    AND NOT EXISTS (
      SELECT 1
      FROM public.datos_personales_privados AS datos
      WHERE datos.perfil_id = p_perfil_id
        AND datos.documento_verificado
    )
  THEN
    RAISE EXCEPTION 'El administrador debe verificar el documento antes de asignar un rol elevado';
  END IF;

  SELECT perfil.rol
  INTO v_rol_anterior
  FROM public.perfiles AS perfil
  WHERE perfil.id = p_perfil_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El perfil no existe';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.administradores_principales AS principal
    WHERE principal.usuario_id = p_perfil_id
  ) AND p_nuevo_rol <> 'administrador' THEN
    RAISE EXCEPTION 'No se puede retirar el rol de administrador principal';
  END IF;
  IF p_perfil_id = auth.uid() AND p_nuevo_rol <> v_rol_anterior THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol';
  END IF;

  UPDATE public.perfiles
  SET rol = p_nuevo_rol
  WHERE id = p_perfil_id;

  INSERT INTO public.auditoria_eventos (actor_id, objetivo_id, evento, detalles)
  VALUES (
    auth.uid(),
    p_perfil_id,
    'rol_perfil_actualizado',
    jsonb_build_object(
      'rol_anterior', v_rol_anterior,
      'rol_nuevo', p_nuevo_rol,
      'documento_verificado', CASE
        WHEN p_nuevo_rol = 'socio' THEN NULL
        ELSE EXISTS (
          SELECT 1
          FROM public.datos_personales_privados AS datos
          WHERE datos.perfil_id = p_perfil_id
            AND datos.documento_verificado
        )
      END,
      'asignacion_sin_documento', (
        p_nuevo_rol <> 'socio'
        AND v_es_gran_administrador
        AND NOT EXISTS (
          SELECT 1
          FROM public.datos_personales_privados AS datos
          WHERE datos.perfil_id = p_perfil_id
            AND datos.documento_verificado
        )
      )
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
