import { useEffect, useState } from "react";
import {
  Plus,
  Users,
  UserPlus
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";

const Grupos = () => {
  const { grupo } = useAuth();

  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mostrarModal, setMostrarModal] = useState(false);

  const [nuevoIntegrante, setNuevoIntegrante] = useState({
    nombre: "",
    posicion: "",
    estado: "pendiente"
  });

  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (grupo?.id) {
      cargarParticipantes();
    } else {
      setLoading(false);
    }
  }, [grupo]);

  // =========================
  // CARGAR PARTICIPANTES
  // =========================

  const cargarParticipantes = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("participantes")
      .select("*")
      .eq("grupo_id", grupo.id)
      .order("posicion", { ascending: true });

    if (error) {
      console.error(
        "Error cargando participantes:",
        error
      );
    } else {
      setParticipantes(data || []);
    }

    setLoading(false);
  };

  // =========================
  // FORMULARIO
  // =========================

  const handleChange = (e) => {
    setNuevoIntegrante({
      ...nuevoIntegrante,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // AGREGAR INTEGRANTE
  // =========================

  const agregarIntegrante = async (e) => {
    e.preventDefault();

    setMensaje("");

    const posicionNumero = Number(
      nuevoIntegrante.posicion
    );

    // Validar nombre
    if (!nuevoIntegrante.nombre.trim()) {
      setMensaje(
        "El nombre del integrante es obligatorio."
      );
      return;
    }

    // Validar posición
    if (
      posicionNumero < 1 ||
      posicionNumero > grupo.numero_integrantes
    ) {
      setMensaje(
        `La posición debe estar entre 1 y ${grupo.numero_integrantes}.`
      );
      return;
    }

    // Validar que no esté ocupada
    const posicionOcupada = participantes.some(
      (participante) =>
        participante.posicion === posicionNumero
    );

    if (posicionOcupada) {
      setMensaje(
        "Esa posición ya está ocupada."
      );
      return;
    }

    // Validar cupos
    if (
      participantes.length >=
      grupo.numero_integrantes
    ) {
      setMensaje(
        "El grupo ya está completo."
      );
      return;
    }

    const { error } = await supabase
      .from("participantes")
      .insert({
        grupo_id: grupo.id,
        nombre: nuevoIntegrante.nombre.trim(),
        posicion: posicionNumero,
        estado: nuevoIntegrante.estado
      });

    if (error) {
      console.error(
        "Error agregando integrante:",
        error
      );

      setMensaje(
        "No se pudo agregar el integrante."
      );

      return;
    }

    // Limpiar formulario
    setNuevoIntegrante({
      nombre: "",
      posicion: "",
      estado: "pendiente"
    });

    setMostrarModal(false);
    setMensaje("");

    // Recargar tabla
    await cargarParticipantes();
  };

  // =========================
  // SIN GRUPO
  // =========================

  if (!grupo) {
    return (
      <div
        className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          p-6
        "
      >
        <h2 className="text-xl font-bold">
          No perteneces a ningún grupo
        </h2>

        <p className="text-slate-500 mt-2">
          Cuando seas agregado a un cuadro,
          podrás administrar sus integrantes aquí.
        </p>
      </div>
    );
  }

  const cuposDisponibles =
    grupo.numero_integrantes -
    participantes.length;

  // =========================
  // UI
  // =========================

  return (
    <div className="max-w-7xl mx-auto space-y-7">

      {/* CABECERA */}

      <div
        className="
          flex
          flex-col
          md:flex-row
          md:items-center
          md:justify-between
          gap-4
        "
      >

        <div>
          <p
            className="
              text-sm
              font-semibold
              text-emerald-700
            "
          >
            Caja Comunal
          </p>

          <h1
            className="
              text-3xl
              font-bold
              text-slate-900
            "
          >
            {grupo.nombre}
          </h1>

          <p className="text-slate-500 mt-1">
            Administra los integrantes y posiciones
            del cuadro.
          </p>
        </div>

        <button
          onClick={() => {
            setMostrarModal(true);
            setMensaje("");
          }}
          className="
            flex
            items-center
            justify-center
            gap-2
            bg-emerald-600
            hover:bg-emerald-700
            text-white
            px-5
            py-3
            rounded-xl
            font-semibold
            transition
          "
        >
          <UserPlus size={20} />

          Agregar integrante
        </button>

      </div>

      {/* RESUMEN */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-5
        "
      >

        {/* INTEGRANTES */}

        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <div
            className="
              w-11
              h-11
              bg-emerald-50
              text-emerald-700
              rounded-xl
              flex
              items-center
              justify-center
            "
          >
            <Users size={22} />
          </div>

          <p className="text-sm text-slate-500 mt-4">
            Integrantes actuales
          </p>

          <p className="text-3xl font-bold text-slate-900">
            {participantes.length}
          </p>
        </div>


        {/* CUPOS */}

        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <div
            className="
              w-11
              h-11
              bg-orange-50
              text-orange-600
              rounded-xl
              flex
              items-center
              justify-center
            "
          >
            <Plus size={22} />
          </div>

          <p className="text-sm text-slate-500 mt-4">
            Cupos disponibles
          </p>

          <p className="text-3xl font-bold text-slate-900">
            {cuposDisponibles}
          </p>
        </div>


        {/* APORTE */}

        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <div
            className="
              w-11
              h-11
              bg-blue-50
              text-blue-600
              rounded-xl
              flex
              items-center
              justify-center
              font-bold
            "
          >
            $
          </div>

          <p className="text-sm text-slate-500 mt-4">
            Aporte semanal
          </p>

          <p className="text-3xl font-bold text-slate-900">
            $
            {Number(
              grupo.aporte_semanal
            ).toFixed(2)}
          </p>
        </div>

      </div>

      {/* TABLA */}

      <section
        className="
          bg-white
          rounded-3xl
          border
          border-slate-200
          shadow-sm
          overflow-hidden
        "
      >

        <div className="p-6 border-b border-slate-200">

          <h2 className="text-xl font-bold text-slate-900">
            Integrantes del grupo
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Cada integrante ocupa una posición
            dentro del cuadro.
          </p>

        </div>

        {loading ? (

          <div className="p-8 text-slate-500">
            Cargando integrantes...
          </div>

        ) : participantes.length === 0 ? (

          <div
            className="
              p-10
              text-center
              text-slate-500
            "
          >
            Todavía no existen integrantes
            registrados.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-slate-50">

                <tr>

                  <th
                    className="
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                      p-4
                    "
                  >
                    Puesto
                  </th>

                  <th
                    className="
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                      p-4
                    "
                  >
                    Integrante
                  </th>

                  <th
                    className="
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                      p-4
                    "
                  >
                    Estado
                  </th>

                </tr>

              </thead>

              <tbody>

                {participantes.map(
                  (participante) => (

                    <tr
                      key={participante.id}
                      className="
                        border-t
                        border-slate-100
                        hover:bg-slate-50
                        transition
                      "
                    >

                      {/* POSICIÓN */}

                      <td className="p-4">

                        <span
                          className="
                            w-9
                            h-9
                            inline-flex
                            items-center
                            justify-center
                            rounded-full
                            bg-emerald-50
                            text-emerald-700
                            font-bold
                          "
                        >
                          {participante.posicion}
                        </span>

                      </td>

                      {/* NOMBRE */}

                      <td
                        className="
                          p-4
                          font-medium
                          text-slate-900
                        "
                      >
                        {participante.nombre}
                      </td>

                      {/* ESTADO */}

                      <td className="p-4">

                        <span
                          className={`
                            px-3
                            py-1
                            rounded-full
                            text-xs
                            font-semibold

                            ${
                              participante.estado ===
                              "pagado"
                                ? "bg-emerald-100 text-emerald-700"

                                : participante.estado ===
                                  "recibido"
                                ? "bg-amber-100 text-amber-700"

                                : participante.estado ===
                                  "actual"
                                ? "bg-orange-100 text-orange-700"

                                : "bg-slate-100 text-slate-600"
                            }
                          `}
                        >
                          {participante.estado}
                        </span>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* ======================================
          MODAL AGREGAR INTEGRANTE
      ====================================== */}

      {mostrarModal && (

        <div
          className="
            fixed
            inset-0
            bg-black/40
            flex
            items-center
            justify-center
            z-50
            p-4
          "
        >

          <div
            className="
              bg-white
              w-full
              max-w-md
              rounded-3xl
              shadow-xl
              p-7
            "
          >

            <h2
              className="
                text-2xl
                font-bold
                text-slate-900
              "
            >
              Agregar integrante
            </h2>

            <p
              className="
                text-slate-500
                mt-1
                mb-6
              "
            >
              Asigna un integrante a un
              puesto disponible del cuadro.
            </p>

            <form
              onSubmit={agregarIntegrante}
              className="space-y-5"
            >

              {/* NOMBRE */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-2
                  "
                >
                  Nombre del integrante
                </label>

                <input
                  name="nombre"
                  value={
                    nuevoIntegrante.nombre
                  }
                  onChange={handleChange}
                  placeholder="Ej. Andrea López"
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


              {/* POSICIÓN */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-2
                  "
                >
                  Posición
                </label>

                <input
                  name="posicion"
                  type="number"
                  min="1"
                  max={
                    grupo.numero_integrantes
                  }
                  value={
                    nuevoIntegrante.posicion
                  }
                  onChange={handleChange}
                  placeholder="Ej. 8"
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

                <p
                  className="
                    text-xs
                    text-slate-400
                    mt-2
                  "
                >
                  Posiciones disponibles:
                  {" "}
                  {cuposDisponibles}
                </p>

              </div>


              {/* ESTADO */}

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-2
                  "
                >
                  Estado inicial
                </label>

                <select
                  name="estado"
                  value={
                    nuevoIntegrante.estado
                  }
                  onChange={handleChange}
                  className="
                    w-full
                    border
                    border-slate-300
                    rounded-xl
                    px-4
                    py-3
                    bg-white
                  "
                >

                  <option value="pendiente">
                    Pendiente
                  </option>

                  <option value="pagado">
                    Pagado
                  </option>

                </select>

              </div>


              {/* MENSAJE */}

              {mensaje && (

                <div
                  className="
                    bg-red-50
                    text-red-700
                    text-sm
                    rounded-xl
                    p-3
                  "
                >
                  {mensaje}
                </div>

              )}


              {/* BOTONES */}

              <div
                className="
                  flex
                  justify-end
                  gap-3
                  pt-3
                "
              >

                <button
                  type="button"
                  onClick={() => {

                    setMostrarModal(false);

                    setMensaje("");

                    setNuevoIntegrante({
                      nombre: "",
                      posicion: "",
                      estado: "pendiente"
                    });

                  }}
                  className="
                    px-4
                    py-2
                    rounded-xl
                    border
                    border-slate-300
                    text-slate-700
                    hover:bg-slate-50
                  "
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="
                    px-5
                    py-2
                    rounded-xl
                    bg-emerald-600
                    hover:bg-emerald-700
                    text-white
                    font-semibold
                  "
                >
                  Agregar integrante
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};

export default Grupos;