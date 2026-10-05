import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAdminActiveCuadrosData } from "../../services/dashboardService";
import RondaAdmin from "../../components/cuadro/RondaAdmin";

const AdminCuadrosOverview = () => {
  const { grupo, grupos, seleccionarGrupo } = useAuth();
  const cuadrosActivos = useMemo(() => grupos.filter((item) => item.estado === "activo"), [grupos]);
  const [data, setData] = useState({ participants: [], contributions: [], deliveries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      setLoading(true);
      setError("");
      try {
        const overview = await getAdminActiveCuadrosData(cuadrosActivos);
        if (active) setData(overview);
      } catch (loadError) {
        console.error("Error cargando cuadros activos:", loadError);
        if (active) setError("No se pudo cargar el estado de todos los cuadros.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, [cuadrosActivos]);

  const cuadros = useMemo(() => cuadrosActivos.map((item) => {
    const participants = data.participants.filter((participant) => participant.grupo_id === item.id);
    const roundPayments = data.contributions.filter((contribution) => (
      contribution.grupo_id === item.id
      && Number(contribution.semana) === Number(item.semana_actual)
      && contribution.estado === "pagado"
    ));
    const paidIds = new Set(roundPayments.map((contribution) => contribution.participante_id));
    const currentDeliveries = data.deliveries.filter((delivery) => (
      delivery.grupo_id === item.id && Number(delivery.semana) === Number(item.semana_actual)
    ));

    return {
      group: item,
      participants,
      paidIds,
      paidCount: paidIds.size,
      pendingCount: Math.max(participants.length - paidIds.size, 0),
      currentDeliveries
    };
  }), [cuadrosActivos, data]);

  const selectedCuadro = cuadros.find((item) => item.group.id === grupo?.id);
  const totalSocios = cuadros.reduce((total, item) => total + item.participants.length, 0);
  const totalPendientes = cuadros.reduce((total, item) => total + item.pendingCount, 0);

  return (
    <div className="space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-emerald-700">Administración general</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Revisión de cuadros</h1>
        <p className="mt-2 text-sm text-slate-600">Supervisa rondas, aportes y entregas de todos los cuadros activos.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de cuadros activos">
        <Metric icon={<CalendarDays size={19} />} label="Cuadros activos" value={cuadrosActivos.length} />
        <Metric icon={<Users size={19} />} label="Socios en operación" value={totalSocios} />
        <Metric icon={<Clock3 size={19} />} label="Aportes pendientes" value={totalPendientes} />
      </section>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Cuadros en operación</h2>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando cuadros activos...</p>
        ) : cuadros.length === 0 ? (
          <div className="px-5 py-8">
            <p className="text-sm text-slate-600">No hay cuadros activos en este momento.</p>
            <Link to="/grupo" className="mt-3 inline-flex text-sm font-semibold text-emerald-800 hover:text-emerald-950">Gestionar grupos</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Cuadro</th>
                  <th className="px-5 py-3 font-semibold">Ronda</th>
                  <th className="px-5 py-3 font-semibold">Socios</th>
                  <th className="px-5 py-3 font-semibold">Aportes al día</th>
                  <th className="px-5 py-3 font-semibold">Entregas de la ronda</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuadros.map((item) => (
                  <tr key={item.group.id} className={selectedCuadro?.group.id === item.group.id ? "bg-emerald-50/60" : ""}>
                    <td className="px-5 py-3 font-semibold text-slate-900">{item.group.nombre}</td>
                    <td className="px-5 py-3 text-slate-700">{item.group.semana_actual} / {item.group.numero_integrantes}</td>
                    <td className="px-5 py-3 text-slate-700">{item.participants.length} / {item.group.numero_integrantes}</td>
                    <td className="px-5 py-3 text-slate-700">{item.paidCount} pagados · {item.pendingCount} pendientes</td>
                    <td className="px-5 py-3 text-slate-700">{item.currentDeliveries.length}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => seleccionarGrupo(item.group.id)} className="whitespace-nowrap font-semibold text-emerald-800 hover:text-emerald-950">Revisar cuadro</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCuadro && (
        <>
          <section className="border-b border-slate-200 pb-4">
            <p className="text-sm font-semibold text-emerald-700">Detalle de la ronda {selectedCuadro.group.semana_actual}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedCuadro.group.nombre}</h2>
          </section>
          <RondaAdmin />
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Seguimiento de socios</h2>
            </div>
            {selectedCuadro.participants.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Este cuadro no tiene socios registrados.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedCuadro.participants.map((participant) => {
                  const paid = selectedCuadro.paidIds.has(participant.id);
                  const delivery = selectedCuadro.currentDeliveries.find((item) => item.participante_id === participant.id);
                  return (
                    <div key={participant.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <p className="font-medium text-slate-900">#{participant.posicion} · {participant.nombre}</p>
                      <span className={`inline-flex items-center gap-1.5 text-sm ${paid ? "text-emerald-800" : "text-amber-800"}`}>
                        {paid ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                        {paid ? "Aporte pagado" : "Aporte pendiente"}
                      </span>
                      <span className="text-sm text-slate-600">{delivery ? "Entrega registrada" : "Sin entrega en esta ronda"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 border-y border-slate-200 py-4">
    <span className="text-emerald-800">{icon}</span>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default AdminCuadrosOverview;