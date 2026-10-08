import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] || character));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Método no permitido" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar Supabase en los secretos de la función.");
    return jsonResponse(500, { error: "El servicio de invitaciones no está configurado." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse(401, { error: "Inicia sesión para continuar." });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse(401, { error: "La sesión no es válida." });
  const { data: assurance, error: assuranceError } =
    await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance.currentLevel !== "aal2") {
    return jsonResponse(403, { error: "Completa la verificación MFA antes de continuar." });
  }

  let body: { action?: string; requestId?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "La solicitud no contiene JSON válido." });
  }

  if (body.action === "send") {
    if (!body.requestId) return jsonResponse(400, { error: "Falta la solicitud de invitación." });
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("INVITATION_FROM");
    const appUrl = Deno.env.get("APP_URL");
    if (!resendKey || !sender || !appUrl) {
      return jsonResponse(500, { error: "Configura RESEND_API_KEY, INVITATION_FROM y APP_URL en los secretos de Supabase." });
    }

    const rawToken = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { data: inviteRows, error: inviteError } = await userClient.rpc(
      "preparar_invitacion_grupo",
      { p_solicitud_id: body.requestId, p_token_hash: await sha256(rawToken) },
    );
    if (inviteError) return jsonResponse(400, { error: inviteError.message });
    const invite = inviteRows?.[0];
    if (!invite?.perfil_id || !invite?.grupo_nombre) {
      return jsonResponse(500, { error: "No se pudo preparar la invitación." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: recipientData, error: recipientError } =
      await adminClient.auth.admin.getUserById(invite.perfil_id);
    const email = recipientData.user?.email;
    const emailConfirmed = Boolean(recipientData.user?.email_confirmed_at || recipientData.user?.confirmed_at);
    if (recipientError || !email || !emailConfirmed) {
      await userClient.rpc("revertir_invitacion_grupo", { p_solicitud_id: body.requestId });
      return jsonResponse(400, { error: "El socio debe confirmar el correo de su cuenta antes de recibir una invitación." });
    }

    const link = `${appUrl.replace(/\/$/, "")}/aceptar-invitacion?token=${rawToken}`;
    const name = escapeHtml(invite.nombre || "socio");
    const groupName = escapeHtml(invite.grupo_nombre);
    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject: `Invitación al grupo ${invite.grupo_nombre}`,
        html: `<main style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:24px">
          <h1 style="color:#065f46">¡Te damos la bienvenida, ${name}!</h1>
          <p>El administrador te invita a unirte al grupo <strong>${groupName}</strong> en FlashMonkey.</p>
          <p>Abre el enlace y accede con la cuenta a la que se envió este correo. Después, la administración confirmará tu ingreso.</p>
          <p style="margin:28px 0"><a href="${link}" style="background:#065f46;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Revisar invitación</a></p>
          <p>El enlace vence en 72 horas y solo puede usarse una vez. Si no esperabas esta invitación, ignora este mensaje.</p>
        </main>`,
      }),
    });

    if (!mailResponse.ok) {
      const details = await mailResponse.text();
      console.error("Resend rechazó el mensaje:", details);
      await userClient.rpc("revertir_invitacion_grupo", { p_solicitud_id: body.requestId });
      return jsonResponse(502, { error: "No se pudo enviar el correo. Revisa la configuración del proveedor." });
    }
    return jsonResponse(200, { sent: true });
  }

  if (body.action === "accept") {
    if (!body.token || !/^[a-f0-9]{64}$/i.test(body.token)) {
      return jsonResponse(400, { error: "El enlace de invitación no es válido." });
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const forwarded = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const { error } = await serviceClient.rpc("aceptar_invitacion_grupo_backend", {
      p_perfil_id: authData.user.id,
      p_token_hash: await sha256(body.token),
      p_direccion_ip: forwarded || null,
      p_agente_usuario: request.headers.get("user-agent") || "",
    });
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, { accepted: true });
  }

  return jsonResponse(400, { error: "Acción no reconocida." });
});
