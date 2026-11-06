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

export const listarAuditoriaPaginada = ({
  grupoId = null,
  desde = null,
  hasta = null,
  evento = null,
  busqueda = null,
  antesDe = null,
  antesId = null,
  limite = 101
}) => callRpc("listar_auditoria_paginada", {
  p_grupo_id: grupoId || null,
  p_desde: desde || null,
  p_hasta: hasta || null,
  p_evento: evento || null,
  p_busqueda: busqueda || null,
  p_antes_de: antesDe,
  p_antes_id: antesId,
  p_limite: limite
});

export const listarTiposAuditoria = (grupoId = null, desde = null, hasta = null) => callRpc(
  "listar_tipos_auditoria",
  {
    p_grupo_id: grupoId || null,
    p_desde: desde || null,
    p_hasta: hasta || null
  }
);

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

export const listarRevisionesAuditoria = () => callRpc("auditoria_listar_revisiones_v2", {});

export const listarResponsablesAuditoria = () => callRpc("auditoria_listar_responsables", {});

export const guardarRevisionAuditoria = ({
  grupoId,
  desde,
  hasta,
  estado,
  notas,
  fechaLimite,
  responsableId,
  conclusion
}) => callRpc(
  "auditoria_guardar_revision_v2",
  {
    p_grupo_id: grupoId,
    p_periodo_desde: desde,
    p_periodo_hasta: hasta,
    p_estado: estado,
    p_notas: notas,
    p_fecha_limite: fechaLimite || null,
    p_responsable_id: responsableId || null,
    p_conclusion: conclusion
  }
);

export const listarHallazgosAuditoria = (grupoId = null) => callRpc("auditoria_listar_hallazgos_v3", {
  p_grupo_id: grupoId || null
});

export const crearHallazgoAuditoria = ({
  grupoId,
  titulo,
  descripcion,
  evidencia,
  severidad,
  estado,
  fechaLimite,
  responsableId,
  revisionId
}) => callRpc(
  "auditoria_crear_hallazgo_v3",
  {
    p_grupo_id: grupoId,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_evidencia: evidencia,
    p_severidad: severidad,
    p_estado: estado,
    p_fecha_limite: fechaLimite || null,
    p_responsable_id: responsableId || null,
    p_revision_id: revisionId || null
  }
);

export const actualizarHallazgoAuditoria = ({
  hallazgoId,
  estado,
  descripcion,
  evidencia,
  fechaLimite,
  responsableId,
  revisionId
}) => callRpc(
  "auditoria_actualizar_hallazgo_v3",
  {
    p_hallazgo_id: hallazgoId,
    p_estado: estado,
    p_descripcion: descripcion,
    p_evidencia: evidencia,
    p_fecha_limite: fechaLimite || null,
    p_responsable_id: responsableId || null,
    p_revision_id: revisionId || null
  }
);

export const responderHallazgoAuditoria = (hallazgoId, respuesta) => callRpc("auditoria_responder_hallazgo", {
  p_hallazgo_id: hallazgoId,
  p_respuesta: respuesta
});

export const agregarEvidenciaAuditoria = ({
  revisionId,
  hallazgoId,
  ruta,
  nombreArchivo,
  tipoContenido,
  bytes
}) => callRpc("auditoria_agregar_evidencia", {
  p_revision_id: revisionId || null,
  p_hallazgo_id: hallazgoId || null,
  p_ruta: ruta,
  p_nombre_archivo: nombreArchivo,
  p_tipo_contenido: tipoContenido,
  p_bytes: bytes
});

export const listarConciliacionesFondoAuditoria = (grupoId) => callRpc(
  "auditoria_listar_conciliaciones_fondo",
  { p_grupo_id: grupoId }
);
