import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, UserRoundCog } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { cambiarRolPerfil, listarPerfilesAdministrador } from "../../services/adminService";

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

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-emerald-700">Administración de acceso</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Socios y roles</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Listado de cuentas registradas, ordenadas desde la más reciente. Busca por nombre, cédula, correo o teléfono. Administración o tesorería debe verificar el documento antes de asignar un rol elevado; los cambios quedan auditados.</p>
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
            <table className="w-full min-w-[1250px] text-left text-sm">
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
                        <ShieldCheck size={16} /> {profile.documento_verificado ? "Verificado por tesorería" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <label className="sr-only" htmlFor={`role-${profile.id}`}>Rol para {profile.nombre}</label>
                      <select id={`role-${profile.id}`} value={profile.rol} onChange={(event) => actualizarRol(profile, event.target.value)} disabled={savingId === profile.id} className="rounded-lg border border-slate-300 bg-white px-3 py-2 capitalize disabled:opacity-60">
                        {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
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
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><UserRoundCog size={16} className="mt-0.5 shrink-0" /> Cédula y dirección son datos restringidos: esta pantalla solo está habilitada para administración.</p>
    </div>
  );
};

export default Usuarios;
