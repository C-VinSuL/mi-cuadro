import { useCallback, useEffect, useState } from "react";
import { Download, FileDown, Printer, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { listarAuditoria } from "../../services/adminService";

const escapeCsv = (input) => {
  const value = String(input ?? "");
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

const Auditoria = () => {
  const { grupos } = useAuth();
  const [groupId, setGroupId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const until = toDate ? new Date(`${toDate}T00:00:00`).getTime() + 86400000 : null;
      const rows = await listarAuditoria(
        groupId,
        fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null,
        until ? new Date(until).toISOString() : null
      );
      setEvents(rows || []);
    } catch (loadError) {
      console.error("Error cargando registro de auditoría:", loadError);
      setError(loadError.message || "No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, [groupId, fromDate, toDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadEvents, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadEvents]);

  const exportCsv = () => {
    const headings = ["Fecha y hora", "Grupo", "Evento", "Actor", "Socio", "Dirección IP", "Agente de usuario", "Detalles"];
    const rows = events.map((event) => [
      event.ocurrido_en,
      event.grupo_nombre,
      event.evento,
      event.actor,
      event.objetivo,
      event.direccion_ip,
      event.agente_usuario,
      JSON.stringify(event.detalles || {})
    ]);
    const csv = `\uFEFF${[headings, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-flashmonkey-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <style>{`@media print { aside, header, button, select, input { display: none !important; } main { margin: 0 !important; padding: 0 !important; } .audit-print { display: block !important; } }`}</style>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={17} /> Control y trazabilidad</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Auditoría</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Registro de invitaciones, aceptación de términos de ingreso, aprobación de membresía, inicio de cuadros y cambios de roles. La IP solo queda disponible cuando la acción pasó por el servicio seguro de invitación.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={exportCsv} disabled={events.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={16} /> Exportar CSV</button>
          <button type="button" onClick={() => window.print()} disabled={events.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Printer size={16} /> Guardar PDF</button>
        </div>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); loadEvents(); }} className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm font-medium text-slate-700">
          Grupo
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="mt-1 block min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Todos</option>
            {grupos.map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Desde
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hasta
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <button disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><FileDown size={16} /> {loading ? "Consultando..." : "Aplicar filtros"}</button>
      </form>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      <section className="audit-print overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Registro de eventos</h2>
          <p className="mt-1 text-sm text-slate-500">{events.length} eventos · máximo 5.000 por consulta</p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando registro...</p>
        ) : events.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay eventos para estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                  <th className="px-4 py-3 font-semibold">Grupo</th>
                  <th className="px-4 py-3 font-semibold">Evento</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Socio</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(event.ocurrido_en).toLocaleString("es-EC")}</td>
                    <td className="px-4 py-3 text-slate-700">{event.grupo_nombre || "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{event.evento.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-700">{event.actor || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{event.objetivo || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{event.direccion_ip || "No disponible"}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-500">{JSON.stringify(event.detalles || {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-slate-500">La fecha y hora se conserva en UTC y se presenta en la zona horaria del dispositivo. La exportación puede incluir información personal; guárdala y compártela con acceso restringido.</p>
    </div>
  );
};

export default Auditoria;
