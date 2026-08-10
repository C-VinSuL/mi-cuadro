import {
  Users,
  Wallet,
  CalendarDays,
  Armchair
} from "lucide-react";

const CuadroSummary = ({ grupo }) => {
  const pozo =
    Number(grupo.aporte_semanal) *
    Number(grupo.numero_integrantes);

  const data = [
    {
      title: "Integrantes",
      value: grupo.numero_integrantes,
      icon: Users
    },
    {
      title: "Pozo del cuadro",
      value: `$${pozo.toFixed(2)}`,
      icon: Wallet
    },
    {
      title: "Semana",
      value: `${grupo.semana_actual} / ${grupo.numero_integrantes}`,
      icon: CalendarDays
    },
    {
      title: "Tu puesto",
      value: "#7",
      icon: Armchair
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

      {data.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="
              bg-white
              rounded-2xl
              border
              border-slate-200
              shadow-sm
              p-6
              min-h-[140px]
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
              <Icon size={22} />
            </div>

            <div className="mt-4">
              <p className="text-sm text-slate-500">
                {item.title}
              </p>

              <p className="text-3xl font-bold text-slate-900 mt-1">
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