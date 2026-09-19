import {
  useEffect,
  useState
} from "react";

import {
  Wallet,
  PiggyBank,
  CheckCircle2,
  Clock3,
  Trophy,
  HandCoins,
  ArrowRight,
  CircleDollarSign
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import {
  useAuth
} from "../../../context/AuthContext";

import {
  getDashboardAdminData
} from "../../../services/dashboardService";

const DashboardTesorero = () => {
  const {
    grupo,
    profile,
    fondoComunitario
  } = useAuth();

  const [datos, setDatos] =
    useState({
      participantes: [],
      aportes: [],
      entregas: [],
      totalPagados: 0,
      pendientes: [],
      beneficiarioActual: null,
      pozo: 0
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ========================================
  // CARGAR DATOS
  // ========================================

  useEffect(() => {
    const cargarDashboard =
      async () => {

        if (!grupo?.id) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const resultado =
            await getDashboardAdminData(
              grupo
            );

          setDatos(resultado);

        } catch (error) {
          console.error(
            "Error dashboard tesorero:",
            error
          );

          setError(
            "No se pudo cargar el panel de tesorería."
          );
        } finally {
          setLoading(false);
        }
      };

    cargarDashboard();

  }, [
    grupo?.id,
    grupo?.semana_actual
  ]);

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
        <h2 className="text-xl font-bold text-slate-900">
          No tienes un grupo asignado
        </h2>

        <p className="mt-2 text-slate-500">
          Cuando seas asignado a un grupo,
          podrás gestionar su tesorería aquí.
        </p>
      </div>
    );
  }

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-8
          text-slate-500
        "
      >
        Cargando tesorería...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-red-200
          bg-red-50
          p-5
          text-red-700
        "
      >
        {error}
      </div>
    );
  }

  // ========================================
  // CÁLCULOS
  // ========================================

  const capacidad =
    Number(
      grupo.numero_integrantes || 0
    );

  const semana =
    Number(
      grupo.semana_actual || 0
    );

  const aporteSemanal =
    Number(
      grupo.aporte_semanal || 0
    );

  const recaudado =
    datos.aportes
      .filter(
        (aporte) =>
          aporte.estado === "pagado"
      )
      .reduce(
        (
          total,
          aporte
        ) =>
          total +
          Number(
            aporte.monto || 0
          ),
        0
      );

  const porcentaje =
    datos.pozo > 0
      ? Math.min(
          (
            recaudado /
            datos.pozo
          ) * 100,
          100
        )
      : 0;

  const todosPagaron =
    capacidad > 0 &&
    datos.totalPagados === capacidad;

  // ========================================
  // UI
  // ========================================

  return (
    <div className="space-y-8">

      {/* ==================================
          CABECERA
      =================================== */}

      <section
        className="
          rounded-3xl
          border
          border-blue-100
          bg-gradient-to-br
          from-white
          to-blue-50
          p-6
          md:p-8
        "
      >

        <p
          className="
            text-sm
            font-semibold
            uppercase
            tracking-[0.14em]
            text-blue-700
          "
        >
          Tesorería
        </p>

        <div
          className="
            mt-3
            flex
            flex-col
            gap-6
            lg:flex-row
            lg:items-end
            lg:justify-between
          "
        >

          <div>

            <h1
              className="
                text-3xl
                font-bold
                text-slate-900
                md:text-4xl
              "
            >
              Hola,{" "}
              {profile?.nombre ||
                "Tesorero"} 👋
            </h1>

            <p
              className="
                mt-2
                max-w-2xl
                text-slate-500
              "
            >
              Controla los aportes,
              movimientos y disponibilidad
              financiera de {grupo.nombre}.
            </p>

          </div>


          <div
            className="
              rounded-2xl
              border
              border-blue-200
              bg-white
              px-5
              py-4
              shadow-sm
            "
          >
            <p className="text-xs text-slate-500">
              Semana actual
            </p>

            <p
              className="
                mt-1
                text-xl
                font-bold
                text-slate-900
              "
            >
              {semana} de {capacidad}
            </p>
          </div>

        </div>

      </section>


      {/* ==================================
          MÉTRICAS
      =================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-5
          sm:grid-cols-2
          2xl:grid-cols-4
        "
      >

        {/* RECAUDADO */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
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
              bg-blue-50
              text-blue-600
            "
          >
            <CircleDollarSign size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Recaudado
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            ${recaudado.toFixed(2)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Meta: ${Number(datos.pozo).toFixed(2)}
          </p>

        </div>


        {/* PAGOS */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
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
            <CheckCircle2 size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Pagaron
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            {datos.totalPagados} / {capacidad}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {datos.pendientes.length} pendientes
          </p>

        </div>


        {/* FONDO */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
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
              bg-violet-50
              text-violet-600
            "
          >
            <PiggyBank size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Fondo comunitario
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            $
            {Number(
              fondoComunitario || 0
            ).toFixed(2)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Disponible para préstamos
          </p>

        </div>


        {/* APORTE */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
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
              bg-amber-50
              text-amber-600
            "
          >
            <Wallet size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Aporte semanal
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            ${aporteSemanal.toFixed(2)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Por integrante
          </p>

        </div>

      </section>


      {/* ==================================
          RECAUDACIÓN
      =================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-6
          xl:grid-cols-[1.4fr_0.8fr]
        "
      >

        <div
          className="
            rounded-3xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
            md:p-7
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
                  text-sm
                  font-semibold
                  text-blue-700
                "
              >
                Recaudación semanal
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Estado de aportes
              </h2>

            </div>

            <span
              className={`
                rounded-full
                px-3
                py-1.5
                text-xs
                font-semibold

                ${
                  todosPagaron
                    ? `
                      bg-emerald-100
                      text-emerald-700
                    `
                    : `
                      bg-amber-100
                      text-amber-700
                    `
                }
              `}
            >
              {todosPagaron
                ? "Ronda completa"
                : "Recaudando"
              }
            </span>

          </div>


          <div className="mt-7">

            <div
              className="
                flex
                justify-between
                text-sm
              "
            >
              <span className="text-slate-500">
                ${recaudado.toFixed(2)} de{" "}
                ${Number(datos.pozo).toFixed(2)}
              </span>

              <strong>
                {Math.round(porcentaje)}%
              </strong>
            </div>

            <div
              className="
                mt-3
                h-3
                overflow-hidden
                rounded-full
                bg-slate-100
              "
            >
              <div
                className="
                  h-full
                  rounded-full
                  bg-blue-600
                  transition-all
                "
                style={{
                  width:
                    `${porcentaje}%`
                }}
              />
            </div>

          </div>


          {!todosPagaron && (

            <div
              className="
                mt-7
                rounded-2xl
                border
                border-amber-200
                bg-amber-50
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-2
                  font-semibold
                  text-amber-900
                "
              >
                <Clock3 size={18} />
                Pendientes de aporte
              </div>


              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >

                {datos.pendientes.map(
                  (participante) => (

                    <span
                      key={
                        participante.id
                      }
                      className="
                        rounded-full
                        bg-white
                        px-3
                        py-1.5
                        text-sm
                        text-amber-800
                        shadow-sm
                      "
                    >
                      #{participante.posicion}
                      {" "}
                      {participante.nombre}
                    </span>

                  )
                )}

              </div>

            </div>

          )}


          {todosPagaron && (

            <div
              className="
                mt-7
                rounded-2xl
                border
                border-emerald-200
                bg-emerald-50
                p-5
                text-emerald-800
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  font-semibold
                "
              >
                <CheckCircle2 size={18} />
                Recaudación completa
              </div>

              <p className="mt-2 text-sm">
                Todos los integrantes han
                realizado el aporte de esta ronda.
              </p>
            </div>

          )}

        </div>


        {/* BENEFICIARIO */}

        <div
          className="
            rounded-3xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
            md:p-7
          "
        >

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-amber-50
              text-amber-600
            "
          >
            <Trophy size={23} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Entrega de esta ronda
          </p>

          <h2
            className="
              mt-1
              text-2xl
              font-bold
              text-slate-900
            "
          >
            {datos.beneficiarioActual
              ?.nombre ||
              "Sin asignar"
            }
          </h2>

          {datos.beneficiarioActual && (

            <p className="mt-1 text-sm text-slate-500">
              Puesto #
              {
                datos
                  .beneficiarioActual
                  .posicion
              }
            </p>

          )}


          <div
            className="
              mt-6
              rounded-2xl
              bg-slate-50
              p-4
            "
          >
            <p className="text-xs text-slate-500">
              Monto previsto
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-emerald-700
              "
            >
              ${Number(datos.pozo).toFixed(2)}
            </p>
          </div>

        </div>

      </section>


      {/* ==================================
          ACCIONES
      =================================== */}

      <section>

        <p
          className="
            text-sm
            font-semibold
            text-blue-700
          "
        >
          Tesorería
        </p>

        <h2
          className="
            mt-1
            text-2xl
            font-bold
            text-slate-900
          "
        >
          Acciones rápidas
        </h2>


        <div
          className="
            mt-5
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            xl:grid-cols-3
          "
        >

          <Link
            to="/aportes"
            className="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition
              hover:-translate-y-1
              hover:shadow-md
            "
          >
            <Wallet className="text-blue-600" />

            <p className="mt-4 font-semibold text-slate-900">
              Revisar aportes
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Consulta pagos y pendientes
              de la ronda actual.
            </p>

            <ArrowRight
              size={18}
              className="
                mt-5
                text-slate-400
                transition
                group-hover:translate-x-1
              "
            />
          </Link>


          <Link
            to="/cuadro"
            className="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition
              hover:-translate-y-1
              hover:shadow-md
            "
          >
            <CheckCircle2 className="text-emerald-700" />

            <p className="mt-4 font-semibold text-slate-900">
              Gestión de ronda
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Verifica aportes y realiza
              el cierre de ronda.
            </p>

            <ArrowRight
              size={18}
              className="
                mt-5
                text-slate-400
                transition
                group-hover:translate-x-1
              "
            />
          </Link>


          <Link
            to="/prestamos"
            className="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition
              hover:-translate-y-1
              hover:shadow-md
            "
          >
            <HandCoins className="text-violet-600" />

            <p className="mt-4 font-semibold text-slate-900">
              Préstamos
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Revisa las solicitudes
              relacionadas con el fondo.
            </p>

            <ArrowRight
              size={18}
              className="
                mt-5
                text-slate-400
                transition
                group-hover:translate-x-1
              "
            />
          </Link>

        </div>

      </section>

    </div>
  );
};

export default DashboardTesorero;