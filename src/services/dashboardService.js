import { supabase } from "./supabase";

export const getDashboardAdminData = async (grupo) => {
  if (!grupo?.id) {
    return {
      participantes: [],
      aportes: [],
      entregas: [],
      totalPagados: 0,
      pendientes: [],
      beneficiarioActual: null,
      pozo: 0
    };
  }

  const semanaActual =
    Number(grupo.semana_actual || 0);

  const capacidad =
    Number(grupo.numero_integrantes || 0);

  const aporteSemanal =
    Number(grupo.aporte_semanal || 0);

  const [
    participantesResponse,
    aportesResponse,
    entregasResponse
  ] = await Promise.all([
    supabase
      .from("participantes")
      .select(`
        id,
        nombre,
        posicion,
        perfil_id
      `)
      .eq("grupo_id", grupo.id)
      .order("posicion", {
        ascending: true
      }),

    supabase
      .from("aportes")
      .select(`
        id,
        participante_id,
        semana,
        monto,
        comision_app,
        estado
      `)
      .eq("grupo_id", grupo.id)
      .eq("semana", semanaActual),

    supabase
      .from("entregas")
      .select(`
        id,
        participante_id,
        semana,
        monto
      `)
      .eq("grupo_id", grupo.id)
  ]);

  if (participantesResponse.error) {
    throw participantesResponse.error;
  }

  if (aportesResponse.error) {
    throw aportesResponse.error;
  }

  if (entregasResponse.error) {
    throw entregasResponse.error;
  }

  const participantes =
    participantesResponse.data || [];

  const aportes =
    aportesResponse.data || [];

  const entregas =
    entregasResponse.data || [];

  const aportesPagados =
    aportes.filter(
      (aporte) =>
        aporte.estado === "pagado"
    );

  const idsPagados =
    new Set(
      aportesPagados.map(
        (aporte) =>
          aporte.participante_id
      )
    );

  const pendientes =
    participantes.filter(
      (participante) =>
        !idsPagados.has(
          participante.id
        )
    );

  const beneficiarioActual =
    participantes.find(
      (participante) =>
        Number(
          participante.posicion
        ) === semanaActual
    ) || null;

  const totalPagados =
    idsPagados.size;

  const pozo =
    capacidad * aporteSemanal;

  return {
    participantes,
    aportes,
    entregas,
    totalPagados,
    pendientes,
    beneficiarioActual,
    pozo
  };
};