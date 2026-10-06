import { supabase } from "./supabase";
 
const ejecutarRpc = async (nombre, parametros) => {
  const { data, error } = await supabase.rpc(nombre, parametros);
  if (error) throw error;
  return data;
};

export const crearGrupo = (grupo) => ejecutarRpc("crear_grupo", {
  p_nombre: grupo.nombre.trim(),
  p_numero_integrantes: Number(grupo.numeroIntegrantes),
  p_aporte_semanal: Number(grupo.aporteSemanal)
});

export const solicitarUnionGrupo = (codigo) => ejecutarRpc("solicitar_union_grupo", {
  p_codigo: codigo.trim()
});

export const resolverSolicitudGrupo = (solicitudId, aprobar) => ejecutarRpc("resolver_solicitud_grupo", {
  p_solicitud_id: solicitudId,
  p_aprobar: aprobar
});

export const iniciarCuadro = (grupoId) => ejecutarRpc("iniciar_cuadro", {
  p_grupo_id: grupoId
});

export const obtenerSolicitudesGrupo = (grupoId) => ejecutarRpc("obtener_solicitudes_grupo", {
  p_grupo_id: grupoId
});

export const eliminarGrupo = (grupoId) => ejecutarRpc("eliminar_grupo", {
  p_grupo_id: grupoId
});
