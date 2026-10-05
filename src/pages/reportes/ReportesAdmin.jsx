import { useEffect, useMemo, useState } from "react";
import { Download, FileBarChart2, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const obtenerTodosLosMovimientos = async (groupIds) => {
  const allMovements = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("movimientos_fondo")
      .select("id, grupo_id, tipo, concepto, monto, descripcion, created_at")
      .in("grupo_id", groupIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    allMovements.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return allMovements;
};

const ReportesAdmin = () => {
  const { grupos } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      if (!grupos.length) {
        if (active) {
          setMovimientos([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const rows = await obtenerTodosLosMovimientos(grupos.map((grupo) => grupo.id));
        const groupNames = new Map(grupos.map((grupo) => [grupo.id, grupo.nombre]));
        if (active) {
          setMovimientos(rows.map((row) => ({ ...row, grupo: groupNames.get(row.grupo_id) || "Grupo" })));
        }
      } catch (loadError) {
        console.error("Error generando reportes:", loadError);
        if (active) setError("No se pudieron cargar los movimientos para el reporte.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [grupos]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((movimiento) => (
    (grupoFiltro === "todos" || movimiento.grupo_id === grupoFiltro)
    && (tipoFiltro === "todos" || movimiento.tipo === tipoFiltro)
  )), [movimientos, grupoFiltro, tipoFiltro]);

  const resumen = useMemo(() => movimientosFiltrados.reduce((totals, movimiento) => {
    const amount = Number(movimiento.monto || 0);
    if (movimiento.tipo === "ingreso") totals.ingresos += amount;
    if (movimiento.tipo === "egreso") totals.egresos += amount;
    return totals;
  }, { ingresos: 0, egresos: 0 }), [movimientosFiltrados]);

  const descargarReporte = () => {
    const rows = [
      ["Fecha", "Grupo", "Tipo", "Concepto", "Descripción", "Monto"],
      ...movimientosFiltrados.map((movimiento) => [
        movimiento.created_at || "",
        movimiento.grupo,
        movimiento.tipo,
        movimiento.concepto,
        movimiento.descripcion,
        movimiento.monto
      ])
    ];
    const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const fileUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administración</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Reportes financieros</h1>
          <p className="mt-2 text-sm text-slate-600">Consolida los movimientos registrados en todos los grupos.</p>
        </div>
        <button type="button" onClick={descargarReporte} disabled={loading || movimientosFiltrados.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
          <Download size={17} /> Exportar CSV
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <select value={grupoFiltro} onChange={(event) => setGrupoFiltro(event.target.value)} aria-label="Filtrar reporte por grupo" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
          <option value="todos">Todos los grupos</option>
          {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
        </select>
        <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} aria-label="Filtrar reporte por tipo de movimiento" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
          <option value="todos">Ingresos y egresos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
      </div>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen del reporte">
        <Metric icon={<TrendingUp size={19} />} label="Ingresos" value={currency.format(resumen.ingresos)} />
        <Metric icon={<TrendingDown size={19} />} label="Egresos" value={currency.format(resumen.egresos)} />
        <Metric icon={<FileBarChart2 size={19} />} label="Movimientos" value={movimientosFiltrados.length} />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Libro consolidado</h2>
          <p className="mt-1 text-sm text-slate-500">{movimientosFiltrados.length} registros incluidos en este reporte.</p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando movimientos...</p>
        ) : movimientosFiltrados.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay movimientos para estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Grupo</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Concepto</th>
                  <th className="px-5 py-3 font-semibold">Descripción</th>
                  <th className="px-5 py-3 text-right font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientosFiltrados.map((movimiento) => (
                  <tr key={movimiento.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{movimiento.created_at ? new Date(movimiento.created_at).toLocaleDateString("es-EC") : "-"}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{movimiento.grupo}</td>
                    <td className="px-5 py-3 capitalize text-slate-700">{movimiento.tipo}</td>
                    <td className="px-5 py-3 text-slate-700">{movimiento.concepto || "-"}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-slate-600">{movimiento.descripcion || "-"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-900">{currency.format(movimiento.monto)}</td>
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
  <div className="flex items-center gap-3 border-y border-slate-200 py-4">
    <span className="text-emerald-800">{icon}</span>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default ReportesAdmin;