import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileUp, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  agregarEvidenciaEntregaAuditoria,
  listarEgresosControlAuditoria,
  listarEntregasRondaAuditoria,
  listarPrestamosControlAuditoria,
  listarResumenControlFinancieroAuditoria
} from "../../services/adminService";
import { supabase } from "../../services/supabase";
import { logOperationalError } from "../../utils/logOperationalError";
import { createUniqueId } from "../../utils/uniqueId";
import { getStorageUploadErrorMessage, getSupportedDocumentMimeType } from "../../utils/fileUpload";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const evidenceTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const dateLabel = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("es-EC")
  : "Sin fecha";

const Metric = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 font-semibold text-slate-900">{value}</p>
  </div>
);

const AuditoriaControlFinanciero = ({ grupoId, desde, hasta }) => {
  const { profile } = useAuth();
  const isAuditor = profile?.rol?.toLowerCase() === "auditor";
  const [summary, setSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingEvidence, setSavingEvidence] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRows, expenseRows, deliveryRows, loanRows] = await Promise.all([
        listarResumenControlFinancieroAuditoria(grupoId, desde, hasta),
        listarEgresosControlAuditoria(grupoId, desde, hasta),
        listarEntregasRondaAuditoria(grupoId, desde, hasta),
        listarPrestamosControlAuditoria(grupoId, desde, hasta)
      ]);
      setSummary(summaryRows || []);
      setExpenses(expenseRows || []);
      setDeliveries(deliveryRows || []);
      setLoans(loanRows || []);
    } catch (loadError) {
      logOperationalError("Error cargando el control financiero de auditoría:", loadError);
      setError("No se pudo cargar el control financiero. Actualiza los datos e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [desde, grupoId, hasta]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const openEvidence = async (path) => {
    const evidenceWindow = window.open("about:blank", "_blank");
    if (!evidenceWindow) {
      setError("Permite las ventanas emergentes para abrir la evidencia.");
      return;
    }
    evidenceWindow.opener = null;
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("auditoria-evidencias")
        .createSignedUrl(path, 120);
      if (signedUrlError) throw signedUrlError;
      evidenceWindow.location.href = data.signedUrl;
    } catch (openError) {
      evidenceWindow.close();
      logOperationalError("Error abriendo evidencia de entrega:", openError);
      setError("No se pudo abrir la evidencia privada.");
    }
  };

  const openExpenseReceipt = async (path) => {
    const receiptWindow = window.open("about:blank", "_blank");
    if (!receiptWindow) {
      setError("Permite las ventanas emergentes para abrir el comprobante.");
      return;
    }
    receiptWindow.opener = null;
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("expense-receipts")
        .createSignedUrl(path, 120);
      if (signedUrlError) throw signedUrlError;
      receiptWindow.location.href = data.signedUrl;
    } catch (openError) {
      receiptWindow.close();
      logOperationalError("Error abriendo comprobante de egreso:", openError);
      setError("No se pudo abrir el comprobante privado del egreso.");
    }
  };

  const uploadEvidence = async (delivery, file) => {
    if (!file || savingEvidence) return;
    const mimeType = getSupportedDocumentMimeType(file, evidenceTypes);
    if (!mimeType || file.size > 10 * 1024 * 1024) {
      setError("Adjunta evidencia PDF, JPG o PNG de hasta 10 MB.");
      return;
    }

    const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1];
    const path = `entrega/${delivery.entrega_id}/${createUniqueId()}.${extension}`;
    setSavingEvidence(delivery.entrega_id);
    setError("");
    try {
      const { error: uploadError } = await supabase.storage
        .from("auditoria-evidencias")
        .upload(path, file, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      try {
        await agregarEvidenciaEntregaAuditoria({
          entregaId: delivery.entrega_id,
          ruta: path,
          nombreArchivo: file.name,
          tipoContenido: mimeType,
          bytes: file.size
        });
      } catch (registerError) {
        const { error: cleanupError } = await supabase.storage.from("auditoria-evidencias").remove([path]);
        if (cleanupError) {
          logOperationalError("No se pudo limpiar evidencia no registrada de entrega:", cleanupError);
        }
        throw registerError;
      }

      await loadData();
    } catch (uploadError) {
      logOperationalError("Error adjuntando evidencia a entrega del cuadro:", uploadError);
      setError(uploadError?.status || uploadError?.statusCode
        ? getStorageUploadErrorMessage(uploadError, "PDF, JPG o PNG")
        : "No se pudo guardar la evidencia de la entrega.");
    } finally {
      setSavingEvidence("");
    }
  };

  const unresolvedExpenseBackups = summary.reduce(
    (total, row) => total + Math.max(Number(row.cantidad_egresos || 0) - Number(row.egresos_con_comprobante || 0), 0),
    0
  );
  const overdueInstallments = loans.reduce((total, loan) => total + Number(loan.cuotas_vencidas || 0), 0);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cruces financieros del período</h2>
            <p className="mt-1 text-sm text-slate-600">
              Compara los registros del mismo grupo y período. Las diferencias son señales para investigar, no una conclusión automática de error.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Período: {dateLabel(desde)} – {dateLabel(hasta)} · Aportes, egresos y movimientos del fondo son registros independientes; sus diferencias requieren revisión y no implican por sí solas un descuadre. Los movimientos de billetera se muestran aparte porque son saldos personales.
            </p>
          </div>
          <button type="button" onClick={loadData} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
        {error && <p role="alert" className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {loading && summary.length === 0 ? (
          <p role="status" className="mt-4 text-sm text-slate-500">Cargando comparaciones financieras…</p>
        ) : summary.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No hay grupos para comparar en este alcance.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {unresolvedExpenseBackups > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Hay {unresolvedExpenseBackups} gasto(s) sin comprobante adjunto en los grupos seleccionados.
              </p>
            )}
            <div className="space-y-4">
              {summary.map((row) => (
                <article key={row.grupo_id} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-900">{row.grupo_nombre}</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Aportes aprobados" value={currency.format(Number(row.aportes_aprobados || 0))} />
                    <Metric label="Ingresos en el fondo" value={currency.format(Number(row.ingresos_fondo || 0))} />
                    <Metric label="Egresos registrados" value={`${currency.format(Number(row.egresos_registrados || 0))} · ${row.egresos_con_comprobante}/${row.cantidad_egresos} con comprobante`} />
                    <Metric label="Salidas registradas en fondo" value={currency.format(Number(row.salidas_fondo || 0))} />
                    <Metric label="Diferencia: aportes vs ingresos del fondo" value={currency.format(Number(row.diferencia_aportes_ingresos_fondo || 0))} />
                    <Metric label="Diferencia: gastos vs salidas del fondo" value={currency.format(Number(row.diferencia_egresos_salidas_fondo || 0))} />
                    <Metric label="Saldo neto del fondo en el período" value={currency.format(Number(row.saldo_neto_fondo || 0))} />
                    <Metric label="Flujo neto de billeteras asociadas" value={currency.format(Number(row.billetera_neta || 0))} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Egresos y comprobantes</h2>
          <p className="mt-1 text-sm text-slate-600">Consulta los gastos registrados en el período y abre sus respaldos privados cuando estén adjuntos.</p>
        </div>
        {expenses.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No hay egresos registrados en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto / categoría</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.egreso_id}>
                    <td className="px-4 py-3">{expense.grupo_nombre}</td>
                    <td className="px-4 py-3">{dateLabel(expense.fecha)}</td>
                    <td className="px-4 py-3">{expense.concepto}<span className="block text-xs text-slate-500">{expense.categoria}</span></td>
                    <td className="px-4 py-3 font-medium">{currency.format(Number(expense.monto || 0))}</td>
                    <td className="px-4 py-3">
                      {expense.comprobante_path ? (
                        <button type="button" onClick={() => openExpenseReceipt(expense.comprobante_path)} className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline">
                          Abrir comprobante <ExternalLink size={13} />
                        </button>
                      ) : <span className="text-amber-800">Sin comprobante</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Entregas del cuadro rotativo</h2>
          <p className="mt-1 text-sm text-slate-600">Compara el monto entregado con los aportes pagados en esa ronda y revisa la evidencia. La diferencia es una alerta de revisión, no una conclusión automática.</p>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No hay entregas registradas en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Beneficiario</th>
                  <th className="px-4 py-3">Ronda</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Aportes pagados / socios</th>
                  <th className="px-4 py-3">Diferencia del pozo</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Evidencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((delivery) => (
                  <tr key={delivery.entrega_id}>
                    <td className="px-4 py-3">{delivery.grupo_nombre}</td>
                    <td className="px-4 py-3">{delivery.participante}</td>
                    <td className="px-4 py-3">{delivery.periodo}</td>
                    <td className="px-4 py-3 font-medium">{currency.format(Number(delivery.monto || 0))}</td>
                    <td className="px-4 py-3">
                      {currency.format(Number(delivery.aportes_ronda || 0))}
                      <span className="block text-xs text-slate-500">
                        {delivery.aportes_pagados_ronda || 0} / {delivery.socios_grupo || 0} socios
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${Number(delivery.diferencia_pozo || 0) === 0 ? "text-slate-700" : "text-amber-800"}`}>
                      {currency.format(Number(delivery.diferencia_pozo || 0))}
                    </td>
                    <td className="px-4 py-3">{dateLabel(delivery.fecha_entrega)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        {(delivery.evidencias || []).map((evidence) => (
                          <button key={evidence.id} type="button" onClick={() => openEvidence(evidence.ruta)} className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline">
                            {evidence.nombre_archivo} <ExternalLink size={13} />
                          </button>
                        ))}
                        {isAuditor && (
                          <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-800">
                            <FileUp size={14} />
                            {savingEvidence === delivery.entrega_id ? "Guardando…" : "Adjuntar evidencia"}
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                              disabled={Boolean(savingEvidence)}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) uploadEvidence(delivery, file);
                              }}
                              className="sr-only"
                            />
                          </label>
                        )}
                        {(delivery.evidencias || []).length === 0 && !isAuditor && <span className="text-slate-400">Sin evidencia</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Control de préstamos</h2>
          <p className="mt-1 text-sm text-slate-600">Consulta solicitudes, montos, estados y cuotas para preparar controles antes de una futura habilitación. El período filtra por fecha de solicitud; los saldos y vencimientos reflejan el estado actual.</p>
        </div>
        {overdueInstallments > 0 && <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">{overdueInstallments} cuota(s) aparecen vencidas según su fecha y estado.</p>}
        {loans.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No hay préstamos registrados en este período. Las operaciones de préstamos continúan deshabilitadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Grupo / socio</th>
                  <th className="px-4 py-3">Solicitud</th>
                  <th className="px-4 py-3">Monto / total pactado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Aprobador</th>
                  <th className="px-4 py-3">Cuotas pagadas / total</th>
                  <th className="px-4 py-3">Vencidas</th>
                  <th className="px-4 py-3">Pagado / pendiente</th>
                  <th className="px-4 py-3">Movimientos de fondo vinculados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <tr key={loan.prestamo_id}>
                    <td className="px-4 py-3">{loan.grupo_nombre} · {loan.participante}</td>
                    <td className="px-4 py-3">{dateLabel(loan.fecha_solicitud)}</td>
                    <td className="px-4 py-3">{currency.format(Number(loan.monto || 0))} / {currency.format(Number(loan.total_pactado || 0))}</td>
                    <td className="px-4 py-3 capitalize">{String(loan.estado || "").replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">{loan.aprobado_por || "Sin aprobación registrada"}</td>
                    <td className="px-4 py-3">{loan.cuotas_pagadas} / {loan.cuotas_totales}</td>
                    <td className="px-4 py-3">{loan.cuotas_vencidas}</td>
                    <td className="px-4 py-3">{currency.format(Number(loan.total_pagado || 0))} / {currency.format(Number(loan.saldo_pendiente || 0))}</td>
                    <td className="px-4 py-3">{currency.format(Number(loan.movimiento_fondo_asociado || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AuditoriaControlFinanciero;
