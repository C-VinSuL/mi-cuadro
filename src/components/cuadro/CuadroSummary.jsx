import {
  Users,
  Wallet,
  CalendarDays,
  Armchair
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

const CuadroSummary = ({ grupo }) => {
  const { participant } = useAuth();

  const pozo =
    Number(grupo?.aporte_semanal || 0) *
    Number(grupo?.numero_integrantes || 0);

  const data = [
    {
      title: "Integrantes",
      value: grupo?.numero_integrantes || 0,
      icon: Users
    },
    {
      title: "Pozo del cuadro",
      value: `$${pozo.toFixed(2)}`,
      icon: Wallet
    },
    {
      title: "Semana",
      value: `${grupo?.semana_actual || 0} / ${grupo?.numero_integrantes || 0}`,
      icon: CalendarDays
    },
    {
      title: "Tu puesto",
      value: participant
        ? `#${participant.posicion}`
        : "Sin puesto",
      icon: Armchair
    }
  ];

  return (
    <div
      className="
        grid
        grid-cols-1
        md:grid-cols-2
        2xl:grid-cols-4
        gap-5
      "
    >
      {data.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="
              min-w-0
              bg-white
              rounded-2xl
              border
              border-slate-200
              shadow-sm
              p-5
              min-h-[135px]
              flex
              flex-col
              justify-between
              hover:shadow-md
              transition
            "
          >
            <div
              className="
                w-11
                h-11
                rounded-xl
                bg-emerald-50
                text-emerald-700
                flex
                items-center
                justify-center
              "
            >
              <Icon size={21} />
            </div>

            <div className="mt-4 min-w-0">

              <p
                className="
                  text-sm
                  text-slate-500
                  truncate
                "
              >
                {item.title}
              </p>

              <p
                className="
                  text-2xl
                  md:text-3xl
                  font-bold
                  text-slate-900
                  mt-1
                  break-words
                "
              >
                {item.value}
              </p>

            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CuadroSummary;