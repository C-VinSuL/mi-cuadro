import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleDollarSign, ExternalLink, RefreshCw, Users, Wallet, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { createUniqueId } from "../../utils/uniqueId";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { etiquetaPeriodo, listarParticipantesGrupoAdmin, registrarAporteMiembro } from "../../services/grupoService";
import { logOperationalError } from "../../utils/logOperationalError";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const estadoAporte = (aporte) => {
  if (aporte.estado_revision === "pendiente") return "pendiente";
  if (aporte.estado_revision === "rechazado") return "rechazado";
  if (aporte.estado_revision === "aprobado" || aporte.estado?.toLowerCase() === "pagado") return "pagado";
  return aporte.estado?.toLowerCase() || "pendiente";
};

const AportesAdmin = () => {
  const { grupos, profile, cargarFondoComunitario } = useAuth();
  const { notify } = useNotifications();
  const [searchParams] = useSearchParams();
  const [aportes, setAportes] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [estadoFiltro, setEstadoFiltro] = useState(() => searchParams.get("estado") || "todos");
  const [grupoRegistroId, setGrupoRegistroId] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [participanteId, setParticipanteId] = useState("");
  const [monto, setMonto] = useState("");
  const [cargandoParticipantes, setCargandoParticipantes] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registroError, setRegistroError] = useState("");
  const [actualizacion, setActualizacion] = useState(0);
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [antiguedadFiltro, setAntiguedadFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);
  const [aporteRechazo, setAporteRechazo] = useState(null);
  const [notaRechazo, setNotaRechazo] = useState("");
  const [estadoTiempoReal, setEstadoTiempoReal] = useState("conectando");
  const puedeRevisar = ["administrador", "tesorero"].includes(profile?.rol?.toLowerCase());
  const estadoTiempoRealVisible = !profile?.id || grupos.length === 0 ? "inactivo" : estadoTiempoReal;

  const cargarAportes = useCallback(async ({ mostrarCarga = true } = {}) => {
    if (!grupos.length) {
      setAportes([]);
      setLoading(false);
      return;
    }

    if (mostrarCarga) setLoading(true);
    setError("");
    const groupIds = grupos.map((grupo) => grupo.id);
    const [participantsResponse, contributionsResponse] = await Promise.all([
      supabase.from("participantes").select("id, grupo_id, nombre").in("grupo_id", groupIds),
      supabase
        .from("aportes")
        .select("id, grupo_id, participante_id, semana, monto, comision_app, estado, fecha_pago, comprobante_en, comprobante_path, estado_revision, revisado_en, nota_revision")
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
    if (mostrarCarga) setLoading(false);
  }, [grupos]);

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
        logOperationalError("Error cargando participantes para registrar aportes:", loadError);
        if (active) setRegistroError("No se pudieron cargar los miembros del grupo. Inténtalo nuevamente.");
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
    Promise.resolve()
      .then(() => cargarAportes())
      .catch((loadError) => {
        logOperationalError("Error cargando aportes administrativos:", loadError);
        if (active) {
          setError("No se pudieron cargar los aportes de los grupos.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [cargarAportes, actualizacion]);

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
      logOperationalError("Error registrando aporte de un miembro:", submitError);
      setRegistroError("No se pudo registrar el aporte. Verifica los datos e inténtalo nuevamente.");
    } finally {
      setRegistrando(false);
    }
  };
  useEffect(() => {
    if (!profile?.id || grupos.length === 0) {
      return undefined;
    }

    const groupIds = new Set(grupos.map((grupo) => grupo.id));
    const channel = supabase
      .channel(`aportes-admin-${profile.id}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "aportes"
      }, (payload) => {
        const changedGroupId = payload.new?.grupo_id || payload.old?.grupo_id;
        if (changedGroupId && !groupIds.has(changedGroupId)) return;

        cargarAportes({ mostrarCarga: false }).catch((refreshError) => {
          logOperationalError("Error actualizando aportes en tiempo real:", refreshError);
          setError("No se pudo actualizar el registro en tiempo real. Usa Actualizar para volver a intentarlo.");
        });
      })
      .subscribe((status, subscriptionError) => {
        if (status === "SUBSCRIBED") {
          setEstadoTiempoReal("activo");
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          if (subscriptionError) logOperationalError("Error en la conexión de tiempo real de aportes:", subscriptionError);
          setEstadoTiempoReal("error");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarAportes, grupos, profile?.id]);

  const aportesFiltrados = useMemo(() => aportes.filter((aporte) => (
    (grupoFiltro === "todos" || aporte.grupo_id === grupoFiltro)
    && (estadoFiltro === "todos" || estadoAporte(aporte) === estadoFiltro)
    && (periodoFiltro === "todos" || String(aporte.semana) === periodoFiltro)
    && (antiguedadFiltro === "todos" || (() => {
      const fechaRegistro = aporte.comprobante_en || aporte.fecha_pago;
      return estadoAporte(aporte) === "pendiente"
        && Boolean(fechaRegistro)
        && Date.now() - new Date(fechaRegistro).getTime() >= Number(antiguedadFiltro);
    })())
  )), [aportes, grupoFiltro, estadoFiltro, periodoFiltro, antiguedadFiltro]);

  const periodosDisponibles = useMemo(() => [...new Set(
    aportes
      .filter((aporte) => grupoFiltro === "todos" || aporte.grupo_id === grupoFiltro)
      .map((aporte) => Number(aporte.semana))
      .filter(Number.isFinite)
  )].sort((a, b) => b - a), [aportes, grupoFiltro]);

  const pagados = aportesFiltrados.filter((aporte) => estadoAporte(aporte) === "pagado");
  const totalPagado = pagados.reduce((total, aporte) => total + Number(aporte.monto || 0), 0);
  const pendientesRevision = aportes.filter((aporte) => estadoAporte(aporte) === "pendiente" && aporte.estado_revision === "pendiente");

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
      logOperationalError("Error generando URL del comprobante:", signedUrlError);
    }
  };

  const resolverAporte = async (aporte, aprobar, nota = null) => {
    setProcesandoId(aporte.id);
    setError("");
    setMensaje("");
    try {
      const { error: reviewError } = await supabase.rpc("resolver_aporte_comprobante", {
        p_aporte_id: aporte.id,
        p_aprobar: aprobar,
        p_nota: nota
      });
      if (reviewError) throw reviewError;
      setMensaje(aprobar ? "Comprobante aprobado y aporte acreditado." : "Comprobante rechazado; el socio podrá enviar uno nuevo.");
      setAporteRechazo(null);
      setNotaRechazo("");
      await cargarAportes();
    } catch (reviewError) {
      logOperationalError("Error revisando comprobante de aporte:", reviewError);
      setError("No se pudo guardar la decisión. Inténtalo nuevamente.");
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 md:p-8">
        <div>
          <SectionPageTitle
            icon={CircleDollarSign}
            eyebrow="Revisión de aportes"
            title="Control de aportes"
            description="Prioriza comprobantes pendientes y revisa por grupo, periodo o antigüedad."
            plain
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cargarAportes().catch((loadError) => {
              logOperationalError("Error actualizando aportes administrativos:", loadError);
              setError("No se pudieron actualizar los aportes. Intenta nuevamente.");
              setLoading(false);
            })}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} /> Actualizar
          </button>
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
        <Metric icon={<Users size={19} />} label="Registros filtrados" value={aportesFiltrados.length} />
        <Metric icon={<CircleDollarSign size={19} />} label="Total aprobado" value={currency.format(totalPagado)} />
        <Metric icon={<Wallet size={19} />} label="Pendientes de revisión" value={pendientesRevision.length} />
      </section>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {mensaje && <p className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{mensaje}</p>}

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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Registro de aportes</h2>
              <p className="mt-1 text-xs text-slate-500">{pendientesRevision.length} comprobante{pendientesRevision.length === 1 ? "" : "s"} esperando revisión en todos los grupos</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              estadoTiempoRealVisible === "activo" ? "text-emerald-700"
                : estadoTiempoRealVisible === "error" ? "text-amber-700" : "text-slate-500"
            }`}>
              <span className={`size-2 rounded-full ${
                estadoTiempoRealVisible === "activo" ? "bg-emerald-500"
                  : estadoTiempoRealVisible === "error" ? "bg-amber-500" : "bg-slate-400"
              }`} />
              {estadoTiempoRealVisible === "activo" ? "Actualización en tiempo real activa"
                : estadoTiempoRealVisible === "error" ? "Tiempo real no disponible"
                  : estadoTiempoRealVisible === "inactivo" ? "Sin grupos para supervisar" : "Conectando en tiempo real..."}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={grupoFiltro} onChange={(event) => {
              setGrupoFiltro(event.target.value);
              setPeriodoFiltro("todos");
            }} aria-label="Filtrar aportes por grupo" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="todos">Todos los grupos</option>
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
            </select>
            <select value={periodoFiltro} onChange={(event) => setPeriodoFiltro(event.target.value)} aria-label="Filtrar aportes por periodo" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="todos">Todos los periodos</option>
              {periodosDisponibles.map((periodo) => <option key={periodo} value={periodo}>Periodo {periodo}</option>)}
            </select>
            <select value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)} aria-label="Filtrar aportes por estado" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes de revisión</option>
              <option value="pagado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
            </select>
            <select value={antiguedadFiltro} onChange={(event) => setAntiguedadFiltro(event.target.value)} aria-label="Filtrar pendientes por antigüedad" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="todos">Cualquier antigüedad</option>
              <option value={24 * 60 * 60 * 1000}>Pendientes hace más de 24 horas</option>
              <option value={3 * 24 * 60 * 60 * 1000}>Pendientes hace más de 3 días</option>
              <option value={7 * 24 * 60 * 60 * 1000}>Pendientes hace más de 7 días</option>
            </select>
          </div>
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
                  <th className="px-5 py-3 font-semibold">Fecha de envío / pago</th>
                  {puedeRevisar && <th className="px-5 py-3 font-semibold">Revisión</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aportesFiltrados.map((aporte) => {
                  const estado = estadoAporte(aporte);
                  const esperandoRevision = estado === "pendiente" && aporte.estado_revision === "pendiente";
                  return (
                    <tr key={aporte.id} className="transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none">
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
                      <td className="px-5 py-3 text-slate-600">{(aporte.comprobante_en || aporte.fecha_pago) ? new Date(aporte.comprobante_en || aporte.fecha_pago).toLocaleDateString("es-EC") : "Sin fecha"}</td>
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
                                onClick={() => {
                                  setAporteRechazo(aporte);
                                  setNotaRechazo("");
                                }}
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
      {aporteRechazo && (
        <div className="ui-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !procesandoId) setAporteRechazo(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="rechazar-aporte-titulo" className="ui-dialog-panel w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <header className="border-b border-slate-200 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">Rechazar comprobante</p>
              <h2 id="rechazar-aporte-titulo" className="mt-1 text-xl font-bold text-slate-900">{aporteRechazo.socio}</h2>
              <p className="mt-1 text-sm text-slate-600">{aporteRechazo.grupo} · {etiquetaPeriodo(grupos.find((grupo) => grupo.id === aporteRechazo.grupo_id)?.aporte_periodicidad)} {aporteRechazo.semana} · {currency.format(aporteRechazo.monto)}</p>
            </header>
            <div className="space-y-2 px-5 py-4">
              <label htmlFor="nota-rechazo-aporte" className="text-sm font-medium text-slate-700">Motivo que verá el socio</label>
              <textarea id="nota-rechazo-aporte" value={notaRechazo} onChange={(event) => setNotaRechazo(event.target.value)} maxLength={500} rows={4} required placeholder="Indica qué debe corregir o verificar el socio." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" />
              <p className="text-right text-xs text-slate-500">{notaRechazo.trim().length}/500 caracteres (mínimo 5)</p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setAporteRechazo(null)} disabled={Boolean(procesandoId)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => resolverAporte(aporteRechazo, false, notaRechazo.trim())} disabled={Boolean(procesandoId) || notaRechazo.trim().length < 5} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                <X size={16} /> {procesandoId ? "Guardando..." : "Confirmar rechazo"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none">
    <span className="text-emerald-800">{icon}</span>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default AportesAdmin;
