import { useEffect, useState } from "react";
import StaggerList from "../../../components/motion/StaggerList";
import { Activity, HandCoins, Landmark, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { getAdminActivityOverview } from "../../../services/dashboardService";

const currency = new Intl.NumberFormat("es", { style: "currency", currency: "USD" });
const shortDate = new Intl.DateTimeFormat("es", { dateStyle: "short" });
const monthLabel = new Intl.DateTimeFormat("es", { month: "short" });
const ACTIVITY_SERIES = [
  { key: "contributions", dateKey: "fecha_pago", label: "Aportes", color: "#059669" },
  { key: "deliveries", dateKey: "fecha_entrega", label: "Entregas", color: "#0f766e" },
  { key: "loans", dateKey: "fecha_solicitud", label: "Préstamos", color: "#d97706" },
  { key: "movements", dateKey: "created_at", label: "Movimientos", color: "#2563eb" }
];

const buildMonthlyActivity = (data) => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const monthKeys = new Set(months.map((month) => `${month.getFullYear()}-${month.getMonth()}`));
  const counts = months.map((month) => ({
    key: `${month.getFullYear()}-${month.getMonth()}`,
    label: monthLabel.format(month).replace(".", ""),
    contributions: 0,
    deliveries: 0,
    loans: 0,
    movements: 0
  }));
  const buckets = new Map(counts.map((month) => [month.key, month]));

  ACTIVITY_SERIES.forEach(({ key, dateKey }) => {
    (data[key] || []).forEach((record) => {
      const date = record[dateKey] ? new Date(`${String(record[dateKey]).slice(0, 10)}T12:00:00`) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKeys.has(monthKey)) buckets.get(monthKey)[key] += 1;
    });
  });

  return counts;
};

const ActivityChart = ({ data }) => {
  const monthlyActivity = buildMonthlyActivity(data);
  const hasActivity = monthlyActivity.some((month) => ACTIVITY_SERIES.some(({ key }) => month[key] > 0));
  const maxCount = Math.max(1, ...monthlyActivity.flatMap((month) => ACTIVITY_SERIES.map(({ key }) => month[key])));
  const chartWidth = 700;
  const chartHeight = 180;
  const left = 36;
  const right = 16;
  const top = 16;
  const bottom = 10;
  const tickCount = Math.min(maxCount, 3);
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const pointsForSeries = (key) => monthlyActivity.map((month, index) => ({
    x: left + (monthlyActivity.length === 1 ? 0 : (index * plotWidth) / (monthlyActivity.length - 1)),
    y: top + plotHeight - (month[key] / maxCount) * plotHeight,
    value: month[key],
    label: month.label
  }));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="dashboard-activity-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-800">
            <Activity size={18} />
            <h3 id="dashboard-activity-title" className="font-semibold text-slate-900">Movimiento de acciones</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Registros de los últimos seis meses, en todos los grupos.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Por mes</span>
      </div>

      {hasActivity ? (
        <>
          <div className="mt-4" role="img" aria-label="Gráfica mensual de aportes, entregas, préstamos y movimientos del fondo">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-44 w-full sm:h-52" preserveAspectRatio="none">
              {Array.from({ length: tickCount + 1 }, (_, index) => index).map((line) => {
                const y = top + (plotHeight * line) / tickCount;
                return (
                  <g key={line}>
                    <line x1={left} y1={y} x2={chartWidth - right} y2={y} stroke="#e2e8f0" strokeDasharray={line === tickCount ? "0" : "4 5"} />
                    <text x={left - 9} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">
                      {maxCount - (line * maxCount) / tickCount}
                    </text>
                  </g>
                );
              })}
              {ACTIVITY_SERIES.map(({ key, label, color }) => {
                const points = pointsForSeries(key);
                const path = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
                return (
                  <g key={key}>
                    <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map(({ x, y, value, label: month }) => (
                      <circle key={`${key}-${month}`} cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2">
                        <title>{`${label}, ${month}: ${value}`}</title>
                      </circle>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-6 text-center text-xs capitalize text-slate-500" aria-hidden="true">
            {monthlyActivity.map((month) => <span key={month.key}>{month.label}</span>)}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label="Leyenda de la gráfica">
            {ACTIVITY_SERIES.map(({ key, label, color }) => (
              <span key={key} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
                <span className="text-slate-400">
                  {monthlyActivity.reduce((total, month) => total + month[key], 0)}
                </span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50 px-4 text-center sm:min-h-48">
          <Activity size={24} className="text-emerald-700" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Sin actividad reciente</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">Cuando se registren aportes, entregas, préstamos o movimientos, su evolución aparecerá aquí.</p>
        </div>
      )}
    </section>
  );
};

const LoanStatusChart = ({ loans }) => {
  const statusColors = ["bg-emerald-600", "bg-amber-500", "bg-red-500", "bg-blue-600", "bg-slate-500"];
  const statusLabels = {
    pendiente: "Pendiente",
    aprobado: "Aprobado",
    pagado: "Pagado",
    rechazado: "Rechazado",
    cancelado: "Cancelado",
    desembolsado: "Desembolsado"
  };
  const counts = loans.reduce((result, loan) => {
    const status = String(loan.estado || "sin estado").toLowerCase();
    result.set(status, (result.get(status) || 0) + 1);
    return result;
  }, new Map());
  const statuses = [...counts.entries()].sort((first, second) => second[1] - first[1]);
  const total = loans.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="loan-status-title">
      <div className="flex items-center gap-2 text-emerald-800">
        <HandCoins size={18} />
        <h3 id="loan-status-title" className="font-semibold text-slate-900">Estado de préstamos</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">Distribución de solicitudes de todos los grupos.</p>
      {total === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Aún no hay préstamos registrados.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {statuses.map(([status, count], index) => (
            <div key={status}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate capitalize text-slate-600">{statusLabels[status] || status.replaceAll("_", " ")}</span>
                <span className="shrink-0 font-semibold text-slate-900">{count} <span className="font-normal text-slate-500">· {Math.round((count / total) * 100)}%</span></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${statusColors[index % statusColors.length]}`} style={{ width: `${(count / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">{total} préstamos registrados</p>
    </section>
  );
};

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
    { label: "Préstamos registrados", value: data.loans.length, icon: HandCoins },
    { label: "Movimientos del fondo", value: data.movements.length, icon: Wallet }
  ] : [];

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Aportes y movimientos</p>
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
          <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"><Icon size={19} /></span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="truncate text-xl font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </StaggerList>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)]">
            <ActivityChart data={data} />
            <LoanStatusChart loans={data.loans} />
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