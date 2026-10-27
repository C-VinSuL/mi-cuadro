import {
  useEffect,
  useState
} from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import {
  Wallet,
  PiggyBank,
  CheckCircle2,
  Clock3,
  Trophy,
  HandCoins,
  ArrowRight,
  CircleDollarSign,
  LayoutDashboard,
  Sparkles,
  Coins
} from "lucide-react";
import SectionPageTitle from "../../../components/ui/SectionPageTitle";
import StatCard from "../../../components/ui/StatCard";
import BentoCard from "../../../components/ui/BentoCard";
import ProgressBar from "../../../components/ui/ProgressBar";
import PillButton from "../../../components/ui/PillButton";

import {
  Link
} from "react-router-dom";

import {
  useAuth
} from "../../../context/AuthContext";

import {
  getDashboardAdminData
} from "../../../services/dashboardService";
import { etiquetaAporte, etiquetaPeriodo } from "../../../services/grupoService";
import TreasuryQueuePanel from "./TreasuryQueuePanel";
import TreasuryGroupSummary from "./TreasuryGroupSummary";
import StaggerList from "../../../components/motion/StaggerList";

const DashboardTesorero = () => {
  const {
    grupo,
    fondoComunitario
  } = useAuth();
  const periodoActual = etiquetaPeriodo(grupo?.aporte_periodicidad);
  const { scrollY } = useScroll();
  const headerScale = useTransform(scrollY, [0, 180], [1, 0.98]);
  const headerOpacity = useTransform(scrollY, [0, 180], [1, 0.92]);
  const reduceMotion = useReducedMotion();

  const [datos, setDatos] =
    useState({
      participantes: [],
      aportes: [],
      entregas: [],
      totalPagados: 0,
      pendientes: [],
      beneficiarioActual: null,
      pozo: 0
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");
  const [currentTime, setCurrentTime] = useState(null);

  // ========================================
  // CARGAR DATOS
  // ========================================

  useEffect(() => {
    const cargarDashboard =
      async () => {

        if (!grupo?.id) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const resultado =
            await getDashboardAdminData(
              grupo
            );

          setDatos(resultado);

        } catch (error) {
          console.error(
            "Error dashboard tesorero:",
            error
          );

          setError(
            "No se pudo cargar el panel de tesorería."
          );
        } finally {
          setLoading(false);
        }
      };

    cargarDashboard();

  }, [
    grupo
  ]);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const timeoutId = window.setTimeout(updateTime, 0);
    const intervalId = window.setInterval(updateTime, 60000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  // ========================================
  // SIN GRUPO
  // ========================================

  if (!grupo) {
    return (
      <div className="space-y-5">
        <SectionPageTitle
          icon={LayoutDashboard}
          eyebrow="Resumen de tesorería"
          title="Inicio"
          description="Tu espacio para consultar y gestionar la tesorería de los grupos asignados."
        />
        <section className="dashboard-card fade-in-up rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">
            No tienes un grupo asignado
          </h2>

          <p className="mt-2 text-slate-500">
            Cuando seas asignado a un grupo,
            podrás gestionar su tesorería aquí.
          </p>
        </section>
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
        Cargando tesorería...
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
  // CÁLCULOS
  // ========================================

  const capacidad =
    Number(
      grupo.numero_integrantes || 0
    );

  const semana =
    Number(
      grupo.semana_actual || 0
    );

  const aporteSemanal =
    Number(
      grupo.aporte_semanal || 0
    );

  const recaudado =
    datos.aportes
      .filter(
        (aporte) =>
          aporte.estado === "pagado"
      )
      .reduce(
        (
          total,
          aporte
        ) =>
          total +
          Number(
            aporte.monto || 0
          ),
        0
      );

  const porcentaje =
    datos.pozo > 0
      ? Math.min(
          (
            recaudado /
            datos.pozo
          ) * 100,
          100
        )
      : 0;

  const todosPagaron =
    capacidad > 0 &&
    datos.totalPagados === capacidad;
  const fechaVencimientoActual = (() => {
    if (!grupo.fecha_inicio || grupo.estado !== "activo" || semana < 1) return null;
    const deadline = new Date(grupo.fecha_inicio);
    if (grupo.aporte_periodicidad === "mensual") {
      const dayOfMonth = deadline.getUTCDate();
      const targetMonth = deadline.getUTCMonth() + semana;
      deadline.setUTCDate(1);
      deadline.setUTCMonth(targetMonth);
      const lastDayOfTargetMonth = new Date(Date.UTC(
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        0
      )).getUTCDate();
      deadline.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
    } else {
      deadline.setUTCDate(deadline.getUTCDate() + semana * (grupo.aporte_periodicidad === "quincenal" ? 14 : 7));
    }
    return deadline;
  })();
  const aportesEnRevision = new Set(datos.aportes
    .filter((aporte) => aporte.semana === semana && aporte.estado_revision === "pendiente")
    .map((aporte) => aporte.participante_id));
  const aportesSinPagoAprobado = datos.pendientes.filter((item) => !aportesEnRevision.has(item.id)).length;
  const aportesVencidos = fechaVencimientoActual && currentTime && currentTime.getTime() >= fechaVencimientoActual.getTime()
    ? aportesSinPagoAprobado
    : 0;

  // ========================================
  // UI
  // ========================================

  return (
    <StaggerList className="space-y-8">

      {/* ==================================
          CABECERA
      =================================== */}

      <motion.section
        style={{ scale: reduceMotion ? 1 : headerScale, opacity: reduceMotion ? 1 : headerOpacity }}
        className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-[#064E3B] via-[#0B6651] to-[#16835D] p-5 text-white shadow-[0_18px_45px_rgba(6,78,59,0.18)] sm:p-6 md:p-8"
      >
        <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:size-14">
              <Sparkles className="size-6 text-emerald-100 sm:size-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">Resumen de tesorería</p>
              <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">{grupo.nombre}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:text-base">
                Controla los aportes, movimientos y disponibilidad financiera de tu grupo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:shrink-0 xl:flex-col xl:items-stretch">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-xs text-emerald-100/80">{periodoActual} actual</p>
              <p className="mt-1 text-lg font-bold text-white sm:text-xl">{semana} de {capacidad}</p>
            </div>
            <PillButton to="/aportes" variant="light" className="w-full shadow-lg shadow-emerald-950/10 sm:w-auto">
              Revisar aportes
              <ArrowRight size={17} aria-hidden="true" />
            </PillButton>
          </div>
        </div>
      </motion.section>

      <TreasuryGroupSummary />
      <TreasuryQueuePanel />

      {aportesVencidos > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4" role="status">
          <div>
            <p className="font-semibold text-amber-950">{aportesVencidos} aporte{aportesVencidos === 1 ? "" : "s"} vencido{aportesVencidos === 1 ? "" : "s"} en {grupo.nombre}</p>
            <p className="mt-1 text-sm text-amber-900">El plazo del periodo actual venció el {fechaVencimientoActual.toLocaleDateString("es-EC")}.</p>
          </div>
          <Link to="/aportes" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
            Revisar aportes
          </Link>
        </section>
      )}


      {/* ==================================
          MÉTRICAS
      =================================== */}

      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Recaudado"
          value={`$${recaudado.toFixed(2)}`}
          variation={`Meta: $${Number(datos.pozo).toFixed(2)}`}
          icon={CircleDollarSign}
          className="min-w-0"
        />
        <StatCard
          title="Pagaron"
          value={`${datos.totalPagados} / ${capacidad}`}
          variation={`${datos.pendientes.length} pendientes`}
          icon={CheckCircle2}
          className="min-w-0"
        />
        <StatCard
          title="Fondo comunitario"
          value={`$${Number(fondoComunitario || 0).toFixed(2)}`}
          variation="Saldo registrado"
          icon={PiggyBank}
          className="min-w-0"
        />
        <StatCard
          title={etiquetaAporte(grupo.aporte_periodicidad)}
          value={`$${aporteSemanal.toFixed(2)}`}
          variation="Por integrante"
          icon={Coins}
          className="min-w-0"
        />
      </StaggerList>


      {/* ==================================
          RECAUDACIÓN
      =================================== */}

      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <BentoCard className="min-w-0 p-5 md:p-6">

          <div
            className="
              flex
              items-start
              justify-between
              gap-4
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-semibold
                  text-blue-700
                "
              >
                Recaudación por periodo
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                Estado de aportes
              </h2>

            </div>

            <span
              className={`
                rounded-full
                px-3
                py-1.5
                text-xs
                font-semibold

                ${
                  todosPagaron
                    ? `
                      bg-emerald-100
                      text-emerald-700
                    `
                    : `
                      bg-amber-100
                      text-amber-700
                    `
                }
              `}
            >
              {todosPagaron
                ? "Ronda completa"
                : "Recaudando"
              }
            </span>

          </div>


          <div className="mt-7">

            <div
              className="
                flex
                justify-between
                text-sm
              "
            >
              <span className="text-slate-500">
                ${recaudado.toFixed(2)} de{" "}
                ${Number(datos.pozo).toFixed(2)}
              </span>

              <strong>
                {Math.round(porcentaje)}%
              </strong>
            </div>

            <ProgressBar
              value={porcentaje}
              max={100}
              label="Porcentaje de recaudación del periodo"
              className="mt-3 h-3"
              trackClassName="bg-slate-100"
              barClassName="bg-[#16835D]"
            />

          </div>


          {!todosPagaron && (

            <div
              className="
                mt-7
                rounded-2xl
                border
                border-amber-200
                bg-amber-50
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  gap-2
                  font-semibold
                  text-amber-900
                "
              >
                <Clock3 size={18} />
                Pendientes de aporte
              </div>


              <div
                className="
                  mt-4
                  flex
                  flex-wrap
                  gap-2
                "
              >

                {datos.pendientes.map(
                  (participante) => (

                    <span
                      key={
                        participante.id
                      }
                      className="
                        rounded-full
                        bg-white
                        px-3
                        py-1.5
                        text-sm
                        text-amber-800
                        shadow-sm
                      "
                    >
                      #{participante.posicion}
                      {" "}
                      {participante.nombre}
                    </span>

                  )
                )}

              </div>

            </div>

          )}


          {todosPagaron && (

            <div
              className="
                mt-7
                rounded-2xl
                border
                border-emerald-200
                bg-emerald-50
                p-5
                text-emerald-800
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  font-semibold
                "
              >
                <CheckCircle2 size={18} />
                Recaudación completa
              </div>

              <p className="mt-2 text-sm">
                Todos los integrantes han
                realizado el aporte de esta ronda.
              </p>
            </div>

          )}

        </BentoCard>


        {/* BENEFICIARIO */}

        <BentoCard className="min-w-0 p-5 md:p-6">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-amber-50
              text-amber-600
            "
          >
            <Trophy size={23} />
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Entrega de esta ronda
          </p>

          <h2
            className="
              mt-1
              text-2xl
              font-bold
              text-slate-900
            "
          >
            {datos.beneficiarioActual
              ?.nombre ||
              "Sin asignar"
            }
          </h2>

          {datos.beneficiarioActual && (

            <p className="mt-1 text-sm text-slate-500">
              Puesto #
              {
                datos
                  .beneficiarioActual
                  .posicion
              }
            </p>

          )}


          <div
            className="
              mt-6
              rounded-2xl
              bg-slate-50
              p-4
            "
          >
            <p className="text-xs text-slate-500">
              Monto previsto
            </p>

            <p
              className="
                mt-1
                text-2xl
                font-bold
                text-emerald-700
              "
            >
              ${Number(datos.pozo).toFixed(2)}
            </p>
          </div>

        </BentoCard>

      </section>


      {/* ==================================
          ACCIONES
      =================================== */}

      <section>

        <p
          className="
            text-sm
            font-semibold
            text-blue-700
          "
        >
          Tesorería
        </p>

        <h2
          className="
            mt-1
            text-2xl
            font-bold
            text-slate-900
          "
        >
          Acciones rápidas
        </h2>


        <div
          className="
            mt-5
            grid
            grid-cols-1
            gap-4
            sm:grid-cols-2
            xl:grid-cols-3
          "
        >

          <Link
            to="/aportes"
            className="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition
              hover:-translate-y-1
              hover:shadow-md
            "
          >
            <Wallet className="text-blue-600" />

            <p className="mt-4 font-semibold text-slate-900">
              Revisar aportes
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Consulta pagos y pendientes
              de la ronda actual.
            </p>

            <ArrowRight
              size={18}
              className="
                mt-5
                text-slate-400
                transition
                group-hover:translate-x-1
              "
            />
          </Link>


          <Link
            to="/cuadro"
            className="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition
              hover:-translate-y-1
              hover:shadow-md
            "
          >
            <CheckCircle2 className="text-emerald-700" />

            <p className="mt-4 font-semibold text-slate-900">
              Gestión de ronda
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Verifica aportes y realiza
              el cierre de ronda.
            </p>

            <ArrowRight
              size={18}
              className="
                mt-5
                text-slate-400
                transition
                group-hover:translate-x-1
              "
            />
          </Link>


          <div
            aria-disabled="true"
            className="
              relative
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              opacity-80
            "
          >
            <HandCoins className="text-violet-600" />

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">Préstamos</p>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                Próximamente
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Esta función estará disponible más adelante.
            </p>
          </div>

        </div>

      </section>

    </StaggerList>
  );
};

export default DashboardTesorero;