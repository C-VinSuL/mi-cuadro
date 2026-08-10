import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import ParticipantCard from "./ParticipantCard";

const CuadroBoard = () => {

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    obtenerParticipantes();
  }, []);

  const obtenerParticipantes = async () => {

    setLoading(true);

    const { data, error } = await supabase
      .from("participantes")
      .select("*")
      .order("posicion", { ascending: true });

    if (error) {
  console.error("ERROR SUPABASE COMPLETO:", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
     });

    setErrorMessage("No se pudieron cargar los participantes.");
  }  else {
      setParticipants(data);
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
      <div className="bg-white rounded-3xl p-8">
        Cargando participantes...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-red-50 text-red-700 rounded-2xl p-5">
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
        border-slate-100
        shadow-sm
        p-6
      "
    >

      <div className="mb-7">

        <p className="text-emerald-700 font-medium text-sm">
          Los Amigos del Barrio
        </p>

        <h2 className="text-2xl font-bold text-slate-900">
          Tablero del Cuadro
        </h2>

        <p className="text-slate-500 mt-1">
          Revisa las posiciones y el estado de los integrantes.
        </p>

      </div>

      <div
        className="
          grid
          grid-cols-2
          md:grid-cols-3
          xl:grid-cols-5
          gap-4
        "
      >

        {participants.map((participant) => (

          <ParticipantCard
            key={participant.id}
            participant={{
              posicion: participant.posicion,
              nombre: participant.nombre,
              estado: participant.estado,
              textoEstado: obtenerTextoEstado(
                participant.estado
              )
            }}
          />

        ))}

      </div>

    </section>
  );
};

export default CuadroBoard;