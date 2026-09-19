import {
  useEffect,
  useState
} from "react";

import {
  CheckCircle2,
  Clock3,
  Trophy,
  CircleDollarSign
} from "lucide-react";

import { supabase } from "../../services/supabase";


const CuadroBoard = ({ grupo }) => {

  const [participantes, setParticipantes] = useState([]);
  const [aportes, setAportes] = useState([]);
  const [entregas, setEntregas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");


  useEffect(() => {

    if (grupo?.id) {
      cargarDatosCuadro();
    }

  }, [grupo]);


  // ========================================
  // CARGAR TODA LA INFORMACIÓN DEL CUADRO
  // ========================================

  const cargarDatosCuadro = async () => {

    setLoading(true);
    setErrorMessage("");

    try {

      // PARTICIPANTES

      const {
        data: participantesData,
        error: participantesError
      } = await supabase
        .from("participantes")
        .select(`
          id,
          nombre,
          posicion,
          perfil_id
        `)
        .eq("grupo_id", grupo.id)
        .order("posicion", {
          ascending: true
        });


      if (participantesError) {
        throw participantesError;
      }


      // APORTES SEMANA ACTUAL

      const {
        data: aportesData,
        error: aportesError
      } = await supabase
        .from("aportes")
        .select(`
          id,
          participante_id,
          semana,
          monto,
          estado
        `)
        .eq("grupo_id", grupo.id)
        .eq(
          "semana",
          grupo.semana_actual
        );


      if (aportesError) {
        throw aportesError;
      }


      // ENTREGAS REALIZADAS

      const {
        data: entregasData,
        error: entregasError
      } = await supabase
        .from("entregas")
        .select(`
          id,
          participante_id,
          semana,
          monto,
          fecha_entrega
        `)
        .eq("grupo_id", grupo.id);


      if (entregasError) {
        throw entregasError;
      }


      setParticipantes(
        participantesData || []
      );

      setAportes(
        aportesData || []
      );

      setEntregas(
        entregasData || []
      );

    } catch (error) {

      console.error(
        "Error cargando cuadro:",
        error
      );

      setErrorMessage(
        "No se pudo cargar la información del cuadro."
      );

    }

    setLoading(false);
  };


  // ========================================
  // ¿PAGÓ ESTA SEMANA?
  // ========================================

  const participantePago = (participanteId) => {

    return aportes.some(
      (aporte) =>
        aporte.participante_id === participanteId &&
        aporte.estado === "pagado"
    );

  };


  // ========================================
  // ¿YA RECIBIÓ?
  // ========================================

  const obtenerEntrega = (participanteId) => {

    return entregas.find(
      (entrega) =>
        entrega.participante_id === participanteId
    );

  };


  // ========================================
  // ESTADÍSTICAS
  // ========================================

  const totalPagados =
    participantes.filter(
      (participante) =>
        participantePago(
          participante.id
        )
    ).length;


  const faltanPagar =
    participantes.length -
    totalPagados;


  // ========================================
  // LOADING
  // ========================================

  if (loading) {

    return (
      <div
        className="
          bg-white
          rounded-3xl
          border
          border-slate-200
          p-8
          text-slate-500
        "
      >
        Cargando estado del cuadro...
      </div>
    );

  }


  if (errorMessage) {

    return (
      <div
        className="
          bg-red-50
          border
          border-red-200
          text-red-700
          rounded-2xl
          p-5
        "
      >
        {errorMessage}
      </div>
    );

  }


  return (
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

      {/* =====================================
          HEADER
      ====================================== */}

      <div
        className="
          p-6
          md:p-8
          border-b
          border-slate-100
        "
      >

        <div
          className="
            flex
            flex-col
            xl:flex-row
            xl:items-center
            xl:justify-between
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
              {grupo.nombre}
            </p>

            <h2
              className="
                text-2xl
                md:text-3xl
                font-bold
                text-slate-900
                mt-1
              "
            >
              Estado de la semana
            </h2>

            <p
              className="
                text-slate-500
                mt-2
              "
            >
              Semana {grupo.semana_actual}
              {" · "}
              {totalPagados} de {participantes.length}
              {" "}integrantes han realizado su aporte.
            </p>

          </div>


          {/* RESUMEN */}

          <div
            className="
              flex
              flex-wrap
              gap-3
            "
          >

            <div
              className="
                bg-emerald-50
                border
                border-emerald-100
                rounded-2xl
                px-5
                py-3
              "
            >

              <p
                className="
                  text-xs
                  text-emerald-700
                "
              >
                Pagaron
              </p>

              <p
                className="
                  text-xl
                  font-bold
                  text-emerald-900
                "
              >
                {totalPagados}
              </p>

            </div>


            <div
              className="
                bg-amber-50
                border
                border-amber-100
                rounded-2xl
                px-5
                py-3
              "
            >

              <p
                className="
                  text-xs
                  text-amber-700
                "
              >
                Pendientes
              </p>

              <p
                className="
                  text-xl
                  font-bold
                  text-amber-900
                "
              >
                {faltanPagar}
              </p>

            </div>

          </div>

        </div>

      </div>


      {/* =====================================
          PARTICIPANTES
      ====================================== */}

      <div
        className="
          p-6
          md:p-8
        "
      >

        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            xl:grid-cols-3
            2xl:grid-cols-4
            gap-5
          "
        >

          {participantes.map(
            (participante) => {

              const pago =
                participantePago(
                  participante.id
                );

              const entrega =
                obtenerEntrega(
                  participante.id
                );


              return (

                <article
                  key={
                    participante.id
                  }
                  className="
                    relative
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-5
                    transition
                    hover:shadow-md
                  "
                >

                  {/* POSICIÓN */}

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-4
                    "
                  >

                    <div
                      className="
                        w-11
                        h-11
                        rounded-full
                        bg-emerald-50
                        text-emerald-700
                        flex
                        items-center
                        justify-center
                        font-bold
                      "
                    >
                      {participante.posicion}
                    </div>


                    {/* PAGO */}

                    {pago ? (

                      <span
                        className="
                          flex
                          items-center
                          gap-1
                          rounded-full
                          bg-emerald-100
                          text-emerald-700
                          px-3
                          py-1
                          text-xs
                          font-semibold
                        "
                      >
                        <CheckCircle2 size={14} />

                        Pagó
                      </span>

                    ) : (

                      <span
                        className="
                          flex
                          items-center
                          gap-1
                          rounded-full
                          bg-amber-100
                          text-amber-700
                          px-3
                          py-1
                          text-xs
                          font-semibold
                        "
                      >
                        <Clock3 size={14} />

                        Pendiente
                      </span>

                    )}

                  </div>


                  {/* NOMBRE */}

                  <h3
                    className="
                      text-lg
                      font-semibold
                      text-slate-900
                      mt-5
                    "
                  >
                    {participante.nombre}
                  </h3>


                  {/* ENTREGA */}

                  <div
                    className="
                      mt-4
                      pt-4
                      border-t
                      border-slate-100
                    "
                  >

                    {entrega ? (

                      <div
                        className="
                          flex
                          items-center
                          gap-3
                          text-amber-700
                        "
                      >

                        <Trophy size={18} />

                        <div>

                          <p
                            className="
                              text-sm
                              font-semibold
                            "
                          >
                            Ya recibió el cuadro
                          </p>

                          <p
                            className="
                              text-xs
                              text-slate-500
                              mt-0.5
                            "
                          >
                            Semana {entrega.semana}
                            {" · "}
                            ${Number(
                              entrega.monto
                            ).toFixed(2)}
                          </p>

                        </div>

                      </div>

                    ) : (

                      <div
                        className="
                          flex
                          items-center
                          gap-3
                          text-slate-400
                        "
                      >

                        <CircleDollarSign
                          size={18}
                        />

                        <p
                          className="
                            text-sm
                          "
                        >
                          Aún no recibe
                        </p>

                      </div>

                    )}

                  </div>

                </article>

              );

            }
          )}

        </div>

      </div>

    </section>
  );
};


export default CuadroBoard;