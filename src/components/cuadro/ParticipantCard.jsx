import { Check, Clock3, Trophy } from "lucide-react";

const ParticipantCard = ({ participant }) => {
  const styles = {
    pagado:
      "bg-emerald-50 border-emerald-300 text-emerald-800",

    pendiente:
      "bg-white border-slate-200 text-slate-700",

    recibido:
      "bg-amber-50 border-amber-300 text-amber-800",

    actual:
      "bg-orange-50 border-orange-400 text-orange-900 ring-2 ring-orange-100",
  };

  const getIcon = () => {
    if (participant.estado === "recibido") {
      return <Trophy size={17} />;
    }

    if (participant.estado === "pagado") {
      return <Check size={17} />;
    }

    return <Clock3 size={17} />;
  };

  return (
    <article
      className={`
        rounded-2xl
        border
        p-4
        min-h-36
        flex
        flex-col
        items-center
        justify-center
        text-center
        transition-all
        duration-200
        hover:-translate-y-1
        hover:shadow-md
        ${styles[participant.estado]}
      `}
    >

      <div className="
        w-12
        h-12
        bg-white
        rounded-full
        flex
        items-center
        justify-center
        shadow-sm
        font-bold
        text-lg
      ">
        {participant.posicion}
      </div>

      <h3 className="font-semibold mt-3">
        {participant.nombre}
      </h3>

      <div className="flex items-center gap-1 mt-2 text-sm">
        {getIcon()}
        {participant.textoEstado}
      </div>

    </article>
  );
};

export default ParticipantCard;