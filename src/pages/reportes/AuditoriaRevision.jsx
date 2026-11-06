import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Download,
  FileSearch,
  FileUp,
  RefreshCw,
  Save,
  ShieldCheck
} from "lucide-react";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  actualizarHallazgoAuditoria,
  agregarEvidenciaAuditoria,
  crearHallazgoAuditoria,
  guardarRevisionAuditoria,
  listarHallazgosAuditoria,
  listarMovimientosBilleteraAuditoria,
  listarResponsablesAuditoria,
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
const deadlineLabel = (value) => value ? dateLabel(value) : "Sin fecha";
const isOverdue = (date, status) => Boolean(
  date
  && status !== "completada"
  && status !== "cerrado"
  && date < dateValue(new Date())
);
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

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
  const { profile } = useAuth();
  const { can, rol } = usePermissions();
  const isAuditor = rol === "auditor";
  const [groups, setGroups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [findings, setFindings] = useState([]);
  const [responsables, setResponsables] = useState([]);
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
  const [reviewDraft, setReviewDraft] = useState({
    key: "",
    estado: "pendiente",
    notas: "",
    fechaLimite: "",
    responsableId: "",
    conclusion: ""
  });
  const [findingForm, setFindingForm] = useState({
    grupoId: "",
    revisionId: "",
    titulo: "",
    descripcion: "",
    evidencia: "",
    severidad: "media",
    estado: "abierto",
    fechaLimite: "",
    responsableId: ""
  });
  const [findingDrafts, setFindingDrafts] = useState({});
  const [responses, setResponses] = useState({});
  const [evidenceUploading, setEvidenceUploading] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState({});
  const walletRequest = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [groupRows, reviewRows, findingRows, responsibleRows] = await Promise.all([
        obtenerResumenAuditoriaGrupos(),
        listarRevisionesAuditoria(),
        listarHallazgosAuditoria(),
        listarResponsablesAuditoria()
      ]);
      setGroups(groupRows || []);
      setReviews(reviewRows || []);
      setFindings(findingRows || []);
      setResponsables(responsibleRows || []);
      setFindingDrafts(Object.fromEntries((findingRows || []).map((finding) => [
        finding.id,
        {
          estado: finding.estado,
          descripcion: finding.descripcion,
          evidencia: finding.evidencia,
          fechaLimite: finding.fecha_limite || "",
          revisionId: finding.revision_id || "",
          responsableId: responsibleRows?.some((person) => (
            person.perfil_id === finding.responsable_id
            && ["administrador", "tesorero"].includes(person.rol)
          ))
            ? finding.responsable_id
            : responsibleRows?.find((person) => ["administrador", "tesorero"].includes(person.rol))?.perfil_id || ""
        }
      ])));
      setFindingForm((current) => ({
        ...current,
        grupoId: current.grupoId || groupRows?.[0]?.grupo_id || "",
        revisionId: current.revisionId || "",
        responsableId: current.responsableId
          || responsibleRows?.find((person) => ["administrador", "tesorero"].includes(person.rol))?.perfil_id
          || ""
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
  const reviewDeadline = reviewDraft.key === reviewKey
    ? reviewDraft.fechaLimite
    : currentReview?.fecha_limite || "";
  const auditorResponsables = useMemo(() => {
    const auditors = responsables.filter((person) => person.rol === "auditor");
    if (
      profile?.rol?.toLowerCase() !== "auditor"
      || !profile.id
      || auditors.some((person) => person.perfil_id === profile.id)
    ) {
      return auditors;
    }

    return [
      ...auditors,
      {
        perfil_id: profile.id,
        nombre: [profile.nombre, profile.apellido].filter(Boolean).join(" ").trim() || "Auditor actual",
        rol: "auditor"
      }
    ];
  }, [responsables, profile]);
  const financeResponsables = responsables.filter((person) => ["administrador", "tesorero"].includes(person.rol));
  const reviewAssignee = reviewDraft.key === reviewKey
    ? reviewDraft.responsableId
    : auditorResponsables.some((person) => person.perfil_id === currentReview?.responsable_id)
      ? currentReview.responsable_id
      : "";
  const reviewConclusion = reviewDraft.key === reviewKey
    ? reviewDraft.conclusion
    : currentReview?.conclusion || "";
  const overdueReviewCount = reviews.filter((review) => isOverdue(review.fecha_limite, review.estado)).length;
  const overdueFindingCount = findings.filter((finding) => isOverdue(finding.fecha_limite, finding.estado)).length;
  const reviewsWithEvidence = reviews.filter((review) => (
    (!groupFilter || review.grupo_id === groupFilter)
    && (review.evidencias || []).length > 0
  ));

  const setReviewField = (field, value) => {
    setReviewDraft((current) => ({
      ...(current.key === reviewKey
        ? current
        : {
          key: reviewKey,
          estado: reviewStatus,
          notas: reviewNotes,
          fechaLimite: reviewDeadline,
          responsableId: reviewAssignee,
          conclusion: reviewConclusion
        }),
      [field]: value
    }));
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => !groupFilter || group.grupo_id === groupFilter);
  }, [groups, groupFilter]);

  const filteredFindings = useMemo(() => (
    findings.filter((finding) => !groupFilter || finding.grupo_id === groupFilter)
  ), [findings, groupFilter]);
  const findingReviews = reviews.filter((review) => review.grupo_id === findingForm.grupoId);
  const unassignedFindingCount = filteredFindings.filter((finding) => !finding.revision_id).length;

  const updateReview = async (event) => {
    event.preventDefault();
    if (!groupFilter || saving) return;
    if (reviewStatus === "completada" && reviewConclusion.trim().length < 3) {
      setError("Agrega una conclusión final de al menos 3 caracteres antes de completar la revisión.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await guardarRevisionAuditoria({
        grupoId: groupFilter,
        desde: period.from,
        hasta: period.to,
        estado: reviewStatus,
        notas: reviewNotes.trim(),
        fechaLimite: reviewDeadline,
        responsableId: reviewAssignee,
        conclusion: reviewConclusion.trim()
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
        evidencia: findingForm.evidencia.trim(),
        fechaLimite: findingForm.fechaLimite,
        responsableId: findingForm.responsableId
      });
      setFindingForm((current) => ({
        ...current,
        titulo: "",
        descripcion: "",
        evidencia: "",
        severidad: "media",
        estado: "abierto",
        fechaLimite: "",
        revisionId: "",
        responsableId: ""
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
        evidencia: draft.evidencia.trim(),
        fechaLimite: draft.fechaLimite,
        responsableId: draft.responsableId,
        revisionId: draft.revisionId
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

  const uploadAuditEvidence = async (targetType, targetId, file) => {
    if (!file) return;
    if (!EVIDENCE_TYPES.includes(file.type) || file.size > MAX_EVIDENCE_BYTES) {
      setError("Adjunta un PDF o una imagen PNG/JPEG de hasta 10 MB.");
      return;
    }

    const uploadKey = `${targetType}:${targetId}`;
    setEvidenceUploading(uploadKey);
    setError("");
    setNotice("");
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-140) || "evidencia";
    const path = `${targetType}/${targetId}/${crypto.randomUUID()}-${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("auditoria-evidencias")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      try {
        await agregarEvidenciaAuditoria({
          revisionId: targetType === "revision" ? targetId : null,
          hallazgoId: targetType === "hallazgo" ? targetId : null,
          ruta: path,
          nombreArchivo: file.name.trim().slice(0, 180) || safeName,
          tipoContenido: file.type,
          bytes: file.size
        });
      } catch (metadataError) {
        const { error: cleanupError } = await supabase.storage
          .from("auditoria-evidencias")
          .remove([path]);
        if (cleanupError) {
          logOperationalError("No se pudo limpiar un archivo de evidencia sin registrar:", cleanupError);
        }
        throw metadataError;
      }

      setNotice("Evidencia privada agregada al expediente.");
      await loadData();
    } catch (uploadError) {
      logOperationalError("Error adjuntando evidencia de auditoría:", uploadError);
      setError("No se pudo adjuntar la evidencia. Verifica tu conexión y vuelve a intentarlo.");
    } finally {
      setEvidenceUploading("");
    }
  };

  const prepareEvidenceLink = async (evidenceId, path) => {
    setError("");
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("auditoria-evidencias")
        .createSignedUrl(path, 120);
      if (signedUrlError) throw signedUrlError;
      setEvidenceLinks((current) => ({ ...current, [evidenceId]: data.signedUrl }));
    } catch (evidenceError) {
      logOperationalError("Error generando enlace para evidencia de auditoría:", evidenceError);
      setError("No se pudo preparar el acceso temporal a la evidencia.");
    }
  };

  const exportReviewReport = async () => {
    if (!currentReview || currentReview.estado !== "completada") return;
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FlashMonkey";
      workbook.created = new Date();
      workbook.subject = "Informe final de revisión";
      workbook.title = "Informe de revisión de auditoría";

      const overview = workbook.addWorksheet("Informe");
      overview.columns = [
        { header: "Campo", key: "field", width: 28 },
        { header: "Detalle", key: "value", width: 100 }
      ];
      overview.addRows([
        { field: "Grupo", value: currentReview.grupo_nombre },
        { field: "Período revisado", value: `${currentReview.periodo_desde} — ${currentReview.periodo_hasta}` },
        { field: "Estado", value: statusLabels[currentReview.estado] },
        { field: "Fecha límite", value: currentReview.fecha_limite || "No definida" },
        { field: "Responsable", value: currentReview.responsable_nombre || "No asignado" },
        { field: "Alcance y notas", value: currentReview.notas || "Sin notas" },
        { field: "Conclusión", value: currentReview.conclusion },
        { field: "Evidencia de la revisión", value: (currentReview.evidencias || []).map((item) => item.nombre_archivo).join("\n") || "Sin archivos adjuntos" },
        { field: "Alcance de hallazgos", value: "Solo incluye los hallazgos vinculados a esta revisión." },
        { field: "Completada", value: currentReview.completada_en ? new Date(currentReview.completada_en) : "—" },
        { field: "Generado", value: new Date() }
      ]);
      overview.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      overview.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      overview.getColumn(2).alignment = { vertical: "top", wrapText: true };
      overview.getColumn(1).font = { bold: true };
      overview.getRow(11).getCell(2).numFmt = "dd/mm/yyyy hh:mm";

      const reportFindings = findings.filter((finding) => finding.revision_id === currentReview.id);
      const findingsSheet = workbook.addWorksheet("Hallazgos de revisión");
      findingsSheet.columns = [
        { header: "Hallazgo", key: "title", width: 32 },
        { header: "Importancia", key: "severity", width: 14 },
        { header: "Estado", key: "status", width: 20 },
        { header: "Fecha límite", key: "due", width: 16 },
        { header: "Responsable", key: "owner", width: 26 },
        { header: "Observación", key: "description", width: 48 },
        { header: "Evidencia / referencia", key: "evidence", width: 38 },
        { header: "Archivos adjuntos", key: "files", width: 42 }
      ];
      reportFindings.forEach((finding) => findingsSheet.addRow({
        title: finding.titulo,
        severity: severityLabels[finding.severidad],
        status: statusLabels[finding.estado],
        due: finding.fecha_limite || "—",
        owner: finding.responsable_nombre || "No asignado",
        description: finding.descripcion,
        evidence: finding.evidencia || "—",
        files: (finding.evidencias || []).map((item) => item.nombre_archivo).join("\n") || "—"
      }));
      findingsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      findingsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
      findingsSheet.eachRow((row) => row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
      }));

      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `informe-auditoria-${currentReview.grupo_nombre.replace(/[^A-Za-z0-9-]/g, "-")}-${currentReview.periodo_hasta}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      logOperationalError("Error exportando el informe final de auditoría:", exportError);
      setError("No se pudo generar el informe final. Inténtalo nuevamente.");
    }
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
      {isAuditor && (overdueReviewCount + overdueFindingCount > 0) && (
        <section className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          <CalendarClock size={19} className="mt-0.5 shrink-0" />
          <p>
            <strong>Seguimientos vencidos:</strong> {overdueReviewCount} revisión{overdueReviewCount === 1 ? "" : "es"} y {overdueFindingCount} hallazgo{overdueFindingCount === 1 ? "" : "s"}
            {" "}en todos los grupos. Actualiza las fechas o el estado para mantener el plan al día.
          </p>
        </section>
      )}

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
                <select value={reviewStatus} onChange={(event) => setReviewField("estado", event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_revision">En revisión</option>
                  <option value="completada">Completada</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fecha límite
                <input type="date" value={reviewDeadline} onChange={(event) => setReviewField("fechaLimite", event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Auditor responsable
                <select required value={reviewAssignee} onChange={(event) => setReviewField("responsableId", event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Selecciona un auditor</option>
                  {auditorResponsables.map((person) => <option key={person.perfil_id} value={person.perfil_id}>{person.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Alcance y notas de auditoría
                <textarea maxLength={4000} rows={4} value={reviewNotes} onChange={(event) => setReviewField("notas", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Indica qué se revisó, documentación consultada y tareas pendientes." />
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Conclusión final
                <textarea maxLength={4000} rows={4} value={reviewConclusion} onChange={(event) => setReviewField("conclusion", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Obligatoria para marcar la revisión como completada." />
              </label>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <button type="submit" disabled={saving || !groupFilter || !period.from || !period.to || auditorResponsables.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                  <Save size={16} />
                  {saving ? "Guardando..." : currentReview ? "Actualizar revisión" : "Crear revisión"}
                </button>
                <button type="button" onClick={exportReviewReport} disabled={currentReview?.estado !== "completada"} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                  <Download size={16} /> Exportar informe final
                </button>
                {!groupFilter && <span className="ml-3 text-sm text-slate-500">Selecciona un grupo para registrar una revisión.</span>}
                {auditorResponsables.length === 0 && <span className="text-sm text-amber-800">No hay auditores activos disponibles para asignar.</span>}
              </div>
            </form>
            {currentReview && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Papeles de trabajo y evidencia</h3>
                    <p className="mt-1 text-xs text-slate-600">Archivos privados PDF, PNG o JPEG; máximo 10 MB por archivo.</p>
                  </div>
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                    <FileUp size={16} />
                    {evidenceUploading === `revision:${currentReview.id}` ? "Subiendo..." : "Adjuntar archivo"}
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      className="sr-only"
                      disabled={Boolean(evidenceUploading)}
                      onChange={(event) => {
                        const [file] = event.target.files || [];
                        uploadAuditEvidence("revision", currentReview.id, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {(currentReview.evidencias || []).length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Aún no hay archivos adjuntos a esta revisión.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {currentReview.evidencias.map((evidence) => (
                      <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="text-slate-700">{evidence.nombre_archivo}</span>
                        {evidenceLinks[evidence.id] ? (
                          <a href={evidenceLinks[evidence.id]} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">Abrir archivo</a>
                        ) : (
                          <button type="button" onClick={() => prepareEvidenceLink(evidence.id, evidence.ruta)} className="font-semibold text-emerald-800 underline">Preparar enlace temporal</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Revisiones registradas</h3>
              {reviews.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Aún no hay revisiones guardadas.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {reviews.filter((review) => !groupFilter || review.grupo_id === groupFilter).slice(0, 10).map((review) => (
                    <li key={review.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                      <span className="font-medium text-slate-800">{review.grupo_nombre} · {dateLabel(review.periodo_desde)} – {dateLabel(review.periodo_hasta)}</span>
                      <span className="text-slate-500">
                        {statusLabels[review.estado]} · responsable: {review.responsable_nombre || "Sin asignar"} · límite: {deadlineLabel(review.fecha_limite)}
                        {isOverdue(review.fecha_limite, review.estado) && <strong className="ml-2 text-amber-800">Vencida</strong>}
                      </span>
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
                <select required value={findingForm.grupoId} onChange={(event) => setFindingForm((current) => ({ ...current, grupoId: event.target.value, revisionId: "" }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Selecciona un grupo</option>
                  {groups.map((group) => <option key={group.grupo_id} value={group.grupo_id}>{group.grupo_nombre}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Revisión relacionada
                <select value={findingForm.revisionId} onChange={(event) => setFindingForm((current) => ({ ...current, revisionId: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Sin revisión asignada</option>
                  {findingReviews.map((review) => (
                    <option key={review.id} value={review.id}>
                      {dateLabel(review.periodo_desde)} – {dateLabel(review.periodo_hasta)} · {statusLabels[review.estado]}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">El informe final solo incluirá los hallazgos vinculados a su revisión.</span>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Importancia
                <select value={findingForm.severidad} onChange={(event) => setFindingForm((current) => ({ ...current, severidad: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fecha límite
                <input type="date" value={findingForm.fechaLimite} onChange={(event) => setFindingForm((current) => ({ ...current, fechaLimite: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Responsable de respuesta
                <select required value={findingForm.responsableId} onChange={(event) => setFindingForm((current) => ({ ...current, responsableId: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Selecciona administración o tesorería</option>
                  {financeResponsables.map((person) => <option key={person.perfil_id} value={person.perfil_id}>{person.nombre} · {person.rol}</option>)}
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
                <button type="submit" disabled={saving || groups.length === 0 || financeResponsables.length === 0} className="min-h-11 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">
                  {saving ? "Guardando..." : "Registrar hallazgo"}
                </button>
                {financeResponsables.length === 0 && <span className="ml-3 text-sm text-amber-800">No hay personal activo de administración o tesorería para asignar.</span>}
              </div>
            </form>
          </section>
        </>
      )}

      {!isAuditor && can("verSeguimientoAuditoria") && reviewsWithEvidence.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Evidencia de revisiones</h2>
          <p className="mt-1 text-sm text-slate-600">Archivos privados asociados a los planes de revisión.</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {reviewsWithEvidence.map((review) => (
              <li key={review.id} className="py-3">
                <p className="text-sm font-semibold text-slate-800">
                  {review.grupo_nombre} · {dateLabel(review.periodo_desde)} – {dateLabel(review.periodo_hasta)}
                </p>
                <ul className="mt-2 space-y-2">
                  {review.evidencias.map((evidence) => (
                    <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700">{evidence.nombre_archivo}</span>
                      {evidenceLinks[evidence.id] ? (
                        <a href={evidenceLinks[evidence.id]} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">Abrir archivo</a>
                      ) : (
                        <button type="button" onClick={() => prepareEvidenceLink(evidence.id, evidence.ruta)} className="font-semibold text-emerald-800 underline">Preparar enlace temporal</button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hallazgos y aclaraciones</h2>
          <p className="mt-1 text-sm text-slate-600">Las respuestas de administración o tesorería quedan adjuntas al hallazgo.</p>
          {isAuditor && unassignedFindingCount > 0 && (
            <p className="mt-1 text-sm text-amber-800">
              {unassignedFindingCount} hallazgo{unassignedFindingCount === 1 ? "" : "s"} sin revisión relacionada. Puedes asignarla desde el seguimiento.
            </p>
          )}
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
              evidencia: finding.evidencia,
              fechaLimite: finding.fecha_limite || "",
              responsableId: finding.responsable_id || "",
              revisionId: finding.revision_id || ""
            };
            const relatedReview = reviews.find((review) => review.id === finding.revision_id);
            const findingReviewChoices = reviews.filter((review) => review.grupo_id === finding.grupo_id);
            return (
              <article key={finding.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{finding.grupo_nombre} · {severityLabels[finding.severidad]}</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">{finding.titulo}</h3>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      Revisión relacionada: {relatedReview
                        ? `${dateLabel(relatedReview.periodo_desde)} – ${dateLabel(relatedReview.periodo_hasta)}`
                        : "Sin revisión asignada"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Registrado por {finding.creado_por_nombre} · {new Date(finding.creado_en).toLocaleString("es-EC")}
                      {" · Responsable: "}{finding.responsable_nombre || "Sin asignar"}
                      {" · Límite: "}{deadlineLabel(finding.fecha_limite)}
                      {isOverdue(finding.fecha_limite, finding.estado) && <strong className="ml-2 text-amber-800">Vencido</strong>}
                    </p>
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-medium text-slate-700 md:col-span-2">
                        Revisión relacionada
                        <select value={draft.revisionId} onChange={(event) => updateFindingDraft(finding.id, "revisionId", event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          <option value="">Sin revisión asignada</option>
                          {findingReviewChoices.map((review) => (
                            <option key={review.id} value={review.id}>
                              {dateLabel(review.periodo_desde)} – {dateLabel(review.periodo_hasta)} · {statusLabels[review.estado]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Fecha límite
                        <input type="date" value={draft.fechaLimite} onChange={(event) => updateFindingDraft(finding.id, "fechaLimite", event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2" />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Responsable de respuesta
                        <select required value={draft.responsableId} onChange={(event) => updateFindingDraft(finding.id, "responsableId", event.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                          <option value="">Selecciona personal activo</option>
                          {financeResponsables.map((person) => <option key={person.perfil_id} value={person.perfil_id}>{person.nombre} · {person.rol}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="text-sm font-medium text-slate-700">
                      Observación y seguimiento
                      <textarea maxLength={4000} rows={3} value={draft.descripcion} onChange={(event) => updateFindingDraft(finding.id, "descripcion", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Evidencia o referencia
                      <textarea maxLength={2000} rows={2} value={draft.evidencia} onChange={(event) => updateFindingDraft(finding.id, "evidencia", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <div>
                      <button type="button" onClick={() => saveFinding(finding.id)} disabled={saving || !draft.responsableId} className="min-h-10 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
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
                {can("verSeguimientoAuditoria") && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Evidencia adjunta</p>
                      {isAuditor && (
                        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
                          <FileUp size={14} />
                          {evidenceUploading === `hallazgo:${finding.id}` ? "Subiendo..." : "Adjuntar"}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            className="sr-only"
                            disabled={Boolean(evidenceUploading)}
                            onChange={(event) => {
                              const [file] = event.target.files || [];
                              uploadAuditEvidence("hallazgo", finding.id, file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {(finding.evidencias || []).length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">Sin archivos adjuntos.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {finding.evidencias.map((evidence) => (
                          <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                            <span className="text-slate-700">{evidence.nombre_archivo}</span>
                            {evidenceLinks[evidence.id] ? (
                              <a href={evidenceLinks[evidence.id]} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">Abrir archivo</a>
                            ) : (
                              <button type="button" onClick={() => prepareEvidenceLink(evidence.id, evidence.ruta)} className="font-semibold text-emerald-800 underline">Preparar enlace temporal</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
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
