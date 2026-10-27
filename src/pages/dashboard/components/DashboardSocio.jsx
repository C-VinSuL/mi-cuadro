import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import {
  Wallet,
  CircleDollarSign,
  Armchair,
  CalendarDays,
  Trophy,
  Bell,
  Sparkles,
  Coins,
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

import SectionPageTitle from "../../../components/ui/SectionPageTitle";
import StatCard from "../../../components/ui/StatCard";
import BentoCard from "../../../components/ui/BentoCard";
import WeekStrip from "../../../components/ui/WeekStrip";
import ProgressBar from "../../../components/ui/ProgressBar";
import PillButton from "../../../components/ui/PillButton";
import MiniBars from "../../../components/ui/MiniBars";
import StaggerList from "../../../components/motion/StaggerList";

import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotifications } from "../../../hooks/useNotifications";
import { supabase } from "../../../services/supabase";
import { etiquetaPeriodo } from "../../../services/grupoService";
import { obtenerResumenBilletera } from "../../../services/walletService";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const WalletBalanceCard = ({ userId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;

    let active = true;
    const refreshBalance = async () => {
      try {
        const walletSummary = await obtenerResumenBilletera();
        if (active) {
          setSummary(walletSummary);
          setError(false);
        }
      } catch (loadError) {
        console.error("Error cargando saldo de billetera en Inicio:", loadError);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshBalance();
    };

    refreshBalance();
    const intervalId = window.setInterval(refreshBalance, 30000);
    window.addEventListener("focus", refreshBalance);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshBalance);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId]);

  return (
    <section className="card fade-in-up flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <CircleDollarSign size={24} />
        </span>
        <div>
          <p className="text-sm font-medium text-slate-600">Saldo confirmado en mi billetera</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading && !summary
              ? "Cargando..."
              : error && !summary
                ? "Saldo no disponible"
                : currency.format(Number(summary?.saldo || 0))}
          </p>
          {summary && (
            <p className="mt-1 text-xs text-slate-500">
              {summary.garantia_cumplida
                ? "Saldo confirmado; una parte puede estar reservada como garantía."
                : "Saldo confirmado disponible en tu billetera."}
            </p>
          )}
          {error && summary && (
            <p className="mt-1 text-xs text-amber-700">No se pudo actualizar el saldo. Se muestra el último valor cargado.</p>
          )}
        </div>
      </div>
      <Link
        to="/billetera"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
      >
        Ver billetera <ArrowUpRight size={16} />
      </Link>
    </section>
  );
};

const DashboardSocio = () => {
  const { user, grupo, participant } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const { scrollY } = useScroll();
  const headerScale = useTransform(scrollY, [0, 180], [1, 0.98]);
  const headerOpacity = useTransform(scrollY, [0, 180], [1, 0.92]);
  const reduceMotion = useReducedMotion();

  const [aporteActual, setAporteActual] = useState(null);
  const [entrega, setEntrega] = useState(null);
  const [beneficiarioActual, setBeneficiarioActual] = useState(null);
  const [walletSummary, setWalletSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("todas");

  useEffect(() => {
    let active = true;

    const loadWalletSummary = async () => {
      if (!user?.id) {
        setWalletSummary(null);
        return;
      }

      try {
        const summary = await obtenerResumenBilletera();
        if (active) setWalletSummary(summary);
      } catch (walletError) {
        console.error("Error cargando saldo del socio en Inicio:", walletError);
        if (active) setWalletSummary(null);
      }
    };

    loadWalletSummary();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const cargarDatos = async () => {
      if (!grupo?.id || !participant?.id) {
        setAporteActual(null);
        setEntrega(null);
        setBeneficiarioActual(null);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setAporteActual(null);
        setEntrega(null);
        setBeneficiarioActual(null);
        setLoading(true);
        setError("");

        const [aporteResponse, entregaResponse, beneficiarioResponse] = await Promise.all([
          supabase
            .from("aportes")
            .select(`
              id,
              semana,
              monto,
              comision_app,
              estado,
              fecha_pago
            `)
            .eq("participante_id", participant.id)
            .eq("grupo_id", grupo.id)
            .eq("semana", grupo.semana_actual)
            .maybeSingle(),

          supabase
            .from("entregas")
            .select(`
              id,
              semana,
              monto,
              fecha_entrega
            `)
            .eq("participante_id", participant.id)
            .eq("grupo_id", grupo.id)
            .maybeSingle(),

          grupo.estado === "activo"
            ? supabase
                .from("participantes")
                .select(`
                  id,
                  nombre,
                  posicion
                `)
                .eq("grupo_id", grupo.id)
                .eq("posicion", grupo.semana_actual)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (aporteResponse.error) throw aporteResponse.error;
        if (entregaResponse.error) throw entregaResponse.error;
        if (beneficiarioResponse.error) throw beneficiarioResponse.error;

        if (!active) return;

        setAporteActual(aporteResponse.data);
        setEntrega(entregaResponse.data);
        setBeneficiarioActual(beneficiarioResponse.data);
      } catch (loadingError) {
        if (!active) return;
        console.error("Error dashboard socio:", loadingError);
        setError("No se pudo cargar tu información.");
      } finally {
        if (active) setLoading(false);
      }
    };

    cargarDatos();

    return () => {
      active = false;
    };
  }, [grupo?.id, grupo?.estado, grupo?.semana_actual, participant?.id]);

  if (!grupo) {
    return (
      <div className="space-y-5">
        <SectionPageTitle
          icon={LayoutDashboard}
          eyebrow="Resumen personal"
          title="Inicio"
          description="Tu espacio para consultar la actividad y el estado de tus grupos."
        />
        <WalletBalanceCard userId={user?.id} />
        <section className="dashboard-card fade-in-up rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">No perteneces a ningún cuadro</h2>
          <p className="mt-2 text-slate-500">
            Cuando seas agregado a un grupo, podrás consultar aquí tu información.
          </p>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
        Cargando tu información...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error}
      </div>
    );
  }

  const semanaActual = Number(grupo.semana_actual || 0);
  const grupoActivo = grupo.estado === "activo";
  const sorteoRealizado = grupo.estado !== "borrador" && Boolean(participant?.posicion);
  const capacidad = Number(grupo.numero_integrantes || 0);
  const aporteSemanal = Number(grupo.aporte_semanal || 0);
  const comision = Number(aporteActual?.comision_app ?? 0);
  const totalPagar = aporteSemanal + comision;
  const pagado = grupoActivo && aporteActual?.estado === "pagado";
  const totalAportado = aporteSemanal * Math.max(semanaActual, 0);
  const saldoDisponible = Number(walletSummary?.saldo || 0);
  const periodoActual = etiquetaPeriodo(grupo?.aporte_periodicidad);
  const weeklyProgress = grupoActivo ? Math.min((semanaActual / Math.max(capacidad, 1)) * 100, 100) : 0;
  const activeDay = Math.min(Math.max(semanaActual || 1, 1), 7);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const labels = ["L", "M", "X", "J", "V", "S", "D"];
    const value = index + 1;
    return {
      label: labels[index],
      value: String(value),
      date: String(value),
      ariaLabel: `${labels[index]} ${value}`,
    };
  });

  const tabs = [
    { id: "todas", label: "Todas" },
    { id: "sin_leer", label: "Sin leer" },
    { id: "importantes", label: "Importantes" },
  ];

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "sin_leer") return !notification.read;
    if (activeTab === "importantes") return notification.type === "warning" || notification.type === "error";
    return true;
  });

  const chartBars = [32, 52, 44, 76, 60, 88, 66];

  return (
    <StaggerList className="space-y-8">
      <motion.section
        style={{ scale: reduceMotion ? 1 : headerScale, opacity: reduceMotion ? 1 : headerOpacity }}
        className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-[#064E3B] via-[#0B6651] to-[#16835D] p-5 text-white shadow-[0_18px_45px_rgba(6,78,59,0.18)] md:p-8"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <Sparkles className="h-7 w-7 text-emerald-100" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/80">Resumen personal</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">{grupo.nombre}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 self-start xl:self-center">
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3 rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white">
                {user?.email?.charAt(0)?.toUpperCase() ?? "C"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/90">{user?.email ?? "Socio"}</p>
                <p className="text-xs text-emerald-100/80">{periodoActual}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-emerald-100/85">Aporte del periodo</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
              {currency.format(aporteSemanal)}
            </p>
          </div>

          <PillButton to="/aportes" variant="light" className="shadow-lg shadow-emerald-950/10">
            Registrar aporte
            <ArrowRight size={17} />
          </PillButton>
        </div>
      </motion.section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Aporte del periodo"
          value={currency.format(aporteSemanal)}
          variation={pagado ? "Pagado" : "Pendiente"}
          icon={Coins}
          className="bg-white/90"
        />
        <StatCard
          title="Total aportado"
          value={currency.format(totalAportado)}
          variation={`${semanaActual || 0} semanas`}
          icon={TrendingUp}
          className="bg-white/90"
        />
        <StatCard
          title="Saldo"
          value={currency.format(saldoDisponible)}
          variation={walletSummary?.garantia_cumplida ? "Con garantía" : "Disponible"}
          icon={Wallet}
          className="bg-white/90"
        />
        <StatCard
          title="Tu turno"
          value={sorteoRealizado ? `#${participant.posicion}` : "Pendiente"}
          variation={periodoActual}
          icon={CalendarDays}
          className="bg-white/90"
        />
      </div>

      <BentoCard className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#064E3B]">Avance del grupo</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {grupoActivo ? `${semanaActual} de ${capacidad}` : "Grupo aún sin iniciar"}
            </h2>
          </div>

          <div className="rounded-full bg-[#E8F2ED] px-3 py-1.5 text-xs font-semibold text-[#0B6651]">
            {grupoActivo ? `${Math.round(weeklyProgress)}%` : "Pendiente"}
          </div>
        </div>

        <div className="mt-5">
          <WeekStrip
            days={weekDays}
            value={String(activeDay)}
            onChange={() => {}}
            label="Semana del grupo"
            className="rounded-2xl bg-[#F4F7F5] p-2"
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Progreso del grupo</span>
            <span>{grupoActivo ? `${Math.round(weeklyProgress)}%` : "0%"}</span>
          </div>
          <ProgressBar value={weeklyProgress} max={100} label="Progreso del grupo" className="h-2.5" barClassName="bg-[#16835D]" trackClassName="bg-slate-200" />
        </div>
      </BentoCard>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <BentoCard className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#064E3B]">Aporte del periodo actual</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                {grupoActivo ? currency.format(totalPagar) : "No disponible"}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F2ED] text-[#0B6651]">
              <Trophy size={22} />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Pago pendiente</span>
              <span className="font-semibold text-slate-900">{currency.format(totalPagar)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Estado</span>
              <span className={`font-semibold ${pagado ? "text-emerald-700" : "text-amber-700"}`}>
                {pagado ? "Pagado" : "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Entrega</span>
              <span className="font-semibold text-slate-900">
                {entrega?.monto ? currency.format(Number(entrega.monto)) : "Sin registro"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Turno</span>
              <span className="font-semibold text-slate-900">
                {sorteoRealizado ? `#${beneficiarioActual?.posicion ?? participant.posicion}` : "Sin asignar"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <MiniBars values={chartBars} className="h-16 w-40" barClassName="bg-[#16835D]" />
            <div className="text-sm text-slate-500">
              <p className="font-medium text-slate-700">Últimas semanas</p>
              <p className="mt-1">Evolución constante</p>
            </div>
          </div>
        </BentoCard>

        <BentoCard className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F2ED] text-[#0B6651]">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
                <p className="text-xs text-slate-500">{unreadCount} sin leer</p>
              </div>
            </div>
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B6651]">
              Ver todo <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mt-4 flex gap-2 rounded-full bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-9 flex-1 rounded-full px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16835D] focus-visible:ring-offset-2 ${
                  activeTab === tab.id ? "bg-[#064E3B] text-white" : "text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No tienes notificaciones en esta vista.
              </div>
            ) : (
              filteredNotifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                    </div>
                    {!notification.read && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#16835D]" aria-label="Notificación sin leer" />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    {new Date(notification.createdAt).toLocaleDateString("es-EC", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </BentoCard>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/aportes" className="group block">
          <BentoCard className="h-full p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F2ED] text-[#0B6651]">
              <Wallet size={22} />
            </div>
            <p className="mt-4 text-xl font-bold text-slate-900">Mis aportes</p>
            <p className="mt-2 text-sm text-slate-500">Consulta y registra tus pagos del grupo.</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0B6651]">
              Ver detalle <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
            </div>
          </BentoCard>
        </Link>

        <Link to="/cuadro" className="group block">
          <BentoCard className="h-full p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F2ED] text-[#0B6651]">
              <Armchair size={22} />
            </div>
            <p className="mt-4 text-xl font-bold text-slate-900">Cuadro rotativo</p>
            <p className="mt-2 text-sm text-slate-500">Revisa tu posición y el avance del sorteo.</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0B6651]">
              Abrir cuadro <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
            </div>
          </BentoCard>
        </Link>

        <div className="group block opacity-80" aria-disabled="true">
          <BentoCard className="h-full p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <Coins size={22} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-xl font-bold text-slate-900">Préstamos</p>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                Próximamente
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">La funcionalidad estará disponible más adelante.</p>
          </BentoCard>
        </div>
      </div>
    </StaggerList>
  );
};

export default DashboardSocio;
