import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";

const Register = () => {
  const { notify } = useNotifications();

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    direccion: "",
    fechaNacimiento: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMensaje("");
    setRegistroExitoso(false);

    try {
      const { data, error } = await supabase.functions.invoke("register-member", {
        body: {
          email: form.email.trim(),
          password: form.password,
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          cedula: form.cedula.trim(),
          telefono: form.telefono.trim(),
          direccion: form.direccion.trim(),
          fechaNacimiento: form.fechaNacimiento || null
        }
      });

      if (error) {
        let details;
        try {
          details = await error.context?.json();
        } catch {
          details = null;
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
    <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">

      <div className="
        w-full
        max-w-lg
        overflow-hidden
        bg-white
        rounded-2xl
        shadow-xl
        shadow-emerald-950/5
        border
        border-slate-200
      ">

        <div className="h-1.5 bg-emerald-800" />
        <div className="p-6 sm:p-9">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-800">Únete a FlashMonkey</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Crear cuenta</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Registra tus datos para preparar tu acceso seguro.</p>
            </div>
            <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl sm:flex">🏡</div>
          </div>

          <div className="mb-6 grid grid-cols-3 border-y border-slate-200 py-3 text-center text-xs text-slate-500">
            <span className="font-semibold text-emerald-800">1. Tus datos</span>
            <span>2. Confirma correo</span>
            <span>3. Ingresa</span>
          </div>

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

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          <div>

            <label className="block text-sm font-semibold text-slate-700">
              Nombre
            </label>

            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              autoComplete="given-name"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />

          </div>

          <div>

            <label className="block text-sm font-semibold text-slate-700">
              Apellido
            </label>

            <input
              name="apellido"
              value={form.apellido}
              onChange={handleChange}
              autoComplete="family-name"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />

          </div>

          <div>

            <label className="block text-sm font-semibold text-slate-700">
              Cédula o documento de identidad
            </label>

            <input
              name="cedula"
              value={form.cedula}
              onChange={handleChange}
              required
              minLength={6}
              maxLength={20}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />

          </div>

          <div>

            <label className="block text-sm font-semibold text-slate-700">
              Teléfono
            </label>

            <input
              name="telefono"
              type="tel"
              autoComplete="tel"
              value={form.telefono}
              onChange={handleChange}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />

          </div>

          <div>

            <label className="block text-sm font-semibold text-slate-700">
              Dirección de residencia
            </label>

            <input
              name="direccion"
              autoComplete="street-address"
              value={form.direccion}
              onChange={handleChange}
              required
              maxLength={250}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            />

          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Fecha de nacimiento
              <input
                name="fechaNacimiento"
                type="date"
                autoComplete="bday"
                value={form.fechaNacimiento}
                onChange={handleChange}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Correo
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                required
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Contraseña
            </label>

            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 pr-12 font-normal outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
                  p-1.5
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

          </div>

          <button
            disabled={loading}
            className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
          >
            {loading
              ? "Creando cuenta..."
              : "Crear cuenta"
            }
          </button>

        </form>

        {mensaje && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {mensaje}
          </p>
        )}

        <p className="mt-7 flex flex-wrap items-center justify-center gap-1 border-t border-slate-200 pt-5 text-sm text-slate-600">
          ¿Ya tienes una cuenta?
          <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 hover:underline">
            Inicia sesión <ArrowRight size={15} />
          </Link>
        </p>
          </>
          )}
        </div>

      </div>
    </main>
  );
};

export default Register;