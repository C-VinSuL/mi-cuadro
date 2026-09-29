import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "../../services/supabase";
import { useNotifications } from "../../hooks/useNotifications";

const Login = () => {

  const navigate = useNavigate();
  const { notify } = useNotifications();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

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

      notify({
        title: "Sesión iniciada",
        message: "Bienvenido nuevamente a Mi Cuadro.",
        type: "success"
      });
      navigate("/", { replace: true });
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
    <div className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-slate-100
      px-6
    ">

      <div className="
        w-full
        max-w-md
        bg-white
        rounded-3xl
        shadow-sm
        border
        border-slate-200
        p-8
      ">

        <div className="text-center mb-8">

          <div className="text-5xl">
            🏡
          </div>

          <h1 className="
            text-3xl
            font-bold
            mt-3
          ">
            Mi Cuadro
          </h1>

          <p className="
            text-slate-500
            mt-2
          ">
            Bienvenido nuevamente
          </p>

        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >

          <div>

            <label className="
              block
              font-medium
              mb-2
            ">
              Correo
            </label>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              className="
                w-full
                border
                border-slate-300
                rounded-xl
                px-4
                py-3
              "
            />

          </div>

          <div>

            <label className="
              block
              font-medium
              mb-2
            ">
              Contraseña
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                autoComplete="current-password"
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  px-4
                  py-3
                  pr-12
                "
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

          </div>

          <div className="-mt-2 flex justify-end">
            <Link to="/recuperar-contrasena" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {errorMessage && (
            <p className="
              bg-red-50
              text-red-700
              p-3
              rounded-xl
              text-sm
            ">
              {errorMessage}
            </p>
          )}

          <button
            disabled={loading}
            className="
              w-full
              bg-emerald-600
              hover:bg-emerald-700
              text-white
              rounded-xl
              py-3
              font-semibold
            "
          >

            {loading
              ? "Ingresando..."
              : "Iniciar sesión"
            }

          </button>

        </form>

        <p className="
          text-center
          text-sm
          mt-6
          text-slate-500
        ">

          ¿Aún no tienes cuenta?

          <Link
            to="/registro"
            className="ml-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            Registrarse
          </Link>

        </p>

      </div>

    </div>
  );
};

export default Login;