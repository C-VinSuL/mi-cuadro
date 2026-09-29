import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";

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
    <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-emerald-950/5">
        <div className="h-1.5 bg-emerald-700" />
        <div className="p-7 sm:p-9">
          <div className="mb-8 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <KeyRound size={23} />
          </div>
          <p className="text-xs font-bold uppercase text-emerald-800">Recuperación segura</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">¿Olvidaste tu contraseña?</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Te enviaremos un enlace para crear una nueva. Ingresa el correo asociado a tu cuenta.</p>

          {sent ? (
            <div className="mt-7 border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
              Si el correo está registrado, recibirás un mensaje con los siguientes pasos. Revisa también la carpeta de spam.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <label className="block text-sm font-semibold text-slate-700">
                Correo electrónico
                <span className="relative mt-1.5 block">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" placeholder="nombre@correo.com" />
                </span>
              </label>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <button disabled={loading} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60">
                {loading ? "Enviando enlace..." : "Enviar enlace de recuperación"}
              </button>
            </form>
          )}

          <Link to="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800">
            <ArrowLeft size={16} /> Volver al inicio de sesión
          </Link>
        </div>
      </section>
    </main>
  );
};

export default ForgotPassword;