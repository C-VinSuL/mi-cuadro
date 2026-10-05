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

export const getAdminActivityOverview = async (grupos = []) => {
  const groupIds = grupos.map((grupo) => grupo.id);
  if (groupIds.length === 0) {
    return {
      participants: [],
      contributions: [],
      deliveries: [],
      loans: [],
      movements: [],
      activities: []
    };
  }

  const [participantsResponse, contributionsResponse, deliveriesResponse, loansResponse, movementsResponse] = await Promise.all([
    supabase.from("participantes").select("id, grupo_id, nombre").in("grupo_id", groupIds),
    supabase.from("aportes").select("id, grupo_id, participante_id, semana, monto, estado, fecha_pago").in("grupo_id", groupIds),
    supabase.from("entregas").select("id, grupo_id, participante_id, semana, monto, fecha_entrega").in("grupo_id", groupIds),
    supabase.from("prestamos").select("id, grupo_id, participante_id, monto, estado, fecha_solicitud").in("grupo_id", groupIds),
    supabase.from("movimientos_fondo").select("id, grupo_id, tipo, concepto, monto, prestamo_id, aporte_id, cuota_id, created_at").in("grupo_id", groupIds)
  ]);

  const responses = [participantsResponse, contributionsResponse, deliveriesResponse, loansResponse, movementsResponse];
  const failedResponse = responses.find((response) => response.error);
  if (failedResponse) throw failedResponse.error;

  const participants = participantsResponse.data || [];
  const contributions = contributionsResponse.data || [];
  const deliveries = deliveriesResponse.data || [];
  const loans = loansResponse.data || [];
  const movements = movementsResponse.data || [];
  const loanIds = loans.map((loan) => loan.id);
  let installments = [];

  if (loanIds.length > 0) {
    const installmentsResponse = await supabase
      .from("cuotas_prestamo")
      .select("id, prestamo_id")
      .in("prestamo_id", loanIds);
    if (installmentsResponse.error) throw installmentsResponse.error;
    installments = installmentsResponse.data || [];
  }

  const groupsById = new Map(grupos.map((grupo) => [grupo.id, grupo]));
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const contributionsById = new Map(contributions.map((contribution) => [contribution.id, contribution]));
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const installmentsById = new Map(installments.map((installment) => [installment.id, installment]));
  const activities = [];

  const addActivity = ({ id, groupId, participantId, type, date, amount, status }) => {
    const participant = participantsById.get(participantId);
    activities.push({
      id: `${type}-${id}`,
      group: groupsById.get(groupId)?.nombre || "Grupo",
      participant: participant?.nombre || "Socio sin identificar",
      type,
      date,
      amount: Number(amount || 0),
      status: status || "Registrado"
    });
  };

  contributions.forEach((item) => addActivity({
    id: item.id,
    groupId: item.grupo_id,
    participantId: item.participante_id,
    type: `Aporte · semana ${item.semana}`,
    date: item.fecha_pago,
    amount: item.monto,
    status: item.estado
  }));

  deliveries.forEach((item) => addActivity({
    id: item.id,
    groupId: item.grupo_id,
    participantId: item.participante_id,
    type: `Entrega · semana ${item.semana}`,
    date: item.fecha_entrega,
    amount: item.monto,
    status: "Entregada"
  }));

  loans.forEach((item) => addActivity({
    id: item.id,
    groupId: item.grupo_id,
    participantId: item.participante_id,
    type: "Préstamo",
    date: item.fecha_solicitud,
    amount: item.monto,
    status: item.estado
  }));

  movements.forEach((item) => {
    const linkedContribution = contributionsById.get(item.aporte_id);
    const linkedLoan = loansById.get(item.prestamo_id)
      || loansById.get(installmentsById.get(item.cuota_id)?.prestamo_id);
    addActivity({
      id: item.id,
      groupId: item.grupo_id,
      participantId: linkedContribution?.participante_id || linkedLoan?.participante_id,
      type: item.concepto || item.tipo || "Movimiento de fondo",
      date: item.created_at,
      amount: item.monto,
      status: "Registrado"
    });
  });

  activities.sort((first, second) => new Date(second.date || 0) - new Date(first.date || 0));

  return {
    participants,
    contributions,
    deliveries,
    loans,
    movements,
    activities: activities.slice(0, 40)
  };
};

export const getAdminActiveCuadrosData = async (grupos = []) => {
  const groupIds = grupos.map((grupo) => grupo.id);
  if (groupIds.length === 0) {
    return { participants: [], contributions: [], deliveries: [] };
  }

  const [participantsResponse, contributionsResponse, deliveriesResponse] = await Promise.all([
    supabase
      .from("participantes")
      .select("id, grupo_id, nombre, posicion, estado")
      .in("grupo_id", groupIds)
      .order("posicion", { ascending: true }),
    supabase
      .from("aportes")
      .select("grupo_id, participante_id, semana, monto, estado")
      .in("grupo_id", groupIds),
    supabase
      .from("entregas")
      .select("grupo_id, participante_id, semana, monto, fecha_entrega")
      .in("grupo_id", groupIds)
  ]);

  const failedResponse = [participantsResponse, contributionsResponse, deliveriesResponse]
    .find((response) => response.error);
  if (failedResponse) throw failedResponse.error;

  return {
    participants: participantsResponse.data || [],
    contributions: contributionsResponse.data || [],
    deliveries: deliveriesResponse.data || []
  };
};
