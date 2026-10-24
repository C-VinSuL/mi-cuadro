import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, rejectUntrustedOrigin } from "../_shared/cors.ts";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Método no permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar Supabase para admin-set-user-status.");
    return jsonResponse(500, { error: "El servicio de estado de cuentas no está configurado." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse(401, { error: "Inicia sesión para continuar." });
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) {
    return jsonResponse(401, { error: "La sesión no contiene un token de acceso válido." });
  }

  const browserUserAgent = request.headers.get("x-browser-user-agent")
    || request.headers.get("user-agent");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
        ...(browserUserAgent
          ? { "x-browser-user-agent": browserUserAgent }
          : {}),
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return jsonResponse(401, { error: "La sesión no es válida." });

  const { data: assurance, error: assuranceError } =
    await userClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  if (assuranceError) {
    console.error("No se pudo comprobar MFA antes de cambiar el estado de una cuenta:", assuranceError);
    return jsonResponse(500, { error: "No se pudo comprobar la verificación MFA." });
  }
  if (assurance.currentLevel !== "aal2") {
    return jsonResponse(403, { error: "Debes verificar tu segundo factor antes de cambiar el estado de una cuenta." });
  }

  let body: { userId?: string; active?: boolean };
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse(400, { error: "La solicitud no contiene un objeto JSON válido." });
    }
    body = payload;
  } catch {
    return jsonResponse(400, { error: "La solicitud no contiene JSON válido." });
  }
  if (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
    return jsonResponse(400, { error: "La cuenta seleccionada no es válida." });
  }
  if (typeof body.active !== "boolean") {
    return jsonResponse(400, { error: "El estado solicitado no es válido." });
  }

  const { error: statusError } = await userClient.rpc("cambiar_estado_perfil_administrador", {
    p_perfil_id: body.userId,
    p_activo: body.active,
  });
  if (statusError) {
    console.error("No se pudo cambiar el estado de la cuenta:", statusError);
    return jsonResponse(403, { error: statusError.message || "No tienes permiso para cambiar el estado de esta cuenta." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authStatusError } = await adminClient.auth.admin.updateUserById(body.userId, {
    ban_duration: body.active ? "none" : "876000h",
  });
  if (authStatusError) {
    console.error("No se pudo sincronizar el estado de Auth con el perfil:", authStatusError);
    const { error: rollbackError } = await userClient.rpc("cambiar_estado_perfil_administrador", {
      p_perfil_id: body.userId,
      p_activo: !body.active,
    });
    if (rollbackError) {
      console.error("No se pudo revertir el estado del perfil después del fallo de Auth:", rollbackError);
      return jsonResponse(500, {
        error: "No se pudo sincronizar el estado de la cuenta. El perfil y el acceso de autenticación pueden requerir revisión administrativa.",
      });
    }
    return jsonResponse(502, { error: "No se pudo cambiar el acceso de autenticación; se revirtió el cambio del perfil." });
  }

  return jsonResponse(200, { active: body.active });
});
