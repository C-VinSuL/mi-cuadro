ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS bienvenida_email_enviada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bienvenida_email_intento_en timestamptz;

UPDATE public.perfiles
SET bienvenida_email_enviada = true
WHERE bienvenida_email_enviada = false;
