import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";
import AuthRecoveryStepper from "./AuthRecoveryStepper";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useNotifications();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/actualizar-contrasena`
      });

      if (resetError) throw resetError;

      setSent(true);
      notify({
        title: "Revisa tu correo",
        message: "Si el correo está registrado, recibirás un enlace para cambiar la contraseña.",
        type: "success"
      });
    } catch (requestError) {
      console.error("Error solicitando recuperación:", requestError);
      setError("No pudimos enviar el enlace. Revisa tu conexión e inténtalo nuevamente.");
      notify({ title: "No se pudo enviar el enlace", message: "Inténtalo nuevamente en unos minutos.", type: "error" });
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
          <AuthRecoveryStepper currentStep={sent ? 2 : 1} />
          <header className="mb-6 md:mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Recuperación segura</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">¿Olvidaste tu contraseña?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Te enviaremos un enlace para crear una nueva. Ingresa el correo asociado a tu cuenta.</p>
          </header>

          {sent ? (
            <div className="auth-mobile-enter rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 max-md:rounded-2xl max-md:bg-gradient-to-br max-md:from-emerald-50 max-md:to-white max-md:p-5" role="status">
              <CheckCircle2 size={28} className="auth-mobile-success-check mb-3 text-emerald-700 md:hidden" />
              <p>Si el correo está registrado, recibirás un mensaje con los siguientes pasos. Revisa también la carpeta de spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-y-4 md:space-y-0">
              <label className="block text-sm font-semibold text-slate-700">
                Correo electrónico
                <span className="relative mt-1.5 block">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50/60 py-3 pl-10 pr-4 font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10" placeholder="nombre@correo.com" />
                </span>
              </label>
              {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
              <button disabled={loading} className="w-full rounded-xl bg-emerald-800 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 disabled:cursor-wait disabled:opacity-60">
                {loading
                  ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={18} className="auth-mobile-spin md:hidden" />Enviando enlace...</span>
                  : "Enviar enlace de recuperación"}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-6 inline-flex items-center gap-2 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-600 hover:text-emerald-800 md:mt-auto">
            <ArrowLeft size={16} /> Volver al inicio de sesión
          </Link>
        </div>
      </section>
    </main>
  );
};

export default ForgotPassword;