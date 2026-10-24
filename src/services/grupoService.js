import { supabase } from "./supabase";
 
const ejecutarRpc = async (nombre, parametros) => {
  const { data, error } = await supabase.rpc(nombre, parametros);
  if (error) throw error;
  return data;
};

export const crearGrupo = (grupo) => ejecutarRpc("crear_grupo", {
  p_nombre: grupo.nombre.trim(),
  p_numero_integrantes: Number(grupo.numeroIntegrantes),
  p_aporte: Number(grupo.aporte),
  p_aporte_periodicidad: grupo.periodicidad
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

export const listarParticipantesGrupoAdmin = (grupoId) => ejecutarRpc("listar_participantes_grupo_admin", {
  p_grupo_id: grupoId
});

export const registrarAporteMiembro = async ({ grupoId, participanteId, monto }) => {
  const { data, error } = await supabase.rpc("registrar_aporte_miembro", {
    p_grupo_id: grupoId,
    p_participante_id: participanteId,
    p_monto: Number(monto)
  });
  if (error) throw error;
  return data;
};

export const contarParticipantesGrupo = (grupoId) => ejecutarRpc("contar_participantes_grupo_propio", {
  p_grupo_id: grupoId
});

export const listarGruposDisponibles = () => ejecutarRpc("listar_grupos_disponibles", {});

export const solicitarInvitacionGrupo = (grupoId) => ejecutarRpc("solicitar_invitacion_grupo", {
  p_grupo_id: grupoId
});

export const listarSolicitudesInvitacion = () => ejecutarRpc("listar_solicitudes_invitacion_admin", {});

const obtenerErrorFuncion = async (error) => {
  const response = error?.context;
  if (!response || typeof response.clone !== "function") return error;

  try {
    const payload = await response.clone().json();
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return new Error(payload.error);
    }
  } catch {
    // Keep the original Supabase error when the response does not contain JSON.
  }

  return error;
};

const invocarFuncionInvitaciones = async (body) => {
  const [{ data: sessionData, error: sessionError }, { data: assuranceData, error: assuranceError }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  ]);
  if (sessionError) throw sessionError;
  if (assuranceError) throw assuranceError;
  if (!sessionData.session?.access_token) {
    throw new Error("Tu sesión expiró. Cierra sesión y vuelve a ingresar.");
  }
  if (assuranceData.currentLevel !== "aal2") {
    throw new Error("La sesión no refleja la verificación MFA. Vuelve a verificar el código e inténtalo otra vez.");
  }

  const { data, error } = await supabase.functions.invoke("group-invitations", {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
  });
  if (error) throw await obtenerErrorFuncion(error);
  if (data?.error) throw new Error(data.error);
  return data;
};

export const enviarInvitacionGrupo = (solicitudId) => invocarFuncionInvitaciones({
  action: "send",
  requestId: solicitudId
});

export const aceptarInvitacionGrupo = (token) => invocarFuncionInvitaciones({
  action: "accept",
  token
});

export const rechazarInvitacionGrupo = (solicitudId) => ejecutarRpc("rechazar_invitacion_grupo", {
  p_solicitud_id: solicitudId
});

export const eliminarGrupo = (grupoId) => ejecutarRpc("eliminar_grupo", {
  p_grupo_id: grupoId
});

export const formatearPeriodicidad = (periodicidad) => ({
  semanal: "semanal",
  quincenal: "quincenal",
  mensual: "mensual"
}[periodicidad] || "semanal");

export const etiquetaAporte = (periodicidad) => `Aporte ${formatearPeriodicidad(periodicidad)}`;

export const etiquetaPeriodo = (periodicidad) => ({
  semanal: "Semana",
  quincenal: "Quincena",
  mensual: "Mes"
}[periodicidad] || "Semana");

export const etiquetaPeriodoMinuscula = (periodicidad) => ({
  semanal: "semana",
  quincenal: "quincena",
  mensual: "mes"
}[periodicidad] || "semana");
