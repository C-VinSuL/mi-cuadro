import Card from "../../components/ui/Card/Card";
import CardTitle from "../../components/ui/Card/CardTitle";
import CardValue from "../../components/ui/Card/CardValue";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <section className="rounded-none border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 shadow-sm sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">Resumen semanal</p>
            <h2 className="mt-3 text-[24px] font-semibold text-slate-900 sm:text-[30px]">
              Tu caja comunal está en buen camino
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-600 sm:text-[16px]">
              Mantén el ritmo de tus aportes y revisa el progreso del grupo desde un panel más claro y elegante.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-500">Próxima ronda</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Semana 4 de 10</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardTitle>Integrantes</CardTitle>
          <CardValue>10</CardValue>
        </Card>

        <Card>
          <CardTitle>Pozo</CardTitle>
          <CardValue>$100</CardValue>
        </Card>

        <Card>
          <CardTitle>Semana</CardTitle>
          <CardValue>4 / 10</CardValue>
        </Card>

        <Card>
          <CardTitle>Tu puesto</CardTitle>
          <CardValue>#7</CardValue>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;