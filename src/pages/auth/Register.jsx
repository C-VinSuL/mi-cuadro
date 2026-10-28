import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";
import GoogleAuthButton from "./GoogleAuthButton";

const Register = () => {
  const { notify } = useNotifications();

  const [form, setForm] = useState({
    nombreCompleto: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const nameError = mensaje === "Ingresa tu nombre completo." ? mensaje : "";
  const emailError = mensaje === "Escribe un correo electrónico válido." ? mensaje : "";
  const passwordError = mensaje === "La contraseña debe tener al menos 8 caracteres." ? mensaje : "";

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const [nombre, ...apellidoParts] = form.nombreCompleto.trim().split(/\s+/);
    const apellido = apellidoParts.join(" ");
    if (form.nombreCompleto.trim().length < 2 || !nombre) {
      setMensaje("Ingresa tu nombre completo.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setMensaje("Escribe un correo electrónico válido.");
      return;
    }
    if (form.password.length < 8) {
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    setMensaje("");
    setRegistroExitoso(false);

    try {
      const { data, error } = await supabase.functions.invoke("register-member", {
        body: {
          email: form.email.trim(),
          password: form.password,
          nombre,
          apellido
        }
      });

      if (error) {
        let details;
        try {
          details = await error.context?.json();
        } catch {
          details = null;
        }
        if (error.name === "FunctionsFetchError") {
          throw new Error(
            "No se pudo conectar con el servicio de registro. Verifica que la función register-member esté desplegada y que el dominio de esta página esté permitido en APP_ALLOWED_ORIGINS de Supabase."
          );
        }
        throw new Error(details?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);

      setRegistroExitoso(true);
      setMensaje(data?.message || "Cuenta creada. Revisa tu correo para confirmar la dirección y activar el acceso.");
      notify({ title: "Cuenta creada", message: "Te enviamos un correo para confirmar tu dirección.", type: "success" });
    } catch (error) {
      console.error("Error creando cuenta:", error);
      const message = error.message || "No se pudo crear la cuenta. Inténtalo nuevamente.";
      setMensaje(message);
      notify({ title: "No se pudo crear la cuenta", message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-emerald-950/10 md:min-h-[700px] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex flex-col items-center justify-center bg-[#023a2d] px-6 py-8 text-center sm:py-10 md:px-8 md:py-12">
          <motion.img
            src="/flashmonkey-logo.png"
            alt="FlashMonkey"
            className="block h-auto w-full max-w-[310px]"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            decoding="async"
          />
          <p className="mt-5 max-w-xs text-sm text-emerald-100 md:mt-8 md:text-base md:leading-7">
            Ahorra en comunidad y alcanza tus metas.
          </p>
          <div className="mt-8 hidden h-1 w-14 rounded-full bg-emerald-400 md:block" />
        </aside>

        <div className="px-6 py-7 sm:px-10 sm:py-10 md:flex md:flex-col md:px-12 md:py-12">
          <motion.header
            className="mb-6 md:mb-4"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Únete a FlashMonkey</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Crear cuenta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Registra tus datos para preparar tu acceso seguro.</p>
          </motion.header>

          {registroExitoso ? (
            <div className="border-l-4 border-emerald-600 bg-emerald-50 p-4" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold text-emerald-950">Revisa tu correo</p>
                  <p className="mt-1 text-sm leading-5 text-emerald-900">{mensaje}</p>
                </div>
              </div>
              <Link to="/login" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900">
                Volver al inicio de sesión <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
          <>

        <GoogleAuthButton />

        <div className="my-5 flex items-center gap-3 text-[11px] font-semibold tracking-wide text-slate-400 md:my-4">
          <span className="h-px flex-1 bg-slate-200" />
          O REGÍSTRATE CON TUS DATOS
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4"
        >

          <div>
            <label htmlFor="register-full-name" className="block text-sm font-semibold text-slate-700">
              Nombre completo
            </label>
            <input
              id="register-full-name"
              name="nombreCompleto"
              value={form.nombreCompleto}
              onChange={handleChange}
              required
              minLength={2}
              autoComplete="name"
              aria-invalid={Boolean(nameError)}
              className={`mt-1.5 w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 ${nameError ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-emerald-600"}`}
            />
            <AnimatePresence initial={false}>
              {nameError && <motion.p className="overflow-hidden text-sm text-red-700" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>{nameError}</motion.p>}
            </AnimatePresence>
          </div>

          <div>
            <label htmlFor="register-email" className="block text-sm font-semibold text-slate-700">
              Correo
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
              aria-invalid={Boolean(emailError)}
              className={`mt-1.5 w-full rounded-xl border bg-slate-50/60 px-4 py-3 text-base font-normal text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-emerald-600/10 ${emailError ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-emerald-600"}`}
            />
            <AnimatePresence initial={false}>
              {emailError && <motion.p className="overflow-hidden text-sm text-red-700" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>{emailError}</motion.p>}
            </AnimatePresence>
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-semibold text-slate-700">
              Contraseña
            </label>

            <div className="relative">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                className={`w-full rounded-xl border bg-slate-50/60 px-4 py-3 pr-12 text-base font-normal text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-emerald-600/10 ${passwordError ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-emerald-600"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  rounded-md
                  flex
                  size-11
                  items-center
                  justify-center
                  text-slate-500
                  hover:text-slate-800
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-emerald-600
                "
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="mt-1.5 text-xs font-normal text-slate-500">Usa al menos 8 caracteres.</p>
            <AnimatePresence initial={false}>
              {passwordError && <motion.p className="overflow-hidden text-sm text-red-700" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>{passwordError}</motion.p>}
            </AnimatePresence>

          </div>

          {mensaje && !nameError && !emailError && !passwordError && (
            <motion.p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-800" role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
            >
              {mensaje}
            </motion.p>
          )}

          <button
            disabled={loading}
            className="w-full shrink-0 rounded-xl bg-emerald-800 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-900 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/20 disabled:cursor-wait disabled:opacity-60"
          >
            {loading
              ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin motion-reduce:animate-none" />Creando cuenta...</span>
              : "Crear cuenta"
            }
          </button>

        </form>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-1 border-t border-slate-100 pt-5 text-sm text-slate-500 md:mt-auto">
          ¿Ya tienes una cuenta?
          <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">
            Inicia sesión <ArrowRight size={15} />
          </Link>
        </p>
          </>
          )}
        </div>
      </section>
    </main>
  );
};

export default Register;