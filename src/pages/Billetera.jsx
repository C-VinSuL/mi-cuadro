import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
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
const allowedReceiptTypes = ["image/jpeg", "image/png", "application/pdf"];

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
  const [depositForm, setDepositForm] = useState({ amount: "", reference: "", receipt: null });
  const [withdrawAmount, setWithdrawAmount] = useState("");

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
      console.error("Error cargando la billetera:", loadError);
      setError(loadError.message || "No se pudo cargar la billetera.");
    } finally {
      setLoading(false);
    }
  }, [esRevisor]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadWallet, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWallet, user?.id]);

  const enviarDeposito = async (event) => {
    event.preventDefault();
    if (!depositForm.receipt || saving) return;
    if (!allowedReceiptTypes.includes(depositForm.receipt.type) || depositForm.receipt.size > 5 * 1024 * 1024) {
      setError("Adjunta un comprobante JPG, PNG o PDF de hasta 5 MB.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const extension = depositForm.receipt.type === "application/pdf" ? "pdf" : depositForm.receipt.type.split("/")[1];
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("wallet-receipts").upload(path, depositForm.receipt, {
        contentType: depositForm.receipt.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      await solicitarDepositoBilletera(depositForm.amount, depositForm.reference.trim(), path);
      setDepositForm({ amount: "", reference: "", receipt: null });
      notify({ title: "Depósito enviado a revisión", message: "El saldo se actualizará después de que administración o tesorería confirme el comprobante.", type: "success" });
      await loadWallet();
    } catch (submitError) {
      console.error("Error solicitando depósito:", submitError);
      setError(submitError.message || "No se pudo enviar el depósito.");
    } finally {
      setSaving(false);
    }
  };

  const enviarRetiro = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await solicitarRetiroBilletera(withdrawAmount);
      setWithdrawAmount("");
      notify({ title: "Retiro solicitado", message: "El retiro quedará pendiente hasta su aprobación.", type: "success" });
      await loadWallet();
    } catch (submitError) {
      console.error("Error solicitando retiro:", submitError);
      setError(submitError.message || "No se pudo solicitar el retiro.");
    } finally {
      setSaving(false);
    }
  };

  const resolverMovimiento = async (request, approve) => {
    setSaving(true);
    setError("");
    try {
      await resolverSolicitudBilletera(request.id, approve);
      notify({
        title: approve ? "Movimiento aprobado" : "Movimiento rechazado",
        message: approve ? "El saldo del socio se actualizó y el cambio quedó en auditoría." : "La solicitud fue rechazada y quedó registrada en auditoría.",
        type: "success"
      });
      await loadWallet();
    } catch (reviewError) {
      console.error("Error resolviendo movimiento de billetera:", reviewError);
      setError(reviewError.message || "No se pudo resolver el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  const abrirComprobante = async (request) => {
    if (!request.comprobante_path) return;
    setOpeningReceipt(request.id);
    setError("");
    try {
      const { data, error: urlError } = await supabase.storage.from("wallet-receipts")
        .createSignedUrl(request.comprobante_path, 60);
      if (urlError) throw urlError;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (receiptError) {
      console.error("Error abriendo comprobante:", receiptError);
      setError(receiptError.message || "No se pudo abrir el comprobante privado.");
    } finally {
      setOpeningReceipt("");
    }
  };

  if (esRevisor) {
    return (
      <div className="space-y-7">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-emerald-700">FlashMonkey · Administración</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Solicitudes de billetera</h1>
          <p className="mt-2 text-sm text-slate-600">Revisa comprobantes y resuelve depósitos o retiros de los socios.</p>
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
                <article key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{request.nombre} {request.apellido} · {request.tipo === "deposito" ? "Depósito" : "Retiro"}</p>
                    <p className="mt-1 text-sm text-slate-600">{currency.format(request.monto)} · {new Date(request.creada_en).toLocaleString("es-EC")}</p>
                    {request.referencia && <p className="mt-1 text-xs text-slate-500">Referencia: {request.referencia}</p>}
                    {request.comprobante_path && <button type="button" onClick={() => abrirComprobante(request)} disabled={openingReceipt === request.id} className="mt-2 text-sm font-semibold text-emerald-800 underline">{openingReceipt === request.id ? "Abriendo..." : "Ver comprobante privado"}</button>}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={() => resolverMovimiento(request, true)} className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Aprobar</button>
                    <button type="button" disabled={saving} onClick={() => resolverMovimiento(request, false)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Rechazar</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-emerald-700">FlashMonkey</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Mi billetera</h1>
        <p className="mt-2 text-sm text-slate-600">Consulta tu saldo, solicita depósitos o retiros y revisa el historial.</p>
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
        Si un aporte de un grupo activo sigue impago al vencimiento, el sistema lo cubrirá automáticamente con tu saldo disponible, más la comisión actual de $1. El primer vencimiento ocurre al terminar la primera semana, quincena o mensualidad desde el inicio del grupo. Un depósito solo aumenta tu saldo cuando administración o tesorería aprueba el comprobante.
      </p>

      {profile?.rol?.toLowerCase() === "socio" && <section className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={enviarDeposito} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ArrowDownToLine size={19} className="text-emerald-700" /> Solicitar depósito</h2>
          <p className="text-sm text-slate-600">Adjunta el comprobante de la transferencia realizada por el canal indicado por administración. El saldo no se acredita hasta su aprobación.</p>
          <label className="block text-sm font-medium text-slate-700">
            Monto (USD)
            <input type="number" min="0.01" max="100000" step="0.01" required value={depositForm.amount} onChange={(event) => setDepositForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Referencia de transferencia
            <input maxLength={120} value={depositForm.reference} onChange={(event) => setDepositForm((current) => ({ ...current, reference: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Comprobante (JPG, PNG o PDF; máximo 5 MB)
            <input type="file" accept="image/jpeg,image/png,application/pdf" required onChange={(event) => setDepositForm((current) => ({ ...current, receipt: event.target.files?.[0] || null }))} className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-800" />
          </label>
          <button type="submit" disabled={saving || loading} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? "Enviando..." : "Enviar a revisión"}</button>
        </form>

        <form onSubmit={enviarRetiro} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ArrowUpFromLine size={19} className="text-amber-700" /> Solicitar retiro</h2>
          <p className="text-sm text-slate-600">Los retiros requieren aprobación y solo se autorizan si el saldo disponible los cubre.</p>
          <label className="block text-sm font-medium text-slate-700">
            Monto (USD)
            <input type="number" min="0.01" max={summary?.saldo || undefined} step="0.01" required value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <button type="submit" disabled={saving || loading || !summary?.saldo} className="rounded-lg border border-emerald-800 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50">{saving ? "Enviando..." : "Solicitar retiro"}</button>
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
                <span className="font-medium capitalize text-slate-800">{request.tipo} · {currency.format(request.monto)}</span>
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
