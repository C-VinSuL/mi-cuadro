CREATE OR REPLACE FUNCTION public.chat_puede_acceder(p_canal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.chat_canales AS canal
      JOIN public.perfiles AS perfil ON perfil.id = auth.uid()
      WHERE canal.id = p_canal_id
        AND perfil.activo
        AND (
          (
            canal.tipo = 'equipo'
            AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
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
    )
$$;

CREATE OR REPLACE FUNCTION public.chat_nombre_visible(p_nombre text, p_apellido text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.perfiles AS perfil
      WHERE perfil.id = auth.uid()
        AND lower(coalesce(perfil.rol, '')) IN ('administrador', 'tesorero', 'auditor')
    )
    THEN coalesce(
      nullif(trim(concat_ws(' ', nullif(trim(p_nombre), ''), nullif(trim(p_apellido), ''))), ''),
      'Usuario'
    )
    ELSE trim(
      coalesce(nullif(trim(p_nombre), ''), 'Usuario')
      || CASE
        WHEN nullif(trim(p_apellido), '') IS NULL THEN ''
        ELSE ' ' || left(trim(p_apellido), 1) || '.'
      END
    )
  END
$$;

NOTIFY pgrst, 'reload schema';
