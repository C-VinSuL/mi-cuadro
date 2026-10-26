import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, TrendingDown, Wallet } from "lucide-react";
import StaggerList from "../../components/motion/StaggerList";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import {
  listarEgresosRecientes,
  obtenerTotalEgresos,
  registrarEgreso
} from "../../services/egresosService";
import { logOperationalError } from "../../utils/logOperationalError";
import { formatCurrencyDecimal, parseAmountToCents } from "../../utils/money";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const categories = ["Suministros", "Eventos", "Servicios", "Transporte", "Otros"];
const localDate = new Date();
localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
const today = localDate.toISOString().slice(0, 10);
const emptyForm = { grupoId: "", concepto: "", categoria: "", monto: "", fecha: today };

const Egresos = () => {
  const { grupos } = useAuth();
  const { notify } = useNotifications();
  const [form, setForm] = useState(emptyForm);
  const [egresos, setEgresos] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const gruposId = useMemo(() => grupos.map((grupo) => grupo.id), [grupos]);
  const categoriasFiltro = useMemo(() => (
    [...new Set([...categories, ...egresos.map((egreso) => egreso.categoria)])]
  ), [egresos]);
  const grupoInicialId = grupos.find((grupo) => grupo.id === form.grupoId)?.id
    || grupos.find((grupo) => grupo.estado === "activo")?.id
    || grupos[0]?.id
    || "";

  const cargarEgresos = useCallback(async () => {
    if (!gruposId.length) {
      setEgresos([]);
      setTotal(0);
      setLoadError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const [rows, amount] = await Promise.all([
        listarEgresosRecientes(gruposId),
        obtenerTotalEgresos()
      ]);
      setEgresos(rows);
      setTotal(amount);
    } catch (fetchError) {
      logOperationalError("Error cargando egresos de tesorería:", fetchError);
      setLoadError("No se pudieron cargar los egresos. Verifica tu conexión e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [gruposId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarEgresos, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarEgresos]);

  const egresosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase("es");

    return egresos.filter((egreso) => {
      const matchesCategory = categoriaFiltro === "todas" || egreso.categoria === categoriaFiltro;
      const matchesQuery = !query || [
        egreso.grupo,
        egreso.concepto,
        egreso.categoria,
        egreso.fecha,
        new Date(`${egreso.fecha}T00:00:00`).toLocaleDateString("es-EC"),
        formatCurrencyDecimal(egreso.monto, currency)
      ].some((value) => String(value ?? "").toLocaleLowerCase("es").includes(query));

      return matchesCategory && matchesQuery;
    });
  }, [egresos, categoriaFiltro, busqueda]);

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const enviarEgreso = async (event) => {
    event.preventDefault();
    if (saving) return;

    const concepto = form.concepto.trim();
    const amountInCents = parseAmountToCents(form.monto);
    const validGroup = grupos.some((grupo) => grupo.id === grupoInicialId);
    const validCategory = categories.includes(form.categoria);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(form.fecha)
      && !Number.isNaN(Date.parse(`${form.fecha}T00:00:00.000Z`))
      && new Date(`${form.fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === form.fecha;
    if (!validGroup || !concepto || concepto.length > 500 || !validCategory || !validDate
      || amountInCents === null) {
      setError("Revisa el grupo, la categoría, la fecha y el monto (mayor que cero y hasta dos decimales).");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await registrarEgreso({
        grupoId: grupoInicialId,
        concepto,
        categoria: form.categoria,
        monto: form.monto,
        fecha: form.fecha
      });
      setForm({ ...emptyForm, grupoId: grupoInicialId });
      notify({
        title: "Gasto registrado",
        message: `${formatCurrencyDecimal(form.monto, currency)} se guardó correctamente.`,
        type: "success"
      });
      await cargarEgresos();
    } catch (submitError) {
      logOperationalError("Error registrando egreso:", submitError);
      setError("No se pudo guardar el gasto. Verifica los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <header className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">FlashMonkey · Tesorería</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">Egresos y gastos</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Registra y consulta los gastos de tus grupos en un solo lugar.</p>
      </header>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <StaggerList className="grid gap-5 sm:grid-cols-2" aria-label="Resumen de gastos">
        <Metric tone="emerald" icon={<Wallet size={20} />} label="Total de gastos acumulado" value={formatCurrencyDecimal(total, currency)} />
        <Metric tone="blue" icon={<TrendingDown size={20} />} label="Gastos recientes" value={egresos.length} />
      </StaggerList>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl shadow-emerald-950/5">
        <header className="flex items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-5 sm:px-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/15"><TrendingDown size={20} /></span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Registrar un gasto</h2>
            <p className="mt-1 text-sm text-slate-600">El registro quedará asociado al grupo elegido.</p>
          </div>
        </header>
        {grupos.length === 0 ? (
          <p className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:m-6" role="status">No hay grupos disponibles para registrar gastos.</p>
        ) : (
          <form onSubmit={enviarEgreso} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="text-sm font-medium text-slate-700">
              Grupo
              <select name="grupoId" value={grupoInicialId} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-normal shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none">
                {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Categoría
              <select name="categoria" value={form.categoria} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-normal shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none">
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Concepto / Descripción
              <textarea name="concepto" value={form.concepto} onChange={cambiarCampo} maxLength={500} rows={3} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none" placeholder="Describe el gasto" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Monto (USD)
              <input name="monto" type="number" min="0.01" max="9999999999.99" step="0.01" value={form.monto} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none" placeholder="0.00" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha
              <input name="fecha" type="date" value={form.fecha} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-normal shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:from-emerald-800 hover:to-teal-700 hover:shadow-xl disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none">
                {!saving && <Check size={17} />}
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
            {error && <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Gastos recientes</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos 100 gastos registrados.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative">
              <span className="sr-only">Buscar egresos</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} type="search" aria-label="Buscar gastos" placeholder="Buscar gasto..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 sm:w-52 motion-reduce:transition-none" />
            </label>
            <select value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)} aria-label="Filtrar egresos por categoría" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 motion-reduce:transition-none">
              <option value="todas">Todas las categorías</option>
              {categoriasFiltro.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando egresos...</p>
        ) : loadError ? (
          <p className="px-5 py-8 text-sm text-red-700" role="alert">{loadError}</p>
        ) : egresosFiltrados.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay gastos para mostrar con este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Grupo</th>
                  <th className="px-5 py-3 font-semibold">Concepto</th>
                  <th className="px-5 py-3 font-semibold">Categoría</th>
                  <th className="px-5 py-3 text-right font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {egresosFiltrados.map((egreso) => (
                  <tr key={egreso.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{new Date(`${egreso.fecha}T00:00:00`).toLocaleDateString("es-EC")}</td>
                    <td className="px-5 py-3 text-slate-700">{egreso.grupo}</td>
                    <td className="max-w-xs px-5 py-3 text-slate-700">{egreso.concepto}</td>
                    <td className="px-5 py-3 text-slate-700">{egreso.categoria}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-900">{formatCurrencyDecimal(egreso.monto, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const Metric = ({ tone, icon, label, value }) => {
  const styles = tone === "emerald"
    ? "border-emerald-100 from-white to-emerald-50 text-emerald-700"
    : "border-blue-100 from-white to-blue-50 text-blue-700";

  return (
  <article className={`dashboard-card flex items-center gap-4 rounded-2xl border bg-gradient-to-br p-5 shadow-lg shadow-slate-900/5 sm:p-6 ${styles}`}>
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-current/10">{icon}</span>
    <div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
    </div>
  </article>
  );
};

export default Egresos;
