import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";
import AuthRecoveryStepper from "./AuthRecoveryStepper";

const passwordStrength = (value) => {
  if (!value) return 0;

  return [
    value.length >= 8,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value) || /[^a-zA-Z0-9]/.test(value)
  ].filter(Boolean).length;
};

const strengthLabels = ["Muy corta", "Débil", "Mejorable", "Buena", "Fuerte"];
const strengthColors = [
  "bg-slate-300",
  "bg-red-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-emerald-600"
];

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const strength = passwordStrength(password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      notify({ title: "Contraseña actualizada", message: "Ya puedes ingresar con tu nueva contraseña.", type: "success" });
      const mobileMotionEnabled = window.matchMedia("(max-width: 767px)").matches
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (mobileMotionEnabled) {
        setUpdated(true);
        window.setTimeout(() => navigate("/login", { replace: true }), 1400);
      } else {
        navigate("/login", { replace: true });
      }
    } catch (updateError) {
      console.error("Error actualizando contraseña:", updateError);
      setError("El enlace pudo vencer. Solicita uno nuevo e inténtalo otra vez.");
      notify({ title: "No se pudo actualizar", message: "Solicita un nuevo enlace de recuperación.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-emerald-950/10 md:h-[700px] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col items-center justify-center bg-[#023a2d] px-6 py-8 text-center sm:py-10 md:px-8 md:py-12">
          <img src="/flashmonkey-logo.png" alt="FlashMonkey" className="block h-auto w-full max-w-[310px]" decoding="async" />
          <p className="mt-5 max-w-xs text-sm text-emerald-100 md:mt-8 md:text-base md:leading-7">
            Ahorra en comunidad y alcanza tus metas.
          </p>
          <div className="mt-8 hidden h-1 w-14 rounded-full bg-emerald-400 md:block" />
        </aside>

        <div className="px-6 py-7 sm:px-10 sm:py-10 md:flex md:h-full md:min-h-0 md:flex-col md:px-12 md:py-12">
          <AuthRecoveryStepper currentStep={3} />
          <header className="mb-6 md:mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Acceso a tu cuenta</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Crea una contraseña nueva</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Usa al menos 8 caracteres y confirma la contraseña antes de guardarla.</p>
          </header>

          {updated ? (
            <div className="auth-mobile-enter flex flex-1 flex-col items-center justify-center py-8 text-center md:hidden" role="status" aria-live="polite">
              <span className="auth-mobile-success-check flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={48} strokeWidth={1.8} />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-slate-950">Contraseña actualizada</h2>
              <p className="mt-2 text-sm text-slate-600">Tu cuenta está lista. Volviendo al inicio de sesión...</p>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-y-4 md:space-y-0">
            <label className="block text-sm font-semibold text-slate-700">
              Nueva contraseña
              <span className="relative mt-1.5 block">
                <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 pr-12 font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
            <div className="md:hidden" aria-live="polite">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Seguridad orientativa</span>
                <span className={`font-semibold ${strength >= 3 ? "text-emerald-700" : strength === 2 ? "text-amber-700" : strength > 0 ? "text-red-700" : "text-slate-500"}`}>
                  {password ? strengthLabels[strength] : "Escribe una contraseña"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
                {strengthColors.slice(1).map((color, index) => (
                  <span key={color} className={`h-1.5 rounded-full transition-colors ${strength > index ? color : "bg-slate-200"}`} />
                ))}
              </div>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Confirmar contraseña
              <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10" />
            </label>
            {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-emerald-800 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 disabled:cursor-wait disabled:opacity-60">
              {loading
                ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={18} className="auth-mobile-spin md:hidden" />Guardando...</span>
                : <span className="inline-flex items-center justify-center gap-2"><Check size={18} className="md:hidden" />Guardar nueva contraseña</span>}
            </button>
          </form>
          )}

          <Link to="/login" className="mt-6 inline-flex items-center gap-2 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-600 hover:text-emerald-800 md:mt-auto"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
        </div>
      </section>
    </main>
  );
};

export default UpdatePassword;