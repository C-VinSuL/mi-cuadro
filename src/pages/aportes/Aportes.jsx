
import {
  useEffect,
  useState
} from "react";

import {
  Wallet,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CircleDollarSign
} from "lucide-react";

import {
  supabase
} from "../../services/supabase";

import {
  useAuth
} from "../../context/AuthContext";


const Aportes = () => {

  const {
    grupo,
    participant,
    cargarFondoComunitario
  } = useAuth();


  const [aportes, setAportes] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [registrando, setRegistrando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");


  // =========================
  // DATOS CALCULADOS
  // =========================

  const aporteSemanal =
    Number(
      grupo?.aporte_semanal || 0
    );

  const comisionApp = 1;

  const totalPagar =
    aporteSemanal + comisionApp;

  const semanaActual =
    grupo?.semana_actual || 0;


  // =========================
  // CARGAR APORTES
  // =========================

  const cargarAportes = async () => {

    if (!participant?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const {
      data,
      error
    } = await supabase
      .from("aportes")
      .select("*")
      .eq(
        "participante_id",
        participant.id
      )
      .order(
        "semana",
        {
          ascending: false
        }
      );

    if (error) {

      console.error(
        "Error cargando aportes:",
        error
      );

    } else {

      setAportes(
        data || []
      );

    }

    setLoading(false);
  };


  useEffect(() => {

    cargarAportes();

  }, [participant]);


  // =========================
  // APORTE DE ESTA SEMANA
  // =========================

  const aporteSemanaActual =
    aportes.find(
      (aporte) =>
        aporte.semana ===
        semanaActual
    );


  // =========================
  // REGISTRAR APORTE
  // =========================

  const registrarAporte =
    async () => {

      if (
        !participant ||
        !grupo
      ) {
        return;
      }

      if (aporteSemanaActual) {

        setMensaje(
          "Ya registraste el aporte de esta semana."
        );

        return;
      }

      setRegistrando(true);
      setMensaje("");


      const {
        error
      } = await supabase
        .from("aportes")
        .insert({
          participante_id:
            participant.id,

          grupo_id:
            grupo.id,

          semana:
            semanaActual,

          monto:
            aporteSemanal,

          comision_app:
            comisionApp,

          estado:
            "pagado"
        });


      if (error) {

        console.error(
          "Error registrando aporte:",
          error
        );

        setMensaje(
          "No se pudo registrar el aporte."
        );

        setRegistrando(false);

        return;
      }


      setMensaje(
        "Aporte registrado correctamente."
      );

      // Recargar historial de aportes
      await cargarAportes();

      // Actualizar fondo comunitario global
      await cargarFondoComunitario(grupo.id);

      setRegistrando(false);
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
        No perteneces a ningún grupo.
      </div>
    );
  }


  return (
    <div className="space-y-8">

      {/* =====================
          HEADER
      ====================== */}

      <div>

        <p
          className="
            text-sm
            font-semibold
            text-emerald-700
          "
        >
          Mi aporte
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
          Aportes
        </h1>

        <p
          className="
            text-slate-500
            mt-2
          "
        >
          Revisa tus aportes y registra
          el pago correspondiente a cada semana.
        </p>

      </div>


      {/* =====================
          TARJETA PRINCIPAL
      ====================== */}

      <section
        className="
          rounded-3xl
          bg-gradient-to-br
          from-emerald-700
          to-teal-800
          text-white
          p-6
          md:p-8
          shadow-lg
        "
      >

        <div
          className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-8
          "
        >

          <div>

            <p
              className="
                text-emerald-200
                text-sm
              "
            >
              Semana actual
            </p>

            <h2
              className="
                text-3xl
                font-bold
                mt-1
              "
            >
              Semana {semanaActual}
            </h2>

            <p
              className="
                mt-4
                text-emerald-100
              "
            >
              Grupo: {grupo.nombre}
            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-3
              gap-4
              w-full
              lg:max-w-2xl
            "
          >

            <div
              className="
                bg-white/10
                rounded-2xl
                p-4
              "
            >
              <p
                className="
                  text-xs
                  text-emerald-200
                "
              >
                Aporte
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  mt-1
                "
              >
                ${aporteSemanal.toFixed(2)}
              </p>
            </div>


            <div
              className="
                bg-white/10
                rounded-2xl
                p-4
              "
            >
              <p
                className="
                  text-xs
                  text-emerald-200
                "
              >
                Comisión app
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  mt-1
                "
              >
                ${comisionApp.toFixed(2)}
              </p>
            </div>


            <div
              className="
                bg-white
                text-slate-900
                rounded-2xl
                p-4
              "
            >
              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Total
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  mt-1
                "
              >
                ${totalPagar.toFixed(2)}
              </p>
            </div>

          </div>

        </div>


        {/* ESTADO Y BOTÓN */}

        <div
          className="
            mt-8
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-4
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            {aporteSemanaActual ? (

              <>
                <CheckCircle2
                  className="
                    text-lime-300
                  "
                />

                <div>
                  <p className="font-semibold">
                    Aporte registrado
                  </p>

                  <p
                    className="
                      text-sm
                      text-emerald-200
                    "
                  >
                    Esta semana ya está al día.
                  </p>
                </div>
              </>

            ) : (

              <>
                <Clock3
                  className="
                    text-amber-300
                  "
                />

                <div>
                  <p className="font-semibold">
                    Pago pendiente
                  </p>

                  <p
                    className="
                      text-sm
                      text-emerald-200
                    "
                  >
                    Registra tu aporte de esta semana.
                  </p>
                </div>
              </>

            )}

          </div>


          <button
            onClick={
              registrarAporte
            }
            disabled={
              registrando ||
              Boolean(
                aporteSemanaActual
              )
            }
            className="
              rounded-xl
              bg-white
              text-emerald-800

              px-6
              py-3

              font-semibold

              hover:bg-emerald-50

              disabled:opacity-60

              transition
            "
          >

            {aporteSemanaActual
              ? "Aporte pagado"
              : registrando
              ? "Registrando..."
              : `Registrar $${totalPagar.toFixed(2)}`
            }

          </button>

        </div>

      </section>


      {/* MENSAJE */}

      {mensaje && (

        <div
          className="
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50
            text-emerald-800
            px-5
            py-4
          "
        >
          {mensaje}
        </div>

      )}


      {/* =====================
          RESUMEN
      ====================== */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-5
        "
      >

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
          <Wallet
            className="
              text-emerald-700
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            Aportes realizados
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            {aportes.length}
          </p>
        </div>


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
          <CircleDollarSign
            className="
              text-blue-600
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            Total aportado
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            $
            {aportes
              .reduce(
                (
                  total,
                  aporte
                ) =>
                  total +
                  Number(
                    aporte.monto
                  ),
                0
              )
              .toFixed(2)}
          </p>
        </div>


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
          <CalendarDays
            className="
              text-orange-500
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            Semana actual
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            {semanaActual}
          </p>
        </div>

      </div>


      {/* =====================
          HISTORIAL
      ====================== */}

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
            Historial de aportes
          </h2>

          <p
            className="
              text-sm
              text-slate-500
              mt-1
            "
          >
            Tus pagos registrados
            dentro del cuadro.
          </p>

        </div>


        {loading ? (

          <div
            className="
              p-8
              text-slate-500
            "
          >
            Cargando aportes...
          </div>

        ) : aportes.length === 0 ? (

          <div
            className="
              p-10
              text-center
              text-slate-500
            "
          >
            Todavía no tienes aportes registrados.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead
                className="
                  bg-slate-50
                "
              >

                <tr>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Semana
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Aporte
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Comisión
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Estado
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Fecha
                  </th>

                </tr>

              </thead>


              <tbody>

                {aportes.map(
                  (aporte) => (

                    <tr
                      key={
                        aporte.id
                      }
                      className="
                        border-t
                        border-slate-100
                      "
                    >

                      <td className="p-4">
                        Semana {aporte.semana}
                      </td>

                      <td className="p-4 font-semibold">
                        $
                        {Number(
                          aporte.monto
                        ).toFixed(2)}
                      </td>

                      <td className="p-4">
                        $
                        {Number(
                          aporte.comision_app
                        ).toFixed(2)}
                      </td>

                      <td className="p-4">

                        <span
                          className="
                            rounded-full
                            bg-emerald-100
                            text-emerald-700
                            px-3
                            py-1
                            text-xs
                            font-semibold
                          "
                        >
                          {aporte.estado}
                        </span>

                      </td>

                      <td className="p-4 text-slate-500">
                        {new Date(
                          aporte.fecha_pago
                        ).toLocaleDateString()}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
};


export default Aportes;
