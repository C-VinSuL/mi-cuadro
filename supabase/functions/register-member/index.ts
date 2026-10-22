import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, rejectUntrustedOrigin } from "../_shared/cors.ts";

const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const genericConfirmation = () => response(200, {
  created: true,
  confirmationRequired: true,
  message: "Si los datos permiten crear la cuenta, recibirás un correo de confirmación.",
});

Deno.serve(async (request) => {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Método no permitido" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar Supabase en los secretos del registro.");
    return response(500, { error: "El registro no está configurado." });
  }

  let form: {
    email?: string;
    password?: string;
    nombre?: string;
    apellido?: string;
    telefono?: string;
    cedula?: string;
    direccion?: string;
    fechaNacimiento?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  try {
    form = await request.json();
  } catch {
    return response(400, { error: "La solicitud no contiene JSON válido." });
  }

  const email = typeof form.email === "string" ? form.email.trim().toLowerCase() : "";
  const password = typeof form.password === "string" ? form.password : "";
  const nombre = typeof form.nombre === "string" ? form.nombre.trim() : "";
  const apellido = typeof form.apellido === "string" ? form.apellido.trim() : "";
  const cedula = typeof form.cedula === "string" && form.cedula.trim() ? form.cedula.trim() : null;
  const direccion = typeof form.direccion === "string" ? form.direccion.trim() || null : null;
  const fechaNacimiento = typeof form.fechaNacimiento === "string" ? form.fechaNacimiento : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response(400, { error: "Escribe un correo electrónico válido." });
  }
  if (password.length < 8) {
    return response(400, { error: "La contraseña debe tener al menos 8 caracteres." });
  }
  if (!nombre) {
    return response(400, { error: "Ingresa tu nombre completo." });
  }
  if (cedula !== null && (cedula.length < 6 || cedula.length > 20)) {
    return response(400, { error: "El número de documento debe tener entre 6 y 20 caracteres." });
  }
  if (fechaNacimiento && (Number.isNaN(Date.parse(fechaNacimiento)) || Date.parse(fechaNacimiento) > Date.now())) {
    return response(400, { error: "La fecha de nacimiento no es válida." });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, telefono: form.telefono?.trim() || "" } },
  });
  if (error) {
    console.error("Supabase Auth rechazó el registro:", {
      code: error.code,
      message: error.message,
    });
    const registrationErrorMessages: Record<string, string> = {
      weak_password: "La contraseña no cumple los requisitos de seguridad. Prueba con otra de al menos 8 caracteres que no hayas usado antes.",
      password_too_short: "La contraseña debe tener al menos 8 caracteres.",
      email_address_invalid: "El correo electrónico no es válido. Revísalo e inténtalo nuevamente.",
      over_email_send_rate_limit: "Se enviaron demasiados intentos de registro. Espera unos minutos antes de volver a intentarlo.",
      over_request_rate_limit: "Se enviaron demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.",
      signup_disabled: "El registro está temporalmente deshabilitado. Contacta a administración.",
      email_provider_disabled: "El registro por correo está temporalmente deshabilitado. Contacta a administración.",
      user_already_exists: "No se pudo crear la cuenta con esos datos. Si ya tienes una cuenta, inicia sesión o solicita restablecer tu contraseña.",
      email_exists: "No se pudo crear la cuenta con esos datos. Si ya tienes una cuenta, inicia sesión o solicita restablecer tu contraseña.",
    };
    return response(
      400,
      {
        error: registrationErrorMessages[error.code || ""] ||
          "No se pudo crear la cuenta. Revisa el correo y la contraseña e inténtalo nuevamente.",
      },
    );
  }

  let user = data.user;
  if (!user?.id) return response(500, { error: "No se pudo completar el registro." });

  // A duplicate signup only proceeds after the account owner proves the password.
  if (!user.identities?.length) {
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signInData.user) {
      return genericConfirmation();
    }
    user = signInData.user;
    const { error: signOutError } = await authClient.auth.signOut();
    if (signOutError) console.error("No se pudo cerrar la sesión temporal de registro:", signOutError.message);
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("perfiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("No se pudo comprobar el perfil de registro:", {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    });
    return response(500, { error: "La cuenta se creó, pero no se pudo guardar el perfil. Contacta a administración." });
  }
  if (!profile) {
    const { error: createProfileError } = await adminClient.from("perfiles").insert({
      id: user.id,
      nombre,
      apellido,
      telefono: form.telefono?.trim() || null,
      rol: "socio",
    });
    if (createProfileError) {
      const { data: profileAfterInsert, error: retryError } = await adminClient
        .from("perfiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (retryError || !profileAfterInsert) {
        console.error("No se pudo crear el perfil:", {
          code: createProfileError.code,
          message: createProfileError.message,
          details: createProfileError.details,
          hint: createProfileError.hint,
          retryError: retryError?.message,
        });
        return response(500, { error: "La cuenta se creó, pero no se pudo guardar el perfil. Reintenta el registro con el mismo correo y contraseña o contacta a administración." });
      }
    }
  }

  const { error: privateDataError } = await adminClient
    .from("datos_personales_privados")
    .insert({
      perfil_id: user.id,
      cedula,
      direccion,
      fecha_nacimiento: fechaNacimiento,
      redes_sociales: {
        instagram: form.instagram?.trim() || null,
        facebook: form.facebook?.trim() || null,
        linkedin: form.linkedin?.trim() || null,
      },
    });
  if (privateDataError) {
    const { data: savedPrivateData, error: privateDataRetryError } = await adminClient
      .from("datos_personales_privados")
      .select("perfil_id")
      .eq("perfil_id", user.id)
      .maybeSingle();
    if (!privateDataRetryError && savedPrivateData) {
      return response(200, {
        created: true,
        confirmationRequired: true,
        message: "La cuenta y el perfil ya están registrados. Revisa tu correo para confirmar la dirección.",
      });
    }
    console.error("No se pudo guardar el registro privado:", {
      code: privateDataError.code,
      message: privateDataError.message,
      details: privateDataError.details,
      hint: privateDataError.hint,
      retryError: privateDataRetryError?.message,
    });
    return response(500, { error: "La cuenta se creó, pero no se pudieron guardar los datos privados. Contacta a administración." });
  }

  return response(200, {
    created: true,
    confirmationRequired: true,
    message: "Cuenta creada. Revisa tu correo para confirmar la dirección.",
  });
});
