import { useState } from "react";
import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";

const GoogleAuthButton = () => {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGoogleSignIn = async () => {
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { hl: "es" }
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error iniciando sesión con Google:", error);
      const message = "No se pudo conectar con Google. Inténtalo nuevamente.";
      setErrorMessage(message);
      notify({ title: "No se pudo conectar con Google", message, type: "error" });
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
      >
        <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
        {loading ? "Conectando con Google..." : "Continuar con Google"}
      </button>
      {errorMessage && (
        <p className="mt-3 text-sm text-red-700" role="alert">{errorMessage}</p>
      )}
    </div>
  );
};

export default GoogleAuthButton;
