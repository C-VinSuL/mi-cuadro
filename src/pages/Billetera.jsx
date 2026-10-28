import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Wallet } from "lucide-react";
import SectionPageTitle from "../components/ui/SectionPageTitle";
import { createUniqueId } from "../utils/uniqueId";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { logOperationalError } from "../utils/logOperationalError";
import { getStorageUploadErrorMessage, getSupportedDocumentMimeType } from "../utils/fileUpload";
import { normalizeAmountInput, parseAmountToCents } from "../utils/money";
import {
  listarMovimientosBilletera,
  listarSolicitudesBilleteraAdmin,
  listarSolicitudesBilleteraPropias,
  obtenerResumenBilletera,
  resolverSolicitudBilletera,
  solicitarDepositoBilletera,
  solicitarRetiroBilletera
} from "../services/walletService";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const Billetera = () => {
  const { user, profile, grupos } = useAuth();
  const { notify } = useNotifications();
  const esRevisor = ["administrador", "tesorero"].includes(profile?.rol?.toLowerCase());
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [requests, setRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingReceipt, setOpeningReceipt] = useState("");
  const [error, setError] = useState("");
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [depositForm, setDepositForm] = useState({ amount: "", receipt: null });
  const [reviewReferences, setReviewReferences] = useState({});
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const withdrawableBalance = Math.max(
    (summary?.saldo || 0) - (summary?.garantia_minima || 0),
    0
  );

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (esRevisor) {
        const pendingRequests = await listarSolicitudesBilleteraAdmin();
        setSummary(null);
        setMovements([]);
        setRequests([]);
        setAdminRequests(pendingRequests || []);
      } else {
        const [walletSummary, walletMovements, ownRequests] = await Promise.all([
          obtenerResumenBilletera(),
          listarMovimientosBilletera(),
          listarSolicitudesBilleteraPropias()
        ]);
        setSummary(walletSummary);
        setMovements(walletMovements || []);
        setRequests(ownRequests || []);
        setAdminRequests([]);
      }
    } catch (loadError) {
      logOperationalError("Error cargando la billetera:", loadError);
      setError("No se pudo cargar la billetera. Verifica tu conexión e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [esRevisor]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadWallet, 0);
    if (!user?.id) return () => window.clearTimeout(timeoutId);

    const channel = supabase
      .channel(`solicitudes-billetera-${user.id}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificaciones",
        filter: `usuario_id=eq.${user.id}`
      }, (payload) => {
        const walletRoute = esRevisor ? "/admin/billetera" : "/billetera";
        if (payload.new?.ruta_accion === walletRoute) loadWallet();
      })
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [esRevisor, loadWallet, user?.id]);

  const enviarDeposito = async (event) => {
    event.preventDefault();
    if (!depositForm.receipt || saving) return;
    const amountCents = parseAmountToCents(depositForm.amount);
    if (amountCents === null || amountCents > 10_000_000) {
      setError("Ingresa un monto válido entre $0.01 y $100,000.00.");
      return;
    }
    const receiptType = getSupportedDocumentMimeType(depositForm.receipt);
    if (!receiptType || depositForm.receipt.size > 5 * 1024 * 1024) {
      setError("Adjunta un comprobante JPG, PNG o PDF de hasta 5 MB.");
      return;
    }
    setSaving(true);
    setError("");
    let uploadingReceipt = false;
    try {
      const extension = receiptType === "application/pdf" ? "pdf" : receiptType.split("/")[1];
      const path = `${user.id}/${createUniqueId()}.${extension}`;
      uploadingReceipt = true;
      const { error: uploadError } = await supabase.storage.from("wallet-receipts").upload(path, depositForm.receipt, {
        contentType: receiptType,
        upsert: false
      });
      if (uploadError) throw uploadError;
      uploadingReceipt = false;
      await solicitarDepositoBilletera(depositForm.amount, path);
      setDepositForm({ amount: "", receipt: null });
      notify({ title: "Depósito enviado a revisión", message: "El saldo se actualizará después de que administración o tesorería confirme el comprobante.", type: "success" });
      await loadWallet();
    } catch (submitError) {
      logOperationalError("Error solicitando depósito:", submitError);
      setError(uploadingReceipt
        ? getStorageUploadErrorMessage(submitError)
        : "No se pudo enviar el depósito. Verifica los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const enviarRetiro = async (event) => {
    event.preventDefault();
    const amountCents = parseAmountToCents(withdrawAmount);
    if (amountCents === null || amountCents > Math.round(withdrawableBalance * 100)) {
      setError("Ingresa un monto válido que no supere el saldo disponible para retirar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await solicitarRetiroBilletera(withdrawAmount);
      setWithdrawAmount("");
      notify({ title: "Retiro solicitado", message: "El retiro quedará pendiente hasta su aprobación.", type: "success" });
      await loadWallet();
    } catch (submitError) {
      logOperationalError("Error solicitando retiro:", submitError);
      setError("No se pudo solicitar el retiro. Verifica los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const resolverMovimiento = async (request, approve, note = null) => {
    setSaving(true);
    setError("");
    try {
      await resolverSolicitudBilletera(
        request.id,
        approve,
        note || "",
        approve ? reviewReferences[request.id] || "" : ""
      );
      setReviewReferences((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setRequestToReject(null);
      setRejectionNote("");
      notify({
        title: approve ? "Movimiento aprobado" : "Movimiento rechazado",
        message: approve ? "El saldo del socio se actualizó y el cambio quedó en auditoría." : "La solicitud fue rechazada y quedó registrada en auditoría.",
        type: "success"
      });
      await loadWallet();
    } catch (reviewError) {
      logOperationalError("Error resolviendo movimiento de billetera:", reviewError);
      setError("No se pudo resolver el movimiento. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const abrirComprobante = async (request) => {
    if (!request.comprobante_path) return;
    const receiptWindow = window.open("about:blank", "_blank");
    if (!receiptWindow) {
      setError("Permite las ventanas emergentes para abrir el comprobante.");
      return;
    }
    receiptWindow.opener = null;
    setOpeningReceipt(request.id);
    setError("");
    try {
      const { data, error: urlError } = await supabase.storage.from("wallet-receipts")
        .createSignedUrl(request.comprobante_path, 60);
      if (urlError) throw urlError;
      receiptWindow.location.href = data.signedUrl;
    } catch (receiptError) {
      receiptWindow.close();
      logOperationalError("Error abriendo comprobante:", receiptError);
      setError("No se pudo abrir el comprobante privado. Verifica tu acceso e inténtalo nuevamente.");
    } finally {
      setOpeningReceipt("");
    }
  };

  if (esRevisor) {
    return (
      <div className="space-y-7">
        <header>
          <SectionPageTitle
            icon={Wallet}
            eyebrow="Revisión de movimientos"
            title="Solicitudes de billetera"
            description="Revisa comprobantes y resuelve depósitos o retiros de los socios."
          />
        </header>

        {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Movimientos pendientes</h2>
              <p className="mt-1 text-sm text-slate-600">Verifica cada comprobante antes de aprobar un depósito o retiro.</p>
            </div>
            <button type="button" onClick={loadWallet} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={15} /> Actualizar</button>
          </div>
          {loading && adminRequests.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Cargando solicitudes...</p>
          ) : adminRequests.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No hay movimientos pendientes de aprobación.</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5">
              {adminRequests.map((request) => (
                <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none">
                  <div>
                    <p className="font-semibold text-slate-900">{request.nombre} {request.apellido} · {request.tipo === "deposito" ? "Depósito" : "Retiro"}</p>
                    <p className="mt-1 text-sm text-slate-600">{currency.format(request.monto)} · {new Date(request.creada_en).toLocaleString("es-EC")}</p>
                    {request.tipo === "deposito" && (
                      <label className="mt-2 block max-w-sm text-xs font-medium text-slate-600">
                        Referencia verificada por tesorería
                        <input
                          value={reviewReferences[request.id] ?? ""}
                          onChange={(event) => setReviewReferences((current) => ({
                            ...current,
                            [request.id]: event.target.value
                          }))}
                          maxLength={120}
                          placeholder="Ingresa la referencia confirmada en el banco"
                          className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm font-normal text-slate-800"
                        />
                        <span className="mt-1 block text-[11px] font-normal text-slate-500">
                          Obligatoria para aprobar; ingresa la referencia verificada en el comprobante bancario.
                        </span>
                      </label>
                    )}
                    {request.comprobante_path && <button type="button" onClick={() => abrirComprobante(request)} disabled={openingReceipt === request.id} className="mt-2 text-sm font-semibold text-emerald-800 underline">{openingReceipt === request.id ? "Abriendo..." : "Ver comprobante privado"}</button>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving || (request.tipo === "deposito" && !reviewReferences[request.id]?.trim())}
                      onClick={() => resolverMovimiento(request, true)}
                      className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button type="button" disabled={saving} onClick={() => {
                      setRequestToReject(request);
                      setRejectionNote("");
                    }} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50">Rechazar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {requestToReject && (
          <div className="ui-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setRequestToReject(null);
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="rechazar-billetera-titulo" className="ui-dialog-panel w-full max-w-lg rounded-2xl bg-white shadow-2xl">
              <header className="border-b border-slate-200 px-5 py-4">
                <p className="text-sm font-semibold text-red-700">Rechazar solicitud</p>
                <h2 id="rechazar-billetera-titulo" className="mt-1 text-xl font-bold text-slate-900">{requestToReject.nombre} {requestToReject.apellido}</h2>
                <p className="mt-1 text-sm text-slate-600">{requestToReject.tipo === "deposito" ? "Depósito" : "Retiro"} · {currency.format(requestToReject.monto)}</p>
              </header>
              <div className="space-y-2 px-5 py-4">
                <label htmlFor="nota-rechazo-billetera" className="text-sm font-medium text-slate-700">Motivo que verá el socio</label>
                <textarea id="nota-rechazo-billetera" value={rejectionNote} onChange={(event) => setRejectionNote(event.target.value)} maxLength={500} rows={4} required placeholder="Indica qué debe corregir o verificar el socio." className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" />
                <p className="text-right text-xs text-slate-500">{rejectionNote.trim().length}/500 caracteres (mínimo 5)</p>
              </div>
              <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button type="button" onClick={() => setRequestToReject(null)} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={() => resolverMovimiento(requestToReject, false, rejectionNote.trim())} disabled={saving || rejectionNote.trim().length < 5} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? "Guardando..." : "Confirmar rechazo"}
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header>
        <SectionPageTitle
          icon={Wallet}
          eyebrow="Finanzas personales"
          title="Mi billetera"
          description="Consulta tu saldo, solicita depósitos o retiros y revisa el historial."
        />
      </header>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="flex flex-col gap-5 rounded-2xl bg-emerald-900 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/10"><Wallet size={24} /></span>
          <div>
            <p className="text-sm text-emerald-100">Saldo confirmado</p>
            <p className="mt-1 text-3xl font-bold">{loading && !summary ? "Cargando..." : summary ? currency.format(summary.saldo) : "No disponible"}</p>
          </div>
        </div>
        {summary && (
          <div className="rounded-xl bg-white/10 px-4 py-3 text-sm">
            <p>Garantía mínima para unirte a un grupo</p>
            <p className="mt-1 font-bold">{currency.format(summary.garantia_minima)}</p>
            <p className="mt-1 text-xs text-emerald-100">{summary.garantia_cumplida ? "Saldo suficiente para solicitar ingreso" : `Te faltan ${currency.format(Math.max(summary.garantia_minima - summary.saldo, 0))}`}</p>
          </div>
        )}
      </section>

      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
        La garantía mínima de tu billetera permanece como saldo tuyo y no se puede retirar. Si un aporte de un grupo activo sigue impago al vencimiento, el sistema podrá cubrirlo automáticamente con tu saldo, sin comisión adicional. El primer vencimiento ocurre al terminar la primera semana, quincena o mensualidad desde el inicio del grupo. Los depósitos se acreditan después de que administración o tesorería apruebe el comprobante.
      </p>

      {profile?.rol?.toLowerCase() === "socio" && <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={enviarDeposito} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ArrowDownToLine size={19} className="text-emerald-700" /> Solicitar depósito</h2>
          <p className="text-sm text-slate-600">Adjunta el comprobante de la transferencia realizada por el canal indicado por administración. El saldo no se acredita hasta su aprobación.</p>
          <label className="block text-sm font-medium text-slate-700">
            Monto (USD)
            <input type="text" inputMode="decimal" autoComplete="off" maxLength={13} pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="0.00" required value={depositForm.amount} onChange={(event) => setDepositForm((current) => ({ ...current, amount: normalizeAmountInput(event.target.value) }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <div className="block text-sm font-medium text-slate-700">
            <p>Comprobante (JPG, PNG o PDF; máximo 5 MB)</p>
            <label className="relative mt-1.5 inline-flex min-h-11 cursor-pointer items-center overflow-hidden rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
              {depositForm.receipt ? "Cambiar archivo" : "Elegir archivo"}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                required
                aria-label="Elegir comprobante JPG, PNG o PDF"
                onChange={(event) => {
                  const receipt = event.target.files?.[0] || null;
                  const receiptType = getSupportedDocumentMimeType(
                    receipt,
                    new Set(["image/jpeg", "image/png", "application/pdf"])
                  );
                  if (receipt && (!receiptType || receipt.size > 5 * 1024 * 1024)) {
                    setDepositForm((current) => ({ ...current, receipt: null }));
                    setError("Adjunta un comprobante JPG, PNG o PDF de hasta 5 MB.");
                    event.target.value = "";
                    return;
                  }
                  setDepositForm((current) => ({ ...current, receipt }));
                  if (receipt) setError("");
                  else setError("No se recibió ningún archivo. Vuelve a elegirlo desde el teléfono.");
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <span role="status" className="mt-1 block break-all text-xs font-normal text-slate-500">
              {depositForm.receipt
                ? `Seleccionado: ${depositForm.receipt.name} (${(depositForm.receipt.size / (1024 * 1024)).toFixed(2)} MB)`
                : "Ningún archivo seleccionado"}
            </span>
          </div>
          <button type="submit" disabled={saving || loading} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? "Enviando..." : "Enviar a revisión"}</button>
        </form>

        <form onSubmit={enviarRetiro} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ArrowUpFromLine size={19} className="text-amber-700" /> Solicitar retiro</h2>
          <p className="text-sm text-slate-600">Los retiros requieren aprobación. La garantía mínima queda protegida y solo puede usarse para cubrir aportes vencidos.</p>
          <label className="block text-sm font-medium text-slate-700">
            Monto (USD)
            <input type="text" inputMode="decimal" autoComplete="off" maxLength={13} pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="0.00" required value={withdrawAmount} onChange={(event) => setWithdrawAmount(normalizeAmountInput(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <button type="submit" disabled={saving || loading || withdrawableBalance <= 0} className="rounded-lg border border-emerald-800 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{saving ? "Enviando..." : "Solicitar retiro"}</button>
        </form>
      </section>}

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Solicitudes recientes</h2>
        {requests.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Todavía no tienes solicitudes de billetera.</p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5">
            {requests.map((request) => (
              <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium capitalize text-slate-800">{request.tipo} · {currency.format(request.monto)}</p>
                  {request.estado === "rechazada" && request.nota_revision && (
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-red-700">Motivo: {request.nota_revision}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${request.estado === "aprobada" ? "bg-emerald-50 text-emerald-800" : request.estado === "rechazada" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{request.estado}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Historial de movimientos</h2>
        {movements.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Todavía no tienes movimientos confirmados.</p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5">
            {movements.map((movement) => (
              <article key={movement.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-700">{movement.tipo === "aporte_programado" ? `Aporte automático · ${grupos.find((group) => group.id === movement.grupo_id)?.nombre || "Grupo"} · periodo ${movement.periodo}` : movement.tipo} · {new Date(movement.creado_en).toLocaleString("es-EC")}</span>
                <span className={`font-bold ${Number(movement.delta) < 0 ? "text-red-700" : "text-emerald-700"}`}>{Number(movement.delta) > 0 ? "+" : ""}{currency.format(movement.delta)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Billetera;
