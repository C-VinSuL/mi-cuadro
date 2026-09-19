import {
  useEffect,
  useState
} from "react";

import {
  Wallet,
  Armchair,
  CalendarDays,
  Trophy,
  CheckCircle2,
  Clock3,
  HandCoins,
  ArrowRight
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import {
  useAuth
} from "../../../context/AuthContext";

import {
  supabase
} from "../../../services/supabase";

const DashboardSocio = () => {
  const {
    grupo,
    profile,
    participant
  } = useAuth();

  const [aporteActual, setAporteActual] =
    useState(null);

  const [entrega, setEntrega] =
    useState(null);

  const [beneficiarioActual, setBeneficiarioActual] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ========================================
  // CARGAR INFORMACIÓN PERSONAL
  // ========================================

  useEffect(() => {
    const cargarDatos = async () => {
      if (
        !grupo?.id ||
        !participant?.id
      ) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          aporteResponse,
          entregaResponse,
          beneficiarioResponse
        ] = await Promise.all([
          supabase
            .from("aportes")
            .select(`
              id,
              semana,
              monto,
              comision_app,
              estado,
              fecha_pago
            `)
            .eq(
              "participante_id",
              participant.id
            )
            .eq(
              "grupo_id",
              grupo.id
            )
            .eq(
              "semana",
              grupo.semana_actual
            )
            .maybeSingle(),

          supabase
            .from("entregas")
            .select(`
              id,
              semana,
              monto,
              fecha_entrega
            `)
            .eq(
              "participante_id",
              participant.id
            )
            .eq(
              "grupo_id",
              grupo.id
            )
            .maybeSingle(),

          supabase
            .from("participantes")
            .select(`
              id,
              nombre,
              posicion
            `)
            .eq(
              "grupo_id",
              grupo.id
            )
            .eq(
              "posicion",
              grupo.semana_actual
            )
            .maybeSingle()
        ]);

        if (aporteResponse.error) {
          throw aporteResponse.error;
        }

        if (entregaResponse.error) {
          throw entregaResponse.error;
        }

        if (beneficiarioResponse.error) {
          throw beneficiarioResponse.error;
        }

        setAporteActual(
          aporteResponse.data
        );

        setEntrega(
          entregaResponse.data
        );

        setBeneficiarioActual(
          beneficiarioResponse.data
        );

      } catch (error) {
        console.error(
          "Error dashboard socio:",
          error
        );

        setError(
          "No se pudo cargar tu información."
        );
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();

  }, [
    grupo?.id,
    grupo?.semana_actual,
    participant?.id
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
          No perteneces a ningún cuadro
        </h2>

        <p className="mt-2 text-slate-500">
          Cuando seas agregado a un grupo,
          podrás consultar aquí tu información.
        </p>
      </div>
    );
  }

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
        Cargando tu información...
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

  const semanaActual =
    Number(
      grupo.semana_actual || 0
    );

  const capacidad =
    Number(
      grupo.numero_integrantes || 0
    );

  const aporteSemanal =
    Number(
      grupo.aporte_semanal || 0
    );

  const comision =
    Number(
      aporteActual?.comision_app || 1
    );

  const totalPagar =
    aporteSemanal + comision;

  const pagado =
    aporteActual?.estado === "pagado";

  const yaRecibio =
    Boolean(entrega);

  const esSuTurno =
    Number(
      participant?.posicion
    ) === semanaActual;

  // ========================================
  // UI
  // ========================================

  return (
    <div className="space-y-8">

      {/* ==================================
          CABECERA PERSONAL
      =================================== */}

      <section
        className="
          rounded-3xl
          border
          border-emerald-100
          bg-gradient-to-br
          from-white
          to-emerald-50
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
            text-emerald-700
          "
        >
          Mi cuenta
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
                participant?.nombre ||
                "Socio"} 👋
            </h1>

            <p
              className="
                mt-2
                text-slate-500
              "
            >
              Este es tu resumen dentro de{" "}
              <strong>
                {grupo.nombre}
              </strong>.
            </p>

          </div>


          <div
            className="
              rounded-2xl
              border
              border-emerald-200
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
              {semanaActual} de {capacidad}
            </p>

          </div>

        </div>

      </section>


      {/* ==================================
          TARJETAS PERSONALES
      =================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-5
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

        {/* PUESTO */}

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
            <Armchair size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Tu puesto
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            #
            {participant?.posicion ||
              "-"}
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
              bg-blue-50
              text-blue-600
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

        </div>


        {/* ESTADO */}

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
            className={`
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl

              ${
                pagado
                  ? `
                    bg-emerald-50
                    text-emerald-700
                  `
                  : `
                    bg-amber-50
                    text-amber-600
                  `
              }
            `}
          >
            {pagado
              ? <CheckCircle2 size={22} />
              : <Clock3 size={22} />
            }
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Estado del aporte
          </p>

          <p
            className={`
              mt-1
              text-xl
              font-bold

              ${
                pagado
                  ? "text-emerald-700"
                  : "text-amber-700"
              }
            `}
          >
            {pagado
              ? "Pagado"
              : "Pendiente"
            }
          </p>

        </div>


        {/* TURNO */}

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
            <CalendarDays size={22} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Tu turno
          </p>

          <p
            className="
              mt-1
              text-xl
              font-bold
              text-slate-900
            "
          >
            Semana{" "}
            {participant?.posicion ||
              "-"}
          </p>

        </div>

      </section>


      {/* ==================================
          APORTE ACTUAL
      =================================== */}

      <section
        className="
          grid
          grid-cols-1
          gap-6
          xl:grid-cols-[1.3fr_0.7fr]
        "
      >

        <div
          className={`
            rounded-3xl
            border
            p-6
            shadow-sm
            md:p-7

            ${
              pagado
                ? `
                  border-emerald-200
                  bg-emerald-50
                `
                : `
                  border-amber-200
                  bg-amber-50
                `
            }
          `}
        >

          <div
            className="
              flex
              flex-col
              gap-6
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            <div>

              <p
                className={`
                  text-sm
                  font-semibold

                  ${
                    pagado
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                `}
              >
                Aporte de esta semana
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                {pagado
                  ? "Estás al día"
                  : "Tienes un aporte pendiente"
                }
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-600
                "
              >
                Semana {semanaActual}
                {" · "}
                Aporte ${aporteSemanal.toFixed(2)}
                {" + "}
                comisión ${comision.toFixed(2)}
              </p>

            </div>


            <div>

              <p className="text-xs text-slate-500">
                Total
              </p>

              <p
                className="
                  text-3xl
                  font-bold
                  text-slate-900
                "
              >
                ${totalPagar.toFixed(2)}
              </p>

            </div>

          </div>


          {!pagado && (

            <Link
              to="/aportes"
              className="
                mt-6
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
              "
            >
              Registrar aporte
              <ArrowRight size={18} />
            </Link>

          )}


          {pagado && (

            <div
              className="
                mt-6
                flex
                items-center
                gap-2
                font-semibold
                text-emerald-700
              "
            >
              <CheckCircle2 size={19} />
              Aporte registrado correctamente
            </div>

          )}

        </div>


        {/* ESTADO DE ENTREGA */}

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


          {yaRecibio ? (
            <>
              <p className="mt-5 text-sm text-slate-500">
                Tu entrega
              </p>

              <h2
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                Ya recibiste
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Semana {entrega.semana}
              </p>

              <p
                className="
                  mt-4
                  text-3xl
                  font-bold
                  text-emerald-700
                "
              >
                $
                {Number(
                  entrega.monto
                ).toFixed(2)}
              </p>
            </>
          ) : esSuTurno ? (
            <>
              <p className="mt-5 text-sm text-slate-500">
                Tu turno
              </p>

              <h2
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-amber-700
                "
              >
                Esta es tu semana
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cuando todos los aportes
                estén completos, recibirás
                el pozo de la ronda.
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-sm text-slate-500">
                Próxima entrega personal
              </p>

              <h2
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                Semana{" "}
                {participant?.posicion ||
                  "-"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Tu puesto define la ronda
                en la que recibirás el cuadro.
              </p>
            </>
          )}

        </div>

      </section>


      {/* ==================================
          BENEFICIARIO ACTUAL
      =================================== */}

      {beneficiarioActual && (

        <section
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

          <p
            className="
              text-sm
              font-semibold
              text-emerald-700
            "
          >
            Ronda actual
          </p>

          <div
            className="
              mt-3
              flex
              flex-col
              gap-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div>

              <p className="text-sm text-slate-500">
                Beneficiario de la semana
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                {beneficiarioActual.nombre}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Puesto #
                {beneficiarioActual.posicion}
              </p>

            </div>


            <div
              className="
                rounded-2xl
                bg-emerald-50
                px-5
                py-4
              "
            >
              <p className="text-xs text-emerald-700">
                Pozo estimado
              </p>

              <p
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-emerald-900
                "
              >
                $
                {(
                  capacidad *
                  aporteSemanal
                ).toFixed(2)}
              </p>
            </div>

          </div>

        </section>

      )}


      {/* ==================================
          ACCIONES
      =================================== */}

      <section>

        <p
          className="
            text-sm
            font-semibold
            text-emerald-700
          "
        >
          Acciones
        </p>

        <h2
          className="
            mt-1
            text-2xl
            font-bold
            text-slate-900
          "
        >
          ¿Qué deseas hacer?
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
            <Wallet className="text-emerald-700" />

            <p className="mt-4 font-semibold text-slate-900">
              Mis aportes
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Consulta y registra tus pagos.
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
            <Armchair className="text-blue-600" />

            <p className="mt-4 font-semibold text-slate-900">
              Mi Cuadro
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Revisa posiciones y avance.
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
              Solicita o consulta tus préstamos.
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

export default DashboardSocio;