import { useEffect, useMemo, useState } from "react";
import { Download, FileBarChart2, PiggyBank, Printer, TrendingDown, TrendingUp } from "lucide-react";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { obtenerSaldoFondo } from "../../services/fondoService";
import { logOperationalError } from "../../utils/logOperationalError";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const obtenerTodosLosMovimientos = async (groupIds, { grupoFiltro, tipoFiltro, desde, hasta }) => {
  const allMovements = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("movimientos_fondo")
      .select("id, grupo_id, tipo, concepto, monto, descripcion, created_at")
      .in("grupo_id", groupIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (grupoFiltro !== "todos") query = query.eq("grupo_id", grupoFiltro);
    if (tipoFiltro !== "todos") query = query.eq("tipo", tipoFiltro);
    if (desde) query = query.gte("created_at", new Date(`${desde}T00:00:00`).toISOString());
    if (hasta) {
      const nextDay = new Date(`${hasta}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt("created_at", nextDay.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    allMovements.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return allMovements;
};

const ReportesAdmin = () => {
  const { grupos } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [saldosPorGrupo, setSaldosPorGrupo] = useState({});
  const [grupoFiltro, setGrupoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      if (!grupos.length) {
        if (active) {
          setMovimientos([]);
          setSaldosPorGrupo({});
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const groupIds = grupos.map((grupo) => grupo.id);
        const [rows, saldos] = await Promise.all([
          obtenerTodosLosMovimientos(groupIds, { grupoFiltro, tipoFiltro, desde, hasta }),
          Promise.all(grupos.map(async (grupo) => [
            grupo.id,
            await obtenerSaldoFondo(grupo.id)
          ]))
        ]);
        const groupNames = new Map(grupos.map((grupo) => [grupo.id, grupo.nombre]));
        if (active) {
          setMovimientos(rows.map((row) => ({ ...row, grupo: groupNames.get(row.grupo_id) || "Grupo" })));
          setSaldosPorGrupo(Object.fromEntries(saldos));
        }
      } catch (loadError) {
        logOperationalError("Error generando reportes:", loadError);
        if (active) setError("No se pudieron cargar los movimientos y saldos para el reporte.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [grupos, grupoFiltro, tipoFiltro, desde, hasta]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((movimiento) => (
    (grupoFiltro === "todos" || movimiento.grupo_id === grupoFiltro)
    && (tipoFiltro === "todos" || movimiento.tipo === tipoFiltro)
    && (!desde || new Date(movimiento.created_at) >= new Date(`${desde}T00:00:00`))
    && (!hasta || new Date(movimiento.created_at) < new Date(`${hasta}T00:00:00`).getTime() + 86400000)
  )), [movimientos, grupoFiltro, tipoFiltro, desde, hasta]);

  const disponibilidad = useMemo(() => grupoFiltro === "todos"
    ? Object.values(saldosPorGrupo).reduce((total, saldo) => total + Number(saldo || 0), 0)
    : Number(saldosPorGrupo[grupoFiltro] || 0), [grupoFiltro, saldosPorGrupo]);

  const resumen = useMemo(() => movimientosFiltrados.reduce((totals, movimiento) => {
    const amount = Number(movimiento.monto || 0);
    if (movimiento.tipo === "ingreso") totals.ingresos += amount;
    if (movimiento.tipo === "egreso") totals.egresos += amount;
    return totals;
  }, { ingresos: 0, egresos: 0 }), [movimientosFiltrados]);

  const descargarReporte = async () => {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FlashMonkey";
      workbook.subject = "Reporte financiero";
      const worksheet = workbook.addWorksheet("Libro consolidado", {
        views: [{ state: "frozen", ySplit: 1 }],
        autoFilter: "A1:F1"
      });
      worksheet.columns = [
        { header: "Fecha y hora", key: "fecha", width: 22 },
        { header: "Grupo", key: "grupo", width: 24 },
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Concepto", key: "concepto", width: 28 },
        { header: "Descripción", key: "descripcion", width: 44 },
        { header: "Monto", key: "monto", width: 18 }
      ];
      movimientosFiltrados.forEach((movimiento) => worksheet.addRow({
        fecha: movimiento.created_at ? new Date(movimiento.created_at) : null,
        grupo: movimiento.grupo,
        tipo: movimiento.tipo,
        concepto: movimiento.concepto || "",
        descripcion: movimiento.descripcion || "",
        monto: Number(movimiento.monto || 0)
      }));
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      worksheet.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";
      worksheet.getColumn(6).numFmt = '"$"#,##0.00';
      worksheet.eachRow((row) => row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
      }));
      const buffer = await workbook.xlsx.writeBuffer();
      const fileUrl = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }));
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(fileUrl);
    } catch (exportError) {
      logOperationalError("Error exportando reporte financiero:", exportError);
      setError("No se pudo generar el archivo Excel.");
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 md:p-8">
        <div>
          <SectionPageTitle
            icon={FileBarChart2}
            eyebrow="Movimientos de todos los grupos"
            title="Reportes financieros"
            description="Consolida los movimientos registrados en todos los grupos."
            plain
          />
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={descargarReporte} disabled={loading || movimientosFiltrados.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={17} /> Exportar Excel
          </button>
          <button type="button" onClick={() => window.print()} disabled={loading || movimientosFiltrados.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
            <Printer size={17} /> Guardar PDF
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-2 print:hidden">
        <select value={grupoFiltro} onChange={(event) => setGrupoFiltro(event.target.value)} aria-label="Filtrar reporte por grupo" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
          <option value="todos">Todos los grupos</option>
          {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>)}
        </select>
        <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} aria-label="Filtrar reporte por tipo de movimiento" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
          <option value="todos">Ingresos y egresos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        <label className="text-sm font-medium text-slate-700">
          Desde
          <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hasta
          <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>

      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del reporte">
        <Metric icon={<TrendingUp size={19} />} label="Ingresos" value={currency.format(resumen.ingresos)} />
        <Metric icon={<TrendingDown size={19} />} label="Egresos" value={currency.format(resumen.egresos)} />
        <Metric icon={<PiggyBank size={19} />} label="Disponibilidad" value={currency.format(disponibilidad)} />
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