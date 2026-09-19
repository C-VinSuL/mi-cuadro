import {
  useEffect,
  useState
} from "react";

import {
  HandCoins,
  Plus,
  Clock3,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  PiggyBank,
  Percent,
  AlertTriangle,
  CalendarDays,
  Banknote,
  Activity
} from "lucide-react";

import {
  useAuth
} from "../../context/AuthContext";

import {
  usePermissions
} from "../../hooks/usePermissions";

import {
  obtenerPrestamosGrupo,
  obtenerPrestamosSocio,
  solicitarPrestamo,
  aprobarPrestamo,
  rechazarPrestamo,
  obtenerCuotasPrestamo,
  pagarCuotaPrestamo,
  obtenerResumenCuotasPrestamo
} from "../../services/prestamosService";


const Prestamos = () => {

  const {
    grupo,
    participant,
    fondoComunitario,
    cargarFondoComunitario
  } = useAuth();

  const {
    can,
    rol
  } = usePermissions();


  // =====================================================
  // ESTADOS
  // =====================================================

  const [
    prestamos,
    setPrestamos
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    mensaje,
    setMensaje
  ] = useState("");

  const [
    tipoMensaje,
    setTipoMensaje
  ] = useState("");

  const [
    procesando,
    setProcesando
  ] = useState(false);


  // =====================================================
  // MODALES
  // =====================================================

  const [
    mostrarSolicitud,
    setMostrarSolicitud
  ] = useState(false);

  const [
    mostrarRechazo,
    setMostrarRechazo
  ] = useState(false);

  const [
    mostrarCuotas,
    setMostrarCuotas
  ] = useState(false);


  // =====================================================
  // PRÉSTAMO SELECCIONADO
  // =====================================================

  const [
    prestamoSeleccionado,
    setPrestamoSeleccionado
  ] = useState(null);


  // =====================================================
  // CUOTAS
  // =====================================================

  const [
    cuotas,
    setCuotas
  ] = useState([]);

  const [
    cargandoCuotas,
    setCargandoCuotas
  ] = useState(false);

  const [
    resumenPrestamo,
    setResumenPrestamo
  ] = useState(null);


  // =====================================================
  // RECHAZO
  // =====================================================

  const [
    motivoRechazo,
    setMotivoRechazo
  ] = useState("");


  // =====================================================
  // FORMULARIO
  // =====================================================

  const [
    form,
    setForm
  ] = useState({
    monto: "",
    cuotas: "6",
    motivo: ""
  });


  // =====================================================
  // CONFIGURACIÓN DEL GRUPO
  // =====================================================

  const tasaInteres =
    Number(
      grupo?.interes_prestamo || 0
    );

  const maxCuotas =
    Number(
      grupo?.max_cuotas_prestamo || 12
    );

  const montoMaximo =
    grupo?.monto_max_prestamo
      ? Number(
          grupo.monto_max_prestamo
        )
      : null;

  const requiereCuadroActivo =
    grupo?.prestamos_solo_activo === true;

  const prestamosDisponibles =
    !requiereCuadroActivo ||
    grupo?.estado === "activo";


  // =====================================================
  // CARGAR PRÉSTAMOS
  // =====================================================

  const cargarPrestamos =
    async () => {

      if (
        !grupo?.id ||
        !participant?.id
      ) {
        setLoading(false);
        return;
      }

      try {

        setLoading(true);

        let resultado = [];

        if (
          can("aprobarPrestamos")
        ) {

          resultado =
            await obtenerPrestamosGrupo(
              grupo.id
            );

        } else {

          resultado =
            await obtenerPrestamosSocio(
              participant.id
            );

        }

        setPrestamos(
          resultado || []
        );

      } catch (error) {

        console.error(
          "Error cargando préstamos:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudieron cargar los préstamos."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setLoading(false);

      }

    };


  useEffect(() => {

    cargarPrestamos();

  }, [
    grupo?.id,
    participant?.id,
    rol
  ]);


  // =====================================================
  // FORMULARIO
  // =====================================================

  const handleChange =
    (e) => {

      setForm({
        ...form,
        [e.target.name]:
          e.target.value
      });

    };


  // =====================================================
  // SOLICITAR PRÉSTAMO
  // =====================================================

  const enviarSolicitud =
    async (e) => {

      e.preventDefault();

      if (
        !can("solicitarPrestamo")
      ) {
        return;
      }

      const monto =
        Number(
          form.monto
        );

      const cuotasNumero =
        Number(
          form.cuotas
        );


      if (
        requiereCuadroActivo &&
        grupo?.estado !== "activo"
      ) {

        setMensaje(
          "Los préstamos solo están disponibles mientras el cuadro esté activo."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      if (
        !monto ||
        monto <= 0
      ) {

        setMensaje(
          "Ingresa un monto válido."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      if (
        montoMaximo !== null &&
        monto > montoMaximo
      ) {

        setMensaje(
          `El monto máximo permitido es $${montoMaximo.toFixed(
            2
          )}.`
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      if (
        !cuotasNumero ||
        cuotasNumero <= 0
      ) {

        setMensaje(
          "El número de cuotas debe ser mayor a cero."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      if (
        cuotasNumero >
        maxCuotas
      ) {

        setMensaje(
          `El máximo permitido es de ${maxCuotas} cuotas.`
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      try {

        setProcesando(true);
        setMensaje("");


        await solicitarPrestamo({
          monto,

          cuotas:
            cuotasNumero,

          motivo:
            form.motivo
        });


        setMensaje(
          "Solicitud enviada correctamente."
        );

        setTipoMensaje(
          "success"
        );


        setForm({
          monto: "",
          cuotas:
            String(
              Math.min(
                6,
                maxCuotas
              )
            ),
          motivo: ""
        });


        setMostrarSolicitud(
          false
        );


        await cargarPrestamos();

      } catch (error) {

        console.error(
          "Error solicitando préstamo:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo enviar la solicitud."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setProcesando(false);

      }

    };


  // =====================================================
  // APROBAR
  // =====================================================

  const aprobar =
    async (prestamo) => {

      if (
        !can("aprobarPrestamos")
      ) {
        return;
      }


      const fondoSuficiente =
        Number(
          fondoComunitario || 0
        ) >=
        Number(
          prestamo.monto || 0
        );


      if (
        !fondoSuficiente
      ) {

        setMensaje(
          `Fondo insuficiente. Disponible: $${Number(
            fondoComunitario || 0
          ).toFixed(2)}, solicitado: $${Number(
            prestamo.monto || 0
          ).toFixed(2)}.`
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      try {

        setProcesando(true);
        setMensaje("");


        await aprobarPrestamo(
          prestamo.id
        );


        await cargarFondoComunitario(
          grupo.id
        );


        setMensaje(
          "Préstamo aprobado correctamente."
        );

        setTipoMensaje(
          "success"
        );


        await cargarPrestamos();

      } catch (error) {

        console.error(
          "Error aprobando préstamo:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo aprobar el préstamo."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setProcesando(false);

      }

    };


  // =====================================================
  // RECHAZAR
  // =====================================================

  const abrirRechazo =
    (prestamo) => {

      setPrestamoSeleccionado(
        prestamo
      );

      setMotivoRechazo("");

      setMostrarRechazo(
        true
      );

    };


  const confirmarRechazo =
    async () => {

      if (
        !prestamoSeleccionado
      ) {
        return;
      }


      if (
        !motivoRechazo.trim()
      ) {

        setMensaje(
          "Indica el motivo del rechazo."
        );

        setTipoMensaje(
          "error"
        );

        return;

      }


      try {

        setProcesando(true);
        setMensaje("");


        await rechazarPrestamo(
          prestamoSeleccionado.id,
          motivoRechazo
        );


        setMostrarRechazo(
          false
        );

        setMotivoRechazo("");

        setPrestamoSeleccionado(
          null
        );


        setMensaje(
          "Solicitud rechazada correctamente."
        );

        setTipoMensaje(
          "success"
        );


        await cargarPrestamos();

      } catch (error) {

        console.error(
          "Error rechazando préstamo:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo rechazar la solicitud."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setProcesando(false);

      }

    };


  // =====================================================
  // VER CUOTAS
  // =====================================================

  const verCuotas =
    async (prestamo) => {

      try {

        setPrestamoSeleccionado(
          prestamo
        );

        setMostrarCuotas(
          true
        );

        setCargandoCuotas(
          true
        );

        setResumenPrestamo(
          null
        );


        const [
          cuotasData,
          resumenData
        ] = await Promise.all([

          obtenerCuotasPrestamo(
            prestamo.id
          ),

          obtenerResumenCuotasPrestamo(
            prestamo.id
          )

        ]);


        setCuotas(
          cuotasData || []
        );

        setResumenPrestamo(
          resumenData
        );

      } catch (error) {

        console.error(
          "Error cargando cuotas:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo cargar el plan de pagos."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setCargandoCuotas(
          false
        );

      }

    };


  // =====================================================
  // PAGAR CUOTA
  // =====================================================

  const pagarCuota =
    async (cuota) => {

      if (
        cuota.estado === "pagado"
      ) {
        return;
      }


      try {

        setProcesando(true);
        setMensaje("");


        const resultado =
          await pagarCuotaPrestamo(
            cuota.id
          );


        const [
          nuevasCuotas,
          nuevoResumen
        ] = await Promise.all([

          obtenerCuotasPrestamo(
            cuota.prestamo_id
          ),

          obtenerResumenCuotasPrestamo(
            cuota.prestamo_id
          )

        ]);


        setCuotas(
          nuevasCuotas || []
        );

        setResumenPrestamo(
          nuevoResumen
        );


        await cargarFondoComunitario(
          grupo.id
        );


        await cargarPrestamos();


        setMensaje(
          resultado?.mensaje ||
          "Cuota pagada correctamente."
        );

        setTipoMensaje(
          "success"
        );

      } catch (error) {

        console.error(
          "Error pagando cuota:",
          error
        );

        setMensaje(
          error.message ||
          "No se pudo registrar el pago."
        );

        setTipoMensaje(
          "error"
        );

      } finally {

        setProcesando(false);

      }

    };


  // =====================================================
  // HELPERS
  // =====================================================

  const estiloEstado =
    (estado) => {

      switch (estado) {

        case "aprobado":

          return `
            bg-emerald-100
            text-emerald-700
          `;

        case "rechazado":

          return `
            bg-red-100
            text-red-700
          `;

        case "pagado":

          return `
            bg-blue-100
            text-blue-700
          `;

        default:

          return `
            bg-amber-100
            text-amber-700
          `;

      }

    };


  const textoEstado =
    (estado) => {

      switch (estado) {

        case "aprobado":
          return "Aprobado";

        case "rechazado":
          return "Rechazado";

        case "pagado":
          return "Pagado";

        default:
          return "Pendiente";

      }

    };


  const iconoEstado =
    (estado) => {

      if (
        estado === "aprobado" ||
        estado === "pagado"
      ) {

        return (
          <CheckCircle2
            size={14}
          />
        );

      }


      if (
        estado === "rechazado"
      ) {

        return (
          <XCircle
            size={14}
          />
        );

      }


      return (
        <Clock3
          size={14}
        />
      );

    };


  const calcularDiasAtraso =
    (fecha) => {

      if (!fecha) {
        return 0;
      }


      const hoy =
        new Date();

      hoy.setHours(
        0,
        0,
        0,
        0
      );


      const vencimiento =
        new Date(
          `${fecha}T00:00:00`
        );


      const diferencia =
        hoy -
        vencimiento;


      return Math.max(

        Math.floor(
          diferencia /
          (
            1000 *
            60 *
            60 *
            24
          )
        ),

        0

      );

    };


  const cuotaEstaVencida =
    (cuota) => {

      if (
        !cuota ||
        cuota.estado === "pagado" ||
        !cuota.fecha_vencimiento
      ) {
        return false;
      }


      return (
        calcularDiasAtraso(
          cuota.fecha_vencimiento
        ) > 0
      );

    };


  const cuotaVenceHoy =
    (cuota) => {

      if (
        !cuota ||
        cuota.estado === "pagado" ||
        !cuota.fecha_vencimiento
      ) {
        return false;
      }


      const hoy =
        new Date();


      const vencimiento =
        new Date(
          `${cuota.fecha_vencimiento}T00:00:00`
        );


      return (

        hoy.getFullYear() ===
          vencimiento.getFullYear() &&

        hoy.getMonth() ===
          vencimiento.getMonth() &&

        hoy.getDate() ===
          vencimiento.getDate()

      );

    };


  const formatearFecha =
    (fecha) => {

      if (!fecha) {
        return "-";
      }


      return new Date(
        fecha
      ).toLocaleDateString(
        "es-EC"
      );

    };


  // =====================================================
  // CÁLCULOS FORMULARIO
  // =====================================================

  const montoFormulario =
    Number(
      form.monto || 0
    );


  const interesEstimado =
    montoFormulario *
    (
      tasaInteres /
      100
    );


  const totalEstimado =
    montoFormulario +
    interesEstimado;


  const cuotasFormulario =
    Number(
      form.cuotas || 1
    );


  const cuotaEstimada =
    cuotasFormulario > 0
      ? totalEstimado /
        cuotasFormulario
      : 0;


  // =====================================================
  // SIN GRUPO
  // =====================================================

  if (!grupo) {

    return (

      <div
        className="
          rounded-3xl
          border
          border-slate-200
          bg-white
          p-8
        "
      >

        <h2
          className="
            text-xl
            font-bold
            text-slate-900
          "
        >
          No perteneces a ningún grupo
        </h2>

        <p
          className="
            mt-2
            text-slate-500
          "
        >
          Necesitas pertenecer a un cuadro
          para utilizar el módulo de préstamos.
        </p>

      </div>

    );

  }


  return (

    <div
      className="
        space-y-6
        pb-10
      "
    >

      {/* =================================================
          CABECERA
      ================================================= */}

      <section
        className="
          grid
          grid-cols-1
          gap-6
          xl:grid-cols-[1fr_1.25fr_auto]
          xl:items-center
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
            Fondo comunitario
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
            Préstamos
          </h1>

          <p
            className="
              mt-2
              text-slate-500
            "
          >
            {can("aprobarPrestamos")
              ? "Gestiona las solicitudes de préstamos del grupo."
              : "Solicita y consulta tus préstamos personales."
            }
          </p>

        </div>


        {/* FONDO */}

        <div
          className="
            rounded-3xl
            bg-gradient-to-br
            from-emerald-600
            to-teal-800
            p-6
            text-white
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              gap-6
            "
          >

            <div>

              <p
                className="
                  text-sm
                  text-emerald-100
                "
              >
                Fondo comunitario actual
              </p>

              <p
                className="
                  mt-1
                  text-3xl
                  font-bold
                "
              >
                $
                {Number(
                  fondoComunitario || 0
                ).toFixed(2)}
              </p>

              <p
                className="
                  mt-2
                  text-sm
                  text-emerald-100
                "
              >
                Disponible para apoyar
                préstamos del grupo.
              </p>

            </div>


            <div
              className="
                flex
                h-16
                w-16
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-white/10
              "
            >
              <PiggyBank
                size={30}
              />
            </div>

          </div>

        </div>


        {/* SOLICITAR */}

        {can(
          "solicitarPrestamo"
        ) && (

          <button
            onClick={() => {

              if (
                !prestamosDisponibles
              ) {

                setMensaje(
                  "Los préstamos no están disponibles porque el cuadro no está activo."
                );

                setTipoMensaje(
                  "error"
                );

                return;

              }


              setMostrarSolicitud(
                true
              );

              setMensaje("");

            }}
            disabled={
              !prestamosDisponibles
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              px-5
              py-3
              font-semibold
              transition

              ${
                prestamosDisponibles

                  ? `
                    bg-emerald-600
                    text-white
                    hover:bg-emerald-700
                  `

                  : `
                    cursor-not-allowed
                    bg-slate-200
                    text-slate-500
                  `
              }
            `}
          >

            <Plus
              size={19}
            />

            Solicitar préstamo

          </button>

        )}

      </section>


      {/* =================================================
          REGLAS
      ================================================= */}

      <section
        className="
          grid
          grid-cols-2
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
          lg:grid-cols-4
        "
      >

        <div
          className="
            flex
            items-center
            gap-4
            border-b
            border-r
            border-slate-200
            p-5
            lg:border-b-0
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-emerald-700
            "
          >
            <Percent
              size={21}
            />
          </div>

          <div>

            <p className="text-xs text-slate-500">
              Tasa vigente
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {tasaInteres.toFixed(2)}%
            </p>

          </div>

        </div>


        <div
          className="
            flex
            items-center
            gap-4
            border-b
            border-slate-200
            p-5
            lg:border-b-0
            lg:border-r
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-blue-50
              text-blue-600
            "
          >
            <CalendarDays
              size={21}
            />
          </div>

          <div>

            <p className="text-xs text-slate-500">
              Máximo de cuotas
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {maxCuotas} cuotas
            </p>

          </div>

        </div>


        <div
          className="
            flex
            items-center
            gap-4
            border-r
            border-slate-200
            p-5
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-emerald-700
            "
          >
            <Banknote
              size={21}
            />
          </div>

          <div>

            <p className="text-xs text-slate-500">
              Monto máximo
            </p>

            <p className="mt-1 font-bold text-slate-900">
              {montoMaximo !== null
                ? `$${montoMaximo.toFixed(
                    2
                  )}`
                : "Sin límite"
              }
            </p>

          </div>

        </div>


        <div
          className="
            flex
            items-center
            gap-4
            p-5
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-emerald-700
            "
          >
            <Activity
              size={21}
            />
          </div>

          <div>

            <p className="text-xs text-slate-500">
              Estado del cuadro
            </p>

            <p
              className={`
                mt-1
                flex
                items-center
                gap-2
                font-bold

                ${
                  grupo?.estado ===
                  "activo"
                    ? "text-emerald-700"
                    : "text-amber-600"
                }
              `}
            >

              <span
                className={`
                  h-2
                  w-2
                  rounded-full

                  ${
                    grupo?.estado ===
                    "activo"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  }
                `}
              />

              {grupo?.estado
                ? grupo.estado
                    .charAt(0)
                    .toUpperCase() +
                  grupo.estado.slice(1)
                : "Sin definir"
              }

            </p>

          </div>

        </div>

      </section>


      {/* =================================================
          MENSAJE
      ================================================= */}

      {mensaje && (

        <div
          className={`
            rounded-2xl
            border
            px-5
            py-4
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
          {mensaje}
        </div>

      )}


      {/* =================================================
          TABLA DE PRÉSTAMOS
      ================================================= */}

      <section
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >

        <div
          className="
            border-b
            border-slate-200
            px-6
            py-5
          "
        >

          <h2
            className="
              text-xl
              font-bold
              text-slate-900
            "
          >
            {can("aprobarPrestamos")
              ? "Solicitudes del grupo"
              : "Mis préstamos"
            }
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            Consulta el estado y detalle
            de cada solicitud.
          </p>

        </div>


        {loading ? (

          <div
            className="
              p-10
              text-center
              text-slate-500
            "
          >
            Cargando préstamos...
          </div>

        ) : prestamos.length === 0 ? (

          <div
            className="
              p-12
              text-center
            "
          >

            <HandCoins
              size={42}
              className="
                mx-auto
                text-slate-300
              "
            />

            <p
              className="
                mt-4
                font-semibold
                text-slate-700
              "
            >
              No existen préstamos registrados
            </p>

          </div>

        ) : (

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                min-w-[850px]
              "
            >

              <thead
                className="
                  bg-slate-50
                "
              >

                <tr>

                  {can(
                    "aprobarPrestamos"
                  ) && (

                    <th
                      className="
                        px-6
                        py-4
                        text-left
                        text-xs
                        font-semibold
                        uppercase
                        tracking-wide
                        text-slate-500
                      "
                    >
                      Socio
                    </th>

                  )}


                  <th
                    className="
                      px-6
                      py-4
                      text-left
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Monto
                  </th>


                  <th
                    className="
                      px-6
                      py-4
                      text-left
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Cuotas
                  </th>


                  <th
                    className="
                      px-6
                      py-4
                      text-left
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Estado
                  </th>


                  <th
                    className="
                      px-6
                      py-4
                      text-left
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Fecha
                  </th>


                  <th
                    className="
                      px-6
                      py-4
                      text-right
                      text-xs
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-500
                    "
                  >
                    Acciones
                  </th>

                </tr>

              </thead>


              <tbody>

                {prestamos.map(
                  (prestamo) => {

                    const fondoSuficiente =
                      Number(
                        fondoComunitario || 0
                      ) >=
                      Number(
                        prestamo.monto || 0
                      );


                    const puedeVerPlan =
                      prestamo.estado ===
                        "aprobado" ||
                      prestamo.estado ===
                        "pagado";


                    return (

                      <tr
                        key={
                          prestamo.id
                        }
                        className="
                          border-t
                          border-slate-100
                          transition
                          hover:bg-slate-50/70
                        "
                      >

                        {/* SOCIO */}

                        {can(
                          "aprobarPrestamos"
                        ) && (

                          <td
                            className="
                              px-6
                              py-5
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
                                  h-10
                                  w-10
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-full
                                  bg-emerald-100
                                  text-sm
                                  font-bold
                                  text-emerald-700
                                "
                              >
                                {(
                                  prestamo
                                    .participantes
                                    ?.nombre ||
                                  "S"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>


                              <div>

                                <p
                                  className="
                                    font-semibold
                                    text-slate-900
                                  "
                                >
                                  {prestamo
                                    .participantes
                                    ?.nombre ||
                                    "Socio"}
                                </p>

                                {prestamo
                                  .participantes
                                  ?.posicion && (

                                  <p
                                    className="
                                      mt-1
                                      text-xs
                                      text-slate-500
                                    "
                                  >
                                    Puesto #
                                    {
                                      prestamo
                                        .participantes
                                        .posicion
                                    }
                                  </p>

                                )}

                              </div>

                            </div>

                          </td>

                        )}


                        {/* MONTO */}

                        <td
                          className="
                            px-6
                            py-5
                          "
                        >

                          <p
                            className="
                              font-bold
                              text-slate-900
                            "
                          >
                            $
                            {Number(
                              prestamo.monto
                            ).toFixed(2)}
                          </p>

                          <p
                            className="
                              mt-1
                              text-xs
                              text-slate-500
                            "
                          >
                            {prestamo.estado ===
                            "pendiente"
                              ? `Tasa vigente: ${tasaInteres.toFixed(2)}%`
                              : `${Number(
                                  prestamo.interes_porcentaje
                                ).toFixed(2)}% interés`
                            }
                          </p>

                        </td>


                        {/* CUOTAS */}

                        <td
                          className="
                            px-6
                            py-5
                          "
                        >

                          <span
                            className="
                              inline-flex
                              h-9
                              min-w-9
                              items-center
                              justify-center
                              rounded-lg
                              bg-slate-100
                              px-3
                              font-semibold
                              text-slate-900
                            "
                          >
                            {
                              prestamo
                                .numero_cuotas
                            }
                          </span>

                        </td>


                        {/* ESTADO */}

                        <td
                          className="
                            px-6
                            py-5
                          "
                        >

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              px-3
                              py-1.5
                              text-xs
                              font-semibold

                              ${estiloEstado(
                                prestamo.estado
                              )}
                            `}
                          >

                            {iconoEstado(
                              prestamo.estado
                            )}

                            {textoEstado(
                              prestamo.estado
                            )}

                          </span>

                        </td>


                        {/* FECHA */}

                        <td
                          className="
                            px-6
                            py-5
                            text-sm
                            text-slate-500
                          "
                        >
                          {formatearFecha(
                            prestamo
                              .fecha_solicitud
                          )}
                        </td>


                        {/* ACCIONES */}

                        <td
                          className="
                            px-6
                            py-5
                          "
                        >

                          <div
                            className="
                              flex
                              justify-end
                              gap-2
                            "
                          >

                            {puedeVerPlan && (

                              <button
                                onClick={() =>
                                  verCuotas(
                                    prestamo
                                  )
                                }
                                title="Ver plan de pagos"
                                className="
                                  inline-flex
                                  h-10
                                  w-10
                                  items-center
                                  justify-center
                                  rounded-xl
                                  border
                                  border-slate-300
                                  bg-white
                                  text-slate-600
                                  transition
                                  hover:border-emerald-300
                                  hover:bg-emerald-50
                                  hover:text-emerald-700
                                "
                              >
                                <Eye
                                  size={18}
                                />
                              </button>

                            )}


                            {can(
                              "aprobarPrestamos"
                            ) &&
                              prestamo.estado ===
                              "pendiente" && (

                              <>

                                <button
                                  disabled={
                                    procesando ||
                                    !fondoSuficiente
                                  }
                                  onClick={() =>
                                    aprobar(
                                      prestamo
                                    )
                                  }
                                  className={`
                                    rounded-xl
                                    px-4
                                    py-2
                                    text-xs
                                    font-semibold
                                    transition

                                    ${
                                      fondoSuficiente

                                        ? `
                                          bg-emerald-600
                                          text-white
                                          hover:bg-emerald-700
                                        `

                                        : `
                                          cursor-not-allowed
                                          bg-slate-200
                                          text-slate-500
                                        `
                                    }
                                  `}
                                >
                                  {fondoSuficiente
                                    ? "Aprobar"
                                    : "Sin fondos"
                                  }
                                </button>


                                <button
                                  disabled={
                                    procesando
                                  }
                                  onClick={() =>
                                    abrirRechazo(
                                      prestamo
                                    )
                                  }
                                  className="
                                    rounded-xl
                                    bg-red-50
                                    px-4
                                    py-2
                                    text-xs
                                    font-semibold
                                    text-red-600
                                    transition
                                    hover:bg-red-100
                                  "
                                >
                                  Rechazar
                                </button>

                              </>

                            )}

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}


        {/* =================================================
            LEYENDA
        ================================================= */}

        <div
          className="
            grid
            grid-cols-1
            gap-4
            border-t
            border-slate-200
            bg-emerald-50/30
            p-5
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >

          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-emerald-100
                text-emerald-700
              "
            >
              <CheckCircle2
                size={18}
              />
            </div>

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-emerald-700
                "
              >
                Aprobado
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Préstamo aprobado y plan generado.
              </p>

            </div>

          </div>


          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-red-100
                text-red-600
              "
            >
              <XCircle
                size={18}
              />
            </div>

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-red-600
                "
              >
                Rechazado
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Solicitud rechazada por administración.
              </p>

            </div>

          </div>


          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-amber-100
                text-amber-600
              "
            >
              <Clock3
                size={18}
              />
            </div>

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-amber-600
                "
              >
                Pendiente
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Solicitud en revisión.
              </p>

            </div>

          </div>


          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-slate-300
                bg-white
                text-slate-600
              "
            >
              <Eye
                size={18}
              />
            </div>

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Ver
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  text-slate-500
                "
              >
                Consulta el plan de pagos.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* =================================================
          AVISO
      ================================================= */}

      <div
        className="
          flex
          items-start
          gap-3
          rounded-2xl
          border
          border-red-200
          bg-red-50/60
          p-5
        "
      >

        <div
          className="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-red-100
            text-red-600
          "
        >
          <AlertTriangle
            size={22}
          />
        </div>


        <div>

          <p
            className="
              font-semibold
              text-red-700
            "
          >
            Importante
          </p>

          <p
            className="
              mt-1
              text-sm
              text-slate-600
            "
          >
            Los préstamos solo están disponibles
            mientras el cuadro esté activo y exista
            fondo suficiente para cubrirlos.
          </p>

        </div>

      </div>


      {/* =================================================
          MODAL SOLICITAR
      ================================================= */}

      {mostrarSolicitud && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/50
            p-4
          "
        >

          <div
            className="
              max-h-[90vh]
              w-full
              max-w-lg
              overflow-y-auto
              rounded-3xl
              bg-white
              p-7
              shadow-2xl
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
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
                  Fondo comunitario
                </p>

                <h2
                  className="
                    mt-1
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Solicitar préstamo
                </h2>

              </div>


              <button
                onClick={() =>
                  setMostrarSolicitud(
                    false
                  )
                }
                className="
                  rounded-xl
                  p-2
                  text-slate-500
                  hover:bg-slate-100
                "
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <form
              onSubmit={
                enviarSolicitud
              }
              className="
                mt-6
                space-y-5
              "
            >

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
                  Monto solicitado
                </label>

                <input
                  name="monto"
                  type="number"
                  min="1"
                  max={
                    montoMaximo ||
                    undefined
                  }
                  step="0.01"
                  required
                  value={
                    form.monto
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ej. 100"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-300
                    px-4
                    py-3
                    outline-none
                    focus:border-emerald-500
                    focus:ring-2
                    focus:ring-emerald-500/20
                  "
                />

                {montoMaximo !== null && (

                  <p
                    className="
                      mt-2
                      text-xs
                      text-slate-500
                    "
                  >
                    Máximo permitido:{" "}
                    <strong>
                      $
                      {montoMaximo.toFixed(
                        2
                      )}
                    </strong>
                  </p>

                )}

              </div>


              <div
                className="
                  grid
                  grid-cols-1
                  gap-4
                  sm:grid-cols-2
                "
              >

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
                      flex
                      items-center
                      justify-between
                      rounded-xl
                      border
                      border-slate-200
                      bg-slate-50
                      px-4
                      py-3
                    "
                  >

                    <span
                      className="
                        font-semibold
                        text-slate-900
                      "
                    >
                      {tasaInteres.toFixed(
                        2
                      )}
                      %
                    </span>

                    <Percent
                      size={18}
                      className="
                        text-emerald-600
                      "
                    />

                  </div>

                </div>


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
                    Número de cuotas
                  </label>

                  <input
                    name="cuotas"
                    type="number"
                    min="1"
                    max={
                      maxCuotas
                    }
                    required
                    value={
                      form.cuotas
                    }
                    onChange={
                      handleChange
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-300
                      px-4
                      py-3
                      outline-none
                      focus:border-emerald-500
                      focus:ring-2
                      focus:ring-emerald-500/20
                    "
                  />

                </div>

              </div>


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
                  Motivo
                </label>

                <textarea
                  name="motivo"
                  rows="3"
                  value={
                    form.motivo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="¿Para qué necesitas el préstamo?"
                  className="
                    w-full
                    resize-none
                    rounded-xl
                    border
                    border-slate-300
                    px-4
                    py-3
                    outline-none
                    focus:border-emerald-500
                    focus:ring-2
                    focus:ring-emerald-500/20
                  "
                />

              </div>


              <div
                className="
                  space-y-3
                  rounded-2xl
                  bg-slate-50
                  p-5
                "
              >

                <div
                  className="
                    flex
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-slate-500">
                    Monto
                  </span>

                  <strong>
                    $
                    {montoFormulario.toFixed(
                      2
                    )}
                  </strong>
                </div>


                <div
                  className="
                    flex
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-slate-500">
                    Interés
                  </span>

                  <strong>
                    $
                    {interesEstimado.toFixed(
                      2
                    )}
                  </strong>
                </div>


                <div
                  className="
                    flex
                    justify-between
                    border-t
                    border-slate-200
                    pt-3
                    text-sm
                  "
                >
                  <span className="text-slate-500">
                    Total estimado
                  </span>

                  <strong className="text-emerald-700">
                    $
                    {totalEstimado.toFixed(
                      2
                    )}
                  </strong>
                </div>


                <div
                  className="
                    flex
                    justify-between
                    text-sm
                  "
                >
                  <span className="text-slate-500">
                    Cuota aproximada
                  </span>

                  <strong className="text-emerald-700">
                    $
                    {cuotaEstimada.toFixed(
                      2
                    )}
                  </strong>
                </div>

              </div>


              <div
                className="
                  flex
                  justify-end
                  gap-3
                  pt-2
                "
              >

                <button
                  type="button"
                  onClick={() =>
                    setMostrarSolicitud(
                      false
                    )
                  }
                  className="
                    rounded-xl
                    border
                    border-slate-300
                    px-4
                    py-2.5
                    font-medium
                    text-slate-700
                  "
                >
                  Cancelar
                </button>


                <button
                  type="submit"
                  disabled={
                    procesando
                  }
                  className="
                    rounded-xl
                    bg-emerald-600
                    px-5
                    py-2.5
                    font-semibold
                    text-white
                    hover:bg-emerald-700
                    disabled:opacity-60
                  "
                >
                  {procesando
                    ? "Enviando..."
                    : "Enviar solicitud"
                  }
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* =================================================
          MODAL CUOTAS
      ================================================= */}

      {mostrarCuotas && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/50
            p-4
          "
        >

          <div
            className="
              max-h-[90vh]
              w-full
              max-w-4xl
              overflow-y-auto
              rounded-3xl
              bg-white
              p-7
              shadow-2xl
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
              "
            >

              <div>

                <p
                  className="
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wide
                    text-emerald-700
                  "
                >
                  Plan de pagos
                </p>

                <h2
                  className="
                    mt-1
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Cuotas del préstamo
                </h2>

                {prestamoSeleccionado && (

                  <p
                    className="
                      mt-2
                      text-sm
                      text-slate-500
                    "
                  >
                    Préstamo de{" "}
                    <strong>
                      $
                      {Number(
                        prestamoSeleccionado.monto
                      ).toFixed(2)}
                    </strong>

                    {" · "}

                    {Number(
                      prestamoSeleccionado
                        .interes_porcentaje || 0
                    ).toFixed(2)}
                    % interés
                  </p>

                )}

              </div>


              <button
                onClick={() => {

                  setMostrarCuotas(
                    false
                  );

                  setPrestamoSeleccionado(
                    null
                  );

                  setResumenPrestamo(
                    null
                  );

                }}
                className="
                  rounded-xl
                  p-2
                  text-slate-500
                  hover:bg-slate-100
                "
              >
                <X
                  size={20}
                />
              </button>

            </div>


            {cargandoCuotas ? (

              <p
                className="
                  py-12
                  text-center
                  text-slate-500
                "
              >
                Cargando cuotas...
              </p>

            ) : cuotas.length === 0 ? (

              <div
                className="
                  py-12
                  text-center
                "
              >

                <CalendarDays
                  size={40}
                  className="
                    mx-auto
                    text-slate-300
                  "
                />

                <p
                  className="
                    mt-4
                    text-slate-500
                  "
                >
                  No existen cuotas registradas.
                </p>

              </div>

            ) : (

              <>

                {resumenPrestamo && (

                  <div
                    className="
                      mt-6
                      rounded-2xl
                      border
                      border-slate-200
                      bg-slate-50
                      p-5
                    "
                  >

                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-5
                        md:grid-cols-4
                      "
                    >

                      <div>

                        <p className="text-xs text-slate-500">
                          Cuotas pagadas
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          {
                            resumenPrestamo
                              .cuotasPagadas
                          }
                          {" / "}
                          {
                            resumenPrestamo
                              .totalCuotas
                          }
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-500">
                          Total pagado
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          $
                          {Number(
                            resumenPrestamo
                              .totalPagado
                          ).toFixed(2)}
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-500">
                          Saldo pendiente
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          $
                          {Number(
                            resumenPrestamo
                              .saldoPendiente
                          ).toFixed(2)}
                        </p>

                      </div>


                      <div>

                        <p className="text-xs text-slate-500">
                          Progreso
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          {
                            resumenPrestamo
                              .porcentaje
                          }
                          %
                        </p>

                      </div>

                    </div>


                    <div
                      className="
                        mt-5
                        h-2.5
                        overflow-hidden
                        rounded-full
                        bg-slate-200
                      "
                    >

                      <div
                        className="
                          h-full
                          rounded-full
                          bg-emerald-500
                        "
                        style={{
                          width:
                            `${resumenPrestamo.porcentaje}%`
                        }}
                      />

                    </div>

                  </div>

                )}


                {resumenPrestamo
                  ?.cuotasVencidas >
                  0 && (

                  <div
                    className="
                      mt-5
                      flex
                      items-start
                      gap-3
                      rounded-2xl
                      border
                      border-red-200
                      bg-red-50
                      p-4
                    "
                  >

                    <AlertTriangle
                      size={20}
                      className="
                        mt-0.5
                        shrink-0
                        text-red-600
                      "
                    />

                    <div>

                      <p className="font-semibold text-red-700">
                        Pagos atrasados
                      </p>

                      <p className="mt-1 text-sm text-red-600">

                        {resumenPrestamo.cuotasVencidas}{" "}

                        {resumenPrestamo.cuotasVencidas === 1
                          ? "cuota vencida"
                          : "cuotas vencidas"
                        }{" "}

                        por un total de{" "}

                        <strong>
                          $
                          {Number(
                            resumenPrestamo
                              .totalVencido
                          ).toFixed(2)}
                        </strong>.

                      </p>

                    </div>

                  </div>

                )}


                <div
                  className="
                    mt-6
                    overflow-hidden
                    rounded-2xl
                    border
                    border-slate-200
                  "
                >

                  <div
                    className="
                      overflow-x-auto
                    "
                  >

                    <table
                      className="
                        w-full
                        min-w-[650px]
                      "
                    >

                      <thead
                        className="
                          bg-slate-50
                        "
                      >

                        <tr>

                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Cuota
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Monto
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Vencimiento
                          </th>

                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">
                            Estado
                          </th>

                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                            Acción
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {cuotas.map(
                          (cuota) => {

                            const vencida =
                              cuotaEstaVencida(
                                cuota
                              );

                            const venceHoy =
                              cuotaVenceHoy(
                                cuota
                              );

                            const dias =
                              vencida
                                ? calcularDiasAtraso(
                                    cuota.fecha_vencimiento
                                  )
                                : 0;


                            return (

                              <tr
                                key={
                                  cuota.id
                                }
                                className="
                                  border-t
                                  border-slate-100
                                "
                              >

                                <td
                                  className="
                                    px-4
                                    py-4
                                    font-semibold
                                    text-slate-900
                                  "
                                >
                                  {
                                    cuota
                                      .numero_cuota
                                  }
                                </td>


                                <td
                                  className="
                                    px-4
                                    py-4
                                    font-semibold
                                    text-slate-900
                                  "
                                >
                                  $
                                  {Number(
                                    cuota.monto
                                  ).toFixed(2)}
                                </td>


                                <td
                                  className="
                                    px-4
                                    py-4
                                    text-sm
                                    text-slate-600
                                  "
                                >
                                  {formatearFecha(
                                    cuota.fecha_vencimiento
                                  )}
                                </td>


                                <td
                                  className="
                                    px-4
                                    py-4
                                  "
                                >

                                  {cuota.estado ===
                                  "pagado" ? (

                                    <span
                                      className="
                                        inline-flex
                                        items-center
                                        gap-1.5
                                        rounded-full
                                        bg-emerald-100
                                        px-2.5
                                        py-1
                                        text-xs
                                        font-semibold
                                        text-emerald-700
                                      "
                                    >
                                      <CheckCircle2
                                        size={13}
                                      />

                                      Pagada
                                    </span>

                                  ) : vencida ? (

                                    <div>

                                      <span
                                        className="
                                          inline-flex
                                          items-center
                                          gap-1.5
                                          rounded-full
                                          bg-red-100
                                          px-2.5
                                          py-1
                                          text-xs
                                          font-semibold
                                          text-red-700
                                        "
                                      >
                                        <XCircle
                                          size={13}
                                        />

                                        Vencida
                                      </span>

                                      <p
                                        className="
                                          mt-1
                                          text-xs
                                          font-semibold
                                          text-red-600
                                        "
                                      >
                                        {dias}{" "}
                                        {dias === 1
                                          ? "día"
                                          : "días"
                                        }{" "}
                                        de atraso
                                      </p>

                                    </div>

                                  ) : venceHoy ? (

                                    <span
                                      className="
                                        inline-flex
                                        items-center
                                        gap-1.5
                                        rounded-full
                                        bg-amber-100
                                        px-2.5
                                        py-1
                                        text-xs
                                        font-semibold
                                        text-amber-700
                                      "
                                    >
                                      <Clock3
                                        size={13}
                                      />

                                      Vence hoy
                                    </span>

                                  ) : (

                                    <span
                                      className="
                                        inline-flex
                                        items-center
                                        gap-1.5
                                        rounded-full
                                        bg-slate-100
                                        px-2.5
                                        py-1
                                        text-xs
                                        font-semibold
                                        text-slate-600
                                      "
                                    >
                                      <Clock3
                                        size={13}
                                      />

                                      Pendiente
                                    </span>

                                  )}

                                </td>


                                <td
                                  className="
                                    px-4
                                    py-4
                                    text-right
                                  "
                                >

                                  {cuota.estado ===
                                  "pagado" ? (

                                    <CheckCircle2
                                      size={18}
                                      className="
                                        ml-auto
                                        text-emerald-600
                                      "
                                    />

                                  ) : !can(
                                    "aprobarPrestamos"
                                  ) ? (

                                    <button
                                      onClick={() =>
                                        pagarCuota(
                                          cuota
                                        )
                                      }
                                      disabled={
                                        procesando
                                      }
                                      className={`
                                        rounded-lg
                                        border
                                        px-3
                                        py-1.5
                                        text-xs
                                        font-semibold
                                        transition

                                        ${
                                          vencida

                                            ? `
                                              border-red-300
                                              bg-red-50
                                              text-red-600
                                              hover:bg-red-100
                                            `

                                            : `
                                              border-emerald-300
                                              bg-white
                                              text-emerald-700
                                              hover:bg-emerald-50
                                            `
                                        }
                                      `}
                                    >
                                      Pagar
                                    </button>

                                  ) : (

                                    <span
                                      className="
                                        text-xs
                                        text-slate-400
                                      "
                                    >
                                      —
                                    </span>

                                  )}

                                </td>

                              </tr>

                            );

                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>


                <div
                  className="
                    mt-6
                    flex
                    justify-end
                  "
                >

                  <button
                    onClick={() =>
                      setMostrarCuotas(
                        false
                      )
                    }
                    className="
                      rounded-xl
                      border
                      border-slate-300
                      px-5
                      py-2.5
                      font-medium
                      text-slate-700
                      hover:bg-slate-50
                    "
                  >
                    Cerrar
                  </button>

                </div>

              </>

            )}

          </div>

        </div>

      )}


      {/* =================================================
          MODAL RECHAZO
      ================================================= */}

      {mostrarRechazo && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/50
            p-4
          "
        >

          <div
            className="
              w-full
              max-w-xl
              rounded-3xl
              bg-white
              p-7
              shadow-2xl
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
              "
            >

              <div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-red-600
                  "
                >
                  Administración
                </p>

                <h2
                  className="
                    mt-1
                    text-2xl
                    font-bold
                    text-slate-900
                  "
                >
                  Rechazar solicitud
                </h2>

              </div>


              <button
                onClick={() =>
                  setMostrarRechazo(
                    false
                  )
                }
                className="
                  rounded-xl
                  p-2
                  text-slate-500
                  hover:bg-slate-100
                "
              >
                <X
                  size={20}
                />
              </button>

            </div>


            {prestamoSeleccionado && (

              <div
                className="
                  mt-6
                  flex
                  items-center
                  justify-between
                  gap-4
                  rounded-2xl
                  border
                  border-red-100
                  bg-red-50/50
                  p-4
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
                      rounded-full
                      bg-emerald-100
                      font-bold
                      text-emerald-700
                    "
                  >
                    {(
                      prestamoSeleccionado
                        .participantes
                        ?.nombre ||
                      "S"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>


                  <div>

                    <p
                      className="
                        font-semibold
                        text-slate-900
                      "
                    >
                      {prestamoSeleccionado
                        .participantes
                        ?.nombre ||
                        "Socio"}
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-slate-500
                      "
                    >
                      Puesto #
                      {prestamoSeleccionado
                        .participantes
                        ?.posicion ||
                        "-"
                      }
                    </p>

                  </div>

                </div>


                <div
                  className="
                    text-right
                  "
                >

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Monto solicitado
                  </p>

                  <p
                    className="
                      mt-1
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    $
                    {Number(
                      prestamoSeleccionado.monto
                    ).toFixed(2)}
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-slate-500
                    "
                  >
                    {
                      prestamoSeleccionado
                        .numero_cuotas
                    }{" "}
                    cuotas
                  </p>

                </div>

              </div>

            )}


            <div
              className="
                mt-6
              "
            >

              <label
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Motivo del rechazo *
              </label>

              <p
                className="
                  mb-3
                  text-xs
                  text-slate-500
                "
              >
                Indica el motivo para que
                el socio pueda conocer la decisión.
              </p>


              <textarea
                rows="6"
                value={
                  motivoRechazo
                }
                onChange={
                  (e) =>
                    setMotivoRechazo(
                      e.target.value
                    )
                }
                placeholder="Escribe el motivo del rechazo..."
                className="
                  w-full
                  resize-none
                  rounded-xl
                  border
                  border-slate-300
                  px-4
                  py-3
                  outline-none
                  focus:border-red-400
                  focus:ring-2
                  focus:ring-red-400/20
                "
              />

            </div>


            <div
              className="
                mt-6
                flex
                justify-end
                gap-3
              "
            >

              <button
                onClick={() =>
                  setMostrarRechazo(
                    false
                  )
                }
                className="
                  rounded-xl
                  border
                  border-slate-300
                  px-5
                  py-2.5
                  font-medium
                  text-slate-700
                  hover:bg-slate-50
                "
              >
                Cancelar
              </button>


              <button
                onClick={
                  confirmarRechazo
                }
                disabled={
                  procesando
                }
                className="
                  rounded-xl
                  bg-red-600
                  px-5
                  py-2.5
                  font-semibold
                  text-white
                  hover:bg-red-700
                  disabled:opacity-60
                "
              >
                {procesando
                  ? "Procesando..."
                  : "Confirmar rechazo"
                }
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};

export default Prestamos;