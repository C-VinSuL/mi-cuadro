import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Users, Wallet } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { etiquetaPeriodo, listarParticipantesGrupoAdmin, registrarAporteMiembro } from "../../services/grupoService";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const AportesAdmin = () => {
  const { grupos, cargarFondoComunitario } = useAuth();
  const { notify } = useNotifications();
  const [aportes, setAportes] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [grupoRegistroId, setGrupoRegistroId] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [participanteId, setParticipanteId] = useState("");
  const [monto, setMonto] = useState("");
  const [cargandoParticipantes, setCargandoParticipantes] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registroError, setRegistroError] = useState("");
  const [actualizacion, setActualizacion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const grupoRegistroIdActual = grupoRegistroId
    || grupos.find((grupo) => grupo.estado === "activo")?.id
    || grupos[0]?.id
    || "";
  const grupoRegistro = grupos.find((grupo) => grupo.id === grupoRegistroIdActual);
  const grupoActivo = grupoRegistro?.estado === "activo" && Number(grupoRegistro.semana_actual) > 0;

  useEffect(() => {
    let active = true;

    const loadParticipants = async () => {
      if (!grupoRegistroIdActual) {
        setParticipantes([]);
        setParticipanteId("");
        setMonto("");
        return;
      }

      setCargandoParticipantes(true);
      setRegistroError("");
      setParticipantes([]);
      setParticipanteId("");
      setMonto(Number(grupoRegistro?.aporte_semanal || 0).toFixed(2));

      try {
        const data = await listarParticipantesGrupoAdmin(grupoRegistroIdActual);
        if (active) setParticipantes(data || []);
      } catch (loadError) {
        console.error("Error cargando participantes para registrar aportes:", loadError);
        if (active) setRegistroError(loadError.message || "No se pudieron cargar los miembros del grupo.");
      } finally {
        if (active) setCargandoParticipantes(false);
      }
    };

    loadParticipants();
    return () => {
      active = false;
    };
  }, [grupoRegistroIdActual, grupoRegistro?.aporte_semanal]);

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
  }, [grupos, actualizacion]);

  const registrarAporte = async (event) => {
    event.preventDefault();
    if (!grupoRegistro || !grupoActivo || !participanteId || registrando) return;

    const montoNumerico = Number(monto);
    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setRegistroError("Ingresa un monto mayor que cero.");
      return;
    }

    setRegistrando(true);
    setRegistroError("");
    try {
      await registrarAporteMiembro({
        grupoId: grupoRegistro.id,
        participanteId,
        monto: montoNumerico
      });
      notify({
        title: "Aporte registrado",
        message: `El aporte de ${currency.format(montoNumerico)} quedó guardado en Supabase.`,
        type: "success"
      });
      setParticipanteId("");
      setActualizacion((value) => value + 1);
      await cargarFondoComunitario(grupoRegistro.id);
    } catch (submitError) {
      console.error("Error registrando aporte de un miembro:", submitError);
      setRegistroError(submitError.message || "No se pudo registrar el aporte.");
    } finally {
      setRegistrando(false);
    }
  };

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

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Registrar aporte de un miembro</h2>
          <p className="mt-1 text-sm text-slate-600">Al guardar, el aporte se registra para el periodo actual del grupo.</p>
        </div>
        <form onSubmit={registrarAporte} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Grupo
            <select
              value={grupoRegistroIdActual}
              onChange={(event) => setGrupoRegistroId(event.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"
            >
              <option value="" disabled>Selecciona un grupo</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Miembro
            <select
              value={participanteId}
              onChange={(event) => setParticipanteId(event.target.value)}
              required
              disabled={!grupoActivo || cargandoParticipantes}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal disabled:bg-slate-100"
            >
              <option value="">{cargandoParticipantes ? "Cargando miembros..." : "Selecciona un miembro"}</option>
              {participantes.map((participante) => (
                <option key={participante.id} value={participante.id}>{participante.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Monto (USD)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              required
              disabled={!grupoActivo}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!grupoActivo || !participanteId || registrando}
              className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {registrando ? "Guardando..." : "Registrar aporte"}
            </button>
          </div>
        </form>
        {!grupoActivo && grupoRegistro && (
          <p className="mt-4 text-sm text-amber-800" role="status">El grupo debe estar activo para registrar aportes.</p>
        )}
        {registroError && <p className="mt-4 text-sm text-red-700" role="alert">{registroError}</p>}
      </section>

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
                  <th className="px-5 py-3 font-semibold">Periodo</th>
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
                    <td className="px-5 py-3 text-slate-700">
                      {etiquetaPeriodo(grupos.find((grupo) => grupo.id === aporte.grupo_id)?.aporte_periodicidad)} {aporte.semana}
                    </td>
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