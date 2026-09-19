import {
  useEffect,
  useState
} from "react";

import {
  CheckCircle2,
  Clock3,
  Trophy,
  CircleDollarSign,
  LockKeyhole,
  Users
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";

const RondaAdmin = () => {
  const {
    grupo,
    profile,
    cargarGrupo
  } = useAuth();

  const [participantes, setParticipantes] =
    useState([]);

  const [aportes, setAportes] =
    useState([]);

  const [entregas, setEntregas] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [cerrando, setCerrando] =
    useState(false);

  const [
    mostrarConfirmacion,
    setMostrarConfirmacion
  ] = useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [tipoMensaje, setTipoMensaje] =
    useState("");


  // ========================================
  // PERMISOS
  // ========================================

  const { can } =
  usePermissions();

const puedeAdministrar =
  can("cerrarRonda");


  // ========================================
  // CARGAR DATOS
  // ========================================

  const cargarDatos = async () => {
    if (!grupo?.id) return;

    setLoading(true);

    const [
      participantesResponse,
      aportesResponse,
      entregasResponse
    ] = await Promise.all([

      supabase
        .from("participantes")
        .select(`
          id,
          nombre,
          posicion
        `)
        .eq("grupo_id", grupo.id)
        .order("posicion"),

      supabase
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
        ),

      supabase
        .from("entregas")
        .select(`
          id,
          participante_id,
          semana,
          monto
        `)
        .eq("grupo_id", grupo.id)

    ]);


    if (participantesResponse.error) {
      console.error(
        participantesResponse.error
      );
    }

    if (aportesResponse.error) {
      console.error(
        aportesResponse.error
      );
    }

    if (entregasResponse.error) {
      console.error(
        entregasResponse.error
      );
    }


    setParticipantes(
      participantesResponse.data || []
    );

    setAportes(
      aportesResponse.data || []
    );

    setEntregas(
      entregasResponse.data || []
    );

    setLoading(false);
  };


  useEffect(() => {
    if (
      grupo?.id &&
      grupo?.estado === "activo"
    ) {
      cargarDatos();
    }
  }, [
    grupo?.id,
    grupo?.semana_actual,
    grupo?.estado
  ]);


  // ========================================
  // NO MOSTRAR PARA SOCIO
  // ========================================

  if (!puedeAdministrar) {
    return null;
  }


  if (!grupo) {
    return null;
  }


  if (grupo.estado !== "activo") {
    return null;
  }


  // ========================================
  // CÁLCULOS
  // ========================================

  const capacidad =
    Number(
      grupo.numero_integrantes || 0
    );

  const aporteSemanal =
    Number(
      grupo.aporte_semanal || 0
    );

  const pozo =
    capacidad * aporteSemanal;


  const aportesPagados =
    aportes.filter(
      (aporte) =>
        aporte.estado === "pagado"
    );


  const totalPagados =
    new Set(
      aportesPagados.map(
        (aporte) =>
          aporte.participante_id
      )
    ).size;


  const todosPagaron =
    capacidad > 0 &&
    totalPagados === capacidad;


  const porcentaje =
    capacidad > 0
      ? Math.min(
          (
            totalPagados /
            capacidad
          ) * 100,
          100
        )
      : 0;


  // ========================================
  // BENEFICIARIO AUTOMÁTICO
  // ========================================

  const beneficiario =
    participantes.find(
      (participante) =>
        Number(
          participante.posicion
        ) ===
        Number(
          grupo.semana_actual
        )
    );


  const yaRecibio =
    beneficiario
      ? entregas.some(
          (entrega) =>
            entrega.participante_id ===
            beneficiario.id
        )
      : false;


  // ========================================
  // PENDIENTES
  // ========================================

  const idsPagados =
    new Set(
      aportesPagados.map(
        (aporte) =>
          aporte.participante_id
      )
    );


  const pendientes =
    participantes.filter(
      (participante) =>
        !idsPagados.has(
          participante.id
        )
    );


  const puedeCerrar =
    todosPagaron &&
    beneficiario &&
    !yaRecibio;


  // ========================================
  // CERRAR RONDA
  // ========================================

  const cerrarRonda = async () => {
    if (!puedeCerrar) {
      return;
    }

    setCerrando(true);

    setMensaje("");
    setTipoMensaje("");


    const {
      data,
      error
    } = await supabase.rpc(
      "cerrar_ronda",
      {
        p_grupo_id:
          grupo.id
      }
    );


    if (error) {
      console.error(
        "Error cerrando ronda:",
        error
      );

      setMensaje(
        error.message ||
        "No se pudo cerrar la ronda."
      );

      setTipoMensaje("error");

      setCerrando(false);

      return;
    }


    setMensaje(
      data?.mensaje ||
      "Ronda cerrada correctamente."
    );

    setTipoMensaje("success");


    setMostrarConfirmacion(
      false
    );


    await cargarGrupo(
      grupo.id
    );


    setCerrando(false);
  };


  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <section
        className="
          rounded-3xl
          border
          border-slate-200
          bg-white
          p-7
          text-slate-500
        "
      >
        Cargando gestión de ronda...
      </section>
    );
  }


  return (
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

      {/* HEADER */}

      <div
        className="
          border-b
          border-slate-100
          p-6
          md:p-8
        "
      >

        <div
          className="
            flex
            flex-col
            gap-6
            xl:flex-row
            xl:items-center
            xl:justify-between
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
              Gestión administrativa
            </p>

            <h2
              className="
                mt-1
                text-2xl
                font-bold
                text-slate-900
                md:text-3xl
              "
            >
              Ronda {grupo.semana_actual}
            </h2>

            <p
              className="
                mt-2
                text-slate-500
              "
            >
              Controla los aportes antes
              de cerrar la ronda actual.
            </p>

          </div>


          <div
            className="
              rounded-2xl
              border
              border-emerald-100
              bg-emerald-50
              px-5
              py-4
            "
          >

            <p
              className="
                text-xs
                text-emerald-700
              "
            >
              Pozo de esta ronda
            </p>

            <p
              className="
                mt-1
                text-3xl
                font-bold
                text-emerald-900
              "
            >
              ${pozo.toFixed(2)}
            </p>

          </div>

        </div>

      </div>


      {/* CONTENIDO */}

      <div
        className="
          space-y-7
          p-6
          md:p-8
        "
      >

        {/* MÉTRICAS */}

        <div
          className="
            grid
            grid-cols-1
            gap-5
            md:grid-cols-3
          "
        >

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              p-5
            "
          >
            <Users
              className="
                text-emerald-700
              "
            />

            <p
              className="
                mt-4
                text-sm
                text-slate-500
              "
            >
              Aportes recibidos
            </p>

            <p
              className="
                mt-1
                text-3xl
                font-bold
              "
            >
              {totalPagados} / {capacidad}
            </p>
          </div>


          <div
            className="
              rounded-2xl
              border
              border-slate-200
              p-5
            "
          >

            {todosPagaron ? (
              <CheckCircle2
                className="
                  text-emerald-600
                "
              />
            ) : (
              <Clock3
                className="
                  text-amber-500
                "
              />
            )}

            <p
              className="
                mt-4
                text-sm
                text-slate-500
              "
            >
              Estado
            </p>

            <p
              className="
                mt-1
                text-xl
                font-bold
              "
            >
              {todosPagaron
                ? "Todos pagaron"
                : `${pendientes.length} pendientes`
              }
            </p>

          </div>


          <div
            className="
              rounded-2xl
              border
              border-slate-200
              p-5
            "
          >

            <Trophy
              className="
                text-amber-500
              "
            />

            <p
              className="
                mt-4
                text-sm
                text-slate-500
              "
            >
              Beneficiario
            </p>

            <p
              className="
                mt-1
                text-xl
                font-bold
              "
            >
              {beneficiario
                ? beneficiario.nombre
                : "Sin asignar"
              }
            </p>

            {beneficiario && (
              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                Puesto #{beneficiario.posicion}
              </p>
            )}

          </div>

        </div>


        {/* PROGRESO */}

        <div>

          <div
            className="
              mb-2
              flex
              justify-between
              text-sm
            "
          >
            <span className="text-slate-500">
              Progreso de aportes
            </span>

            <strong>
              {Math.round(porcentaje)}%
            </strong>
          </div>

          <div
            className="
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
                bg-emerald-500
                transition-all
              "
              style={{
                width:
                  `${porcentaje}%`
              }}
            />
          </div>

        </div>


        {/* PENDIENTES */}

        {!todosPagaron && (
          <div
            className="
              rounded-2xl
              border
              border-amber-200
              bg-amber-50
              p-5
            "
          >

            <p
              className="
                font-semibold
                text-amber-900
              "
            >
              Faltan aportes para cerrar
              la ronda
            </p>

            <div
              className="
                mt-4
                flex
                flex-wrap
                gap-2
              "
            >

              {pendientes.map(
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


        {/* BENEFICIARIO */}

        {todosPagaron &&
          beneficiario &&
          !yaRecibio && (

          <div
            className="
              rounded-2xl
              border
              border-emerald-200
              bg-emerald-50
              p-5
            "
          >

            <div
              className="
                flex
                items-start
                gap-4
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
                  bg-emerald-100
                  text-emerald-700
                "
              >
                <Trophy size={21} />
              </div>

              <div>

                <p
                  className="
                    font-semibold
                    text-emerald-900
                  "
                >
                  Ronda lista para cerrar
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    text-emerald-800
                  "
                >
                  El beneficiario de la
                  semana {grupo.semana_actual}
                  {" "}es{" "}

                  <strong>
                    {beneficiario.nombre}
                  </strong>

                  {" "}por ocupar el puesto{" "}

                  <strong>
                    #{beneficiario.posicion}
                  </strong>.
                </p>

              </div>

            </div>

          </div>

        )}


        {/* ERROR DE INTEGRIDAD */}

        {yaRecibio && (
          <div
            className="
              rounded-2xl
              border
              border-red-200
              bg-red-50
              p-5
              text-red-800
            "
          >

            <p className="font-semibold">
              Inconsistencia detectada
            </p>

            <p className="mt-1 text-sm">
              El participante asignado a
              esta ronda ya aparece como
              beneficiario de una entrega
              anterior.
            </p>

          </div>
        )}


        {/* MENSAJE */}

        {mensaje && (
          <div
            className={`
              rounded-2xl
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
            {mensaje}
          </div>
        )}


        {/* BOTÓN */}

        <div
          className="
            flex
            justify-end
          "
        >

          <button
            onClick={() =>
              setMostrarConfirmacion(
                true
              )
            }
            disabled={!puedeCerrar}
            className={`
              flex
              items-center
              gap-2
              rounded-xl
              px-6
              py-3
              font-semibold
              transition

              ${
                puedeCerrar
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

            {puedeCerrar ? (
              <CheckCircle2 size={19} />
            ) : (
              <LockKeyhole size={19} />
            )}

            {puedeCerrar
              ? "Cerrar ronda"
              : "Ronda pendiente"
            }

          </button>

        </div>

      </div>


      {/* ====================================
          MODAL CONFIRMACIÓN
      ===================================== */}

      {mostrarConfirmacion && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/40
            p-4
          "
        >

          <div
            className="
              w-full
              max-w-lg
              rounded-3xl
              bg-white
              p-7
              shadow-xl
            "
          >

            <p
              className="
                text-sm
                font-semibold
                text-emerald-700
              "
            >
              Cierre de ronda
            </p>

            <h2
              className="
                mt-1
                text-2xl
                font-bold
                text-slate-900
              "
            >
              Confirmar entrega
            </h2>

            <p
              className="
                mt-3
                text-slate-500
              "
            >
              Estás por cerrar la ronda{" "}
              {grupo.semana_actual}.
            </p>


            <div
              className="
                mt-6
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
                  gap-4
                "
              >
                <span className="text-slate-500">
                  Beneficiario
                </span>

                <strong>
                  {beneficiario?.nombre}
                </strong>
              </div>


              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >
                <span className="text-slate-500">
                  Puesto
                </span>

                <strong>
                  #{beneficiario?.posicion}
                </strong>
              </div>


              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >
                <span className="text-slate-500">
                  Aportes
                </span>

                <strong>
                  {totalPagados} / {capacidad}
                </strong>
              </div>


              <div
                className="
                  flex
                  justify-between
                  gap-4
                "
              >
                <span className="text-slate-500">
                  Monto a entregar
                </span>

                <strong
                  className="
                    text-emerald-700
                  "
                >
                  ${pozo.toFixed(2)}
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
              Al confirmar se registrará
              oficialmente la entrega y el
              sistema avanzará a la siguiente
              ronda.
            </div>


            <div
              className="
                mt-7
                flex
                justify-end
                gap-3
              "
            >

              <button
                onClick={() =>
                  setMostrarConfirmacion(
                    false
                  )
                }
                disabled={cerrando}
                className="
                  rounded-xl
                  border
                  border-slate-300
                  px-4
                  py-2.5
                  hover:bg-slate-50
                "
              >
                Cancelar
              </button>


              <button
                onClick={cerrarRonda}
                disabled={cerrando}
                className="
                  rounded-xl
                  bg-emerald-600
                  px-5
                  py-2.5
                  font-semibold
                  text-white
                  hover:bg-emerald-700
                "
              >
                {cerrando
                  ? "Cerrando..."
                  : "Confirmar entrega"
                }
              </button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
};

export default RondaAdmin;