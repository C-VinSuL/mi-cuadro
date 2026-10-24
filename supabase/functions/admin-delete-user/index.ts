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

  let body: { userId?: string; reason?: string; purgePersonalData?: boolean };
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
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
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
  if (validation.tiene_datos_privados && body.purgePersonalData !== true) {
    return jsonResponse(409, { error: "Confirma la purga de los datos personales privados para continuar." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let identityDocumentPath: string | null = null;
  if (validation.tiene_datos_privados) {
    const { data: privateData, error: privateDataError } = await adminClient
      .from("datos_personales_privados")
      .select("documento_identidad_path")
      .eq("perfil_id", body.userId)
      .maybeSingle();
    if (privateDataError) {
      console.error("No se pudieron consultar los datos privados antes de eliminar la cuenta:", privateDataError);
      return jsonResponse(500, { error: "No se pudieron verificar los datos privados de la cuenta." });
    }
    identityDocumentPath = privateData?.documento_identidad_path || null;
  }

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
        datos_personales_purgados: Boolean(validation.tiene_datos_privados),
        resultado: "en_proceso",
      },
      agente_usuario: (
        request.headers.get("x-browser-user-agent")
        || request.headers.get("user-agent")
        || ""
      ).slice(0, 500) || null,
    })
    .select("id")
    .single();
  if (auditError || !auditRow) {
    console.error("No se pudo registrar la eliminación antes de ejecutarla:", auditError);
    return jsonResponse(500, { error: "No se pudo registrar la acción en auditoría; la cuenta no fue eliminada." });
  }

  if (identityDocumentPath) {
    const { error: storageError } = await adminClient.storage
      .from("identity-documents")
      .remove([identityDocumentPath]);
    if (storageError) {
      console.error("No se pudo purgar el documento privado antes de eliminar la cuenta:", storageError);
      const { error: auditUpdateError } = await adminClient
        .from("auditoria_eventos")
        .update({
          detalles: {
            motivo: reason,
            usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
            usuario_correo: validation.correo || null,
            usuario_rol: validation.rol || null,
            datos_personales_purgados: false,
            resultado: "fallida_purga_documento",
          },
        })
        .eq("id", auditRow.id);
      if (auditUpdateError) {
        console.error("No se pudo registrar el fallo de purga en auditoría:", auditUpdateError);
      }
      return jsonResponse(502, { error: "No se pudo eliminar el documento privado; la cuenta no fue eliminada." });
    }
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
          datos_personales_purgados: Boolean(validation.tiene_datos_privados),
          resultado: identityDocumentPath ? "fallida_documento_purgado" : "fallida",
        },
      })
      .eq("id", auditRow.id);
    if (auditUpdateError) {
      console.error("No se pudo registrar el fallo de eliminación en auditoría:", auditUpdateError);
    }
    return jsonResponse(502, {
      error: identityDocumentPath
        ? "Se purgó el documento privado, pero Supabase no pudo eliminar la cuenta. No reintentes sin revisar el registro."
        : "Supabase no pudo eliminar la cuenta. No se completó la eliminación.",
    });
  }

  const { error: profileDeleteError } = await adminClient
    .from("perfiles")
    .delete()
    .eq("id", body.userId);
  if (profileDeleteError) {
    console.error("La cuenta de autenticación se eliminó, pero no se pudo eliminar el perfil:", profileDeleteError);
    const { error: auditUpdateError } = await adminClient
      .from("auditoria_eventos")
      .update({
        detalles: {
          motivo: reason,
          usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
          usuario_correo: validation.correo || null,
          usuario_rol: validation.rol || null,
          datos_personales_purgados: Boolean(validation.tiene_datos_privados),
          resultado: "auth_eliminada_perfil_pendiente",
        },
      })
      .eq("id", auditRow.id);
    if (auditUpdateError) {
      console.error("No se pudo registrar el perfil pendiente de eliminación en auditoría:", auditUpdateError);
    }
    return jsonResponse(500, {
      error: "Se eliminó el acceso de autenticación, pero el perfil sigue pendiente de eliminación. Contacta a soporte antes de volver a intentar.",
    });
  }

  const { data: remainingProfile, error: profileCheckError } = await adminClient
    .from("perfiles")
    .select("id")
    .eq("id", body.userId)
    .maybeSingle();
  if (profileCheckError || remainingProfile) {
    console.error(
      "La cuenta de autenticación se eliminó, pero no se pudo confirmar la eliminación del perfil:",
      profileCheckError || "El perfil aún existe",
    );
    const { error: auditUpdateError } = await adminClient
      .from("auditoria_eventos")
      .update({
        detalles: {
          motivo: reason,
          usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
          usuario_correo: validation.correo || null,
          usuario_rol: validation.rol || null,
          datos_personales_purgados: Boolean(validation.tiene_datos_privados),
          resultado: "auth_eliminada_perfil_pendiente",
        },
      })
      .eq("id", auditRow.id);
    if (auditUpdateError) {
      console.error("No se pudo registrar la verificación pendiente del perfil en auditoría:", auditUpdateError);
    }
    return jsonResponse(500, {
      error: "Se eliminó el acceso de autenticación, pero no se pudo confirmar que desapareciera el perfil. Contacta a soporte antes de volver a intentar.",
    });
  }

  const { error: auditUpdateError } = await adminClient
    .from("auditoria_eventos")
    .update({
      detalles: {
        motivo: reason,
        usuario_nombre: validation.usuario_nombre || "Usuario sin nombre",
        usuario_correo: validation.correo || null,
        usuario_rol: validation.rol || null,
        datos_personales_purgados: Boolean(validation.tiene_datos_privados),
        resultado: "completada",
      },
    })
    .eq("id", auditRow.id);
  if (auditUpdateError) {
    console.error("La cuenta se eliminó, pero no se pudo actualizar el resultado en auditoría:", auditUpdateError);
  }

  return jsonResponse(200, { deleted: true, auditUpdated: !auditUpdateError });
});
