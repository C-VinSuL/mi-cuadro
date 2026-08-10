import {
  useEffect,
  useState
} from "react";

import { supabase } from "../../services/supabase";
import ParticipantCard from "./ParticipantCard";

const CuadroBoard = ({ grupo }) => {
  const [participants, setParticipants] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (grupo?.id) {
      obtenerParticipantes();
    }
  }, [grupo]);

  const obtenerParticipantes = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } =
      await supabase
        .from("participantes")
        .select("*")
        .eq("grupo_id", grupo.id)
        .order(
          "posicion",
          {
            ascending: true
          }
        );

    if (error) {
      console.error(
        "Error cargando participantes:",
        error
      );

      setErrorMessage(
        "No se pudieron cargar los participantes."
      );
    } else {
      setParticipants(data || []);
    }

    setLoading(false);
  };

  const obtenerTextoEstado = (estado) => {
    switch (estado) {
      case "recibido":
        return "Ya recibió";

      case "pagado":
        return "Pagó";

      case "actual":
        return "Turno actual";

      default:
        return "Pendiente";
    }
  };

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
        Cargando participantes...
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
        min-w-0
        bg-white
        rounded-3xl
        border
        border-slate-200
        shadow-sm
        p-5
        md:p-6
        overflow-hidden
      "
    >

      {/* ENCABEZADO */}

      <div
        className="
          flex
          flex-col
          lg:flex-row
          lg:items-center
          lg:justify-between
          gap-4
          mb-6
        "
      >
        <div className="min-w-0">

          <p
            className="
              text-sm
              font-medium
              text-emerald-700
            "
          >
            {grupo?.nombre}
          </p>

          <h2
            className="
              text-2xl
              font-bold
              text-slate-900
            "
          >
            Tablero del Cuadro
          </h2>

          <p
            className="
              text-sm
              text-slate-500
              mt-1
            "
          >
            Revisa las posiciones y el estado de los integrantes.
          </p>

        </div>

        <div
          className="
            shrink-0
            bg-orange-50
            border
            border-orange-200
            rounded-2xl
            px-4
            py-3
          "
        >
          <p className="text-xs text-orange-700">
            Semana actual
          </p>

          <p className="font-bold text-orange-900">
            {grupo?.semana_actual}
          </p>
        </div>

      </div>


      {/* PARTICIPANTES */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          2xl:grid-cols-5
          gap-4
          min-w-0
        "
      >
        {participants.map(
          (participant) => (
            <ParticipantCard
              key={participant.id}
              participant={{
                posicion:
                  participant.posicion,

                nombre:
                  participant.nombre,

                estado:
                  participant.estado,

                textoEstado:
                  obtenerTextoEstado(
                    participant.estado
                  )
              }}
            />
          )
        )}

      </div>

    </section>
  );
};

export default CuadroBoard;