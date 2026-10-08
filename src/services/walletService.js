import { supabase } from "./supabase";

const callRpc = async (name, params = {}) => {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
};

export const obtenerResumenBilletera = async () => {
  const rows = await callRpc("resumen_billetera_propio");
  return rows?.[0] || null;
};

export const listarMovimientosBilletera = () => callRpc("historial_billetera_propio");

export const listarSolicitudesBilleteraPropias = () => callRpc("solicitudes_billetera_propias");

export const solicitarDepositoBilletera = (monto, referencia, comprobantePath) => callRpc(
  "solicitar_deposito_billetera",
  { p_monto: Number(monto), p_referencia: referencia || null, p_comprobante_path: comprobantePath }
);

export const solicitarRetiroBilletera = (monto) => callRpc(
  "solicitar_retiro_billetera",
  { p_monto: Number(monto) }
);

export const listarSolicitudesBilleteraAdmin = () => callRpc("listar_solicitudes_billetera_admin");

export const resolverSolicitudBilletera = (solicitudId, aprobar, nota = "") => callRpc(
  "resolver_solicitud_billetera",
  { p_solicitud_id: solicitudId, p_aprobar: aprobar, p_nota: nota || null }
);
