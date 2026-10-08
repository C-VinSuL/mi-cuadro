import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  const email = form.email?.trim().toLowerCase();
  const password = form.password || "";
  const nombre = form.nombre?.trim() || "";
  const apellido = form.apellido?.trim() || "";
  const cedula = form.cedula?.trim() || "";
  const direccion = form.direccion?.trim() || "";
  const fechaNacimiento = form.fechaNacimiento || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || password.length < 8 || !nombre || !apellido
    || cedula.length < 6 || cedula.length > 20 || !direccion) {
    return response(400, { error: "Completa los datos requeridos con formatos válidos." });
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
    console.error("Supabase Auth rechazó el registro:", error.message);
    return response(400, { error: "No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente." });
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
