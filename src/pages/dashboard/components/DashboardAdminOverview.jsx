import { useEffect, useState } from "react";
import { Landmark, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { getAdminActivityOverview } from "../../../services/dashboardService";

const currency = new Intl.NumberFormat("es", { style: "currency", currency: "USD" });
const shortDate = new Intl.DateTimeFormat("es", { dateStyle: "short" });

const DashboardAdminOverview = ({ grupos }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      setLoading(true);
      setError("");
      try {
        const overview = await getAdminActivityOverview(grupos);
        if (active) setData(overview);
      } catch (overviewError) {
        console.error("Error cargando actividad global:", overviewError);
        if (active) setError("No se pudo cargar la actividad de todos los grupos.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadOverview();
    return () => {
      active = false;
    };
  }, [grupos]);

  const metrics = data ? [
    { label: "Grupos", value: grupos.length, icon: Landmark },
    { label: "Socios", value: data.participants.length, icon: Users },
    { label: "Aportes", value: currency.format(data.contributions.reduce((sum, item) => sum + Number(item.monto || 0), 0)), icon: Wallet },
    { label: "Entregas", value: currency.format(data.deliveries.reduce((sum, item) => sum + Number(item.monto || 0), 0)), icon: Wallet },
    { label: "Movimientos del fondo", value: data.movements.length, icon: Wallet }
  ] : [];

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administración</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Actividad de todos los grupos</h2>
          <p className="mt-1 text-sm text-slate-600">Aportes, entregas, préstamos y movimientos registrados por los socios.</p>
        </div>
        <Link to="/grupo" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">Gestionar grupos</Link>
      </header>

      {loading ? (
        <p className="py-6 text-sm text-slate-500" role="status">Cargando actividad...</p>
      ) : error ? (
        <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 border-y border-slate-200 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Icon size={19} /></span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="truncate text-xl font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Movimientos recientes</h3>
              <p className="mt-1 text-sm text-slate-500">Últimos 40 registros de todos los grupos.</p>
            </div>
            {!data.activities.length ? (
              <p className="px-4 py-8 text-sm text-slate-500">Aún no hay movimientos registrados en los grupos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Grupo</th>
                      <th className="px-4 py-3 font-semibold">Socio</th>
                      <th className="px-4 py-3 font-semibold">Movimiento</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.activities.map((activity) => (
                      <tr key={activity.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {activity.date ? shortDate.format(new Date(activity.date)) : "Sin fecha"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{activity.group}</td>
                        <td className="px-4 py-3 text-slate-700">{activity.participant}</td>
                        <td className="px-4 py-3 text-slate-700">{activity.type}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{activity.status}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">{currency.format(activity.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default DashboardAdminOverview;