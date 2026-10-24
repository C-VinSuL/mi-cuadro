import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, rejectUntrustedOrigin } from "../_shared/cors.ts";

const appUrl = Deno.env.get("APP_URL");

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

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !brevoKey || !sender || !appUrl) {
    console.error("Falta configurar Supabase, Brevo, APP_URL o INVITATION_FROM en los secretos.");
    return jsonResponse(500, { error: "El correo de bienvenida no está configurado." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse(401, { error: "Inicia sesión para continuar." });
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) {
    return jsonResponse(401, { error: "La sesión no contiene un token válido." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return jsonResponse(401, { error: "La sesión no es válida." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = authData.user;
  const { data: existingProfile, error: profileError } = await adminClient
    .from("perfiles")
    .select("id, nombre, apellido, bienvenida_email_enviada")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("No se pudo consultar el perfil para la bienvenida:", profileError);
    return jsonResponse(500, { error: "No se pudo preparar el correo de bienvenida." });
  }

  let profile = existingProfile;
  if (!profile) {
    const metadata = user.user_metadata || {};
    const fullName = String(metadata.full_name || metadata.name || "").trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const nombre = String(metadata.given_name || nameParts.shift() || "Nuevo").trim();
    const apellido = String(metadata.family_name || nameParts.join(" ") || "Socio").trim();
    const { error: createProfileError } = await adminClient
      .from("perfiles")
      .upsert(
        { id: user.id, nombre, apellido, rol: "socio" },
        { onConflict: "id", ignoreDuplicates: true },
      );

    if (createProfileError) {
      console.error("No se pudo preparar el perfil de Google:", createProfileError);
      return jsonResponse(500, { error: "No se pudo preparar el perfil de la cuenta." });
    }

    const { data: createdProfile, error: createdProfileError } = await adminClient
      .from("perfiles")
      .select("id, nombre, apellido, bienvenida_email_enviada")
      .eq("id", user.id)
      .single();

    if (createdProfileError || !createdProfile) {
      console.error("No se pudo volver a consultar el perfil creado:", createdProfileError);
      return jsonResponse(500, { error: "No se pudo preparar el perfil de la cuenta." });
    }
    profile = createdProfile;
  }

  if (profile.bienvenida_email_enviada) return jsonResponse(200, { sent: false });
  if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    return jsonResponse(400, { error: "La cuenta no tiene un correo válido para enviar la bienvenida." });
  }

  const senderMatch = sender.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const senderEmail = senderMatch ? senderMatch[2].trim() : sender.trim();
  const senderName = senderMatch?.[1].trim() || "FlashMonkey";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    console.error("INVITATION_FROM debe contener un correo válido.");
    return jsonResponse(500, { error: "El remitente del correo no está configurado correctamente." });
  }

  const claimAt = new Date().toISOString();
  const staleClaimAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: claimedProfile, error: claimError } = await adminClient
    .from("perfiles")
    .update({ bienvenida_email_intento_en: claimAt })
    .eq("id", user.id)
    .eq("bienvenida_email_enviada", false)
    .or(`bienvenida_email_intento_en.is.null,bienvenida_email_intento_en.lt.${staleClaimAt}`)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("No se pudo reservar el envío de bienvenida:", claimError);
    return jsonResponse(500, { error: "No se pudo reservar el envío del correo de bienvenida." });
  }
  if (!claimedProfile) return jsonResponse(200, { sent: false });

  const releaseClaim = async () => {
    const { error } = await adminClient
      .from("perfiles")
      .update({ bienvenida_email_intento_en: null })
      .eq("id", user.id)
      .eq("bienvenida_email_intento_en", claimAt);
    if (error) console.error("No se pudo liberar la reserva del correo de bienvenida:", error);
  };

  const name = escapeHtml([profile.nombre, profile.apellido].filter(Boolean).join(" ") || "socio");
  const safeAppUrl = escapeHtml(appUrl.replace(/\/$/, ""));
  let mailResponse: Response;

  try {
    mailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: user.email }],
        subject: "¡Te damos la bienvenida a FlashMonkey!",
        htmlContent: `<main style="margin:0 auto;max-width:600px;padding:32px 20px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
          <section style="overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:#fff">
            <header style="padding:32px 28px;background:#065f46;color:#fff">
              <p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">FlashMonkey</p>
              <h1 style="margin:0;font-size:28px;line-height:1.25">¡Qué bueno tenerte aquí!</h1>
            </header>
            <div style="padding:30px 28px">
              <p style="font-size:17px;line-height:1.6">Hola ${name},</p>
              <p style="font-size:16px;line-height:1.7">Tu cuenta ya está lista. En FlashMonkey te ayudamos a organizar tus grupos y avanzar hacia tus metas en comunidad.</p>
              <p style="margin:28px 0"><a href="${safeAppUrl}" style="display:inline-block;border-radius:9px;background:#047857;padding:14px 22px;color:#fff;font-weight:bold;text-decoration:none">Ir a FlashMonkey</a></p>
              <p style="font-size:14px;line-height:1.6;color:#475569">Completa tu perfil al ingresar para dejar preparada tu cuenta. Si no creaste esta cuenta, puedes ignorar este mensaje.</p>
            </div>
            <footer style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:12px;line-height:1.6">Este mensaje fue enviado por FlashMonkey. Por favor, no respondas a este correo.</footer>
          </section>
        </main>`,
      }),
    });
  } catch (error) {
    console.error("No se pudo conectar con Brevo para enviar la bienvenida:", error);
    await releaseClaim();
    return jsonResponse(502, { error: "No se pudo conectar con el proveedor del correo. Inténtalo de nuevo más tarde." });
  }

  if (!mailResponse.ok) {
    const responseText = await mailResponse.text();
    console.error("Brevo rechazó el correo de bienvenida:", {
      status: mailResponse.status,
      details: responseText,
    });
    await releaseClaim();
    return jsonResponse(502, { error: "El proveedor no pudo enviar el correo de bienvenida." });
  }

  const { error: markSentError } = await adminClient
    .from("perfiles")
    .update({ bienvenida_email_enviada: true, bienvenida_email_intento_en: null })
    .eq("id", user.id)
    .eq("bienvenida_email_enviada", false)
    .eq("bienvenida_email_intento_en", claimAt);
  if (markSentError) {
    console.error("Brevo aceptó el correo, pero no se pudo guardar el estado de envío:", markSentError);
    return jsonResponse(500, { error: "El correo se envió, pero no se pudo confirmar el estado del envío." });
  }

  return jsonResponse(200, { sent: true });
});
