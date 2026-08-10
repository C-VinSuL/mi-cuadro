import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../services/supabase";

const Login = () => {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({

      email,
      password

    });

    if (error) {

      setErrorMessage(
        "Correo o contraseña incorrectos."
      );

      setLoading(false);
      return;
    }

    console.log(
      "Usuario autenticado:",
      data.user
    );

    setLoading(false);

    navigate("/");

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

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
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

          <button
            onClick={() =>
              navigate("/registro")
            }
            className="
              text-emerald-700
              font-semibold
              ml-1
            "
          >
            Registrarse
          </button>

        </p>

      </div>

    </div>
  );
};

export default Login;