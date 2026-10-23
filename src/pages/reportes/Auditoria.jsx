import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileDown, Printer, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { listarAuditoria } from "../../services/adminService";

const EVENT_LABELS = {
  aporte_comprobante_aprobado: "Comprobante de aporte aprobado",
  aporte_comprobante_enviado: "Comprobante de aporte enviado",
  aporte_comprobante_rechazado: "Comprobante de aporte rechazado",
  aporte_cubierto_desde_billetera: "Aporte cubierto desde la billetera",
  aporte_socio_registrado: "Aporte registrado",
  configuracion_grupo_actualizada: "Configuración del grupo actualizada",
  desactivacion_usuario: "Cuenta desactivada",
  documento_personal_verificado: "Documento de identidad verificado",
  eliminacion_usuario: "Cuenta eliminada",
  gran_administrador_designado: "Administrador principal designado",
  grupo_creado: "Grupo creado",
  grupo_eliminado: "Grupo eliminado",
  grupo_iniciado: "Grupo iniciado",
  invitacion_grupo_aceptada: "Invitación al grupo aceptada",
  invitacion_grupo_enviada: "Invitación al grupo enviada",
  movimiento_billetera_aprobado: "Movimiento de billetera aprobado",
  movimiento_billetera_rechazado: "Movimiento de billetera rechazado",
  movimiento_fondo_conciliado: "Movimiento del fondo conciliado",
  pago_programado_vencido: "Pago programado cubierto",
  prestamo_aprobado: "Préstamo aprobado",
  prestamo_rechazado: "Préstamo rechazado",
  reactivacion_usuario: "Cuenta reactivada",
  rol_perfil_actualizado: "Rol actualizado",
  solicitud_grupo_rechazada: "Solicitud al grupo rechazada",
  solicitud_invitacion_creada: "Solicitud de invitación creada",
  socio_agregado_a_grupo: "Socio agregado al grupo"
};

const DETAIL_LABELS = {
  aceptada_en: "Fecha de aceptación",
  aprobado_por: "Aprobado por",
  aporte: "Aporte",
  aporte_id: "Identificador del aporte",
  asignacion_sin_documento: "Rol asignado sin documento verificado",
  capacidad: "Capacidad del grupo",
  comision: "Comisión",
  conciliacion_id: "Identificador de conciliación",
  correo: "Correo",
  documento_verificado: "Documento verificado",
  detalles: "Detalles",
  estado: "Estado",
  estado_anterior: "Estado anterior",
  estado_nuevo: "Estado nuevo",
  fecha: "Fecha",
  fecha_revision: "Fecha de revisión",
  garantia_utilizada: "Se utilizó la garantía",
  grupo_id_original: "Identificador original del grupo",
  grupo_nombre: "Nombre del grupo",
  integrantes: "Número de integrantes",
  ip: "Dirección IP",
  mensaje: "Mensaje",
  monto: "Monto",
  movimiento_id: "Identificador del movimiento",
  motivo: "Motivo",
  nota: "Nota",
  observacion: "Observación",
  periodicidad: "Periodicidad del aporte",
  periodo: "Periodo",
  referencia: "Referencia",
  resultado: "Resultado",
  rol_anterior: "Rol anterior",
  rol_nuevo: "Rol nuevo",
  solicitud_id: "Identificador de la solicitud",
  tipo: "Tipo",
  usuario_correo: "Correo de la cuenta",
  usuario_nombre: "Nombre de la cuenta",
  usuario_rol: "Rol de la cuenta",
  vencido_en: "Fecha de vencimiento"
};

const VALUE_LABELS = {
  administrador: "Administrador",
  auditor: "Auditor",
  aprobada: "Aprobada",
  aprobado: "Aprobado",
  aprobados: "Aprobados",
  desactivada: "Desactivada",
  eliminada: "Eliminada",
  false: "No",
  mensual: "Mensual",
  pendiente: "Pendiente",
  quincenal: "Quincenal",
  rechazada: "Rechazada",
  rechazado: "Rechazado",
  reactivada: "Reactivada",
  socio: "Socio",
  tesorero: "Tesorero",
  true: "Sí",
  verificado: "Verificado"
};

const formatLabel = (value) => String(value)
  .replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toLocaleUpperCase("es-EC"));

const formatEventName = (eventName) => EVENT_LABELS[eventName] || formatLabel(eventName);

const formatDetailValue = (key, value) => {
  if (value === null || value === undefined || value === "") return "No especificado";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") {
    if (["aporte", "monto", "comision"].includes(key)) {
      return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
    }
    return new Intl.NumberFormat("es-EC").format(value);
  }
  if (Array.isArray(value)) return value.map((item) => formatDetailValue(key, item)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([nestedKey, nestedValue]) =>
        `${DETAIL_LABELS[nestedKey] || formatLabel(nestedKey)}: ${formatDetailValue(nestedKey, nestedValue)}`
      )
      .join(" · ");
  }

  const stringValue = String(value);
  if (VALUE_LABELS[stringValue.toLowerCase()]) return VALUE_LABELS[stringValue.toLowerCase()];
  if (["aceptada_en", "fecha", "fecha_revision", "vencido_en"].includes(key)) {
    const date = new Date(stringValue);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("es-EC");
  }
  return stringValue;
};

const getAuditDetails = (details, eventName) => {
  const entries = details && typeof details === "object" && !Array.isArray(details)
    ? Object.entries(details)
    : [];
  const availableEntries = entries.filter(([, value]) => value !== null && value !== undefined && value !== "");

  if (availableEntries.length > 0 || eventName !== "documento_personal_verificado") {
    return availableEntries;
  }

  return [
    ["mensaje", "Se verificó el documento de identidad del socio. No se incluyen datos del documento."],
    ["estado_anterior", "pendiente"],
    ["estado_nuevo", "verificado"]
  ];
};

const Auditoria = () => {
  const { grupos } = useAuth();
  const [groupId, setGroupId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
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

  useEffect(() => {
    if (!selectedEvent) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedEvent]);

  const exportExcel = async () => {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FlashMonkey";
      workbook.created = new Date();
      workbook.subject = "Registro de auditoría";
      workbook.title = "Auditoría FlashMonkey";

      const worksheet = workbook.addWorksheet("Auditoría", {
        views: [{ state: "frozen", xSplit: 2, ySplit: 5 }],
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      worksheet.columns = [
        { header: "Fecha y hora", key: "date", width: 21 },
        { header: "Grupo", key: "group", width: 22 },
        { header: "Evento", key: "event", width: 34 },
        { header: "Realizado por", key: "actor", width: 25 },
        { header: "Socio afectado", key: "target", width: 25 },
        { header: "Dirección IP", key: "ip", width: 18 },
        { header: "Detalles", key: "details", width: 52 },
        { header: "Navegador y sistema", key: "userAgent", width: 38 }
      ];
      worksheet.mergeCells("A1:H1");
      worksheet.getCell("A1").value = "FLASHMONKEY  |  REGISTRO DE AUDITORÍA";
      worksheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 34;
      worksheet.mergeCells("A2:H2");
      worksheet.getCell("A2").value = `Generado el ${new Date().toLocaleString("es-EC")} · ${events.length} eventos`;
      worksheet.getCell("A2").font = { name: "Aptos", size: 10, italic: true, color: { argb: "FF475569" } };
      worksheet.getCell("A2").alignment = { horizontal: "center" };
      worksheet.mergeCells("A3:H3");
      worksheet.getCell("A3").value = `Filtros: ${groupId ? (grupos.find((group) => group.id === groupId)?.nombre || "Grupo seleccionado") : "Todos los grupos"} · Desde ${fromDate || "sin límite"} · Hasta ${toDate || "sin límite"}`;
      worksheet.getCell("A3").font = { name: "Aptos", size: 10, color: { argb: "FF475569" } };
      worksheet.getCell("A3").alignment = { horizontal: "center", wrapText: true };

      const headerRow = worksheet.getRow(5);
      headerRow.values = worksheet.columns.map((column) => column.header);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = { bottom: { style: "medium", color: { argb: "FFF2B544" } } };
      });

      events.forEach((event, index) => {
        const detailText = getAuditDetails(event.detalles, event.evento)
          .map(([key, value]) => `${DETAIL_LABELS[key] || formatLabel(key)}: ${formatDetailValue(key, value)}`)
          .join("\n") || "Sin detalles adicionales";
        const row = worksheet.addRow({
          date: new Date(event.ocurrido_en),
          group: event.grupo_nombre || "—",
          event: formatEventName(event.evento),
          actor: event.actor || "—",
          target: event.objetivo || "—",
          ip: event.direccion_ip || "No disponible",
          details: detailText,
          userAgent: event.agente_usuario || "No disponible"
        });
        row.getCell(1).numFmt = "dd/mm/yyyy hh:mm:ss";
        row.height = Math.max(
          32,
          Math.min(180, detailText.split("\n").reduce((lineCount, line) => lineCount + Math.ceil(line.length / 80), 0) * 15)
        );
        row.eachCell((cell) => {
          cell.font = { name: "Aptos", size: 10, color: { argb: "FF1E293B" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
          if (index % 2 === 1) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
          }
        });
      });
      worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 8 } };
      worksheet.pageSetup.printTitlesRow = "1:5";

      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `auditoria-flashmonkey-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      console.error("Error exportando auditoría a Excel:", exportError);
      setError("No se pudo generar el archivo Excel. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        .audit-print-report-row { display: none; }
        .audit-print-footer { display: none; }
        .audit-print-details { display: none; }
        @page { size: landscape; margin: 14mm 9mm 14mm; }
        @media print {
          body { background: #fff !important; color: #0f172a !important; font-family: Arial, sans-serif; }
          #root { width: 100% !important; min-height: 0 !important; }
          aside, header, button, select, input, form, nav, .print\\:hidden, .audit-screen-note, .audit-screen-title { display: none !important; }
          main { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          .audit-print-report-row { display: table-row !important; }
          .audit-print-branding { display: flex !important; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 12px !important; border: 0 !important; background: #fff !important; }
          .audit-print-brand { display: flex; align-items: center; gap: 12px; text-align: left; }
          .audit-print-brand img { width: 44px; height: 44px; object-fit: contain; }
          .audit-print-meta { text-align: right; font-size: 8pt; font-weight: normal; line-height: 1.45; }
          .audit-print-band { height: 5px; margin: 0 !important; background: linear-gradient(90deg, #065f46 0 72%, #10b981 72% 91%, #f2b544 91%); print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .audit-print { overflow: visible !important; border: 1px solid #cbd5e1 !important; border-radius: 8px !important; }
          .audit-print .overflow-x-auto { overflow: visible !important; max-width: none !important; }
          .audit-print > div:first-child { display: none !important; }
          .audit-print table { width: 100% !important; min-width: 0 !important; table-layout: fixed; border-collapse: collapse; font-size: 8pt !important; }
          .audit-print thead { display: table-header-group; background: #065f46 !important; color: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .audit-print th { color: white !important; font-size: 8pt !important; padding: 7px 6px !important; }
          .audit-print-report-row th { padding: 0 !important; background: white !important; }
          .audit-print-column-row th { background: #065f46 !important; }
          .audit-print td { padding: 6px !important; border-bottom: 1px solid #e2e8f0 !important; vertical-align: top; overflow-wrap: anywhere; }
          .audit-print tr { break-inside: avoid; page-break-inside: avoid; }
          .audit-print td:nth-child(1) { width: 12%; }
          .audit-print td:nth-child(2) { width: 10%; }
          .audit-print td:nth-child(3) { width: 18%; }
          .audit-print td:nth-child(4), .audit-print td:nth-child(5) { width: 14%; }
          .audit-print td:nth-child(6) { width: 10%; }
          .audit-print td:nth-child(7) { width: 22%; }
          .audit-print-details { display: block !important; font-size: 7pt; line-height: 1.35; }
          .audit-print-details p { margin: 0 0 2px; }
          .audit-print-details strong { color: #334155; }
          .audit-screen-note { display: none !important; }
          .audit-print-footer { display: flex !important; justify-content: space-between; border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 4px; color: #64748b; font-size: 8pt; }
        }
      `}</style>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={17} /> Control y trazabilidad</p>
          <h1 className="audit-screen-title mt-1 text-3xl font-bold text-slate-900">Auditoría</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Consulta las acciones realizadas en la plataforma. Cada evento muestra quién lo realizó, a quién afectó y sus detalles en un formato fácil de entender; el motivo de las eliminaciones también queda registrado.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={exportExcel} disabled={events.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={16} /> Exportar Excel</button>
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
                <tr className="audit-print-report-row">
                  <th colSpan={7}>
                    <div className="audit-print-branding">
                      <div className="audit-print-brand">
                        <img src="/flashmonkey-mascot.png" alt="FlashMonkey" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">FlashMonkey</p>
                          <p className="mt-1 text-lg font-bold text-slate-950">Reporte de auditoría</p>
                          <p className="text-xs text-slate-600">Control, trazabilidad y seguridad de la plataforma</p>
                        </div>
                      </div>
                      <div className="audit-print-meta text-slate-600">
                        <p className="font-semibold text-slate-800">{events.length} eventos registrados</p>
                        <p>Generado: {new Date().toLocaleString("es-EC")}</p>
                        <p>Grupo: {groupId ? (grupos.find((group) => group.id === groupId)?.nombre || "Seleccionado") : "Todos"}</p>
                        {(fromDate || toDate) && <p>Periodo: {fromDate || "Inicio"} — {toDate || "Actualidad"}</p>}
                      </div>
                    </div>
                    <div className="audit-print-band" />
                  </th>
                </tr>
                <tr className="audit-print-column-row">
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
                    <td className="px-4 py-3 font-medium text-slate-900">{formatEventName(event.evento)}</td>
                    <td className="px-4 py-3 text-slate-700">{event.actor || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{event.objetivo || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{event.direccion_ip || "No disponible"}</td>
                    <td className="px-4 py-3">
                      {getAuditDetails(event.detalles, event.evento).length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 print:hidden"
                          >
                            <Eye size={14} />
                            Ver detalles
                          </button>
                          <div className="audit-print-details">
                            {getAuditDetails(event.detalles, event.evento).map(([key, value]) => (
                              <p key={key}><strong>{DETAIL_LABELS[key] || formatLabel(key)}:</strong> {formatDetailValue(key, value)}</p>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">Sin detalles adicionales</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="audit-screen-note text-xs leading-5 text-slate-500">La fecha y hora se conserva en UTC y se presenta en la zona horaria del dispositivo. La exportación puede incluir información personal; guárdala y compártela con acceso restringido.</p>
      <div className="audit-print-footer">
        <span>FlashMonkey · Documento confidencial de auditoría</span>
        <span>Información para uso administrativo</span>
      </div>
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvent(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Detalle del registro</p>
                <h2 id="audit-detail-title" className="mt-1 text-xl font-bold text-slate-950">
                  {formatEventName(selectedEvent.evento)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(selectedEvent.ocurrido_en).toLocaleString("es-EC")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Cerrar detalles"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X size={20} />
              </button>
            </header>
            <div className="space-y-5 px-6 py-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Realizado por", selectedEvent.actor],
                  ["Afectado", selectedEvent.objetivo],
                  ["Grupo", selectedEvent.grupo_nombre],
                  ["Dirección IP", selectedEvent.direccion_ip]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || "No disponible"}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Información del evento</h3>
                {getAuditDetails(selectedEvent.detalles, selectedEvent.evento).length > 0 ? (
                  <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {getAuditDetails(selectedEvent.detalles, selectedEvent.evento).map(([key, value]) => (
                      <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_2fr] sm:gap-4">
                        <dt className="text-sm font-medium text-slate-600">{DETAIL_LABELS[key] || formatLabel(key)}</dt>
                        <dd className="break-words text-sm text-slate-900">{formatDetailValue(key, value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Este evento no contiene información adicional.</p>
                )}
              </div>
            </div>
            <footer className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
