import { supabase } from "./supabase";

const callRpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
};

export const buscarPerfilesAdministradores = (busqueda) => callRpc("buscar_perfiles_administrador", {
  p_busqueda: busqueda.trim()
});

export const listarPerfilesAdministrador = (busqueda = "", limite = 50, desplazamiento = 0) => callRpc(
  "listar_perfiles_administrador",
  {
    p_busqueda: busqueda.trim() || null,
    p_limite: limite,
    p_desplazamiento: desplazamiento
  }
);

export const cambiarRolPerfil = (perfilId, rol) => callRpc("cambiar_rol_perfil_administrador", {
  p_perfil_id: perfilId,
  p_nuevo_rol: rol
});

export const solicitarRestablecimientoMfaAdministrador = async (perfilId) => {
  const { data, error } = await supabase.functions.invoke("admin-reset-mfa", {
    body: { userId: perfilId }
  });
  if (error) {
    if (error.context instanceof Response) {
      let responseBody;
      try {
        responseBody = await error.context.clone().json();
      } catch {
        throw error;
      }
      if (typeof responseBody?.error === "string") throw new Error(responseBody.error);
    }
    throw error;
  }
  return data;
};

export const cambiarEstadoUsuarioAdministrador = async ({ perfilId, activo }) => {
  const { data, error } = await supabase.functions.invoke("admin-set-user-status", {
    body: { userId: perfilId, active: activo }
  });
  if (error) {
    if (error.context instanceof Response) {
      let responseBody;
      try {
        responseBody = await error.context.clone().json();
      } catch {
        throw error;
      }
      if (typeof responseBody?.error === "string") throw new Error(responseBody.error);
    }
    throw error;
  }
  return data;
};

export const eliminarUsuarioAdministrador = async ({ perfilId, motivo, purgarDatosPersonales = false }) => {
  const { data, error } = await supabase.functions.invoke("admin-delete-user", {
    body: { userId: perfilId, reason: motivo, purgePersonalData: purgarDatosPersonales }
  });
  if (error) {
    if (error.context instanceof Response) {
      let responseBody;
      try {
        responseBody = await error.context.clone().json();
      } catch {
        throw error;
      }
      if (typeof responseBody?.error === "string") throw new Error(responseBody.error);
    }
    throw error;
  }
  return data;
};

export const listarDocumentosPendientes = () => callRpc("listar_documentos_pendientes_tesorero", {});

export const verificarDocumento = (perfilId) => callRpc("verificar_documento_tesorero", {
  p_perfil_id: perfilId
});

export const listarAuditoria = (grupoId = null, desde = null, hasta = null) => callRpc("listar_auditoria_administrador", {
  p_grupo_id: grupoId || null,
  p_desde: desde || null,
  p_hasta: hasta || null
});

export const listarArchivosAuditoriaAdministrador = (offset = 0, limit = 100) => callRpc(
  "listar_archivos_auditoria_administrador",
  { p_limit: limit, p_offset: offset }
);

export const obtenerResumenAuditoriaGrupos = () => callRpc("auditoria_resumen_grupos", {});

export const listarMovimientosBilleteraAuditoria = (grupoId = null, limite = 100, desplazamiento = 0) => callRpc(
  "auditoria_listar_movimientos_billetera",
  {
    p_grupo_id: grupoId || null,
    p_limite: limite,
    p_desplazamiento: desplazamiento
  }
);

export const listarRevisionesAuditoria = () => callRpc("auditoria_listar_revisiones", {});

export const guardarRevisionAuditoria = ({ grupoId, desde, hasta, estado, notas }) => callRpc(
  "auditoria_guardar_revision",
  {
    p_grupo_id: grupoId,
    p_periodo_desde: desde,
    p_periodo_hasta: hasta,
    p_estado: estado,
    p_notas: notas
  }
);

export const listarHallazgosAuditoria = (grupoId = null) => callRpc("auditoria_listar_hallazgos", {
  p_grupo_id: grupoId || null
});

export const crearHallazgoAuditoria = ({ grupoId, titulo, descripcion, evidencia, severidad, estado }) => callRpc(
  "auditoria_crear_hallazgo",
  {
    p_grupo_id: grupoId,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_evidencia: evidencia,
    p_severidad: severidad,
    p_estado: estado
  }
);

export const actualizarHallazgoAuditoria = ({ hallazgoId, estado, descripcion, evidencia }) => callRpc(
  "auditoria_actualizar_hallazgo",
  {
    p_hallazgo_id: hallazgoId,
    p_estado: estado,
    p_descripcion: descripcion,
    p_evidencia: evidencia
  }
);

export const responderHallazgoAuditoria = (hallazgoId, respuesta) => callRpc("auditoria_responder_hallazgo", {
  p_hallazgo_id: hallazgoId,
  p_respuesta: respuesta
});
