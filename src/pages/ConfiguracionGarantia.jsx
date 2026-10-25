import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  actualizarGarantiaMinimaBilletera,
  obtenerGarantiaMinimaBilleteraAdmin
} from "../services/walletService";
import { logOperationalError } from "../utils/logOperationalError";

const ConfiguracionGarantia = () => {
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const currentAmount = await obtenerGarantiaMinimaBilleteraAdmin();
        if (active) setMonto(String(currentAmount));
      } catch (loadError) {
        logOperationalError("Error cargando la garantía mínima:", loadError);
        if (active) {
          setLoadFailed(true);
          setError("No se pudo cargar la garantía mínima. Inténtalo nuevamente.");
        }
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const guardarMonto = async (event) => {
    event.preventDefault();
    if (saving) return;

    const amount = Number(monto);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
      setError("Ingresa un monto entre $0 y $100,000.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await actualizarGarantiaMinimaBilletera(amount);
      setMonto(amount.toFixed(2));
      setMessage("El mínimo de garantía se actualizó para todos los socios.");
    } catch (saveError) {
      logOperationalError("Error guardando la garantía mínima:", saveError);
      setError("No se pudo guardar la garantía mínima. Inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <ShieldCheck size={21} />
        </span>
        <div>
          <h2 className="font-bold text-slate-900">Garantía de billetera</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Define el saldo mínimo que cada socio debe mantener para ingresar a un grupo. La garantía no es una comisión y solo se usa para cubrir aportes vencidos que sigan impagos. El cambio aplica a todos los socios.
          </p>
        </div>
      </div>

      <form onSubmit={guardarMonto} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block w-full max-w-xs text-sm font-semibold text-slate-700">
          Garantía mínima (USD)
          <input
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            value={monto}
            onChange={(event) => {
              setMonto(event.target.value);
              setError("");
              setMessage("");
            }}
            disabled={loading || saving || loadFailed}
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 disabled:bg-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={loading || saving || loadFailed}
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Cargando..." : saving ? "Guardando..." : "Guardar garantía"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-800" role="status">{message}</p>}
    </section>
  );
};

export default ConfiguracionGarantia;
