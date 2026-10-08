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

export const listarDocumentosPendientes = () => callRpc("listar_documentos_pendientes_tesorero", {});

export const verificarDocumento = (perfilId) => callRpc("verificar_documento_tesorero", {
  p_perfil_id: perfilId
});

export const listarAuditoria = (grupoId = null, desde = null, hasta = null) => callRpc("listar_auditoria_administrador", {
  p_grupo_id: grupoId || null,
  p_desde: desde || null,
  p_hasta: hasta || null
});
