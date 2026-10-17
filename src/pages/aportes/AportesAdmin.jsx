import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleDollarSign, ExternalLink, Users, Wallet, X } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { etiquetaPeriodo } from "../../services/grupoService";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const estadoAporte = (aporte) => {
  if (aporte.estado_revision === "pendiente") return "pendiente";
  if (aporte.estado_revision === "rechazado") return "rechazado";
  if (aporte.estado_revision === "aprobado" || aporte.estado?.toLowerCase() === "pagado") return "pagado";
  return aporte.estado?.toLowerCase() || "pendiente";
};

const AportesAdmin = () => {
  const { grupos, profile } = useAuth();
  const [aportes, setAportes] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);
  const puedeRevisar = ["administrador", "tesorero"].includes(profile?.rol?.toLowerCase());

  const cargarAportes = useCallback(async () => {
    if (!grupos.length) {
      setAportes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const groupIds = grupos.map((grupo) => grupo.id);
    const [participantsResponse, contributionsResponse] = await Promise.all([
      supabase.from("participantes").select("id, grupo_id, nombre").in("grupo_id", groupIds),
      supabase
        .from("aportes")
        .select("id, grupo_id, participante_id, semana, monto, comision_app, estado, fecha_pago, comprobante_path, estado_revision, revisado_en, nota_revision")
        .in("grupo_id", groupIds)
        .order("semana", { ascending: false })
    ]);

    if (participantsResponse.error || contributionsResponse.error) {
      throw participantsResponse.error || contributionsResponse.error;
    }

    const participantNames = new Map((participantsResponse.data || []).map((item) => [item.id, item.nombre]));
    const groupNames = new Map(grupos.map((item) => [item.id, item.nombre]));
    setAportes((contributionsResponse.data || []).map((item) => ({
      ...item,
      socio: participantNames.get(item.participante_id) || "Socio sin identificar",
      grupo: groupNames.get(item.grupo_id) || "Grupo"
    })));
    setLoading(false);
  }, [grupos]);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => cargarAportes())
      .catch((loadError) => {
        console.error("Error cargando aportes administrativos:", loadError);
        if (active) {
          setError("No se pudieron cargar los aportes de los grupos.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [cargarAportes]);

  const aportesFiltrados = useMemo(() => aportes.filter((aporte) => (
    (grupoFiltro === "todos" || aporte.grupo_id === grupoFiltro)
    && (estadoFiltro === "todos" || estadoAporte(aporte) === estadoFiltro)
  )), [aportes, grupoFiltro, estadoFiltro]);

  const pagados = aportesFiltrados.filter((aporte) => estadoAporte(aporte) === "pagado");
  const pendientes = aportesFiltrados.filter((aporte) => estadoAporte(aporte) === "pendiente");
  const totalPagado = pagados.reduce((total, aporte) => total + Number(aporte.monto || 0), 0);

  const abrirComprobante = async (aporte) => {
    setError("");
    const ventana = window.open("about:blank", "_blank");
    if (!ventana) {
      setError("Permite las ventanas emergentes para abrir el comprobante.");
      return;
    }
    ventana.opener = null;

    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("contribution-receipts")
        .createSignedUrl(aporte.comprobante_path, 60);
      if (signedUrlError) throw signedUrlError;
      ventana.location.href = data.signedUrl;
    } catch (signedUrlError) {
      ventana.close();
      setError("No se pudo abrir el comprobante. Verifica tu sesión y el segundo factor de autenticación.");
      console.error("Error generando URL del comprobante:", signedUrlError);
    }
  };

  const resolverAporte = async (aporte, aprobar) => {
    setProcesandoId(aporte.id);
    setError("");
    setMensaje("");
    try {
      const { error: reviewError } = await supabase.rpc("resolver_aporte_comprobante", {
        p_aporte_id: aporte.id,
        p_aprobar: aprobar,
        p_nota: null
      });
      if (reviewError) throw reviewError;
      setMensaje(aprobar ? "Comprobante aprobado y aporte acreditado." : "Comprobante rechazado; el socio podrá enviar uno nuevo.");
      await cargarAportes();
    } catch (reviewError) {
      console.error("Error revisando comprobante de aporte:", reviewError);
      setError(reviewError.message || "No se pudo guardar la decisión.");
    } finally {
      setProcesandoId(null);
    }
  };

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
            <option value="pendiente">Pendientes de revisión</option>
            <option value="pagado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de aportes">
        <Metric icon={<Users size={19} />} label="Registros" value={aportesFiltrados.length} />
        <Metric icon={<CircleDollarSign size={19} />} label="Total aprobado" value={currency.format(totalPagado)} />
        <Metric icon={<Wallet size={19} />} label="Pendientes de revisión" value={pendientes.length} />
      </section>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {mensaje && <p className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{mensaje}</p>}

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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Grupo</th>
                  <th className="px-5 py-3 font-semibold">Socio</th>
                  <th className="px-5 py-3 font-semibold">Periodo</th>
                  <th className="px-5 py-3 font-semibold">Aporte</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  <th className="px-5 py-3 font-semibold">Comprobante</th>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  {puedeRevisar && <th className="px-5 py-3 font-semibold">Revisión</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aportesFiltrados.map((aporte) => {
                  const estado = estadoAporte(aporte);
                  const esperandoRevision = estado === "pendiente" && aporte.estado_revision === "pendiente";
                  return (
                    <tr key={aporte.id}>
                      <td className="px-5 py-3 font-medium text-slate-900">{aporte.grupo}</td>
                      <td className="px-5 py-3 text-slate-700">{aporte.socio}</td>
                      <td className="px-5 py-3 text-slate-700">
                        {etiquetaPeriodo(grupos.find((grupo) => grupo.id === aporte.grupo_id)?.aporte_periodicidad)} {aporte.semana}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{currency.format(aporte.monto)}</td>
                      <td className="px-5 py-3 capitalize text-slate-700">{estado === "pagado" ? "Aprobado" : estado === "pendiente" ? (esperandoRevision ? "En revisión" : "Pendiente") : estado}</td>
                      <td className="px-5 py-3">
                        {aporte.comprobante_path ? (
                          <button type="button" onClick={() => abrirComprobante(aporte)} className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline">
                            Abrir <ExternalLink size={15} />
                          </button>
                        ) : <span className="text-slate-400">No adjunto</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{aporte.fecha_pago ? new Date(aporte.fecha_pago).toLocaleDateString("es-EC") : "-"}</td>
                      {puedeRevisar && (
                        <td className="px-5 py-3">
                          {esperandoRevision ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => resolverAporte(aporte, true)}
                                disabled={procesandoId === aporte.id || !aporte.comprobante_path}
                                aria-label={`Aprobar aporte de ${aporte.socio}`}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                <Check size={15} /> Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => resolverAporte(aporte, false)}
                                disabled={procesandoId === aporte.id}
                                aria-label={`Rechazar aporte de ${aporte.socio}`}
                                className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1.5 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                              >
                                <X size={15} /> Rechazar
                              </button>
                            </div>
                          ) : aporte.revisado_en ? (
                            <span className="text-slate-500">{new Date(aporte.revisado_en).toLocaleDateString("es-EC")}</span>
                          ) : <span className="text-slate-400">-</span>}
                          {aporte.nota_revision && estado === "rechazado" && <p className="mt-1 max-w-48 text-xs text-red-700">{aporte.nota_revision}</p>}
                        </td>
                      )}
                    </tr>
                  );
                })}
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
