import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, KeyRound, RotateCcw, Search, ShieldCheck, Trash2, UserRoundCog, X } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { cambiarEstadoUsuarioAdministrador, cambiarRolPerfil, eliminarUsuarioAdministrador, listarPerfilesAdministrador, solicitarRestablecimientoMfaAdministrador } from "../../services/adminService";

const ROLES = ["socio", "tesorero", "auditor", "administrador"];
const PAGE_SIZE = 50;

const formatDate = (value) => value
  ? new Date(value).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })
  : "No disponible";

const Usuarios = () => {
  const { notify } = useNotifications();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [changingStatusId, setChangingStatusId] = useState("");
  const [resettingMfaId, setResettingMfaId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("No completa el registro.");
  const [purgePrivateDataConfirmed, setPurgePrivateDataConfirmed] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const cargarPerfiles = useCallback(async (busqueda = "", desplazamiento = 0) => {
    setLoading(true);
    setError("");
    try {
      const rows = await listarPerfilesAdministrador(busqueda, PAGE_SIZE, desplazamiento);
      setProfiles(rows || []);
      setTotal(Number(rows?.[0]?.total_registros || 0));
      setOffset(desplazamiento);
      setActiveQuery(busqueda);
    } catch (loadError) {
      console.error("Error cargando socios y perfiles:", loadError);
      setError(loadError.message || "No se pudo cargar el listado de socios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => cargarPerfiles("", 0), 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarPerfiles]);

  const buscar = async (event) => {
    event.preventDefault();
    const term = query.trim();
    if (term && term.length < 2) {
      setError("Escribe al menos dos caracteres o deja la búsqueda vacía para ver todos los socios.");
      return;
    }
    await cargarPerfiles(term, 0);
  };

  const actualizarRol = async (profile, role) => {
    if (role === profile.rol) return;
    const confirmed = window.confirm(
      `¿Cambiar el rol de ${profile.nombre} ${profile.apellido || ""} a ${role}? Esta acción quedará registrada en la auditoría.`
    );
    if (!confirmed) return;

    setSavingId(profile.id);
    setError("");
    try {
      await cambiarRolPerfil(profile.id, role);
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, rol: role } : item));
      notify({ title: "Rol actualizado", message: `Se asignó el rol ${role}.`, type: "success" });
    } catch (roleError) {
      console.error("Error cambiando rol:", roleError);
      setError(roleError.message || "No se pudo actualizar el rol.");
      notify({ title: "No se pudo cambiar el rol", message: roleError.message || "Revisa la verificación documental.", type: "error" });
    } finally {
      setSavingId("");
    }
  };

  const cambiarEstado = async (profile) => {
    const active = !profile.activo;
    const fullName = `${profile.nombre} ${profile.apellido || ""}`.trim();
    const description = active
      ? `¿Reactivar la cuenta de ${fullName}? Podrá volver a iniciar sesión con los datos y registros conservados.`
      : `¿Desactivar la cuenta de ${fullName}? No podrá volver a iniciar sesión; sus documentos y registros se conservarán.`;
    if (!window.confirm(description)) return;

    setChangingStatusId(profile.id);
    setError("");
    try {
      await cambiarEstadoUsuarioAdministrador({ perfilId: profile.id, activo: active });
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, activo: active } : item));
      notify({
        title: active ? "Cuenta reactivada" : "Cuenta desactivada",
        message: active
          ? `Se reactivó la cuenta de ${fullName}.`
          : `Se bloqueó el acceso de ${fullName}; sus datos permanecen conservados.`,
        type: "success"
      });
    } catch (statusError) {
      console.error("Error cambiando el estado de la cuenta:", statusError);
      const message = statusError.message || "No se pudo cambiar el estado de la cuenta.";
      setError(message);
      notify({ title: "No se pudo cambiar el estado de la cuenta", message, type: "error" });
    } finally {
      setChangingStatusId("");
    }
  };

  const restablecerSegundoFactor = async (profile) => {
    if (!profile.correo || resettingMfaId) return;
    const fullName = `${profile.nombre} ${profile.apellido || ""}`.trim();
    const confirmed = window.confirm(
      `Confirma que verificaste la identidad de ${fullName} (${profile.correo}) por un canal confiable. Se eliminarán sus factores TOTP y se cerrarán las sesiones actuales; se enviará un correo para que inicie sesión y registre un QR nuevo.`
    );
    if (!confirmed) return;

    setResettingMfaId(profile.id);
    setError("");
    try {
      const result = await solicitarRestablecimientoMfaAdministrador(profile.id);
      if (result?.emailSent) {
        notify({
          title: result.partialReset
            ? "Restablecimiento parcial"
            : result.factorReset
              ? "Segundo factor restablecido"
              : "Instrucciones enviadas",
          message: result.factorReset
            ? result.partialReset
              ? `Se eliminó parte de los factores TOTP y se envió el correo a ${profile.correo}. Revisa el estado de la cuenta antes de continuar.`
              : `Se eliminó el factor TOTP y se envió el correo a ${profile.correo}.`
            : `La cuenta no tenía un factor TOTP activo. Se enviaron instrucciones a ${profile.correo}.`,
          type: result.partialReset ? "error" : "success"
        });
      } else if (result?.factorReset) {
        notify({
          title: result.partialReset ? "Restablecimiento parcial; correo pendiente" : "Factor restablecido; correo pendiente",
          message: `${result.partialReset ? "Se eliminó parte de los factores TOTP" : "Se eliminó el factor"}, pero no se pudo enviar el correo a ${profile.correo}. Puedes reintentar el envío desde este botón durante las próximas 24 horas o contactar a la persona por un canal verificado.`,
          type: "error"
        });
      } else {
        throw new Error("No se pudo completar el restablecimiento.");
      }
    } catch (resetError) {
      console.error("Error restableciendo segundo factor:", resetError);
      const message = resetError.message || "No se pudo restablecer el segundo factor.";
      setError(message);
      notify({ title: "No se pudo restablecer el segundo factor", message, type: "error" });
    } finally {
      setResettingMfaId("");
    }
  };

  const cerrarModalEliminacion = useCallback(() => {
    if (deletingId) return;
    setDeleteTarget(null);
    setDeleteReason("No completa el registro.");
    setPurgePrivateDataConfirmed(false);
  }, [deletingId]);

  useEffect(() => {
    if (!deleteTarget) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") cerrarModalEliminacion();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteTarget, cerrarModalEliminacion]);

  const eliminarUsuario = async (event) => {
    event.preventDefault();
    const motivo = deleteReason.trim();
    if (!deleteTarget || motivo.length < 10 || motivo.length > 500 || deletingId) return;
    if (deleteTarget.tiene_datos_privados && !purgePrivateDataConfirmed) return;

    setDeletingId(deleteTarget.id);
    setError("");
    try {
      const result = await eliminarUsuarioAdministrador({
        perfilId: deleteTarget.id,
        motivo,
        purgarDatosPersonales: purgePrivateDataConfirmed
      });
      const remainingProfiles = profiles.filter((profile) => profile.id !== deleteTarget.id);
      const remainingTotal = Math.max(total - 1, 0);
      setProfiles(remainingProfiles);
      setTotal(remainingTotal);
      setDeleteTarget(null);
      setDeleteReason("No completa el registro.");
      setPurgePrivateDataConfirmed(false);
      notify({
        title: result?.auditUpdated === false ? "Usuario eliminado; auditoría pendiente de actualizar" : "Usuario eliminado",
        message: result?.auditUpdated === false
          ? "La cuenta fue eliminada y el evento con el motivo quedó registrado. No se pudo actualizar el estado final del evento de auditoría."
          : `Se eliminó la cuenta de ${deleteTarget.nombre} ${deleteTarget.apellido || ""} y el motivo quedó registrado en auditoría.`,
        type: result?.auditUpdated === false ? "error" : "success"
      });
      if (remainingProfiles.length === 0 && offset > 0 && remainingTotal > 0) {
        await cargarPerfiles(activeQuery, Math.max(offset - PAGE_SIZE, 0));
      }
    } catch (deleteError) {
      console.error("Error eliminando cuenta de usuario:", deleteError);
      const message = deleteError.message || "No se pudo eliminar el usuario.";
      setError(message);
      notify({ title: "No se pudo eliminar el usuario", message, type: "error" });
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-emerald-700">Administración de acceso</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Socios y roles</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Listado de cuentas registradas, ordenadas desde la más reciente. Las cuentas nuevas ingresan como socios; el administrador principal puede asignarles un rol sin cargar el documento. Para los demás administradores, la verificación documental sigue siendo obligatoria. Los cambios y las eliminaciones con su motivo quedan auditados.</p>
      </header>

      <form onSubmit={buscar} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="perfil-query">Buscar socio por nombre, cédula, correo o teléfono</label>
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="perfil-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, cédula, correo o teléfono (opcional)" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
        </div>
        <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
          <Search size={17} /> {loading ? "Cargando..." : "Buscar"}
        </button>
      </form>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="px-5 py-9 text-center text-sm text-slate-500" role="status">Cargando socios registrados...</p>
        ) : profiles.length === 0 ? (
          <p className="px-5 py-9 text-center text-sm text-slate-500">{activeQuery ? "No se encontraron cuentas para esta búsqueda." : "Todavía no hay cuentas registradas."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1580px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Socio</th>
                  <th className="px-5 py-3 font-semibold">Correo</th>
                  <th className="px-5 py-3 font-semibold">Fecha de creación</th>
                  <th className="px-5 py-3 font-semibold">Teléfono</th>
                  <th className="px-5 py-3 font-semibold">Documento</th>
                  <th className="px-5 py-3 font-semibold">Dirección</th>
                  <th className="px-5 py-3 font-semibold">Nacimiento</th>
                  <th className="px-5 py-3 font-semibold">Verificación</th>
                  <th className="px-5 py-3 font-semibold">Rol</th>
                  <th className="px-5 py-3 font-semibold">Segundo factor</th>
                  <th className="px-5 py-3 font-semibold">Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{profile.nombre} {profile.apellido}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{profile.correo || "Sin correo"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{formatDate(profile.creado_en)}</td>
                    <td className="px-5 py-4 text-slate-700">{profile.telefono || "Sin teléfono"}</td>
                    <td className="px-5 py-4 text-slate-700">{profile.cedula || "No registrado"}</td>
                    <td className="max-w-xs px-5 py-4 text-slate-600">{profile.direccion || "No registrada"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{profile.fecha_nacimiento ? new Date(`${profile.fecha_nacimiento}T00:00:00`).toLocaleDateString("es-EC") : "No registrada"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 ${profile.documento_verificado ? "text-emerald-800" : "text-amber-800"}`}>
                        <ShieldCheck size={16} /> {profile.documento_verificado ? "Verificado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <label className="sr-only" htmlFor={`role-${profile.id}`}>Rol para {profile.nombre}</label>
                      <select id={`role-${profile.id}`} value={profile.rol} onChange={(event) => actualizarRol(profile, event.target.value)} disabled={!profile.activo || savingId === profile.id} className="rounded-lg border border-slate-300 bg-white px-3 py-2 capitalize disabled:opacity-60">
                        {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => restablecerSegundoFactor(profile)}
                        disabled={!profile.activo || !profile.correo || Boolean(resettingMfaId) || Boolean(changingStatusId)}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <KeyRound size={15} />
                        {resettingMfaId === profile.id ? "Procesando..." : "Restablecer MFA"}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-[160px] flex-col items-stretch gap-2">
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${profile.activo ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                          {profile.activo ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          {profile.activo ? "Cuenta activa" : "Cuenta inactiva"}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarEstado(profile)}
                          disabled={Boolean(deletingId) || Boolean(resettingMfaId) || Boolean(changingStatusId)}
                          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${profile.activo ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-500" : "border-emerald-300 bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-500"}`}
                        >
                          {profile.activo ? <Ban size={15} /> : <RotateCcw size={15} />}
                          {changingStatusId === profile.id
                            ? "Procesando..."
                            : profile.activo ? "Desactivar cuenta" : "Reactivar cuenta"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(profile)}
                          disabled={Boolean(deletingId) || Boolean(resettingMfaId) || Boolean(changingStatusId)}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          Eliminar usuario
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-600">
              Mostrando {offset + 1}–{Math.min(offset + profiles.length, total)} de {total} cuentas
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => cargarPerfiles(activeQuery, Math.max(offset - PAGE_SIZE, 0))} disabled={offset === 0 || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
                <ChevronLeft size={16} /> Anterior
              </button>
              <button type="button" onClick={() => cargarPerfiles(activeQuery, offset + PAGE_SIZE)} disabled={offset + profiles.length >= total || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><UserRoundCog size={16} className="mt-0.5 shrink-0" /> Cédula y dirección son datos restringidos: esta pantalla y la gestión de roles solo están habilitadas para administración.</p>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) cerrarModalEliminacion();
        }}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-description"
            onSubmit={eliminarUsuario}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-user-title" className="text-xl font-bold text-slate-900">Eliminar cuenta de usuario</h2>
                <p id="delete-user-description" className="mt-2 text-sm leading-6 text-slate-600">
                  Esta acción es permanente. Se eliminará la cuenta de <strong>{deleteTarget.nombre} {deleteTarget.apellido || ""}</strong>
                  {deleteTarget.correo ? <> ({deleteTarget.correo})</> : ""}. El motivo se guardará en auditoría.
                  {" "}No se podrá eliminar si existen registros operativos que deban conservarse.
                </p>
              </div>
              <button type="button" onClick={cerrarModalEliminacion} disabled={Boolean(deletingId)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                <X size={19} />
              </button>
            </div>
            <label htmlFor="delete-user-reason" className="mt-5 block text-sm font-semibold text-slate-800">Motivo de anulación</label>
            <textarea
              id="delete-user-reason"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              maxLength={500}
              minLength={10}
              required
              rows={4}
              disabled={Boolean(deletingId)}
              autoFocus
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">Ejemplo: “No completa el registro”. Escribe al menos 10 caracteres. El auditor podrá consultar este motivo.</p>
            {deleteTarget.tiene_datos_privados && (
              <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  checked={purgePrivateDataConfirmed}
                  onChange={(event) => setPurgePrivateDataConfirmed(event.target.checked)}
                  disabled={Boolean(deletingId)}
                  className="mt-1"
                />
                <span>
                  Confirmo que es una cuenta de prueba o existe autorización para eliminar sus datos personales.
                  Se purgarán los datos privados y el documento de identidad; la operación quedará auditada.
                </span>
              </label>
            )}
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={cerrarModalEliminacion} disabled={Boolean(deletingId)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={Boolean(deletingId) || deleteReason.trim().length < 10 || (deleteTarget.tiene_datos_privados && !purgePrivateDataConfirmed)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 size={16} />
                {deletingId === deleteTarget.id ? "Eliminando..." : "Confirmar eliminación"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
