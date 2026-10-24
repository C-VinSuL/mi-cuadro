import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingDown, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import {
  listarEgresosRecientes,
  obtenerTotalEgresos,
  registrarEgreso
} from "../../services/egresosService";

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
      console.error("Error cargando egresos de tesorería:", fetchError);
      setLoadError(fetchError.message || "No se pudieron cargar los egresos.");
    } finally {
      setLoading(false);
    }
  }, [gruposId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarEgresos, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarEgresos]);

  const egresosFiltrados = useMemo(() => egresos.filter((egreso) => (
    categoriaFiltro === "todas" || egreso.categoria === categoriaFiltro
  )), [egresos, categoriaFiltro]);

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const enviarEgreso = async (event) => {
    event.preventDefault();
    if (saving) return;

    const concepto = form.concepto.trim();
    const amount = Number(form.monto);
    if (!grupoInicialId || !concepto || !form.categoria || !form.fecha
      || !Number.isFinite(amount) || amount <= 0) {
      setError("Completa todos los campos con un monto mayor que cero.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await registrarEgreso({
        grupoId: grupoInicialId,
        concepto,
        categoria: form.categoria,
        monto: amount,
        fecha: form.fecha
      });
      setForm({ ...emptyForm, grupoId: grupoInicialId });
      notify({
        title: "Gasto registrado",
        message: `${currency.format(amount)} se guardó correctamente.`,
        type: "success"
      });
      await cargarEgresos();
    } catch (submitError) {
      console.error("Error registrando egreso:", submitError);
      setError(submitError.message || "No se pudo guardar el gasto.");
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

      <section className="grid gap-5 sm:grid-cols-2" aria-label="Resumen de gastos">
        <Metric icon={<Wallet size={20} />} label="Total de gastos acumulado" value={currency.format(total)} />
        <Metric icon={<TrendingDown size={20} />} label="Gastos recientes" value={egresos.length} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Registrar un gasto</h2>
        <p className="mt-1 text-sm text-slate-600">El registro quedará asociado al grupo elegido.</p>
        {grupos.length === 0 ? (
          <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="status">No hay grupos disponibles para registrar gastos.</p>
        ) : (
          <form onSubmit={enviarEgreso} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Grupo
              <select name="grupoId" value={grupoInicialId} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Categoría
              <select name="categoria" value={form.categoria} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Concepto / Descripción
              <textarea name="concepto" value={form.concepto} onChange={cambiarCampo} maxLength={500} rows={3} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" placeholder="Describe el gasto" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Monto (USD)
              <input name="monto" type="number" min="0.01" step="0.01" value={form.monto} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" placeholder="0.00" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha
              <input name="fecha" type="date" value={form.fecha} onChange={cambiarCampo} required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Gastos recientes</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos 100 gastos registrados.</p>
          </div>
          <select value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)} aria-label="Filtrar egresos por categoría" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
            <option value="todas">Todas las categorías</option>
            {categoriasFiltro.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
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
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-900">{currency.format(egreso.monto)}</td>
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

const Metric = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">{icon}</span>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default Egresos;
