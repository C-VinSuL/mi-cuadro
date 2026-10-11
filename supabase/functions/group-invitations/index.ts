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
    console.error("No se pudo verificar el nivel MFA de la sesión:", assuranceError);
    return jsonResponse(500, { error: "No se pudo comprobar la verificación MFA. Inténtalo de nuevo." });
  }
  if (assurance.currentLevel !== "aal2") {
    console.warn("La sesión de invitaciones no tiene MFA verificado:", {
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
    });
    return jsonResponse(403, {
      error: "Supabase recibió una sesión sin la verificación MFA actualizada. Vuelve a verificar tu código e inténtalo otra vez."
    });
  }

  let body: { action?: string; requestId?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "La solicitud no contiene JSON válido." });
  }

  if (body.action === "send") {
    if (!body.requestId) return jsonResponse(400, { error: "Falta la solicitud de invitación." });
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const sender = Deno.env.get("INVITATION_FROM");
    const appUrl = Deno.env.get("APP_URL");
    if (!brevoKey || !sender || !appUrl) {
      return jsonResponse(500, { error: "Configura BREVO_API_KEY, INVITATION_FROM y APP_URL en los secretos de Supabase." });
    }

    const senderMatch = sender.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    const senderEmail = senderMatch ? senderMatch[2].trim() : sender.trim();
    const senderName = senderMatch?.[1].trim() || "FlashMonkey";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      return jsonResponse(500, { error: "INVITATION_FROM debe contener un correo válido y, opcionalmente, un nombre." });
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
    let mailResponse: Response;
    try {
      mailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject: `Invitación al grupo ${invite.grupo_nombre}`,
          htmlContent: `<main style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto;padding:24px">
            <h1 style="color:#065f46">¡Te damos la bienvenida, ${name}!</h1>
            <p>El administrador te invita a unirte al grupo <strong>${groupName}</strong> en FlashMonkey.</p>
            <p>Abre el enlace y accede con la cuenta a la que se envió este correo. Después, la administración confirmará tu ingreso.</p>
            <p style="margin:28px 0"><a href="${link}" style="background:#065f46;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Revisar invitación</a></p>
            <p>El enlace vence en 72 horas y solo puede usarse una vez. Si no esperabas esta invitación, ignora este mensaje.</p>
          </main>`,
        }),
      });
    } catch (sendError) {
      console.error("No se pudo conectar con la API de Brevo:", sendError);
      const { error: rollbackError } = await userClient.rpc(
        "revertir_invitacion_grupo",
        { p_solicitud_id: body.requestId },
      );
      if (rollbackError) {
        console.error("No se pudo revertir la invitación tras el error de conexión con Brevo:", rollbackError);
      }
      return jsonResponse(502, { error: "No se pudo conectar con Brevo. Revisa los registros de group-invitations e inténtalo de nuevo." });
    }

    if (!mailResponse.ok) {
      const responseText = await mailResponse.text();
      let providerDetails = responseText;
      try {
        const payload = JSON.parse(responseText);
        providerDetails = [payload.message, payload.name, payload.code]
          .filter((value) => typeof value === "string" && value.length > 0)
          .join(" · ") || responseText;
      } catch {
        providerDetails = responseText;
      }

      console.error("Brevo rechazó el mensaje:", {
        status: mailResponse.status,
        details: providerDetails,
      });

      const { error: rollbackError } = await userClient.rpc(
        "revertir_invitacion_grupo",
        { p_solicitud_id: body.requestId },
      );
      if (rollbackError) {
        console.error("No se pudo revertir el estado de la invitación tras el rechazo de Brevo:", rollbackError);
      }

      const normalizedDetails = providerDetails.toLowerCase();
      let errorMessage = `Brevo rechazó el correo (HTTP ${mailResponse.status}). Revisa los registros de la función group-invitations en Supabase.`;
      if (/api.?key|unauthorized|invalid.*key/.test(normalizedDetails) || mailResponse.status === 401) {
        errorMessage = "Brevo rechazó la clave API. Verifica BREVO_API_KEY en los secretos de Supabase y actualízala si fue revocada.";
      } else if (/domain|sender|from address|verified|not allowed to send/.test(normalizedDetails) || mailResponse.status === 403) {
        errorMessage = "Brevo rechazó el remitente. Verifica el dominio en Brevo y que INVITATION_FROM use una dirección de ese dominio verificado.";
      } else if (mailResponse.status === 429) {
        errorMessage = "Brevo alcanzó el límite de envíos. Espera y vuelve a intentarlo o revisa los límites de tu cuenta.";
      } else if (mailResponse.status === 400 || mailResponse.status === 422) {
        errorMessage = "Brevo rechazó los datos del correo. Revisa INVITATION_FROM, el correo de destino y los registros de group-invitations en Supabase.";
      }
      return jsonResponse(502, { error: errorMessage });
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
