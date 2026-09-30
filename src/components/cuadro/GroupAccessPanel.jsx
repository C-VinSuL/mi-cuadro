import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Trash2, UserRoundPlus, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useNotifications } from "../../hooks/useNotifications";
import {
  crearGrupo,
  obtenerSolicitudesGrupo,
  resolverSolicitudGrupo,
  solicitarUnionGrupo,
  eliminarGrupo
} from "../../services/grupoService";

const GroupAccessPanel = () => {
  const { user, profile, grupo, grupos, cargarParticipante } = useAuth();
  const { can, rol } = usePermissions();
  const { notify } = useNotifications();
  const [codigo, setCodigo] = useState("");
  const [formGrupo, setFormGrupo] = useState({ nombre: "", numeroIntegrantes: "", aporteSemanal: "" });
  const [solicitudes, setSolicitudes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [grupoAEliminar, setGrupoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");

  const cargarSolicitudes = async () => {
    if (!grupo?.id || !can("iniciarCuadro")) {
      setSolicitudes([]);
      return;
    }

    try {
      setSolicitudes(await obtenerSolicitudesGrupo(grupo.id));
    } catch (loadError) {
      console.error("Error cargando solicitudes:", loadError);
      setError("No se pudieron cargar las solicitudes del grupo.");
    }
  };

  useEffect(() => {
    if (!grupo?.id || !["administrador", "tesorero"].includes(rol)) return undefined;

    let active = true;
    obtenerSolicitudesGrupo(grupo.id)
      .then((rows) => {
        if (active) setSolicitudes(rows);
      })
      .catch((loadError) => {
        console.error("Error cargando solicitudes:", loadError);
        if (active) setError("No se pudieron cargar las solicitudes del grupo.");
      });

    return () => {
      active = false;
    };
  }, [grupo?.id, rol]);

  const enviarSolicitud = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError("");

    try {
      await solicitarUnionGrupo(codigo);
      setCodigo("");
      notify({ title: "Solicitud enviada", message: "Administración revisará tu ingreso al grupo.", type: "success" });
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
      setFormGrupo({ nombre: "", numeroIntegrantes: "", aporteSemanal: "" });
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

  const revisarSolicitud = async (solicitudId, aprobar) => {
    setEnviando(true);
    setError("");

    try {
      await resolverSolicitudGrupo(solicitudId, aprobar);
      await Promise.all([cargarSolicitudes(), cargarParticipante(user.id, profile.rol)]);
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

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(grupo.codigo_acceso);
      notify({ title: "Código copiado", message: "Compártelo con los socios que quieras invitar.", type: "success" });
    } catch {
      setError("No se pudo copiar el código. Puedes seleccionarlo y copiarlo manualmente.");
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
    if (!grupoAEliminar || !user?.id || !profile?.rol) return;
    setEliminando(true);
    setError("");

    try {
      await eliminarGrupo(grupoAEliminar.id);
      if (grupo?.id === grupoAEliminar.id) {
        window.localStorage.removeItem(`mi-cuadro-grupo-${user.id}`);
      }
      setGrupoAEliminar(null);
      await cargarParticipante(user.id, profile.rol);
      notify({ title: "Grupo eliminado", message: "Se eliminaron el grupo y sus membresías. Las cuentas de los socios siguen intactas.", type: "success" });
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar el grupo.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <section className="space-y-5 border-y border-slate-200 py-5">
      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      {grupo?.codigo_acceso && grupo.estado === "borrador" && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Código de acceso · {grupo.nombre}</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-wider text-emerald-800">{grupo.codigo_acceso}</p>
          </div>
          <button type="button" onClick={copiarCodigo} aria-label="Copiar código de acceso" title="Copiar código" className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
            <Copy size={17} />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={enviarSolicitud} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><UserRoundPlus size={18} /> Solicitar ingreso a otro grupo</h2>
            <button type="button" onClick={actualizarMembresias} disabled={enviando} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-950 disabled:opacity-60">
              <RefreshCw size={15} /> Actualizar grupos
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} required maxLength={10} autoComplete="off" aria-label="Código de acceso del grupo" placeholder="Código de acceso" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
            <button disabled={enviando} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{enviando ? "Enviando..." : "Solicitar"}</button>
          </div>
        </form>

        {can("gestionarGrupo") && (
          <form onSubmit={crearNuevoGrupo} className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Users size={18} /> Crear grupo</h2>
            <input value={formGrupo.nombre} onChange={(event) => setFormGrupo({ ...formGrupo, nombre: event.target.value })} required maxLength={80} aria-label="Nombre del grupo" placeholder="Nombre del grupo" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="2" max="500" value={formGrupo.numeroIntegrantes} onChange={(event) => setFormGrupo({ ...formGrupo, numeroIntegrantes: event.target.value })} required aria-label="Cantidad de socios" placeholder="Cantidad de socios" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
              <input type="number" min="0.01" step="0.01" value={formGrupo.aporteSemanal} onChange={(event) => setFormGrupo({ ...formGrupo, aporteSemanal: event.target.value })} required aria-label="Aporte semanal" placeholder="Aporte semanal" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
            </div>
            <button disabled={enviando} className="rounded-lg border border-emerald-800 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60">Crear cuadro</button>
          </form>
        )}
      </div>

      {can("gestionarGrupo") && grupos.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900">Administrar grupos</h2>
          <p className="mt-1 text-sm text-slate-500">Solo se pueden eliminar grupos en borrador sin movimientos financieros. Las cuentas de sus socios no se eliminan.</p>
          <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {grupos.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">{item.nombre}</p>
                  <p className="text-sm capitalize text-slate-500">{item.estado || "sin estado"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGrupoAEliminar(item)}
                  disabled={enviando || eliminando || item.estado !== "borrador"}
                  aria-label={`Eliminar grupo ${item.nombre}`}
                  title={item.estado === "borrador" ? "Eliminar grupo" : "Solo se pueden eliminar grupos en borrador"}
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {can("iniciarCuadro") && grupo && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Solicitudes pendientes</h2>
            <span className="text-sm text-slate-500">{solicitudes.length}</span>
          </div>
          {solicitudes.length === 0 ? (
            <p className="border-y border-slate-200 py-4 text-sm text-slate-500">No hay solicitudes pendientes para este grupo.</p>
          ) : (
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {solicitudes.map((solicitud) => (
                <div key={solicitud.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <p className="font-medium text-slate-800">{[solicitud.nombre, solicitud.apellido].filter(Boolean).join(" ")}</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={enviando} onClick={() => revisarSolicitud(solicitud.id, true)} aria-label="Aprobar solicitud" title="Aprobar" className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"><Check size={17} /></button>
                    <button type="button" disabled={enviando} onClick={() => revisarSolicitud(solicitud.id, false)} aria-label="Rechazar solicitud" title="Rechazar" className="inline-flex size-9 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"><X size={17} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {grupoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="eliminar-grupo-titulo">
            <p className="text-sm font-semibold text-red-700">Acción permanente</p>
            <h2 id="eliminar-grupo-titulo" className="mt-1 text-xl font-bold text-slate-900">¿Eliminar “{grupoAEliminar.nombre}”?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Se quitarán el grupo, sus solicitudes y las membresías asociadas. Las cuentas de los socios no se borrarán. Si hay aportes, entregas, préstamos o movimientos, Supabase bloqueará la operación.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setGrupoAEliminar(null)} disabled={eliminando} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={confirmarEliminacion} disabled={eliminando} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">{eliminando ? "Eliminando..." : "Eliminar grupo"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

export default GroupAccessPanel;