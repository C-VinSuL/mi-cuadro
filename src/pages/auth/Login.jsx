import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";
import GoogleAuthButton from "./GoogleAuthButton";

const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const welcomeVideoRef = useRef(null);

  useEffect(() => {
    const video = welcomeVideoRef.current;
    if (!video) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (reducedMotion.matches) {
        video.pause();
        return;
      }

      video.play().catch((error) => {
        console.error("No se pudo reproducir el video de bienvenida:", error);
      });
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => reducedMotion.removeEventListener("change", syncPlayback);
  }, []);

  const handleLogin = async (e) => {

    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({

        email: email.trim(),
        password

      });

      if (error) {

        setErrorMessage(
          "Correo o contraseña incorrectos."
        );
        notify({
          title: "No se pudo iniciar sesión",
          message: "Revisa tu correo y contraseña.",
          type: "error"
        });

        return;
      }

      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (error) {
      console.error("Error iniciando sesión:", error);
      setErrorMessage(
        "No se pudo iniciar sesión. Revisa tu conexión e inténtalo nuevamente."
      );
      notify({
        title: "Error de conexión",
        message: "No fue posible contactar el servicio de acceso.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }

  };

  return (
    <main className="auth-shell flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-emerald-950/10 md:h-[700px] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col items-center justify-center bg-[#023a2d] px-6 py-8 text-center sm:py-10 md:px-8 md:py-12">
          <video
            ref={welcomeVideoRef}
            src="/flashmonkey-welcome.mp4"
            poster="/flashmonkey-logo.png"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label="Video de bienvenida de FlashMonkey"
            className="block h-auto w-full max-w-[310px] rounded-2xl"
          >
            Tu navegador no admite la reproducción de video.
          </video>
          <p className="mt-5 max-w-xs text-sm text-emerald-100 md:mt-8 md:text-base md:leading-7">
            Ahorra en comunidad y alcanza tus metas.
          </p>
          <div className="mt-8 hidden h-1 w-14 rounded-full bg-emerald-400 md:block" />
        </aside>

        <div className="px-6 py-7 sm:px-10 sm:py-10 md:flex md:h-full md:min-h-0 md:flex-col md:px-12 md:py-12">
          <motion.header
            className="mb-6 md:mb-4"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Tu espacio financiero</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Inicia sesión</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Ingresa para continuar con tu comunidad.</p>
          </motion.header>

          <GoogleAuthButton />

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-wide text-slate-400 md:my-4">
            <span className="h-px flex-1 bg-slate-200" />
            O CON TU CORREO
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-y-4 md:space-y-0">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Correo
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={Boolean(errorMessage)}
                className={`w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 ${errorMessage ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-emerald-600"}`}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(errorMessage)}
                  className={`w-full rounded-xl border bg-slate-50/60 px-4 py-3 pr-12 text-base text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-emerald-600/10 ${errorMessage ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-emerald-600"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-0.5">
              <Link to="/recuperar-contrasena" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <AnimatePresence initial={false}>
              {errorMessage && (
                <motion.p
                  className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {errorMessage}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              disabled={loading}
              className="w-full rounded-xl bg-emerald-800 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-900 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin motion-reduce:animate-none" />Ingresando...</span> : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500 md:mt-auto">
            ¿Aún no tienes cuenta?
            <Link to="/registro" className="ml-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">
              Crear cuenta
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default Login;