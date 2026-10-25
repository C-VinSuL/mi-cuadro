DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS bienvenida_email_enviada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bienvenida_email_intento_en timestamptz;
