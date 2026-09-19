import { useEffect, useState } from "react";

import {
  Plus,
  Users,
  UserPlus,
  Play,
  LockKeyhole,
  AlertTriangle,
  Wrench
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";

const Grupos = () => {
  const {
    grupo,
    cargarGrupo
  } = useAuth();

  const { can } = usePermissions();

  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mostrarModal, setMostrarModal] = useState(false);

  const [
    mostrarConfirmacion,
    setMostrarConfirmacion
  ] = useState(false);

  const [
    mostrarCorreccion,
    setMostrarCorreccion
  ] = useState(false);

  const [
    iniciandoCuadro,
    setIniciandoCuadro
  ] = useState(false);

  const [
    corrigiendoGrupo,
    setCorrigiendoGrupo
  ] = useState(false);

  const [nuevoIntegrante, setNuevoIntegrante] = useState({
    nombre: "",
    posicion: "",
    estado: "pendiente"
  });

  const [mensaje, setMensaje] = useState("");

  // ========================================
  // CARGAR PARTICIPANTES
  // ========================================

  useEffect(() => {
    if (grupo?.id) {
      cargarParticipantes();
    } else {
      setLoading(false);
    }
  }, [grupo]);

  const cargarParticipantes = async () => {
    if (!grupo?.id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("participantes")
      .select("*")
      .eq("grupo_id", grupo.id)
      .order("posicion", {
        ascending: true
      });

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

  // ========================================
  // FORMULARIO
  // ========================================

  const handleChange = (e) => {
    setNuevoIntegrante({
      ...nuevoIntegrante,
      [e.target.name]: e.target.value
    });
  };

  // ========================================
  // AGREGAR INTEGRANTE
  // ========================================

  const agregarIntegrante = async (e) => {
    e.preventDefault();

    setMensaje("");

    const capacidad = Number(
      grupo.numero_integrantes
    );

    const posicionNumero = Number(
      nuevoIntegrante.posicion
    );

    if (!can("agregarIntegrantes")) {
      setMensaje(
        "No tienes permisos para agregar integrantes."
      );
      return;
    }

    if (!nuevoIntegrante.nombre.trim()) {
      setMensaje(
        "El nombre del integrante es obligatorio."
      );
      return;
    }

    if (grupo.estado !== "borrador") {
      setMensaje(
        "No puedes agregar integrantes porque el cuadro ya inició."
      );
      return;
    }

    if (
      participantes.length >=
      capacidad
    ) {
      setMensaje(
        "El grupo ya alcanzó el número máximo de integrantes."
      );
      return;
    }

    if (
      !posicionNumero ||
      posicionNumero < 1 ||
      posicionNumero > capacidad
    ) {
      setMensaje(
        `La posición debe estar entre 1 y ${capacidad}.`
      );
      return;
    }

    const posicionOcupada =
      participantes.some(
        (participante) =>
          Number(participante.posicion) ===
          posicionNumero
      );

    if (posicionOcupada) {
      setMensaje(
        "Esa posición ya está ocupada."
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
        error.message ||
        "No se pudo agregar el integrante."
      );

      return;
    }

    setNuevoIntegrante({
      nombre: "",
      posicion: "",
      estado: "pendiente"
    });

    setMostrarModal(false);
    setMensaje("");

    await cargarParticipantes();
  };

  // ========================================
  // SIN GRUPO
  // ========================================

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
        <h2 className="text-xl font-bold text-slate-900">
          No perteneces a ningún grupo
        </h2>

        <p className="text-slate-500 mt-2">
          Cuando seas agregado a un cuadro,
          podrás consultar sus integrantes aquí.
        </p>
      </div>
    );
  }

  // ========================================
  // CÁLCULOS
  // ========================================

  const capacidadGrupo =
    Number(grupo.numero_integrantes) || 0;

  const totalParticipantes =
    participantes.length;

  const cuposDisponibles =
    Math.max(
      capacidadGrupo - totalParticipantes,
      0
    );

  const grupoExcedido =
    totalParticipantes >
    capacidadGrupo;

  const grupoCompleto =
    totalParticipantes ===
    capacidadGrupo;

  const cuadroEsBorrador =
    grupo.estado === "borrador";

  const cuadroActivo =
    grupo.estado === "activo";

  const cuadroFinalizado =
    grupo.estado === "finalizado";

  const puedeAgregar =
    can("agregarIntegrantes") &&
    cuadroEsBorrador &&
    cuposDisponibles > 0;

  const puedeCorregir =
    can("corregirCapacidad") &&
    cuadroEsBorrador;

  const puedeIniciar =
    can("iniciarCuadro") &&
    cuadroEsBorrador &&
    grupoCompleto &&
    !grupoExcedido;

  const pozoActual =
    capacidadGrupo *
    Number(grupo.aporte_semanal || 0);

  const pozoCorregido =
    totalParticipantes *
    Number(grupo.aporte_semanal || 0);

  // ========================================
  // CORREGIR CAPACIDAD
  // ========================================

  const corregirCapacidadGrupo =
    async () => {

      if (!can("corregirCapacidad")) {
        setMensaje(
          "No tienes permisos para corregir la capacidad."
        );
        return;
      }

      if (!cuadroEsBorrador) {
        setMensaje(
          "La capacidad solo puede corregirse mientras el cuadro esté en borrador."
        );
        return;
      }

      setCorrigiendoGrupo(true);
      setMensaje("");

      const nuevaCapacidad =
        totalParticipantes;

      const { data, error } =
        await supabase
          .from("grupos")
          .update({
            numero_integrantes:
              nuevaCapacidad
          })
          .eq(
            "id",
            grupo.id
          )
          .select()
          .single();

      if (error) {
        console.error(
          "Error corrigiendo capacidad:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo corregir la capacidad."
        );

        setCorrigiendoGrupo(false);

        return;
      }

      if (
        cargarGrupo &&
        data?.id
      ) {
        await cargarGrupo(data.id);
      }

      setMostrarCorreccion(false);
      setCorrigiendoGrupo(false);
    };

  // ========================================
  // INICIAR CUADRO
  // ========================================

  const iniciarCuadro = async () => {
    if (!puedeIniciar) {
      return;
    }

    setIniciandoCuadro(true);
    setMensaje("");

    const { data, error } =
      await supabase
        .from("grupos")
        .update({
          estado: "activo",
          fecha_inicio:
            new Date().toISOString(),
          semana_actual: 1
        })
        .eq(
          "id",
          grupo.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Error iniciando cuadro:",
        error
      );

      setMensaje(
        error.message ||
        "No se pudo iniciar el cuadro."
      );

      setIniciandoCuadro(false);

      return;
    }

    if (
      cargarGrupo &&
      data?.id
    ) {
      await cargarGrupo(data.id);
    }

    setMostrarConfirmacion(false);
    setIniciandoCuadro(false);
  };

  // ========================================
  // UI
  // ========================================

  return (
    <div className="space-y-8">

      {/* CABECERA */}

      <div
        className="
          flex
          flex-col
          lg:flex-row
          lg:items-start
          lg:justify-between
          gap-6
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
              md:text-4xl
              font-bold
              text-slate-900
              mt-1
            "
          >
            {grupo.nombre}
          </h1>

          <p
            className="
              text-slate-500
              mt-2
            "
          >
            Consulta los integrantes y
            posiciones del cuadro.
          </p>

          {/* ESTADO */}

          <div className="mt-4">

            <span
              className={`
                inline-flex
                items-center
                rounded-full
                px-3
                py-1
                text-xs
                font-semibold

                ${
                  cuadroActivo
                    ? `
                      bg-emerald-100
                      text-emerald-700
                    `
                    : cuadroFinalizado
                    ? `
                      bg-slate-200
                      text-slate-700
                    `
                    : `
                      bg-amber-100
                      text-amber-700
                    `
                }
              `}
            >
              {cuadroActivo
                ? "● Cuadro activo"
                : cuadroFinalizado
                ? "Cuadro finalizado"
                : "● Borrador"
              }
            </span>

          </div>

        </div>


        {/* ACCIONES */}

        <div
          className="
            flex
            flex-wrap
            gap-3
          "
        >

          {/* AGREGAR */}

          {can("agregarIntegrantes") &&
            cuadroEsBorrador && (

            <button
              onClick={() => {
                if (puedeAgregar) {
                  setMostrarModal(true);
                  setMensaje("");
                }
              }}

              disabled={!puedeAgregar}

              className={`
                flex
                items-center
                justify-center
                gap-2
                px-5
                py-3
                rounded-xl
                font-semibold
                transition

                ${
                  puedeAgregar
                    ? `
                      bg-emerald-600
                      hover:bg-emerald-700
                      text-white
                    `
                    : `
                      bg-slate-200
                      text-slate-500
                      cursor-not-allowed
                    `
                }
              `}
            >
              <UserPlus size={20} />

              {cuposDisponibles === 0
                ? "Grupo completo"
                : "Agregar integrante"
              }
            </button>

          )}


          {/* INICIAR */}

          {can("iniciarCuadro") &&
            cuadroEsBorrador && (

            <button
              onClick={() =>
                setMostrarConfirmacion(true)
              }
              disabled={!puedeIniciar}
              className={`
                flex
                items-center
                gap-2
                px-5
                py-3
                rounded-xl
                font-semibold
                transition

                ${
                  puedeIniciar
                    ? `
                      bg-slate-900
                      text-white
                      hover:bg-slate-800
                    `
                    : `
                      bg-slate-200
                      text-slate-500
                      cursor-not-allowed
                    `
                }
              `}
            >
              <Play size={18} />
              Iniciar Cuadro
            </button>

          )}


          {/* BLOQUEADO */}

          {cuadroActivo && (

            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                bg-emerald-50
                text-emerald-700
                px-4
                py-3
                text-sm
                font-semibold
              "
            >
              <LockKeyhole size={18} />
              Estructura bloqueada
            </div>

          )}

        </div>

      </div>


      {/* RESUMEN */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        "
      >

        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-6
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

          <p className="text-sm text-slate-500 mt-5">
            Integrantes actuales
          </p>

          <p className="text-3xl font-bold text-slate-900 mt-1">
            {totalParticipantes}
          </p>
        </div>


        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-6
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

          <p className="text-sm text-slate-500 mt-5">
            Cupos disponibles
          </p>

          <p className="text-3xl font-bold text-slate-900 mt-1">
            {cuposDisponibles}
          </p>
        </div>


        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-6
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

          <p className="text-sm text-slate-500 mt-5">
            Aporte semanal
          </p>

          <p className="text-3xl font-bold text-slate-900 mt-1">
            $
            {Number(
              grupo.aporte_semanal
            ).toFixed(2)}
          </p>
        </div>

      </div>


      {/* ALERTA EXCEDIDO */}

      {grupoExcedido && (

        <div
          className="
            rounded-2xl
            border
            border-amber-200
            bg-amber-50
            px-5
            py-4
            text-amber-800
          "
        >
          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <AlertTriangle
              size={21}
              className="shrink-0 mt-0.5"
            />

            <div className="flex-1">

              <p className="font-semibold">
                El grupo supera la cantidad
                configurada de integrantes.
              </p>

              <p className="text-sm mt-1">
                Actualmente existen{" "}
                <strong>
                  {totalParticipantes}
                </strong>{" "}
                integrantes, pero el grupo
                está configurado para{" "}
                <strong>
                  {capacidadGrupo}
                </strong>.
              </p>

              <p className="text-sm mt-2">
                Debes corregir esta
                inconsistencia antes de
                iniciar las rondas.
              </p>

              {puedeCorregir && (

                <button
                  onClick={() =>
                    setMostrarCorreccion(true)
                  }
                  className="
                    mt-4
                    inline-flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    rounded-xl
                    bg-amber-600
                    hover:bg-amber-700
                    text-white
                    text-sm
                    font-semibold
                    transition
                  "
                >
                  <Wrench size={17} />
                  Resolver inconsistencia
                </button>

              )}

            </div>
          </div>
        </div>

      )}


      {/* BORRADOR INCOMPLETO */}

      {cuadroEsBorrador &&
        !grupoCompleto &&
        !grupoExcedido && (

        <div
          className="
            rounded-2xl
            border
            border-blue-200
            bg-blue-50
            px-5
            py-4
            text-blue-800
          "
        >
          <p className="font-semibold">
            El cuadro todavía no está
            listo para iniciar.
          </p>

          <p className="text-sm mt-1">
            Faltan{" "}
            <strong>
              {Math.max(
                capacidadGrupo -
                totalParticipantes,
                0
              )}
            </strong>{" "}
            integrantes para completar los{" "}
            <strong>
              {capacidadGrupo}
            </strong>{" "}
            puestos.
          </p>
        </div>

      )}


      {/* MENSAJE */}

      {mensaje && (

        <div
          className="
            rounded-xl
            border
            border-red-200
            bg-red-50
            text-red-700
            px-5
            py-4
            text-sm
          "
        >
          {mensaje}
        </div>

      )}


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

        <div
          className="
            p-6
            border-b
            border-slate-200
          "
        >
          <h2
            className="
              text-xl
              font-bold
              text-slate-900
            "
          >
            Integrantes del grupo
          </h2>

          <p
            className="
              text-sm
              text-slate-500
              mt-1
            "
          >
            Cada integrante ocupa una
            posición dentro del cuadro.
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

                  <th className="text-left text-sm font-semibold text-slate-600 p-4">
                    Puesto
                  </th>

                  <th className="text-left text-sm font-semibold text-slate-600 p-4">
                    Integrante
                  </th>

                  <th className="text-left text-sm font-semibold text-slate-600 p-4">
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


                      <td
                        className="
                          p-4
                          font-medium
                          text-slate-900
                        "
                      >
                        {participante.nombre}
                      </td>


                      <td className="p-4">

                        <span
                          className={`
                            px-3
                            py-1
                            rounded-full
                            text-xs
                            font-semibold

                            ${
                              participante.estado === "pagado"
                                ? `
                                  bg-emerald-100
                                  text-emerald-700
                                `
                                : participante.estado === "recibido"
                                ? `
                                  bg-amber-100
                                  text-amber-700
                                `
                                : participante.estado === "actual"
                                ? `
                                  bg-orange-100
                                  text-orange-700
                                `
                                : `
                                  bg-slate-100
                                  text-slate-600
                                `
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


      {/* MODAL AGREGAR */}

      {mostrarModal && (

        <div
          className="
            fixed
            inset-0
            z-50
            bg-black/40
            flex
            items-center
            justify-center
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
              Asigna un integrante a
              un puesto disponible.
            </p>

            <form
              onSubmit={agregarIntegrante}
              className="space-y-5"
            >

              <div>

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-2
                  "
                >
                  Nombre
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
                  max={capacidadGrupo}
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
                  Cupos disponibles:{" "}
                  {cuposDisponibles}
                </p>

              </div>


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


              {mensaje && (

                <div
                  className="
                    rounded-xl
                    bg-red-50
                    text-red-700
                    p-3
                    text-sm
                  "
                >
                  {mensaje}
                </div>

              )}


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


      {/* MODAL CORRECCIÓN */}

      {mostrarCorreccion && (

        <div
          className="
            fixed
            inset-0
            z-50
            bg-black/40
            flex
            items-center
            justify-center
            p-4
          "
        >

          <div
            className="
              bg-white
              w-full
              max-w-lg
              rounded-3xl
              shadow-xl
              p-7
            "
          >

            <p
              className="
                text-sm
                font-semibold
                text-amber-700
              "
            >
              Corrección administrativa
            </p>

            <h2
              className="
                text-2xl
                font-bold
                text-slate-900
                mt-1
              "
            >
              Ajustar capacidad del cuadro
            </h2>

            <p className="text-slate-500 mt-3">
              El grupo está configurado para{" "}
              <strong>
                {capacidadGrupo}
              </strong>{" "}
              integrantes, pero actualmente tiene{" "}
              <strong>
                {totalParticipantes}
              </strong>.
            </p>


            <div
              className="
                mt-6
                rounded-2xl
                bg-slate-50
                p-5
                space-y-3
              "
            >

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Capacidad actual
                </span>

                <strong>
                  {capacidadGrupo}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Integrantes registrados
                </span>

                <strong>
                  {totalParticipantes}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Nueva capacidad
                </span>

                <strong className="text-emerald-700">
                  {totalParticipantes}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Pozo actual
                </span>

                <strong>
                  ${pozoActual.toFixed(2)}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Nuevo pozo
                </span>

                <strong className="text-emerald-700">
                  ${pozoCorregido.toFixed(2)}
                </strong>
              </div>

            </div>


            <div
              className="
                mt-5
                rounded-xl
                border
                border-amber-200
                bg-amber-50
                p-4
                text-sm
                text-amber-800
              "
            >
              Esta corrección está permitida
              porque el cuadro aún está en
              borrador. Después de iniciarlo,
              la capacidad quedará bloqueada.
            </div>


            <div
              className="
                flex
                justify-end
                gap-3
                mt-7
              "
            >

              <button
                onClick={() =>
                  setMostrarCorreccion(false)
                }
                disabled={corrigiendoGrupo}
                className="
                  px-4
                  py-2.5
                  rounded-xl
                  border
                  border-slate-300
                  hover:bg-slate-50
                "
              >
                Cancelar
              </button>


              <button
                onClick={corregirCapacidadGrupo}
                disabled={corrigiendoGrupo}
                className="
                  px-5
                  py-2.5
                  rounded-xl
                  bg-amber-600
                  hover:bg-amber-700
                  text-white
                  font-semibold
                "
              >
                {corrigiendoGrupo
                  ? "Corrigiendo..."
                  : `Cambiar capacidad a ${totalParticipantes}`
                }
              </button>

            </div>

          </div>

        </div>

      )}


      {/* MODAL INICIAR */}

      {mostrarConfirmacion && (

        <div
          className="
            fixed
            inset-0
            z-50
            bg-black/40
            flex
            items-center
            justify-center
            p-4
          "
        >

          <div
            className="
              bg-white
              w-full
              max-w-lg
              rounded-3xl
              shadow-xl
              p-7
            "
          >

            <p
              className="
                text-sm
                font-semibold
                text-emerald-700
              "
            >
              Confirmar inicio
            </p>

            <h2
              className="
                text-2xl
                font-bold
                text-slate-900
                mt-1
              "
            >
              ¿Iniciar este cuadro?
            </h2>

            <p className="text-slate-500 mt-3">
              Una vez iniciado, la estructura
              principal quedará bloqueada.
            </p>


            <div
              className="
                bg-slate-50
                rounded-2xl
                p-5
                mt-6
                space-y-3
              "
            >

              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Integrantes
                </span>

                <strong>
                  {capacidadGrupo}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Aporte
                </span>

                <strong>
                  $
                  {Number(
                    grupo.aporte_semanal
                  ).toFixed(2)}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Pozo por ronda
                </span>

                <strong>
                  ${pozoActual.toFixed(2)}
                </strong>
              </div>


              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  Rondas
                </span>

                <strong>
                  {capacidadGrupo}
                </strong>
              </div>

            </div>


            <div
              className="
                rounded-xl
                border
                border-amber-200
                bg-amber-50
                p-4
                mt-5
                text-sm
                text-amber-800
              "
            >
              Después de iniciar el cuadro
              no podrás cambiar libremente
              la cantidad de integrantes.
            </div>


            <div
              className="
                flex
                justify-end
                gap-3
                mt-7
              "
            >

              <button
                onClick={() =>
                  setMostrarConfirmacion(false)
                }
                disabled={iniciandoCuadro}
                className="
                  px-4
                  py-2.5
                  rounded-xl
                  border
                  border-slate-300
                  hover:bg-slate-50
                "
              >
                Cancelar
              </button>


              <button
                onClick={iniciarCuadro}
                disabled={iniciandoCuadro}
                className="
                  px-5
                  py-2.5
                  rounded-xl
                  bg-emerald-600
                  hover:bg-emerald-700
                  text-white
                  font-semibold
                "
              >
                {iniciandoCuadro
                  ? "Iniciando..."
                  : "Sí, iniciar cuadro"
                }
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

export default Grupos;