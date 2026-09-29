import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      navigate("/login", { replace: true });
    } catch (updateError) {
      console.error("Error actualizando contraseña:", updateError);
      setError("El enlace pudo vencer. Solicita uno nuevo e inténtalo otra vez.");
      notify({ title: "No se pudo actualizar", message: "Solicita un nuevo enlace de recuperación.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-emerald-950/5">
        <div className="h-1.5 bg-emerald-700" />
        <div className="p-7 sm:p-9">
          <div className="mb-8 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><KeyRound size={23} /></div>
          <p className="text-xs font-bold uppercase text-emerald-800">Acceso a tu cuenta</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Crea una contraseña nueva</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Usa al menos 8 caracteres y confirma la contraseña antes de guardarla.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              Nueva contraseña
              <span className="relative mt-1.5 block">
                <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-3 pr-12 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Confirmar contraseña
              <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
            </label>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60">
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>
          </form>

          <Link to="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
        </div>
      </section>
    </main>
  );
};

export default UpdatePassword;