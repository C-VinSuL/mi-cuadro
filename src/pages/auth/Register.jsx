import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";

const Register = () => {

  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  setLoading(true);
  setMensaje("");

  const { data, error } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,

    options: {
      data: {
        nombre: form.nombre,
        apellido: form.apellido
      }
    }
  });

  if (error) {
    setMensaje(error.message);
    setLoading(false);
    return;
  }

  setMensaje(
    "Cuenta creada correctamente. Revisa tu correo para confirmar tu cuenta."
  );

  setLoading(false);

  // Por ahora NO redirigimos automáticamente
  // navigate("/login");
};

  return (
    <div className="
      min-h-screen
      flex
      items-center
      justify-center
      bg-slate-100
      p-6
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

          <div className="text-5xl mb-3">
            🏡
          </div>

          <h1 className="
            text-3xl
            font-bold
            text-slate-900
          ">
            Crear cuenta
          </h1>

          <p className="text-slate-500 mt-2">
            Únete a Mi Cuadro
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          <div>

            <label className="
              block
              text-sm
              font-medium
              mb-2
            ">
              Nombre
            </label>

            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              className="
                w-full
                border
                border-slate-300
                rounded-xl
                px-4
                py-3
                outline-none
                focus:ring-2
                focus:ring-emerald-500
              "
            />

          </div>

          <div>

            <label className="
              block
              text-sm
              font-medium
              mb-2
            ">
              Apellido
            </label>

            <input
              name="apellido"
              value={form.apellido}
              onChange={handleChange}
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
              text-sm
              font-medium
              mb-2
            ">
              Correo
            </label>

            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
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

            <label className="const {
  data,
              block
              text-sm
              font-medium
              mb-2
            ">
              Contraseña
            </label>

            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
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

          <button
            disabled={loading}
            className="
              w-full
              bg-emerald-600
              hover:bg-emerald-700
              text-white
              font-semibold
              rounded-xl
              py-3
              transition
            "
          >
            {loading
              ? "Creando cuenta..."
              : "Crear cuenta"
            }
          </button>

        </form>

        {mensaje && (
          <p className="
            mt-5
            text-sm
            text-center
            text-slate-600
          ">
            {mensaje}
          </p>
        )}

      </div>

    </div>
  );
};

export default Register;