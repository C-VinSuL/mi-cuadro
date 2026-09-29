import { useEffect, useState } from "react";
import { RefreshCw, Eye, Wallet, HandCoins, CalendarCheck2, CircleAlert } from "lucide-react";
import { supabase } from "../../services/supabase";
import {
  obtenerCuotasPrestamo,
  obtenerPrestamosSocio
} from "../../services/prestamosService";
import { useAuth } from "../../context/AuthContext";

const money = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const formatDate = (date) => {
  if (!date) return "Sin fecha";
  return new Date(date).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const VistaSocio = () => {
  const { grupo } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState({ contributions: [], deliveries: [], loans: [] });
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadParticipants = async () => {
      if (!grupo?.id) {
        setParticipants([]);
        setSelectedId("");
        setLoadingParticipants(false);
        return;
      }

      setLoadingParticipants(true);
      setError("");
      const { data: rows, error: queryError } = await supabase
        .from("participantes")
        .select("id, nombre, posicion, estado")
        .eq("grupo_id", grupo.id)
        .order("posicion", { ascending: true });

      if (!active) return;
      if (queryError) {
        setError("No se pudo cargar la lista de integrantes. Verifica los permisos de lectura del grupo.");
        setParticipants([]);
      } else {
        const list = rows || [];
        setParticipants(list);
        setSelectedId((current) => list.some((participant) => participant.id === current)
          ? current
          : list[0]?.id || "");
      }
      setLoadingParticipants(false);
    };

    loadParticipants();
    return () => {
      active = false;
    };
  }, [grupo?.id]);

  useEffect(() => {
    let active = true;

    const loadDetails = async () => {
      if (!grupo?.id || !selectedId) {
        setData({ contributions: [], deliveries: [], loans: [] });
        setLoadingDetails(false);
        return;
      }

      setLoadingDetails(true);
      setError("");

      try {
        const [contributionsResponse, deliveriesResponse, loans] = await Promise.all([
          supabase
            .from("aportes")
            .select("id, semana, monto, comision_app, estado, fecha_pago")
            .eq("grupo_id", grupo.id)
            .eq("participante_id", selectedId)
            .order("semana", { ascending: false }),
          supabase
            .from("entregas")
            .select("id, semana, monto, fecha_entrega")
            .eq("grupo_id", grupo.id)
            .eq("participante_id", selectedId)
            .order("semana", { ascending: false }),
          obtenerPrestamosSocio(selectedId)
        ]);

        if (contributionsResponse.error) throw contributionsResponse.error;
        if (deliveriesResponse.error) throw deliveriesResponse.error;

        const loansWithInstallments = await Promise.all(
          (loans || []).map(async (loan) => ({
            ...loan,
            installments: await obtenerCuotasPrestamo(loan.id)
          }))
        );

        if (!active) return;
        setData({
          contributions: contributionsResponse.data || [],
          deliveries: deliveriesResponse.data || [],
          loans: loansWithInstallments
        });
      } catch (loadError) {
        console.error("Error cargando vista de socio:", loadError);
        if (active) {
          setError("No se pudieron cargar todos los detalles de este integrante.");
          setData({ contributions: [], deliveries: [], loans: [] });
        }
      } finally {
        if (active) setLoadingDetails(false);
      }
    };

    loadDetails();
    return () => {
      active = false;
    };
  }, [grupo?.id, selectedId]);

  const selectedParticipant = participants.find((person) => person.id === selectedId);
  const paidContributions = data.contributions.filter((item) => item.estado === "pagado");
  const paidTotal = paidContributions.reduce((sum, item) => sum + Number(item.monto || 0) + Number(item.comision_app || 0), 0);
  const pendingContributions = data.contributions.filter((item) => item.estado !== "pagado");
  const activeLoans = data.loans.filter((loan) => ["aprobado", "pendiente"].includes(loan.estado));
  const outstandingTotal = data.loans.reduce((sum, loan) => {
    if (loan.estado !== "aprobado") return sum;
    const paid = loan.installments
      .filter((installment) => installment.estado === "pagado")
      .reduce((total, installment) => total + Number(installment.monto || 0), 0);
    return sum + Math.max(Number(loan.total_pagar || 0) - paid, 0);
  }, 0);

  if (!grupo) {
    return <EmptyState message="Tu cuenta no tiene un grupo asignado para consultar." />;
  }

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">Administración · consulta individual</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Vista de socio</h1>
          <p className="mt-2 text-slate-600">Revisa la experiencia y el historial de un integrante sin cambiar de cuenta.</p>
        </div>
        <label className="w-full max-w-sm text-sm font-semibold text-slate-700">
          Integrante
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={loadingParticipants || participants.length === 0}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          >
            {loadingParticipants && <option value="">Cargando integrantes...</option>}
            {!loadingParticipants && participants.length === 0 && <option value="">No hay integrantes</option>}
            {participants.map((person) => (
              <option key={person.id} value={person.id}>
                #{person.posicion} · {person.nombre}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="flex items-start gap-3 border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950" role="note">
        <Eye size={18} className="mt-0.5 shrink-0" />
        <p><strong>Solo lectura.</strong> Esta vista consulta datos reales del integrante seleccionado. No registra pagos, aprueba préstamos ni modifica su cuenta.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {selectedParticipant && (
        <>
          <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedParticipant.nombre}</h2>
              <p className="mt-1 text-sm text-slate-500">Puesto #{selectedParticipant.posicion} · Estado: {selectedParticipant.estado || "sin estado"}</p>
            </div>
            <p className="text-sm text-slate-500">Grupo: <strong className="text-slate-800">{grupo.nombre}</strong></p>
          </section>

          {loadingDetails ? (
            <div className="flex items-center gap-2 py-12 text-sm text-slate-500" role="status">
              <RefreshCw size={17} className="animate-spin" /> Actualizando el detalle del socio...
            </div>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del socio">
                <Metric icon={<Wallet size={19} />} label="Aportes pagados" value={paidContributions.length} detail={money(paidTotal)} />
                <Metric icon={<CalendarCheck2 size={19} />} label="Aportes pendientes" value={pendingContributions.length} detail="En el historial" />
                <Metric icon={<HandCoins size={19} />} label="Préstamos" value={data.loans.length} detail={`${activeLoans.length} pendientes o activos`} />
                <Metric icon={<CircleAlert size={19} />} label="Saldo de préstamos" value={money(outstandingTotal)} detail="Cuotas aprobadas no pagadas" />
              </section>

              <section className="grid gap-8 xl:grid-cols-2">
                <HistoryTable
                  title="Historial de aportes"
                  empty="Este integrante aún no tiene aportes registrados."
                  headers={["Semana", "Monto", "Estado", "Fecha"]}
                  rows={data.contributions.map((item) => [
                    `Semana ${item.semana}`,
                    money(Number(item.monto || 0) + Number(item.comision_app || 0)),
                    item.estado || "Sin estado",
                    formatDate(item.fecha_pago)
                  ])}
                />

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">Historial de préstamos</h3>
                  {data.loans.length === 0 ? (
                    <p className="border-y border-slate-200 py-5 text-sm text-slate-500">Este integrante no tiene préstamos registrados.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                      {data.loans.map((loan) => {
                        const paidInstallments = loan.installments.filter((item) => item.estado === "pagado").length;
                        const unpaid = loan.installments.length - paidInstallments;
                        return (
                          <article key={loan.id} className="py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{money(loan.monto)} · {loan.numero_cuotas} cuotas</p>
                                <p className="mt-1 text-sm text-slate-500">Solicitado: {formatDate(loan.fecha_solicitud)}</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{loan.estado}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                              <span>Total acordado: {money(loan.total_pagar)}</span>
                              <span>Cuota: {money(loan.cuota_mensual)}</span>
                              {loan.installments.length > 0 && <span>{paidInstallments} pagadas · {unpaid} pendientes</span>}
                            </div>
                            {loan.motivo && <p className="mt-2 text-sm text-slate-500">Motivo: {loan.motivo}</p>}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <HistoryTable
                title="Entregas recibidas"
                empty="Este integrante aún no tiene entregas registradas."
                headers={["Semana", "Monto", "Fecha"]}
                rows={data.deliveries.map((item) => [
                  `Semana ${item.semana}`,
                  money(item.monto),
                  formatDate(item.fecha_entrega)
                ])}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value, detail }) => (
  <div className="border-y border-slate-200 py-4">
    <div className="flex items-center gap-2 text-emerald-700">{icon}<p className="text-sm text-slate-600">{label}</p></div>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>
);

const HistoryTable = ({ title, headers, rows, empty }) => (
  <section>
    <h3 className="mb-3 text-lg font-semibold text-slate-900">{title}</h3>
    {rows.length === 0 ? (
      <p className="border-y border-slate-200 py-5 text-sm text-slate-500">{empty}</p>
    ) : (
      <div className="overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead><tr>{headers.map((header) => <th key={header} className="bg-slate-50 px-3 py-3 font-semibold text-slate-600">{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-slate-100">{row.map((value, cellIndex) => <td key={`${cellIndex}-${value}`} className="px-3 py-3 text-slate-700">{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )}
  </section>
);

const EmptyState = ({ message }) => (
  <div className="border-y border-slate-200 py-8 text-slate-600">{message}</div>
);

export default VistaSocio;