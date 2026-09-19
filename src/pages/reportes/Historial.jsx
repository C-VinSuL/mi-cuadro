import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  History as HistoryIcon,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";

import {
  useAuth
} from "../../context/AuthContext";

import {
  obtenerMovimientosFondo,
  obtenerSaldoFondo
} from "../../services/fondoService";

const Historial = () => {
  const {
    grupo
  } = useAuth();

  const [movimientos, setMovimientos] =
    useState([]);

  const [saldo, setSaldo] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // ========================================
  // CARGAR DATOS
  // ========================================

  useEffect(() => {
    const cargarHistorial =
      async () => {
        if (!grupo?.id) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const [
            movimientosData,
            saldoData
          ] = await Promise.all([
            obtenerMovimientosFondo(
              grupo.id
            ),
            obtenerSaldoFondo(
              grupo.id
            )
          ]);

          setMovimientos(
            movimientosData
          );

          setSaldo(
            Number(
              saldoData || 0
            )
          );

        } catch (error) {
          console.error(
            "Error cargando historial:",
            error
          );

          setError(
            "No se pudo cargar el historial financiero."
          );

        } finally {
          setLoading(false);
        }
      };

    cargarHistorial();

  }, [
    grupo?.id
  ]);

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

  if (error) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-red-200
          bg-red-50
          p-5
          text-red-700
        "
      >
        {error}
      </div>
    );
  }

  // ========================================
  // UI
  // ========================================

  return (
    <div className="space-y-8">

      {/* HEADER */}

      <div>

        <p
          className="
            text-sm
            font-semibold
            text-emerald-700
          "
        >
          Caja Comunal
        </p>

        <h1
          className="
            mt-1
            text-3xl
            font-bold
            text-slate-900
            md:text-4xl
          "
        >
          Historial financiero
        </h1>

        <p
          className="
            mt-2
            text-slate-500
          "
        >
          Consulta los movimientos del fondo
          comunitario de {grupo.nombre}.
        </p>

      </div>


      {/* RESUMEN */}

      <section
        className="
          grid
          grid-cols-1
          gap-5
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >

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

      </section>


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
                Registro cronológico de
                ingresos y egresos.
              </p>

            </div>

          </div>

        </div>


        {movimientos.length === 0 ? (

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
              Aún no existen movimientos
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

                </tr>

              </thead>


              <tbody>

                {movimientos.map(
                  (movimiento) => {

                    const esIngreso =
                      movimiento.tipo ===
                      "ingreso";

                    return (

                      <tr
                        key={
                          movimiento.id
                        }
                        className="
                          border-t
                          border-slate-100
                          hover:bg-slate-50
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

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
};

export default Historial;