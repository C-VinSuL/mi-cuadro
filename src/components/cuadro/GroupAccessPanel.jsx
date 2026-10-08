import { useCallback, useEffect, useState } from "react";
import { Check, Layers3, LoaderCircle, Mail, Plus, RefreshCw, Trash2, UserRoundCheck, UserRoundPlus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useNotifications } from "../../hooks/useNotifications";
import {
  crearGrupo,
  resolverSolicitudGrupo,
  listarGruposDisponibles,
  solicitarInvitacionGrupo,
  listarSolicitudesInvitacion,
  enviarInvitacionGrupo,
  rechazarInvitacionGrupo,
  eliminarGrupo
} from "../../services/grupoService";

const PAGE_SIZE = 6;

const GroupAccessPanel = ({ onMembershipChange }) => {
  const { user, profile, grupo, grupos, cargarParticipante, seleccionarGrupo } = useAuth();
  const { can } = usePermissions();
  const { notify, groupRequests, groupRequestsError, refreshGroupRequests } = useNotifications();
  const esSocio = profile?.rol?.toLowerCase() === "socio";
  const puedeGestionarGrupos = can("gestionarGrupo");
  const [formGrupo, setFormGrupo] = useState({
    nombre: "",
    numeroIntegrantes: "",
    aporte: "",
    periodicidad: "semanal"
  });
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [solicitudesInvitacion, setSolicitudesInvitacion] = useState([]);
  const [cargandoDirectorio, setCargandoDirectorio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [grupoAEliminar, setGrupoAEliminar] = useState(null);
  const [confirmacionNombre, setConfirmacionNombre] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [actualizandoSolicitudes, setActualizandoSolicitudes] = useState(false);
  const [estadoActualizacion, setEstadoActualizacion] = useState("");
  const [seccionAdminAbierta, setSeccionAdminAbierta] = useState(null);
  const [filtroGrupos, setFiltroGrupos] = useState("todos");
  const [paginaGrupos, setPaginaGrupos] = useState(0);
  const [error, setError] = useState("");
  const conteoGrupos = {
    todos: grupos.length,
    borrador: grupos.filter((item) => item.estado === "borrador").length,
    activo: grupos.filter((item) => item.estado === "activo").length,
    finalizado: grupos.filter((item) => item.estado === "finalizado").length
  };
  const gruposFiltrados = grupos.filter((item) => (
    filtroGrupos === "todos" || item.estado === filtroGrupos
  ));
  const paginasGrupos = Math.max(1, Math.ceil(gruposFiltrados.length / PAGE_SIZE));
  const gruposPagina = gruposFiltrados.slice(paginaGrupos * PAGE_SIZE, (paginaGrupos + 1) * PAGE_SIZE);

  const actualizarDirectorio = useCallback(async () => {
    if (!esSocio) return;
    setCargandoDirectorio(true);
    try {
      setGruposDisponibles(await listarGruposDisponibles());
    } catch (loadError) {
      console.error("Error cargando grupos disponibles:", loadError);
      setError(loadError.message || "No se pudo cargar el directorio de grupos.");
    } finally {
      setCargandoDirectorio(false);
    }
  }, [esSocio]);

  const actualizarSolicitudesInvitacion = useCallback(async () => {
    if (!puedeGestionarGrupos) return;
    try {
      setSolicitudesInvitacion(await listarSolicitudesInvitacion());
    } catch (loadError) {
      console.error("Error cargando solicitudes de invitación:", loadError);
      setError(loadError.message || "No se pudieron cargar las solicitudes de invitación.");
    }
  }, [puedeGestionarGrupos]);

  useEffect(() => {
    const refresh = () => {
      actualizarDirectorio();
      actualizarSolicitudesInvitacion();
    };
    const timeoutId = window.setTimeout(refresh, 0);
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [user?.id, actualizarDirectorio, actualizarSolicitudesInvitacion]);

  const actualizarSolicitudes = async () => {
    setActualizandoSolicitudes(true);
    setEstadoActualizacion("");
    const requests = await refreshGroupRequests();
    if (requests === null) {
      setEstadoActualizacion("No se pudieron actualizar las solicitudes. Revisa el error de conexión o los permisos de Supabase.");
    } else {
      setEstadoActualizacion(
        requests.length > 0
          ? `Actualizado: ${requests.length} solicitud${requests.length === 1 ? "" : "es"} pendiente${requests.length === 1 ? "" : "s"}.`
          : `Actualizado: se revisaron ${grupos.length} grupo${grupos.length === 1 ? "" : "s"} y no hay solicitudes pendientes.`
      );
    }
    setActualizandoSolicitudes(false);
  };

  const solicitarInvitacion = async (groupId) => {
    setEnviando(true);
    setError("");

    try {
      await solicitarInvitacionGrupo(groupId);
      await actualizarDirectorio();
      notify({
        title: "Solicitud enviada",
        message: "El administrador revisará tu solicitud y, si la aprueba, te llegará un enlace al correo de tu cuenta.",
        type: "success"
      });
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const crearNuevoGrupo = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError("");

    try {
      const nuevoGrupo = await crearGrupo(formGrupo);
      if (nuevoGrupo?.id) {
        window.localStorage.setItem(`mi-cuadro-grupo-${user.id}`, nuevoGrupo.id);
      }
      await cargarParticipante(user.id, profile.rol);
      setFormGrupo({ nombre: "", numeroIntegrantes: "", aporte: "", periodicidad: "semanal" });
      setSeccionAdminAbierta(null);
      notify({ title: "Grupo creado", message: "Ya puedes compartir el código de acceso.", type: "success" });
    } catch (createError) {
      const detail = createError.message || "";
      setError(
        createError.code === "PGRST202" || /Could not find the function.*crear_grupo|schema cache/i.test(detail)
          ? "Supabase no reconoce crear_grupo. Aplica las migraciones 001, 002 y 003 en orden, o la 003 si las dos primeras ya están aplicadas; luego vuelve a cargar la app."
          : detail || "No se pudo crear el grupo."
      );
    } finally {
      setEnviando(false);
    }
  };

  const enviarCorreoInvitacion = async (requestId) => {
    setEnviando(true);
    setError("");
    try {
      await enviarInvitacionGrupo(requestId);
      await actualizarSolicitudesInvitacion();
      notify({ title: "Invitación enviada", message: "El socio recibió el enlace de invitación por correo.", type: "success" });
    } catch (sendError) {
      setError(sendError.message || "No se pudo enviar la invitación.");
    } finally {
      setEnviando(false);
    }
  };

  const rechazarSolicitudInvitacion = async (requestId) => {
    setEnviando(true);
    setError("");
    try {
      await rechazarInvitacionGrupo(requestId);
      await actualizarSolicitudesInvitacion();
      notify({ title: "Solicitud rechazada", message: "Se registró la decisión en la auditoría.", type: "success" });
    } catch (rejectError) {
      setError(rejectError.message || "No se pudo rechazar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const revisarSolicitud = async (solicitudId, aprobar) => {
    setEnviando(true);
    setError("");

    try {
      await resolverSolicitudGrupo(solicitudId, aprobar);
      const solicitud = groupRequests.find((item) => item.id === solicitudId);
      if (aprobar && solicitud?.grupo_id) {
        await seleccionarGrupo(solicitud.grupo_id);
        await onMembershipChange?.(solicitud.grupo_id);
      }
      await refreshGroupRequests();
      notify({
        title: aprobar ? "Socio agregado" : "Solicitud rechazada",
        message: aprobar ? "El socio ya pertenece a este grupo." : "Se actualizó la solicitud.",
        type: "success"
      });
    } catch (reviewError) {
      setError(reviewError.message || "No se pudo procesar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  const actualizarMembresias = async () => {
    if (!user?.id || !profile?.rol) return;
    setEnviando(true);
    setError("");
    try {
      await cargarParticipante(user.id, profile.rol);
    } catch (refreshError) {
      setError(refreshError.message || "No se pudieron actualizar tus grupos.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!grupoAEliminar || !user?.id || !profile?.rol || confirmacionNombre.trim() !== grupoAEliminar.nombre) return;
    setEliminando(true);
    setError("");

    try {
      await eliminarGrupo(grupoAEliminar.id);
      if (grupo?.id === grupoAEliminar.id) {
        window.localStorage.removeItem(`mi-cuadro-grupo-${user.id}`);
      }
      setGrupoAEliminar(null);
      setConfirmacionNombre("");
      await Promise.all([
        cargarParticipante(user.id, profile.rol),
        refreshGroupRequests()
      ]);
      notify({ title: "Grupo eliminado", message: "Se eliminó el grupo sin actividad financiera. Las cuentas de los socios siguen intactas.", type: "success" });
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar el grupo.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <section className="space-y-5 border-y border-slate-200 py-5">
      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <div className={`grid gap-6 ${esSocio && puedeGestionarGrupos ? "lg:grid-cols-2" : ""}`}>
        {esSocio && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-900"><UserRoundPlus size={18} /> Grupos disponibles</h2>
                <p className="mt-1 text-sm text-slate-500">Solicita una invitación. El administrador revisará tu petición antes de enviar el enlace.</p>
              </div>
              <button type="button" onClick={actualizarDirectorio} disabled={cargandoDirectorio} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-950 disabled:opacity-60">
                <RefreshCw size={15} /> Actualizar
              </button>
            </div>
            {cargandoDirectorio ? (
              <p className="py-5 text-sm text-slate-500" role="status">Cargando grupos disponibles...</p>
            ) : gruposDisponibles.length === 0 ? (
              <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No hay grupos con cupos disponibles en este momento.</p>
            ) : (
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {gruposDisponibles.map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.nombre}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.integrantes} / {item.capacidad} socios · ${Number(item.aporte).toFixed(2)} {item.periodicidad}
                      </p>
                    </div>
                    {item.mi_estado ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold capitalize text-amber-800">
                        {item.mi_estado === "invitacion_enviada" ? "Invitación enviada" : item.mi_estado === "pendiente" ? "Solicitud enviada" : item.mi_estado}
                      </span>
                    ) : (
                      <button type="button" onClick={() => solicitarInvitacion(item.id)} disabled={enviando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                        <Mail size={16} /> Solicitar invitación
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            <button type="button" onClick={actualizarMembresias} disabled={enviando} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 disabled:opacity-60">
              <RefreshCw size={14} /> Actualizar mis grupos
            </button>
          </div>
        )}

      </div>

      {puedeGestionarGrupos && (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold text-slate-900">Administración de grupos y solicitudes</h2>
            <p className="mt-1 text-sm text-slate-500">Abre cada sección para revisar grupos creados y solicitudes pendientes.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AdminSectionButton
              icon={<Plus size={19} />}
              title="Crear grupo"
              description="Configura capacidad, aporte y periodicidad"
              badge="Nuevo"
              onClick={() => {
                setError("");
                setSeccionAdminAbierta("crear");
              }}
            />
            <AdminSectionButton
              icon={<Layers3 size={19} />}
              title="Grupos creados"
              description={`${conteoGrupos.activo} activos · ${conteoGrupos.borrador} en preparación`}
              count={grupos.length}
              onClick={() => setSeccionAdminAbierta("grupos")}
            />
            <AdminSectionButton
              icon={<Mail size={19} />}
              title="Solicitudes de invitación"
              description="Autorizar envío de enlaces"
              count={solicitudesInvitacion.length}
              onClick={() => {
                setSeccionAdminAbierta("invitaciones");
                actualizarSolicitudesInvitacion();
              }}
            />
            {can("iniciarCuadro") && (
              <AdminSectionButton
                icon={<UserRoundCheck size={19} />}
                title="Solicitudes de ingreso"
                description="Aprobar socios en tus grupos"
                count={groupRequests.length}
                onClick={() => {
                  setSeccionAdminAbierta("ingresos");
                  actualizarSolicitudes();
                }}
              />
            )}
          </div>
        </div>
      )}

      {seccionAdminAbierta && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSeccionAdminAbierta(null);
          }}
        >
          <section
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="administracion-grupos-titulo"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 id="administracion-grupos-titulo" className="text-lg font-bold text-slate-900">
                  {seccionAdminAbierta === "crear" ? "Crear grupo"
                    : seccionAdminAbierta === "grupos" ? "Grupos creados"
                    : seccionAdminAbierta === "invitaciones" ? "Solicitudes de invitación"
                      : "Solicitudes de ingreso"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {seccionAdminAbierta === "crear"
                    ? "Define el tamaño del grupo y el valor de cada aporte antes de invitar a los socios."
                    : seccionAdminAbierta === "grupos"
                    ? "Los grupos con actividad financiera no se pueden eliminar."
                    : seccionAdminAbierta === "invitaciones"
                      ? "Autoriza el envío del enlace; el socio deberá aceptarlo antes de aprobar su ingreso."
                      : "Revisa y decide qué socios pueden ingresar a tus grupos."}
                </p>
              </div>
              <button type="button" onClick={() => setSeccionAdminAbierta(null)} aria-label="Cerrar ventana" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={19} />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-3 sm:px-6">
              {seccionAdminAbierta === "crear" && (
                <form onSubmit={crearNuevoGrupo} className="space-y-5 py-2">
                  {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
                  <label className="block text-sm font-semibold text-slate-700">
                    Nombre del grupo
                    <input
                      value={formGrupo.nombre}
                      onChange={(event) => setFormGrupo({ ...formGrupo, nombre: event.target.value })}
                      required
                      maxLength={80}
                      autoFocus
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Cantidad de socios
                      <input
                        type="number"
                        min="2"
                        max="500"
                        value={formGrupo.numeroIntegrantes}
                        onChange={(event) => setFormGrupo({ ...formGrupo, numeroIntegrantes: event.target.value })}
                        required
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Aporte por periodo
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formGrupo.aporte}
                        onChange={(event) => setFormGrupo({ ...formGrupo, aporte: event.target.value })}
                        required
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                      Periodicidad
                      <select
                        value={formGrupo.periodicidad}
                        onChange={(event) => setFormGrupo({ ...formGrupo, periodicidad: event.target.value })}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                      >
                        <option value="semanal">Semanal</option>
                        <option value="quincenal">Quincenal</option>
                        <option value="mensual">Mensual</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setSeccionAdminAbierta(null)}
                      disabled={enviando}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={enviando}
                      className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                    >
                      {enviando ? "Creando..." : "Crear grupo"}
                    </button>
                  </div>
                </form>
              )}

              {seccionAdminAbierta === "grupos" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {[
                      ["todos", "Todos"],
                      ["activo", "Activos"],
                      ["borrador", "En preparación"],
                      ["finalizado", "Finalizados"]
                    ].map(([filter, label]) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setFiltroGrupos(filter);
                          setPaginaGrupos(0);
                        }}
                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                          filtroGrupos === filter
                            ? "bg-emerald-800 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {label} ({conteoGrupos[filter]})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={async () => {
                        setEnviando(true);
                        try {
                          await cargarParticipante(user.id, profile.rol);
                          await actualizarSolicitudesInvitacion();
                        } finally {
                          setEnviando(false);
                        }
                      }}
                      disabled={enviando}
                      className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 text-sm font-semibold text-emerald-800 hover:text-emerald-950 disabled:opacity-60"
                    >
                      <RefreshCw size={15} /> Actualizar
                    </button>
                  </div>

                  {gruposFiltrados.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">No hay grupos en esta categoría.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {gruposPagina.map((item) => (
                        <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{item.nombre}</p>
                              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                                item.estado === "activo" ? "bg-emerald-50 text-emerald-800"
                                  : item.estado === "borrador" ? "bg-amber-50 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                              }`}>
                                {item.estado || "sin estado"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmacionNombre("");
                                setGrupoAEliminar(item);
                              }}
                              disabled={enviando || eliminando}
                              aria-label={`Eliminar grupo ${item.nombre}`}
                              title="Eliminar grupo solo si no tiene movimientos financieros"
                              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="mt-3 text-sm text-slate-600">
                            {item.numero_integrantes || 0} cupos · ${Number(item.aporte_semanal || 0).toFixed(2)} {item.aporte_periodicidad || "semanal"}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              seleccionarGrupo(item.id);
                              setSeccionAdminAbierta(null);
                            }}
                            className="mt-4 w-full rounded-lg border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                          >
                            Ver grupo
                          </button>
                        </article>
                      ))}
                    </div>
                  )}

                  {gruposFiltrados.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                      <p className="text-sm text-slate-600">
                        Página {paginaGrupos + 1} de {paginasGrupos}
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPaginaGrupos((page) => Math.max(0, page - 1))} disabled={paginaGrupos === 0} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">Anterior</button>
                        <button type="button" onClick={() => setPaginaGrupos((page) => Math.min(paginasGrupos - 1, page + 1))} disabled={paginaGrupos >= paginasGrupos - 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">Siguiente</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {seccionAdminAbierta === "invitaciones" && (
                <>
                  <div className="flex justify-end py-2">
                    <button type="button" onClick={actualizarSolicitudesInvitacion} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
                      <RefreshCw size={15} /> Actualizar
                    </button>
                  </div>
                  {solicitudesInvitacion.length === 0 ? (
                    <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No hay solicitudes pendientes de invitación.</p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {solicitudesInvitacion.map((request) => (
                        <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{[request.nombre, request.apellido].filter(Boolean).join(" ") || "Socio"}</p>
                            <p className="mt-1 text-sm text-slate-500">Solicita invitación a {request.grupo_nombre}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => enviarCorreoInvitacion(request.id)} disabled={enviando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                              <Mail size={15} /> Enviar enlace
                            </button>
                            <button type="button" onClick={() => rechazarSolicitudInvitacion(request.id)} disabled={enviando} aria-label="Rechazar solicitud de invitación" title="Rechazar solicitud" className="inline-flex size-9 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60">
                              <X size={17} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}

              {seccionAdminAbierta === "ingresos" && (
                <>
                  <div className="flex justify-end py-2">
                    <button type="button" onClick={actualizarSolicitudes} disabled={actualizandoSolicitudes} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">
                      {actualizandoSolicitudes ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      {actualizandoSolicitudes ? "Actualizando..." : "Actualizar"}
                    </button>
                  </div>
                  {estadoActualizacion && <p className="mb-2 text-sm text-slate-600" role="status">{estadoActualizacion}</p>}
                  {groupRequestsError && <p className="mb-3 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">No se pudieron consultar las solicitudes: {groupRequestsError}</p>}
                  {groupRequests.length === 0 ? (
                    <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No hay solicitudes pendientes en tus grupos.</p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {groupRequests.map((solicitud) => (
                        <article key={solicitud.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{[solicitud.nombre, solicitud.apellido].filter(Boolean).join(" ") || "Socio"}</p>
                            <p className="mt-1 text-sm text-slate-500">Solicita acceso a {solicitud.grupo_nombre}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" disabled={enviando} onClick={() => revisarSolicitud(solicitud.id, true)} aria-label="Aprobar solicitud" title="Aprobar" className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"><Check size={17} /></button>
                            <button type="button" disabled={enviando} onClick={() => revisarSolicitud(solicitud.id, false)} aria-label="Rechazar solicitud" title="Rechazar" className="inline-flex size-9 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"><X size={17} /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {grupoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="eliminar-grupo-titulo">
            <p className="text-sm font-semibold text-red-700">Acción permanente</p>
            <h2 id="eliminar-grupo-titulo" className="mt-1 text-xl font-bold text-slate-900">¿Eliminar “{grupoAEliminar.nombre}”?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Solo se pueden eliminar grupos sin movimientos financieros. Se borrarán el grupo y sus solicitudes o membresías; las cuentas de los socios se conservarán.</p>
            <div className="mt-6 space-y-4">
              <label className="block min-w-0 text-sm text-slate-700">
                Escribe <span className="font-semibold">{grupoAEliminar.nombre}</span> para confirmar
                <input
                  value={confirmacionNombre}
                  onChange={(event) => setConfirmacionNombre(event.target.value)}
                  disabled={eliminando}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => {
                  setGrupoAEliminar(null);
                  setConfirmacionNombre("");
                }} disabled={eliminando} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
                <button type="button" onClick={confirmarEliminacion} disabled={eliminando || confirmacionNombre.trim() !== grupoAEliminar.nombre} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">{eliminando ? "Eliminando..." : "Eliminar grupo"}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

const AdminSectionButton = ({ icon, title, description, count, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
  >
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
    </span>
    {badge ? (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{badge}</span>
    ) : count !== undefined ? (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{count}</span>
    ) : null}
  </button>
);

export default GroupAccessPanel;