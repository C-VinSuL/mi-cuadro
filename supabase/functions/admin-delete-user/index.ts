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
    console.error("Falta configurar Supabase para admin-delete-user.");
    return jsonResponse(500, { error: "El servicio de eliminación no está configurado." });
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
    console.error("No se pudo comprobar MFA antes de eliminar una cuenta:", assuranceError);
    return jsonResponse(500, { error: "No se pudo comprobar la verificación MFA." });
  }
  if (assurance.currentLevel !== "aal2") {
    return jsonResponse(403, { error: "Debes verificar tu segundo factor antes de eliminar una cuenta." });
  }

  let body: { userId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "La solicitud no contiene JSON válido." });
  }
  if (!body.userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)) {
    return jsonResponse(400, { error: "La cuenta seleccionada no es válida." });
  }
  const reason = body.reason?.trim();
  if (!reason || reason.length < 10 || reason.length > 500) {
    return jsonResponse(400, { error: "El motivo debe tener entre 10 y 500 caracteres." });
  }

  const { data: validationRows, error: validationError } = await userClient.rpc(
    "validar_eliminacion_perfil_administrador",
    { p_perfil_id: body.userId },
  );
  if (validationError) {
    console.error("No se pudo validar la eliminación de la cuenta:", validationError);
    return jsonResponse(403, { error: validationError.message || "No tienes permiso para eliminar esta cuenta." });
  }
  const validation = validationRows?.[0];
  if (!validation) return jsonResponse(500, { error: "No se recibió el resultado de validación de la cuenta." });
  if (!validation.puede_eliminar) {
    return jsonResponse(409, { error: validation.mensaje || "La cuenta tiene registros que deben conservarse." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auditRow, error: auditError } = await adminClient
    .from("auditoria_eventos")
    .insert({
      actor_id: authData.user.id,
      objetivo_id: body.userId,
      evento: "eliminacion_usuario",
      detalles: {
        motivo: reason,
        usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
        usuario_correo: validation.correo || null,
        usuario_rol: validation.rol || null,
        resultado: "en_proceso",
      },
    })
    .select("id")
    .single();
  if (auditError || !auditRow) {
    console.error("No se pudo registrar la eliminación antes de ejecutarla:", auditError);
    return jsonResponse(500, { error: "No se pudo registrar la acción en auditoría; la cuenta no fue eliminada." });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.userId, false);
  if (deleteError) {
    console.error("No se pudo eliminar la cuenta mediante Supabase Auth:", deleteError);
    const { error: auditUpdateError } = await adminClient
      .from("auditoria_eventos")
      .update({
        detalles: {
          motivo: reason,
          usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
          usuario_correo: validation.correo || null,
          usuario_rol: validation.rol || null,
          resultado: "fallida",
        },
      })
      .eq("id", auditRow.id);
    if (auditUpdateError) {
      console.error("No se pudo registrar el fallo de eliminación en auditoría:", auditUpdateError);
    }
    return jsonResponse(502, { error: "Supabase no pudo eliminar la cuenta. No se completó la eliminación." });
  }

  const { error: auditUpdateError } = await adminClient
    .from("auditoria_eventos")
    .update({
      detalles: {
        motivo: reason,
        usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
        usuario_correo: validation.correo || null,
        usuario_rol: validation.rol || null,
        resultado: "completada",
      },
    })
    .eq("id", auditRow.id);
  if (auditUpdateError) {
    console.error("La cuenta se eliminó, pero no se pudo actualizar el resultado en auditoría:", auditUpdateError);
  }

  return jsonResponse(200, { deleted: true, auditUpdated: !auditUpdateError });
});
