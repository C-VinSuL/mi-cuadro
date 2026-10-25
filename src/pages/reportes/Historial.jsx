import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  History as HistoryIcon,
  PiggyBank,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from "lucide-react";

import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { createUniqueId } from "../../utils/uniqueId";
import {
  useAuth
} from "../../context/AuthContext";
import { supabase } from "../../services/supabase";

import {
  obtenerMovimientosFondo,
  obtenerSaldoFondo
} from "../../services/fondoService";
import ReportesAdmin from "./ReportesAdmin";
import { logOperationalError } from "../../utils/logOperationalError";

const HistorialSocio = () => {
  const {
    grupo,
    profile
  } = useAuth();
  const esTesorero = profile?.rol?.toLowerCase() === "tesorero";

  const [movimientos, setMovimientos] =
    useState([]);

  const [conciliaciones, setConciliaciones] = useState({});
  const [saldo, setSaldo] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [conciliando, setConciliando] = useState(false);
  const grupoId = grupo?.id;

  // ========================================
  // CARGAR DATOS
  // ========================================

  const cargarHistorial = useCallback(async ({ mostrarCarga = true } = {}) => {
    if (!grupoId) {
      setMovimientos([]);
      setConciliaciones({});
      setLoading(false);
      return;
    }

    if (mostrarCarga) setLoading(true);
    setError("");
    try {
      const [movimientosData, saldoData, conciliacionesResponse] = await Promise.all([
        obtenerMovimientosFondo(grupoId),
        obtenerSaldoFondo(grupoId),
        esTesorero
          ? supabase
            .from("conciliaciones_fondo")
            .select("movimiento_id, conciliado_por, conciliado_en, observacion")
            .eq("grupo_id", grupoId)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (conciliacionesResponse.error) throw conciliacionesResponse.error;

      setMovimientos(movimientosData);
      setSaldo(Number(saldoData || 0));
      setConciliaciones(Object.fromEntries(
        (conciliacionesResponse.data || []).map((item) => [item.movimiento_id, item])
      ));
    } catch (loadError) {
      logOperationalError("Error cargando historial financiero:", loadError);
      setError("No se pudo cargar el historial financiero.");
    } finally {
      setLoading(false);
    }
  }, [esTesorero, grupoId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => cargarHistorial(), 0);
    if (!grupoId || !esTesorero) {
      return () => window.clearTimeout(timeoutId);
    }

    const channel = supabase
      .channel(`historial-tesoreria-${grupoId}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "movimientos_fondo",
        filter: `grupo_id=eq.${grupoId}`
      }, () => {
        cargarHistorial({ mostrarCarga: false });
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "conciliaciones_fondo",
        filter: `grupo_id=eq.${grupoId}`
      }, () => {
        cargarHistorial({ mostrarCarga: false });
      })
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [cargarHistorial, esTesorero, grupoId]);

  // ========================================
  // CÁLCULOS
  // ========================================

  const resumen =
    useMemo(() => {
      const ingresos =
        movimientos
          .filter(
            (movimiento) =>
              movimiento.tipo ===
              "ingreso"
          )
          .reduce(
            (
              total,
              movimiento
            ) =>
              total +
              Number(
                movimiento.monto || 0
              ),
            0
          );

      const egresos =
        movimientos
          .filter(
            (movimiento) =>
              movimiento.tipo ===
              "egreso"
          )
          .reduce(
            (
              total,
              movimiento
            ) =>
              total +
              Number(
                movimiento.monto || 0
              ),
            0
          );

      return {
        ingresos,
        egresos,
        totalMovimientos:
          movimientos.length
      };
    }, [
      movimientos
    ]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((movimiento) => {
    if (tipoFiltro !== "todos" && movimiento.tipo !== tipoFiltro) return false;
    const fecha = new Date(movimiento.created_at);
    if (desde && fecha < new Date(`${desde}T00:00:00`)) return false;
    if (hasta && fecha >= new Date(`${hasta}T00:00:00`).getTime() + 86400000) return false;
    return true;
  }), [desde, hasta, movimientos, tipoFiltro]);
  const movimientosConciliados = movimientos.filter((movimiento) => conciliaciones[String(movimiento.id)]).length;
  const movimientosPendientesConciliacion = movimientos.length - movimientosConciliados;
  const diferenciaSaldo = saldo - (resumen.ingresos - resumen.egresos);
  const saldoConciliado = Math.abs(diferenciaSaldo) < 0.01;

  const conciliarMovimiento = async () => {
    if (!movimientoSeleccionado || conciliando) return;
    setConciliando(true);
    setError("");
    try {
      const { error: reconcileError } = await supabase.rpc("conciliar_movimiento_fondo", {
        p_movimiento_id: String(movimientoSeleccionado.id),
        p_observacion: observacion.trim() || null
      });
      if (reconcileError) throw reconcileError;
      setMovimientoSeleccionado(null);
      setObservacion("");
      await cargarHistorial({ mostrarCarga: false });
    } catch (reconcileError) {
      logOperationalError("Error conciliando movimiento financiero:", reconcileError);
      setError("No se pudo registrar la conciliación. Inténtalo nuevamente.");
    } finally {
      setConciliando(false);
    }
  };

  const exportarExcel = async () => {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FlashMonkey";
      workbook.subject = "Reporte financiero";
      const worksheet = workbook.addWorksheet("Movimientos", {
        views: [{ state: "frozen", ySplit: 1 }],
        autoFilter: "A1:G1"
      });
      worksheet.columns = [
        { header: "Fecha y hora", key: "fecha", width: 22 },
        { header: "Grupo", key: "grupo", width: 24 },
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Concepto", key: "concepto", width: 26 },
        { header: "Descripción", key: "descripcion", width: 42 },
        { header: "Monto", key: "monto", width: 18 },
        { header: "Conciliación", key: "conciliacion", width: 18 }
      ];
      movimientosFiltrados.forEach((movimiento) => {
        worksheet.addRow({
          fecha: new Date(movimiento.created_at),
          grupo: grupo.nombre,
          tipo: movimiento.tipo,
          concepto: textoConcepto(movimiento.concepto),
          descripcion: movimiento.descripcion || "",
          monto: Number(movimiento.monto || 0),
          conciliacion: conciliaciones[String(movimiento.id)] ? "Conciliado" : "Pendiente"
        });
      });
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

  // ========================================
  // HELPERS
  // ========================================

  const textoConcepto =
    (concepto) => {
      switch (concepto) {
        case "comision_aporte":
          return "Comisión de aporte";

        case "desembolso_prestamo":
          return "Desembolso de préstamo";

        case "pago_cuota":
          return "Pago de cuota";

        default:
          return concepto ||
            "Movimiento";
      }
    };

  const formatearFecha =
    (fecha) => {
      if (!fecha) {
        return "-";
      }

      return new Date(
        fecha
      ).toLocaleString(
        "es-EC",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      );
    };

  // ========================================
  // SIN GRUPO
  // ========================================

  if (!grupo) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-6
        "
      >
        <h2
          className="
            text-xl
            font-bold
            text-slate-900
          "
        >
          No perteneces a ningún grupo
        </h2>

        <p
          className="
            mt-2
            text-slate-500
          "
        >
          Cuando formes parte de un cuadro
          podrás consultar aquí el historial
          financiero.
        </p>
      </div>
    );
  }

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-8
          text-slate-500
        "
      >
        Cargando historial financiero...
      </div>
    );
  }

  // ========================================
  // UI
  // ========================================

  return (
    <div className="space-y-8">

      {/* HEADER */}

      <SectionPageTitle
        icon={HistoryIcon}
        eyebrow="Movimientos del grupo"
        title="Historial financiero"
        description={`Consulta los movimientos del fondo comunitario de ${grupo.nombre}.`}
      />

      {error && (
        <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {/* RESUMEN */}

      <section className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${esTesorero ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>

        {/* SALDO */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-emerald-700
            "
          >
            <PiggyBank size={22} />
          </div>

          <p
            className="
              mt-5
              text-sm
              text-slate-500
            "
          >
            Saldo actual
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            ${saldo.toFixed(2)}
          </p>

        </div>


        {/* INGRESOS */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-emerald-700
            "
          >
            <TrendingUp size={22} />
          </div>

          <p
            className="
              mt-5
              text-sm
              text-slate-500
            "
          >
            Ingresos acumulados
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-emerald-700
            "
          >
            +${resumen.ingresos.toFixed(2)}
          </p>

        </div>


        {/* EGRESOS */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-red-50
              text-red-600
            "
          >
            <TrendingDown size={22} />
          </div>

          <p
            className="
              mt-5
              text-sm
              text-slate-500
            "
          >
            Egresos acumulados
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-red-600
            "
          >
            -${resumen.egresos.toFixed(2)}
          </p>

        </div>


        {/* MOVIMIENTOS */}

        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-blue-50
              text-blue-600
            "
          >
            <HistoryIcon size={22} />
          </div>

          <p
            className="
              mt-5
              text-sm
              text-slate-500
            "
          >
            Movimientos
          </p>

          <p
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
            "
          >
            {resumen.totalMovimientos}
          </p>

        </div>

        {esTesorero && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Check size={22} />
            </div>
            <p className="mt-5 text-sm text-slate-500">Conciliados / pendientes</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{movimientosConciliados} / {movimientosPendientesConciliacion}</p>
            <p className="mt-1 text-xs text-slate-400">Verificación manual registrada</p>
          </div>
        )}

      </section>

      {esTesorero && (
        <section className={`rounded-xl border px-4 py-3 text-sm ${
          saldoConciliado
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : "border-red-300 bg-red-50 text-red-950"
        }`} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {saldoConciliado ? "Saldo del fondo consistente" : "Diferencia detectada en el saldo"}
              </p>
              <p className="mt-1">
                El saldo actual se compara con ingresos menos egresos del libro contable.
                {!saldoConciliado && ` Diferencia: $${diferenciaSaldo.toFixed(2)}.`}
              </p>
            </div>
            <span className={`shrink-0 font-semibold ${movimientosPendientesConciliacion > 0 ? "text-amber-800" : ""}`}>
              {movimientosPendientesConciliacion} movimiento{movimientosPendientesConciliacion === 1 ? "" : "s"} sin conciliar
            </span>
          </div>
          {movimientosPendientesConciliacion > 0 && (
            <p className="mt-2 text-xs">
              Revisa los movimientos marcados como pendientes en el libro contable; conciliarlos deja constancia de su verificación, sin cambiar el monto.
            </p>
          )}
        </section>
      )}

      {esTesorero && (
        <section className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-slate-700">
              Tipo de movimiento
              <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="todos">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Desde
              <input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hasta
              <input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => cargarHistorial()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              <RefreshCw size={15} /> Actualizar
            </button>
            <button type="button" onClick={exportarExcel} disabled={movimientosFiltrados.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Download size={15} /> Exportar Excel
            </button>
            <button type="button" onClick={() => window.print()} disabled={movimientosFiltrados.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
              <Printer size={15} /> Guardar PDF
            </button>
          </div>
        </section>
      )}

      {/* LIBRO CONTABLE */}

      <section
        className="
          overflow-hidden
          rounded-3xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >

        <div
          className="
            border-b
            border-slate-200
            p-6
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <Wallet
              size={21}
              className="
                text-emerald-700
              "
            />

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                Movimientos del fondo
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-slate-500
                "
              >
                {esTesorero
                  ? `${movimientosFiltrados.length} de ${movimientos.length} movimientos · conciliación manual y trazable.`
                  : "Registro cronológico de ingresos y egresos."}
              </p>

            </div>

          </div>

        </div>


        {movimientosFiltrados.length === 0 ? (

          <div
            className="
              p-10
              text-center
            "
          >

            <HistoryIcon
              size={40}
              className="
                mx-auto
                text-slate-300
              "
            />

            <p
              className="
                mt-4
                font-semibold
                text-slate-700
              "
            >
              {movimientos.length === 0 ? "Aún no existen movimientos" : "No hay movimientos para estos filtros"}
            </p>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Las comisiones, desembolsos
              y pagos aparecerán aquí.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead
                className="
                  bg-slate-50
                "
              >

                <tr>

                  <th
                    className="
                      p-4
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                    "
                  >
                    Movimiento
                  </th>

                  <th
                    className="
                      p-4
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                    "
                  >
                    Descripción
                  </th>

                  <th
                    className="
                      p-4
                      text-left
                      text-sm
                      font-semibold
                      text-slate-600
                    "
                  >
                    Fecha
                  </th>

                  <th
                    className="
                      p-4
                      text-right
                      text-sm
                      font-semibold
                      text-slate-600
                    "
                  >
                    Monto
                  </th>
                  {esTesorero && (
                    <th className="p-4 text-left text-sm font-semibold text-slate-600 print:hidden">
                      Conciliación
                    </th>
                  )}

                </tr>

              </thead>


              <tbody>

                {movimientosFiltrados.map(
                  (movimiento) => {

                    const esIngreso =
                      movimiento.tipo ===
                      "ingreso";
                    const conciliacion = conciliaciones[String(movimiento.id)];

                    return (

                      <tr
                        key={
                          movimiento.id
                        }
                        className="
                          border-t
                          border-slate-100
                          hover:bg-slate-50
                          transition-colors duration-150 motion-reduce:transition-none
                        "
                      >

                        <td className="p-4">

                          <div
                            className="
                              flex
                              items-center
                              gap-3
                            "
                          >

                            <div
                              className={`
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-xl

                                ${
                                  esIngreso
                                    ? `
                                      bg-emerald-50
                                      text-emerald-700
                                    `
                                    : `
                                      bg-red-50
                                      text-red-600
                                    `
                                }
                              `}
                            >

                              {esIngreso
                                ? (
                                  <ArrowDownLeft
                                    size={19}
                                  />
                                )
                                : (
                                  <ArrowUpRight
                                    size={19}
                                  />
                                )
                              }

                            </div>

                            <div>

                              <p
                                className="
                                  font-semibold
                                  text-slate-900
                                "
                              >
                                {textoConcepto(
                                  movimiento.concepto
                                )}
                              </p>

                              <p
                                className="
                                  mt-1
                                  text-xs
                                  text-slate-500
                                "
                              >
                                {esIngreso
                                  ? "Ingreso"
                                  : "Egreso"
                                }
                              </p>

                            </div>

                          </div>

                        </td>


                        <td
                          className="
                            p-4
                            text-sm
                            text-slate-600
                          "
                        >
                          {movimiento.descripcion ||
                            "Sin descripción"}
                        </td>


                        <td
                          className="
                            p-4
                            text-sm
                            text-slate-500
                          "
                        >
                          {formatearFecha(
                            movimiento.created_at
                          )}
                        </td>


                        <td
                          className={`
                            p-4
                            text-right
                            font-bold

                            ${
                              esIngreso
                                ? "text-emerald-700"
                                : "text-red-600"
                            }
                          `}
                        >
                          {esIngreso
                            ? "+"
                            : "-"
                          }
                          $
                          {Number(
                            movimiento.monto
                          ).toFixed(2)}
                        </td>
                        {esTesorero && (
                          <td className="p-4 print:hidden">
                            {conciliacion ? (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  <Check size={13} /> Conciliado
                                </span>
                                {conciliacion.observacion && (
                                  <p className="mt-1 max-w-56 text-xs text-slate-500">{conciliacion.observacion}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setMovimientoSeleccionado(movimiento);
                                  setObservacion("");
                                }}
                                className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                              >
                                Marcar conciliado
                              </button>
                            )}
                          </td>
                        )}

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {movimientoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 print:hidden" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !conciliando) setMovimientoSeleccionado(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="conciliar-movimiento-titulo" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="conciliar-movimiento-titulo" className="font-bold text-slate-900">Confirmar conciliación</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {textoConcepto(movimientoSeleccionado.concepto)} · {formatearFecha(movimientoSeleccionado.created_at)} · ${Number(movimientoSeleccionado.monto).toFixed(2)}
                </p>
              </div>
              <button type="button" onClick={() => setMovimientoSeleccionado(null)} disabled={conciliando} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-6 text-slate-600">Al confirmar, el movimiento quedará marcado como conciliado. El importe y los datos contables originales no se modifican y esta acción queda en auditoría.</p>
              <label className="block text-sm font-medium text-slate-700">
                Observación (opcional)
                <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} maxLength={500} rows={3} placeholder="Ej.: verificado con el comprobante bancario del día..." className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                <span className="mt-1 block text-right text-xs text-slate-500">{observacion.length}/500</span>
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setMovimientoSeleccionado(null)} disabled={conciliando} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
              <button type="button" onClick={conciliarMovimiento} disabled={conciliando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <Check size={16} /> {conciliando ? "Guardando..." : "Confirmar"}
              </button>
            </footer>
          </section>
        </div>
      )}

    </div>
  );
};

const Historial = () => {
  const { profile } = useAuth();
  return profile?.rol?.toLowerCase() === "administrador"
    ? <ReportesAdmin />
    : <HistorialSocio />;
};

export default Historial;