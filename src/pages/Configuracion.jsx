import {
  useEffect,
  useState
} from "react";

import {
  Settings,
  Percent,
  CalendarRange,
  CircleDollarSign,
  Users,
  Wallet,
  FileBarChart2,
  ShieldCheck,
  Save,
  LockKeyhole,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  useAuth
} from "../context/AuthContext";

import {
  usePermissions
} from "../hooks/usePermissions";

import {
  actualizarConfiguracionGrupo
} from "../services/configuracionService";


const Configuracion = () => {

  const {
    grupo,
    cargarGrupo
  } = useAuth();

  const {
    rol
  } = usePermissions();


  // ========================================
  // FORMULARIO
  // ========================================

  const [
    form,
    setForm
  ] = useState({

    numeroIntegrantes: "",

    aporte: "",

    aportePeriodicidad: "semanal",

    interesPrestamo:
      "10",

    maxCuotasPrestamo:
      "12",

    montoMaxPrestamo:
      "",

    prestamosSoloActivo:
      true

  });


  const [
    guardando,
    setGuardando
  ] = useState(false);


  const [
    mensaje,
    setMensaje
  ] = useState("");


  const [
    tipoMensaje,
    setTipoMensaje
  ] = useState("");


  // ========================================
  // CARGAR CONFIGURACIÓN
  // ========================================

  useEffect(() => {

    if (!grupo) {
      return;
    }


    Promise.resolve().then(() => setForm({

      numeroIntegrantes: String(grupo.numero_integrantes ?? 2),

      aporte: String(grupo.aporte_semanal ?? 1),

      aportePeriodicidad: grupo.aporte_periodicidad || "semanal",

      interesPrestamo:
        String(
          grupo.interes_prestamo ??
          10
        ),

      maxCuotasPrestamo:
        String(
          grupo.max_cuotas_prestamo ??
          12
        ),

      montoMaxPrestamo:
        grupo.monto_max_prestamo !==
          null &&
        typeof grupo.monto_max_prestamo !==
          "undefined"

          ? String(
              grupo.monto_max_prestamo
            )

          : "",

      prestamosSoloActivo:
        grupo.prestamos_solo_activo ??
        true

    }));

  }, [
    grupo
  ]);


  // ========================================
  // CAMBIOS FORMULARIO
  // ========================================

  const handleChange =
    (e) => {

      const {
        name,
        value,
        type,
        checked
      } = e.target;


      setForm(
        (actual) => ({

          ...actual,

          [name]:
            type === "checkbox"
              ? checked
              : value

        })
      );


      // Limpiar mensaje al editar

      if (mensaje) {
        setMensaje("");
      }

    };


  // ========================================
  // GUARDAR
  // ========================================

  const guardarConfiguracion =
    async (e) => {

      e.preventDefault();


      if (!grupo?.id) {

        setMensaje(
          "No se encontró el grupo."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      // =====================================
      // VALORES
      // =====================================

      const interes =
        Number(
          form.interesPrestamo
        );


      const maxCuotas =
        Number(
          form.maxCuotasPrestamo
        );


      const montoMax =
        form.montoMaxPrestamo === ""

          ? null

          : Number(
              form.montoMaxPrestamo
            );

      const numeroIntegrantes = Number(form.numeroIntegrantes);
      const aporte = Number(form.aporte);

      if (!Number.isInteger(numeroIntegrantes) || numeroIntegrantes < 2 || numeroIntegrantes > 500) {
        setMensaje("La capacidad debe ser un número entero entre 2 y 500 socios.");
        setTipoMensaje("error");
        return;
      }

      if (Number.isNaN(aporte) || aporte <= 0) {
        setMensaje("El valor del aporte debe ser mayor a cero.");
        setTipoMensaje("error");
        return;
      }
      if (!["semanal", "quincenal", "mensual"].includes(form.aportePeriodicidad)) {
        setMensaje("Selecciona una periodicidad válida para el aporte.");
        setTipoMensaje("error");
        return;
      }

      if (grupo.estado !== "borrador" && (
        numeroIntegrantes !== Number(grupo.numero_integrantes)
        || aporte !== Number(grupo.aporte_semanal)
        || form.aportePeriodicidad !== (grupo.aporte_periodicidad || "semanal")
      )) {
        setMensaje("La capacidad, el valor y la periodicidad del aporte solo pueden cambiarse antes de iniciar el cuadro.");
        setTipoMensaje("error");
        return;
      }


      // =====================================
      // VALIDAR INTERÉS
      // =====================================

      if (
        Number.isNaN(
          interes
        ) ||
        interes < 0 ||
        interes > 100
      ) {

        setMensaje(
          "La tasa de interés debe estar entre 0% y 100%."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      // =====================================
      // VALIDAR CUOTAS
      // =====================================

      if (
        !Number.isInteger(
          maxCuotas
        ) ||
        maxCuotas < 1 ||
        maxCuotas > 60
      ) {

        setMensaje(
          "El máximo de cuotas debe ser un número entero entre 1 y 60."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      // =====================================
      // VALIDAR MONTO
      // =====================================

      if (
        montoMax !== null &&
        (
          Number.isNaN(
            montoMax
          ) ||
          montoMax <= 0
        )
      ) {

        setMensaje(
          "El monto máximo debe ser mayor a cero."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      // =====================================
      // GUARDAR
      // =====================================

      try {

        setGuardando(
          true
        );

        setMensaje("");


        const resultado =
          await actualizarConfiguracionGrupo({

            grupoId:
              grupo.id,

            numeroIntegrantes,

            aporte,

            aportePeriodicidad: form.aportePeriodicidad,

            interesPrestamo:
              interes,

            maxCuotasPrestamo:
              maxCuotas,

            montoMaxPrestamo:
              montoMax,

            prestamosSoloActivo:
              form.prestamosSoloActivo

          });


        // ===================================
        // RECARGAR GRUPO
        // ===================================

        if (
          cargarGrupo &&
          resultado?.grupo_id
        ) {

          await cargarGrupo(
            resultado.grupo_id
          );

        }


        setMensaje(
          resultado?.mensaje ||
          "Configuración guardada correctamente."
        );

        setTipoMensaje(
          "success"
        );


      } catch (error) {

        console.error(
          "Error actualizando configuración:",
          error
        );


        setMensaje(
          error.message ||
          "No se pudo guardar la configuración."
        );


        setTipoMensaje(
          "error"
        );


      } finally {

        setGuardando(
          false
        );

      }

    };


  // ========================================
  // SIN GRUPO
  // ========================================

  if (!grupo) {

    return (

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-6
        "
      >

        <h2
          className="
            text-xl
            font-bold
            text-slate-900
          "
        >
          No hay un grupo de trabajo seleccionado
        </h2>


        <p
          className="
            mt-2
            text-slate-500
          "
        >
          Selecciona un grupo desde el centro administrativo para revisar sus reglas.
        </p>

      </div>

    );

  }


  // ========================================
  // SEGURIDAD DE UI
  // ========================================

  if (
    rol !== "administrador"
  ) {

    return (

      <div
        className="
          rounded-2xl
          border
          border-red-200
          bg-red-50
          p-6
        "
      >

        <div
          className="
            flex
            items-start
            gap-3
          "
        >

          <AlertCircle
            size={22}
            className="
              mt-0.5
              text-red-600
            "
          />


          <div>

            <h2
              className="
                font-bold
                text-red-800
              "
            >
              Acceso restringido
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-red-700
              "
            >
              Solo el administrador
              puede modificar las reglas
              del grupo.
            </p>

          </div>

        </div>

      </div>

    );

  }


  // ========================================
  // UI
  // ========================================

  return (

    <div
      className="
        space-y-8
      "
    >

      {/* ==================================
          HEADER
      =================================== */}

      <div>

        <p
          className="
            text-sm
            font-semibold
            text-emerald-700
          "
        >
          Administración
        </p>


        <h1
          className="
            mt-1
            text-3xl
            font-bold
            text-slate-900
            md:text-4xl
          "
        >
          Configuración
        </h1>


        <p
          className="
            mt-2
            max-w-2xl
            text-slate-500
          "
        >
          Define las reglas financieras
          y operativas de{" "}

          <strong>
            {grupo.nombre}
          </strong>.
        </p>

      </div>


      {/* ==================================
          SEGURIDAD
      =================================== */}

      <div
        className="
          flex
          items-start
          gap-3
          rounded-2xl
          border
          border-emerald-200
          bg-emerald-50
          p-5
        "
      >

        <ShieldCheck
          size={22}
          className="
            mt-0.5
            shrink-0
            text-emerald-700
          "
        />


        <div>

          <p
            className="
              font-semibold
              text-emerald-900
            "
          >
            Configuración protegida
          </p>


          <p
            className="
              mt-1
              text-sm
              text-emerald-800
            "
          >
            La capacidad y el aporte por periodo definen el cuadro. La tasa y los límites financieros quedan configurados para cuando se habiliten los préstamos.
          </p>

        </div>

      </div>


      {/* ==================================
          FORMULARIO
      =================================== */}

      <form
        onSubmit={
          guardarConfiguracion
        }
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >

        {/* HEADER */}

        <div
          className="
            border-b
            border-slate-200
            p-6
            md:p-7
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-emerald-50
                text-emerald-700
              "
            >
              <Settings
                size={21}
              />
            </div>


            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                Reglas del grupo y del cuadro
              </h2>


              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Ajusta la capacidad, el aporte por periodo y las reglas financieras de {grupo.nombre}.
              </p>

            </div>

          </div>

        </div>


        {/* CAMPOS */}

        <div
          className="
            grid
            grid-cols-1
            gap-6
            p-6
            md:grid-cols-2
            md:p-7
          "
        >

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="numeroIntegrantes">Capacidad del cuadro</label>
            <div className="relative">
              <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="numeroIntegrantes" name="numeroIntegrantes" type="number" min="2" max="500" step="1" required value={form.numeroIntegrantes} onChange={handleChange} disabled={grupo.estado !== "borrador" || guardando} className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
            <p className="mt-2 text-xs text-slate-500">De 2 a 500 socios. Solo editable antes de iniciar.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="aporte">Valor del aporte por socio</label>
            <div className="relative">
              <Wallet size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="aporte" name="aporte" type="number" min="0.01" step="0.01" required value={form.aporte} onChange={handleChange} disabled={grupo.estado !== "borrador" || guardando} className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="aportePeriodicidad">Periodicidad</label>
            <select id="aportePeriodicidad" name="aportePeriodicidad" value={form.aportePeriodicidad} onChange={handleChange} disabled={grupo.estado !== "borrador" || guardando} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">Monto por periodo de aporte. Solo editable antes de iniciar.</p>
          </div>

          {/* =================================
              INTERÉS
          ================================== */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Tasa de interés
            </label>


            <div
              className="
                relative
              "
            >

              <Percent
                size={18}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />


              <input
                name="interesPrestamo"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={
                  form.interesPrestamo
                }
                onChange={
                  handleChange
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  py-3
                  pl-11
                  pr-4
                  outline-none
                  transition
                  focus:border-emerald-500
                  focus:ring-2
                  focus:ring-emerald-500/20
                "
              />

            </div>


            <p
              className="
                mt-2
                text-xs
                text-slate-500
              "
            >
              Tasa configurada para cuando se habilite la función de préstamos.
            </p>

          </div>


          {/* =================================
              CUOTAS
          ================================== */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Máximo de cuotas
            </label>


            <div
              className="
                relative
              "
            >

              <CalendarRange
                size={18}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />


              <input
                name="maxCuotasPrestamo"
                type="number"
                min="1"
                max="60"
                step="1"
                required
                value={
                  form.maxCuotasPrestamo
                }
                onChange={
                  handleChange
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  py-3
                  pl-11
                  pr-4
                  outline-none
                  transition
                  focus:border-emerald-500
                  focus:ring-2
                  focus:ring-emerald-500/20
                "
              />

            </div>


            <p
              className="
                mt-2
                text-xs
                text-slate-500
              "
            >
              Cantidad máxima permitida
              para el plan de pagos.
            </p>

          </div>


          {/* =================================
              MONTO MÁXIMO
          ================================== */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Monto máximo por préstamo
            </label>


            <div
              className="
                relative
              "
            >

              <CircleDollarSign
                size={18}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />


              <input
                name="montoMaxPrestamo"
                type="number"
                min="0.01"
                step="0.01"
                value={
                  form.montoMaxPrestamo
                }
                onChange={
                  handleChange
                }
                placeholder="Ej. 500"
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-300
                  py-3
                  pl-11
                  pr-4
                  outline-none
                  transition
                  focus:border-emerald-500
                  focus:ring-2
                  focus:ring-emerald-500/20
                "
              />

            </div>


            <p
              className="
                mt-2
                text-xs
                text-slate-500
              "
            >
              Déjalo vacío si no deseas
              establecer un límite adicional.
            </p>

          </div>


          {/* =================================
              SOLO ACTIVO
          ================================== */}

          <div>

            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Estado del módulo de préstamos
            </label>


            <label
              className="
                flex
                cursor-not-allowed
                items-center
                justify-between
                gap-4
                rounded-2xl
                border
                border-slate-200
                bg-slate-50
                p-4
              "
            >

              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >

                <LockKeyhole
                  size={20}
                  className="
                    mt-0.5
                    shrink-0
                    text-emerald-700
                  "
                />


                <div>

                  <p
                    className="
                      font-semibold
                      text-slate-900
                    "
                  >
                    Inactivo temporalmente
                  </p>


                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    No se pueden solicitar ni aprobar préstamos desde la aplicación.
                  </p>

                </div>

              </div>


              <input
                name="prestamosSoloActivo"
                type="checkbox"
                checked={
                  form.prestamosSoloActivo
                }
                disabled
                className="
                  h-5
                  w-5
                  shrink-0
                  accent-emerald-600
                "
              />

            </label>

          </div>

        </div>


        {/* ==================================
            RESUMEN
        =================================== */}

        <div
          className="
            border-t
            border-slate-200
            bg-slate-50
            p-6
            md:p-7
          "
        >

          <p
            className="
              text-sm
              font-semibold
              text-slate-700
            "
          >
            Resumen de configuración del cuadro
          </p>


          <div
            className="
              mt-4
              grid
              grid-cols-2
              gap-5
              md:grid-cols-3
            "
          >

            <div>
              <p className="text-xs text-slate-500">Capacidad</p>
              <p className="mt-1 font-bold text-slate-900">{form.numeroIntegrantes} socios</p>
            </div>

            <div>
              <p className="text-xs capitalize text-slate-500">Aporte {form.aportePeriodicidad}</p>
              <p className="mt-1 font-bold text-slate-900">${Number(form.aporte || 0).toFixed(2)}</p>
            </div>

            <div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Interés
              </p>

              <p
                className="
                  mt-1
                  font-bold
                  text-slate-900
                "
              >
                {Number(
                  form.interesPrestamo ||
                  0
                ).toFixed(2)}
                %
              </p>

            </div>


            <div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Máximo cuotas
              </p>

              <p
                className="
                  mt-1
                  font-bold
                  text-slate-900
                "
              >
                {form.maxCuotasPrestamo}
              </p>

            </div>


            <div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Monto máximo
              </p>

              <p
                className="
                  mt-1
                  font-bold
                  text-slate-900
                "
              >
                {form.montoMaxPrestamo

                  ? `$${Number(
                      form.montoMaxPrestamo
                    ).toFixed(2)}`

                  : "Sin límite"
                }
              </p>

            </div>


            <div>

              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Requiere cuadro activo
              </p>

              <p
                className="
                  mt-1
                  font-bold
                  text-slate-900
                "
              >
                {form.prestamosSoloActivo
                  ? "Sí"
                  : "No"
                }
              </p>

            </div>

          </div>

        </div>


        {/* ==================================
            MENSAJE
        =================================== */}

        {mensaje && (

          <div
            className="
              border-t
              border-slate-200
              p-6
              md:p-7
            "
          >

            <div
              className={`
                flex
                items-start
                gap-3
                rounded-xl
                border
                p-4
                text-sm

                ${
                  tipoMensaje ===
                  "success"

                    ? `
                      border-emerald-200
                      bg-emerald-50
                      text-emerald-800
                    `

                    : `
                      border-red-200
                      bg-red-50
                      text-red-700
                    `
                }
              `}
            >

              {tipoMensaje ===
              "success"

                ? (
                  <CheckCircle2
                    size={19}
                    className="
                      mt-0.5
                      shrink-0
                    "
                  />
                )

                : (
                  <AlertCircle
                    size={19}
                    className="
                      mt-0.5
                      shrink-0
                    "
                  />
                )
              }


              <span>
                {mensaje}
              </span>

            </div>

          </div>

        )}


        {/* ==================================
            BOTÓN
        =================================== */}

        <div
          className="
            flex
            justify-end
            border-t
            border-slate-200
            p-6
            md:p-7
          "
        >

          <button
            type="submit"
            disabled={
              guardando
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-5
              py-3
              font-semibold
              text-white
              transition
              hover:bg-emerald-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >

            <Save
              size={18}
            />


            {guardando
              ? "Guardando..."
              : "Guardar configuración"
            }

          </button>

        </div>

      </form>

      <section className="flex flex-col gap-4 border-y border-slate-200 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Reportes y auditoría</h2>
          <p className="mt-1 text-sm text-slate-600">Consulta y exporta los movimientos consolidados de todos los grupos.</p>
        </div>
        <Link to="/historial" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
          <FileBarChart2 size={17} /> Abrir reportes
        </Link>
      </section>

    </div>

  );

};

export default Configuracion;