import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Users, Wallet } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const AportesAdmin = () => {
  const { grupos } = useAuth();
  const [aportes, setAportes] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadContributions = async () => {
      if (!grupos.length) {
        if (active) {
          setAportes([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");
      const groupIds = grupos.map((grupo) => grupo.id);
      const [participantsResponse, contributionsResponse] = await Promise.all([
        supabase.from("participantes").select("id, grupo_id, nombre").in("grupo_id", groupIds),
        supabase
          .from("aportes")
          .select("id, grupo_id, participante_id, semana, monto, comision_app, estado, fecha_pago")
          .in("grupo_id", groupIds)
          .order("semana", { ascending: false })
      ]);

      if (!active) return;
      if (participantsResponse.error || contributionsResponse.error) {
        setError("No se pudieron cargar los aportes de los grupos.");
        setLoading(false);
        return;
      }

      const participantNames = new Map((participantsResponse.data || []).map((item) => [item.id, item.nombre]));
      const groupNames = new Map(grupos.map((item) => [item.id, item.nombre]));
      setAportes((contributionsResponse.data || []).map((item) => ({
        ...item,
        socio: participantNames.get(item.participante_id) || "Socio sin identificar",
        grupo: groupNames.get(item.grupo_id) || "Grupo"
      })));
      setLoading(false);
    };

    loadContributions().catch((loadError) => {
      console.error("Error cargando aportes administrativos:", loadError);
      if (active) {
        setError("No se pudieron cargar los aportes de los grupos.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [grupos]);

  const aportesFiltrados = useMemo(() => aportes.filter((aporte) => (
    (grupoFiltro === "todos" || aporte.grupo_id === grupoFiltro)
    && (estadoFiltro === "todos" || aporte.estado?.toLowerCase() === estadoFiltro)
  )), [aportes, grupoFiltro, estadoFiltro]);

  const pagados = aportesFiltrados.filter((aporte) => aporte.estado?.toLowerCase() === "pagado");
  const pendientes = aportesFiltrados.filter((aporte) => aporte.estado?.toLowerCase() !== "pagado");
  const totalPagado = pagados.reduce((total, aporte) => total + Number(aporte.monto || 0), 0);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Supervisión general</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Control de aportes</h1>
          <p className="mt-2 text-sm text-slate-600">Consulta los aportes registrados por los socios en todos los grupos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={grupoFiltro} onChange={(event) => setGrupoFiltro(event.target.value)} aria-label="Filtrar aportes por grupo" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
            <option value="todos">Todos los grupos</option>
            {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
          </select>
          <select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)} aria-label="Filtrar aportes por estado" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
            <option value="todos">Todos los estados</option>
            <option value="pagado">Pagados</option>
            <option value="pendiente">Pendientes</option>
          </select>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de aportes">
        <Metric icon={<Users size={19} />} label="Registros revisados" value={aportesFiltrados.length} />
        <Metric icon={<CircleDollarSign size={19} />} label="Total pagado" value={currency.format(totalPagado)} />
        <Metric icon={<Wallet size={19} />} label="Pendientes" value={pendientes.length} />
      </section>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Registro de aportes</h2>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando aportes...</p>
        ) : aportesFiltrados.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay aportes para estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Grupo</th>
                  <th className="px-5 py-3 font-semibold">Socio</th>
                  <th className="px-5 py-3 font-semibold">Semana</th>
                  <th className="px-5 py-3 font-semibold">Aporte</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Fecha de pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aportesFiltrados.map((aporte) => (
                  <tr key={aporte.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{aporte.grupo}</td>
                    <td className="px-5 py-3 text-slate-700">{aporte.socio}</td>
                    <td className="px-5 py-3 text-slate-700">{aporte.semana}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{currency.format(aporte.monto)}</td>
                    <td className="px-5 py-3 capitalize text-slate-700">{aporte.estado || "Sin estado"}</td>
                    <td className="px-5 py-3 text-slate-600">{aporte.fecha_pago ? new Date(aporte.fecha_pago).toLocaleDateString("es-EC") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

export default AportesAdmin;