import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, rejectUntrustedOrigin } from "../_shared/cors.ts";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] || character));

Deno.serve(async (request) => {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Método no permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("INVITATION_FROM");
  const appUrl = Deno.env.get("APP_URL");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !brevoKey || !sender || !appUrl) {
    console.error("Falta configurar Supabase, Brevo, APP_URL o INVITATION_FROM para admin-reset-mfa.");
    return jsonResponse(500, { error: "El servicio de restablecimiento no está configurado." });
  }

  const senderMatch = sender.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const senderEmail = senderMatch ? senderMatch[2].trim() : sender.trim();
  const senderName = senderMatch?.[1].trim() || "FlashMonkey";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    return jsonResponse(500, { error: "INVITATION_FROM debe contener un correo válido." });
  }

  let appOrigin: string;
  try {
    const appUrlValue = new URL(appUrl);
    if (
      appUrlValue.protocol !== "https:"
      && appUrlValue.hostname !== "localhost"
      && appUrlValue.hostname !== "127.0.0.1"
    ) {
      return jsonResponse(500, { error: "APP_URL debe usar HTTPS." });
    }
    appOrigin = appUrlValue.origin;
  } catch {
    return jsonResponse(500, { error: "APP_URL no contiene una URL válida." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse(401, { error: "Inicia sesión para continuar." });
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) {
    return jsonResponse(401, { error: "La sesión no contiene un token de acceso válido." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return jsonResponse(401, { error: "La sesión no es válida." });

  const { data: assurance, error: assuranceError } =
    await userClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  if (assuranceError) {
    console.error("No se pudo verificar el nivel MFA de la sesión administrativa:", assuranceError);
    return jsonResponse(500, { error: "No se pudo comprobar la verificación MFA." });
  }
  if (assurance.currentLevel !== "aal2") {
    return jsonResponse(403, { error: "Debes verificar tu segundo factor antes de restablecer el de otra cuenta." });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "La solicitud no contiene JSON válido." });
  }
  if (!body.userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
    return jsonResponse(400, { error: "La cuenta seleccionada no es válida." });
  }
  if (body.userId === authData.user.id) {
    return jsonResponse(400, { error: "No puedes restablecer tu propio segundo factor desde esta acción." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminProfile, error: adminProfileError } = await adminClient
    .from("perfiles")
    .select("rol")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (adminProfileError) {
    console.error("No se pudo comprobar el rol del administrador:", adminProfileError);
    return jsonResponse(500, { error: "No se pudo comprobar el rol administrativo." });
  }
  if (adminProfile?.rol?.toLowerCase() !== "administrador") {
    return jsonResponse(403, { error: "Solo un administrador puede restablecer el segundo factor." });
  }

  const { data: administratorProfiles, error: administratorProfilesError } = await adminClient
    .from("perfiles")
    .select("id")
    .ilike("rol", "administrador");
  if (administratorProfilesError) {
    console.error("No se pudo comprobar la lista de administradores:", administratorProfilesError);
    return jsonResponse(500, { error: "No se pudo comprobar la lista de administradores." });
  }
  const administratorIds = new Set((administratorProfiles || []).map((profile) => profile.id));
  const { data: resetRequests, error: resetRequestError } = await adminClient
    .from("notificaciones")
    .select("usuario_id")
    .like("fuente", `mfa-reset:${body.userId}:%`)
    .gte("creada_en", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  if (resetRequestError) {
    console.error("No se pudo comprobar la solicitud de restablecimiento MFA:", resetRequestError);
    return jsonResponse(500, { error: "No se pudo comprobar la solicitud de restablecimiento MFA." });
  }
  const hasResetRequest = (resetRequests || []).some((notification) =>
    administratorIds.has(notification.usuario_id)
  );
  if (!hasResetRequest) {
    return jsonResponse(409, { error: "El socio no tiene una solicitud de restablecimiento pendiente. Pídele que la envíe desde la pantalla de seguridad." });
  }

  const [{ data: targetProfile, error: targetProfileError }, { data: targetAuth, error: targetAuthError }] =
    await Promise.all([
      adminClient.from("perfiles").select("nombre, apellido").eq("id", body.userId).maybeSingle(),
      adminClient.auth.admin.getUserById(body.userId),
    ]);
  const recipientEmail = targetAuth.user?.email;
  if (targetProfileError || targetAuthError || !targetProfile || !recipientEmail) {
    console.error("No se pudo validar la cuenta destino:", targetProfileError || targetAuthError);
    return jsonResponse(404, { error: "No se encontró la cuenta o su correo registrado." });
  }
  if (!targetAuth.user?.email_confirmed_at && !targetAuth.user?.confirmed_at) {
    return jsonResponse(400, { error: "La cuenta debe tener el correo confirmado para recibir estas instrucciones." });
  }

  const { data: factors, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({
    userId: body.userId,
  });
  if (factorsError) {
    console.error("No se pudieron consultar los factores MFA de la cuenta destino:", factorsError);
    return jsonResponse(502, { error: "No se pudieron consultar los factores de la cuenta." });
  }

  const totpFactors = factors?.factors?.filter((factor) => factor.factor_type === "totp") || [];
  let removedFactors = 0;
  let deletionFailed = false;
  for (const factor of totpFactors) {
    const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
      userId: body.userId,
      id: factor.id,
    });
    if (deleteError) {
      deletionFailed = true;
      console.error("No se pudo eliminar un factor TOTP:", {
        userId: body.userId,
        factorId: factor.id,
        error: deleteError,
      });
    } else {
      removedFactors += 1;
    }
  }
  if (deletionFailed && removedFactors === 0) {
    return jsonResponse(502, { error: "No se pudo eliminar el factor TOTP. No se envió el correo." });
  }

  const factorReset = removedFactors > 0;
  const fullName = `${targetProfile.nombre || ""} ${targetProfile.apellido || ""}`.trim() || "socio";
  const link = `${appOrigin}/seguridad/mfa`;
  const { error: notificationError } = await adminClient.from("notificaciones").insert({
    usuario_id: body.userId,
    titulo: factorReset ? "Restablecimiento del segundo factor" : "Configura tu segundo factor",
    mensaje: factorReset
      ? "Administración restableció tu segundo factor. Inicia sesión y configura uno nuevo desde la pantalla de seguridad."
      : "Administración confirmó que no tienes un factor TOTP activo. Inicia sesión y configura tu segundo factor desde la pantalla de seguridad.",
    tipo: "info",
    ruta_accion: "/seguridad/mfa",
    etiqueta_accion: "Configurar segundo factor",
    fuente: `mfa-reset-complete:${body.userId}:${crypto.randomUUID()}`,
  });
  if (notificationError) {
    console.error("No se pudo guardar la notificación de restablecimiento MFA:", notificationError);
  }
  const { error: closeRequestError } = await adminClient
    .from("notificaciones")
    .update({ leida: true })
    .like("fuente", `mfa-reset:${body.userId}:%`);
  if (closeRequestError) {
    console.error("No se pudo marcar como atendida la solicitud de restablecimiento MFA:", closeRequestError);
  }

  const setupInstructions = factorReset
    ? "Tu factor de autenticación anterior fue restablecido por administración. Por seguridad, tus sesiones activas se cerraron. Inicia sesión nuevamente con tu método habitual y sigue los pasos para registrar un nuevo código QR."
    : "Administración confirmó que tu cuenta no tiene un factor TOTP activo. Inicia sesión con tu método habitual y sigue los pasos para configurar tu segundo factor y escanear el nuevo código QR.";
  let emailSent = false;
  try {
    const mailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipientEmail }],
        subject: "Instrucciones para configurar tu segundo factor",
        htmlContent: `<main style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:24px">
          <h1 style="color:#065f46">Hola, ${escapeHtml(fullName)}</h1>
          <p>${escapeHtml(setupInstructions)}</p>
          <p style="margin:28px 0"><a href="${link}" style="background:#065f46;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Configurar segundo factor</a></p>
          <p>El código QR solo aparecerá en tu sesión segura. No lo compartas ni envíes por correo.</p>
          <p>Si no solicitaste esta ayuda, comunícate con administración por un canal oficial.</p>
        </main>`,
      }),
    });
    if (mailResponse.ok) {
      emailSent = true;
    } else {
      console.error("Brevo rechazó el correo de restablecimiento MFA:", {
        status: mailResponse.status,
        details: await mailResponse.text(),
      });
    }
  } catch (sendError) {
    console.error("No se pudo conectar con Brevo para enviar el correo de restablecimiento MFA:", sendError);
  }

  return jsonResponse(200, {
    factorReset,
    emailSent,
    partialReset: deletionFailed,
  });
});
