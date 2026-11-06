import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Download,
  FileSearch,
  RefreshCw,
  Save,
  ShieldCheck
} from "lucide-react";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { supabase } from "../../services/supabase";
import { usePermissions } from "../../hooks/usePermissions";
import {
  actualizarHallazgoAuditoria,
  crearHallazgoAuditoria,
  guardarRevisionAuditoria,
  listarHallazgosAuditoria,
  listarMovimientosBilleteraAuditoria,
  listarRevisionesAuditoria,
  obtenerResumenAuditoriaGrupos,
  responderHallazgoAuditoria
} from "../../services/adminService";
import { logOperationalError } from "../../utils/logOperationalError";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const dateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const monthBounds = () => {
  const now = new Date();
  return {
    from: dateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
};
const dateLabel = (value) => value
  ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
    .toLocaleDateString("es-EC", { dateStyle: "medium" })
  : "Nunca";

const statusLabels = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  en_revision: "En revisión",
  completada: "Completada",
  abierto: "Abierto",
  aclaracion_solicitada: "Aclaración solicitada",
  en_seguimiento: "En seguimiento",
  cerrado: "Cerrado"
};
const severityLabels = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica"
};

const AuditoriaRevision = () => {
  const { can, rol } = usePermissions();
  const isAuditor = rol === "auditor";
  const [groups, setGroups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [findings, setFindings] = useState([]);
  const [walletMovements, setWalletMovements] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletHasMore, setWalletHasMore] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletReceipt, setWalletReceipt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [period, setPeriod] = useState(monthBounds);
  const [reviewDraft, setReviewDraft] = useState({ key: "", estado: "pendiente", notas: "" });
  const [findingForm, setFindingForm] = useState({
    grupoId: "",
    titulo: "",
    descripcion: "",
    evidencia: "",
    severidad: "media",
    estado: "abierto"
  });
  const [findingDrafts, setFindingDrafts] = useState({});
  const [responses, setResponses] = useState({});
  const walletRequest = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRows, reviewRows, findingRows] = await Promise.all([
        obtenerResumenAuditoriaGrupos(),
        listarRevisionesAuditoria(),
        listarHallazgosAuditoria()
      ]);
      setGroups(groupRows || []);
      setReviews(reviewRows || []);
      setFindings(findingRows || []);
      setFindingDrafts(Object.fromEntries((findingRows || []).map((finding) => [
        finding.id,
        {
          estado: finding.estado,
          descripcion: finding.descripcion,
          evidencia: finding.evidencia
        }
      ])));
      setFindingForm((current) => ({
        ...current,
        grupoId: current.grupoId || groupRows?.[0]?.grupo_id || ""
      }));
    } catch (loadError) {
      logOperationalError("Error cargando herramientas de auditoría:", loadError);
      setError("No se pudieron cargar los datos de revisión. Verifica tu conexión e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const loadWalletMovements = useCallback(async (append = false, offset = 0) => {
    const requestId = walletRequest.current + 1;
    walletRequest.current = requestId;
    setWalletLoading(true);
    setWalletError("");
    if (!append) {
      setWalletMovements([]);
      setWalletReceipt("");
    }
    try {
      const rows = await listarMovimientosBilleteraAuditoria(
        groupFilter || null,
        100,
        append ? offset : 0
      );
      if (requestId !== walletRequest.current) return;
      setWalletMovements((current) => append ? [...current, ...(rows || [])] : (rows || []));
      setWalletHasMore((rows || []).length === 100);
    } catch (loadError) {
      if (requestId !== walletRequest.current) return;
      logOperationalError("Error cargando movimientos de billetera para auditoría:", loadError);
      setWalletError("No se pudieron cargar los movimientos de billetera.");
    } finally {
      if (requestId === walletRequest.current) setWalletLoading(false);
    }
  }, [groupFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => loadWalletMovements(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWalletMovements]);

  const currentReview = useMemo(() => reviews.find((review) => (
    review.grupo_id === groupFilter
    && review.periodo_desde === period.from
    && review.periodo_hasta === period.to
  )), [reviews, groupFilter, period.from, period.to]);

  const reviewKey = `${groupFilter}:${period.from}:${period.to}`;
  const reviewStatus = reviewDraft.key === reviewKey
    ? reviewDraft.estado
    : currentReview?.estado || "pendiente";
  const reviewNotes = reviewDraft.key === reviewKey
    ? reviewDraft.notas
    : currentReview?.notas || "";

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => !groupFilter || group.grupo_id === groupFilter);
  }, [groups, groupFilter]);

  const filteredFindings = useMemo(() => (
    findings.filter((finding) => !groupFilter || finding.grupo_id === groupFilter)
  ), [findings, groupFilter]);

  const updateReview = async (event) => {
    event.preventDefault();
    if (!groupFilter || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await guardarRevisionAuditoria({
        grupoId: groupFilter,
        desde: period.from,
        hasta: period.to,
        estado: reviewStatus,
        notas: reviewNotes.trim()
      });
      setNotice("Plan de revisión guardado.");
      await loadData();
    } catch (saveError) {
      logOperationalError("Error guardando el plan de auditoría:", saveError);
      setError("No se pudo guardar el plan. Revisa el período e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const createFinding = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await crearHallazgoAuditoria({
        ...findingForm,
        titulo: findingForm.titulo.trim(),
        descripcion: findingForm.descripcion.trim(),
        evidencia: findingForm.evidencia.trim()
      });
      setFindingForm((current) => ({
        ...current,
        titulo: "",
        descripcion: "",
        evidencia: "",
        severidad: "media",
        estado: "abierto"
      }));
      setNotice("Hallazgo registrado con trazabilidad.");
      await loadData();
    } catch (createError) {
      logOperationalError("Error registrando hallazgo de auditoría:", createError);
      setError("No se pudo registrar el hallazgo. Revisa los campos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const saveFinding = async (findingId) => {
    const draft = findingDrafts[findingId];
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await actualizarHallazgoAuditoria({
        hallazgoId: findingId,
        estado: draft.estado,
        descripcion: draft.descripcion.trim(),
        evidencia: draft.evidencia.trim()
      });
      setNotice("Seguimiento del hallazgo actualizado.");
      await loadData();
    } catch (saveError) {
      logOperationalError("Error actualizando hallazgo de auditoría:", saveError);
      setError("No se pudo actualizar el seguimiento.");
    } finally {
      setSaving(false);
    }
  };

  const answerFinding = async (findingId) => {
    const response = responses[findingId]?.trim() || "";
    if (!response || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await responderHallazgoAuditoria(findingId, response);
      setResponses((current) => ({ ...current, [findingId]: "" }));
      setNotice("Respuesta agregada al expediente del hallazgo.");
      await loadData();
    } catch (answerError) {
      logOperationalError("Error respondiendo hallazgo de auditoría:", answerError);
      setError("No se pudo guardar la respuesta.");
    } finally {
      setSaving(false);
    }
  };

  const updateFindingDraft = (findingId, key, value) => {
    setFindingDrafts((current) => ({
      ...current,
      [findingId]: { ...current[findingId], [key]: value }
    }));
  };

  const openWalletReceipt = async (path) => {
    setWalletReceipt("");
    setWalletError("");
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("wallet-receipts")
        .createSignedUrl(path, 120);
      if (signedUrlError) throw signedUrlError;
      setWalletReceipt(data.signedUrl);
    } catch (receiptError) {
      logOperationalError("Error generando enlace temporal para comprobante de billetera:", receiptError);
      setWalletError("No se pudo abrir el comprobante de billetera.");
    }
  };

  const exportGroupSummary = async () => {
    if (filteredGroups.length === 0) return;
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FlashMonkey";
      workbook.created = new Date();
      workbook.subject = "Resumen global de auditoría";
      const worksheet = workbook.addWorksheet("Resumen por grupo", {
        views: [{ state: "frozen", ySplit: 2 }]
      });
      worksheet.columns = [
        { header: "Grupo", key: "group", width: 26 },
        { header: "Estado", key: "status", width: 18 },
        { header: "Socios", key: "members", width: 12 },
        { header: "Aportes aprobados", key: "paid", width: 18 },
        { header: "Comprobantes pendientes", key: "pending", width: 23 },
        { header: "Total aportes (USD)", key: "contributions", width: 20 },
        { header: "Total egresos (USD)", key: "expenses", width: 20 },
        { header: "Saldo del fondo (USD)", key: "fund", width: 22 },
        { header: "Billetera neta (USD)", key: "wallet", width: 22 },
        { header: "Última revisión", key: "review", width: 22 },
        { header: "Hallazgos abiertos", key: "findings", width: 19 }
      ];
      filteredGroups.forEach((group) => worksheet.addRow({
        group: group.grupo_nombre,
        status: group.grupo_estado,
        members: Number(group.participantes || 0),
        paid: Number(group.aportes_pagados || 0),
        pending: Number(group.comprobantes_pendientes || 0),
        contributions: Number(group.aportes_total || 0),
        expenses: Number(group.egresos_total || 0),
        fund: Number(group.saldo_fondo || 0),
        wallet: Number(group.movimientos_billetera || 0),
        review: group.ultima_revision ? new Date(group.ultima_revision) : "Nunca",
        findings: Number(group.hallazgos_abiertos || 0)
      }));
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      for (const column of [6, 7, 8, 9]) worksheet.getColumn(column).numFmt = '"$"#,##0.00';
      worksheet.getColumn(10).numFmt = "dd/mm/yyyy hh:mm";
      worksheet.eachRow((row) => row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
      }));
      worksheet.insertRow(1, [`Generado ${new Date().toLocaleString("es-EC")} · Alcance: ${groupFilter ? "grupo seleccionado" : "todos los grupos"}`]);
      worksheet.mergeCells("A1:K1");
      worksheet.getRow(1).font = { italic: true, color: { argb: "FF475569" } };
      worksheet.getRow(1).alignment = { horizontal: "center" };
      worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 11 } };

      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resumen-auditoria-grupos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      logOperationalError("Error exportando el resumen de auditoría:", exportError);
      setError("No se pudo generar el informe de grupos. Inténtalo nuevamente.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionPageTitle
        icon={ClipboardCheck}
        eyebrow="Control independiente"
        title="Revisión de grupos"
        description="Consulta indicadores financieros de todos los grupos, planifica revisiones y da seguimiento a hallazgos."
      />

      {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-medium text-slate-700">
          Grupo
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="mt-1 block min-w-56 rounded-lg border border-slate-300 bg-white px-3 py-2.5"
          >
            <option value="">Todos los grupos</option>
            {groups.map((group) => <option key={group.grupo_id} value={group.grupo_id}>{group.grupo_nombre}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            loadData();
            loadWalletMovements(false);
          }}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar datos
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSearch size={18} className="text-emerald-700" />
            <div>
              <h2 className="font-semibold text-slate-900">Panorama de todos los grupos</h2>
              <p className="text-sm text-slate-500">Indicadores de consulta; las cifras no sustituyen una conciliación formal.</p>
            </div>
          </div>
          <button type="button" onClick={exportGroupSummary} disabled={filteredGroups.length === 0} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download size={15} />
            Exportar resumen
          </button>
        </div>
        {loading ? (
          <p role="status" className="px-5 py-8 text-sm text-slate-500">Cargando indicadores...</p>
        ) : filteredGroups.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay grupos disponibles para revisar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Socios</th>
                  <th className="px-4 py-3">Aportes aprobados</th>
                  <th className="px-4 py-3">Comprobantes pendientes</th>
                  <th className="px-4 py-3">Aportes</th>
                  <th className="px-4 py-3">Egresos</th>
                  <th className="px-4 py-3">Saldo del fondo</th>
                  <th className="px-4 py-3">Billetera neta*</th>
                  <th className="px-4 py-3">Última revisión</th>
                  <th className="px-4 py-3">Hallazgos abiertos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => (
                  <tr key={group.grupo_id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{group.grupo_nombre}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{String(group.grupo_estado || "—").replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">{group.participantes}</td>
                    <td className="px-4 py-3">{group.aportes_pagados}</td>
                    <td className="px-4 py-3">
                      {Number(group.comprobantes_pendientes) > 0
                        ? <span className="font-semibold text-amber-700">{group.comprobantes_pendientes}</span>
                        : group.comprobantes_pendientes}
                    </td>
                    <td className="px-4 py-3">{currency.format(Number(group.aportes_total || 0))}</td>
                    <td className="px-4 py-3">{currency.format(Number(group.egresos_total || 0))}</td>
                    <td className="px-4 py-3">{currency.format(Number(group.saldo_fondo || 0))}</td>
                    <td className="px-4 py-3">{currency.format(Number(group.movimientos_billetera || 0))}</td>
                    <td className="px-4 py-3">{dateLabel(group.ultima_revision)}</td>
                    <td className="px-4 py-3">
                      {Number(group.hallazgos_abiertos) > 0
                        ? <span className="inline-flex items-center gap-1 font-semibold text-amber-800"><AlertTriangle size={14} />{group.hallazgos_abiertos}</span>
                        : group.hallazgos_abiertos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-slate-200 px-5 py-3 text-xs leading-5 text-slate-500">
          * Movimiento neto de billetera asociado al grupo. Los registros huérfanos o sin grupo no se incluyen. Préstamos no se presentan porque la función de préstamos está deshabilitada en el proyecto.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Movimientos de billetera</h2>
          <p className="mt-1 text-sm text-slate-500">Vista global o filtrada por grupo; se muestran los datos necesarios para comprobar tipo, monto, socio y respaldo.</p>
        </div>
        {walletError && <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">{walletError}</p>}
        {walletLoading && walletMovements.length === 0 ? (
          <p role="status" className="px-5 py-8 text-sm text-slate-500">Cargando movimientos...</p>
        ) : walletMovements.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay movimientos de billetera en este alcance.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Monto neto</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Estado / respaldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {walletMovements.map((movement) => (
                  <tr key={movement.movimiento_id}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(movement.creado_en).toLocaleString("es-EC")}</td>
                    <td className="px-4 py-3">{movement.grupo_nombre || "Sin grupo asociado"}</td>
                    <td className="px-4 py-3">{movement.socio}</td>
                    <td className="px-4 py-3 capitalize">{String(movement.tipo).replaceAll("_", " ")}</td>
                    <td className={`px-4 py-3 font-medium ${Number(movement.delta) < 0 ? "text-rose-700" : "text-emerald-800"}`}>
                      {currency.format(Number(movement.delta || 0))}
                    </td>
                    <td className="px-4 py-3">{movement.periodo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span>{statusLabels[movement.estado_solicitud] || movement.estado_solicitud || "Movimiento interno"}</span>
                      {movement.comprobante_path && (
                        <button
                          type="button"
                          onClick={() => openWalletReceipt(movement.comprobante_path)}
                          className="ml-2 font-semibold text-emerald-800 underline"
                        >
                          Comprobante
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {walletReceipt && (
          <div className="border-t border-slate-200 px-5 py-3">
            <a href={walletReceipt} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-800 underline">
              Abrir comprobante (enlace válido por 2 minutos)
            </a>
          </div>
        )}
        {walletHasMore && (
          <div className="border-t border-slate-200 px-5 py-3">
            <button type="button" onClick={() => loadWalletMovements(true, walletMovements.length)} disabled={walletLoading} className="text-sm font-semibold text-emerald-800 hover:underline disabled:opacity-50">
              {walletLoading ? "Cargando..." : "Cargar siguientes 100"}
            </button>
          </div>
        )}
      </section>

      {isAuditor && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <ShieldCheck size={19} className="text-emerald-700" />
              Plan de revisión por grupo y período
            </h2>
            <p className="mt-1 text-sm text-slate-600">Guarda el alcance, avance y notas de cada revisión. Completar una revisión actualiza la fecha de última revisión del grupo.</p>
            <form onSubmit={updateReview} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Período desde
                <input type="date" required value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Período hasta
                <input type="date" required value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Estado de la revisión
                <select value={reviewStatus} onChange={(event) => setReviewDraft({ key: reviewKey, estado: event.target.value, notas: reviewNotes })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_revision">En revisión</option>
                  <option value="completada">Completada</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Alcance y notas de auditoría
                <textarea maxLength={4000} rows={4} value={reviewNotes} onChange={(event) => setReviewDraft({ key: reviewKey, estado: reviewStatus, notas: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Indica qué se revisó, documentación consultada y tareas pendientes." />
              </label>
              <div className="md:col-span-2">
                <button type="submit" disabled={saving || !groupFilter || !period.from || !period.to} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                  <Save size={16} />
                  {saving ? "Guardando..." : currentReview ? "Actualizar revisión" : "Crear revisión"}
                </button>
                {!groupFilter && <span className="ml-3 text-sm text-slate-500">Selecciona un grupo para registrar una revisión.</span>}
              </div>
            </form>
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Revisiones registradas</h3>
              {reviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Aún no hay revisiones guardadas.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {reviews.filter((review) => !groupFilter || review.grupo_id === groupFilter).slice(0, 10).map((review) => (
                    <li key={review.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <span className="font-medium text-slate-800">{review.grupo_nombre} · {dateLabel(review.periodo_desde)} – {dateLabel(review.periodo_hasta)}</span>
                      <span className="text-slate-500">{statusLabels[review.estado]} · actualizado {dateLabel(review.actualizada_en)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Registrar un hallazgo</h2>
            <p className="mt-1 text-sm text-slate-600">Los hallazgos son observaciones que requieren seguimiento; no constituyen por sí solos una conclusión de irregularidad.</p>
            <form onSubmit={createFinding} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Grupo
                <select required value={findingForm.grupoId} onChange={(event) => setFindingForm((current) => ({ ...current, grupoId: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Selecciona un grupo</option>
                  {groups.map((group) => <option key={group.grupo_id} value={group.grupo_id}>{group.grupo_nombre}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Importancia
                <select value={findingForm.severidad} onChange={(event) => setFindingForm((current) => ({ ...current, severidad: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Título
                <input required minLength={3} maxLength={160} value={findingForm.titulo} onChange={(event) => setFindingForm((current) => ({ ...current, titulo: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Observación
                <textarea required minLength={3} maxLength={4000} rows={3} value={findingForm.descripcion} onChange={(event) => setFindingForm((current) => ({ ...current, descripcion: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Evidencia o referencia (no incluyas datos personales innecesarios)
                <textarea maxLength={2000} rows={2} value={findingForm.evidencia} onChange={(event) => setFindingForm((current) => ({ ...current, evidencia: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <div className="md:col-span-2">
                <button type="submit" disabled={saving || groups.length === 0} className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                  {saving ? "Guardando..." : "Registrar hallazgo"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hallazgos y aclaraciones</h2>
          <p className="mt-1 text-sm text-slate-600">Las respuestas de administración o tesorería quedan adjuntas al hallazgo.</p>
        </div>
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">Cargando hallazgos...</p>
        ) : filteredFindings.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">No hay hallazgos en este alcance.</p>
        ) : (
          filteredFindings.map((finding) => {
            const draft = findingDrafts[finding.id] || {
              estado: finding.estado,
              descripcion: finding.descripcion,
              evidencia: finding.evidencia
            };
            return (
              <article key={finding.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{finding.grupo_nombre} · {severityLabels[finding.severidad]}</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">{finding.titulo}</h3>
                    <p className="mt-1 text-xs text-slate-500">Registrado por {finding.creado_por_nombre} · {new Date(finding.creado_en).toLocaleString("es-EC")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusLabels[finding.estado]}</span>
                </div>
                {isAuditor ? (
                  <div className="mt-4 grid gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      Estado
                      <select value={draft.estado} onChange={(event) => updateFindingDraft(finding.id, "estado", event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        {["abierto", "aclaracion_solicitada", "en_seguimiento", "cerrado"].map((state) => <option key={state} value={state}>{statusLabels[state]}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Observación y seguimiento
                      <textarea maxLength={4000} rows={3} value={draft.descripcion} onChange={(event) => updateFindingDraft(finding.id, "descripcion", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Evidencia o referencia
                      <textarea maxLength={2000} rows={2} value={draft.evidencia} onChange={(event) => updateFindingDraft(finding.id, "evidencia", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <div>
                      <button type="button" onClick={() => saveFinding(finding.id)} disabled={saving} className="min-h-10 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                        Guardar seguimiento
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p>{finding.descripcion}</p>
                    {finding.evidencia && <p className="text-slate-500">Evidencia: {finding.evidencia}</p>}
                  </div>
                )}
                {((finding.respuestas || []).length > 0 || finding.respuesta) && (
                  <div className="mt-4 space-y-3">
                    {(finding.respuestas || []).length > 0
                      ? finding.respuestas.map((answer, index) => (
                        <div key={`${finding.id}-reply-${index}`} className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Respuesta de administración / tesorería · {answer.autor}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-sky-950">{answer.respuesta}</p>
                          <p className="mt-2 text-xs text-sky-800">{new Date(answer.creada_en).toLocaleString("es-EC")}</p>
                        </div>
                      ))
                      : (
                        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Respuesta de administración / tesorería</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-sky-950">{finding.respuesta}</p>
                          {finding.respondido_en && <p className="mt-2 text-xs text-sky-800">Respondido: {new Date(finding.respondido_en).toLocaleString("es-EC")}</p>}
                        </div>
                      )}
                  </div>
                )}
                {!isAuditor && can("verSeguimientoAuditoria") && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      maxLength={4000}
                      value={responses[finding.id] || ""}
                      onChange={(event) => setResponses((current) => ({ ...current, [finding.id]: event.target.value }))}
                      placeholder="Escribe una respuesta o aclaración"
                      className="min-h-10 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={() => answerFinding(finding.id)} disabled={saving || !(responses[finding.id] || "").trim()} className="min-h-10 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50">
                      Responder
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default AuditoriaRevision;
