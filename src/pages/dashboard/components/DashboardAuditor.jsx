import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowRight,
  BadgeAlert,
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileSearch,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  listarAuditoria,
  listarHallazgosAuditoria,
  listarRevisionesAuditoria,
  obtenerResumenAuditoriaGrupos
} from "../../../services/adminService";
import { logOperationalError } from "../../../utils/logOperationalError";

const formatEventName = (eventName) => String(eventName || "")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toLocaleUpperCase("es-EC"));

const getLastWeekStart = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const formatDate = (value) => {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
};

const MetricCard = ({ icon: Icon, label, value, detail, tone, index, reduceMotion }) => (
  <motion.article
    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : index * 0.06 }}
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {value}
        </p>
      </div>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={21} />
      </span>
    </div>
    <p className="mt-3 min-h-5 text-xs leading-5 text-slate-500">{detail}</p>
  </motion.article>
);

const ProgressRow = ({ label, count, total, color, reduceMotion }) => {
  const percentage = total > 0 ? Math.min((count / total) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums text-slate-500">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

const DashboardAuditor = () => {
  const { profile } = useAuth();
  const reduceMotion = useReducedMotion();
  const requestId = useRef(0);
  const [events, setEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [findings, setFindings] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadDashboard = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);

    const results = await Promise.allSettled([
      listarAuditoria(null, getLastWeekStart(), new Date().toISOString()),
      obtenerResumenAuditoriaGrupos(),
      listarRevisionesAuditoria(),
      listarHallazgosAuditoria()
    ]);

    if (requestId.current !== currentRequest) return;

    const keys = ["events", "groups", "reviews", "findings"];
    const setters = [setEvents, setGroups, setReviews, setFindings];
    const nextErrors = {};

    results.forEach((result, index) => {
      const key = keys[index];
      if (result.status === "fulfilled") {
        setters[index](result.value || []);
      } else {
        logOperationalError(`Error cargando ${key} en el inicio de auditoría:`, result.reason);
        nextErrors[key] = "No se pudo cargar esta información.";
      }
    });

    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadDashboard, 0);
    return () => {
      window.clearTimeout(timeoutId);
      requestId.current += 1;
    };
  }, [loadDashboard]);

  const openFindings = useMemo(
    () => findings.filter((finding) => finding.estado !== "cerrado"),
    [findings]
  );
  const reviewsByStatus = useMemo(() => ({
    pendiente: reviews.filter((review) => review.estado === "pendiente").length,
    en_revision: reviews.filter((review) => review.estado === "en_revision").length,
    completada: reviews.filter((review) => review.estado === "completada").length
  }), [reviews]);
  const groupsWithReview = useMemo(
    () => groups.filter((group) => group.ultima_revision).length,
    [groups]
  );
  const groupsNeedingReview = groups.length - groupsWithReview;
  const pendingReceipts = useMemo(
    () => groups.reduce((total, group) => total + Number(group.comprobantes_pendientes || 0), 0),
    [groups]
  );
  const highPriorityFindings = useMemo(
    () => openFindings.filter((finding) => ["alta", "critica"].includes(finding.severidad)).length,
    [openFindings]
  );
  const coverage = groups.length > 0 ? Math.round((groupsWithReview / groups.length) * 100) : 0;
  const visibleEvents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-EC");
    const matches = events.filter((event) => {
      if (!query) return true;
      return [
        formatEventName(event.evento),
        event.actor,
        event.objetivo,
        event.grupo_nombre
      ].some((value) => String(value || "").toLocaleLowerCase("es-EC").includes(query));
    });
    return matches.slice(0, 7);
  }, [events, search]);

  const displayValue = (key, value) => (errors[key] ? "—" : loading && value === 0 ? "…" : value);
  const firstName = profile?.nombre?.trim().split(/\s+/)[0];
  const reviewCount = reviews.length;
  const attentionCount = pendingReceipts + openFindings.length + groupsNeedingReview;

  const metrics = [
    {
      icon: UsersRound,
      label: "Grupos monitoreados",
      value: displayValue("groups", groups.length),
      detail: errors.groups ? errors.groups : "Consulta global de grupos",
      tone: "bg-emerald-50 text-emerald-800"
    },
    {
      icon: CalendarCheck2,
      label: "Revisiones en curso",
      value: displayValue("reviews", reviewsByStatus.en_revision),
      detail: errors.reviews
        ? errors.reviews
        : `${reviewsByStatus.pendiente} pendientes · ${reviewsByStatus.completada} completadas`,
      tone: "bg-sky-50 text-sky-800"
    },
    {
      icon: BadgeAlert,
      label: "Hallazgos abiertos",
      value: displayValue("findings", openFindings.length),
      detail: errors.findings
        ? errors.findings
        : `${highPriorityFindings} de prioridad alta o crítica`,
      tone: "bg-amber-50 text-amber-800"
    },
    {
      icon: Activity,
      label: "Eventos recientes",
      value: displayValue("events", events.length),
      detail: errors.events ? errors.events : "Registrados en los últimos 7 días",
      tone: "bg-violet-50 text-violet-800"
    }
  ];

  return (
    <div className="space-y-6 pb-6">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm sm:p-7"
      >
        <div className="pointer-events-none absolute -right-12 -top-20 size-56 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              <ShieldCheck size={14} />
              Centro de control · Auditoría
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {firstName ? `Hola, ${firstName}` : "Inicio"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              Supervisa la actividad de todos los grupos, prioriza revisiones y da seguimiento a los hallazgos desde un solo lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/revision-auditoria"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <ClipboardCheck size={17} />
              Ir a revisiones
              <ArrowRight size={15} />
            </Link>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>
        {errors.groups || errors.reviews || errors.findings || errors.events ? (
          <p role="status" className="relative mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            Algunas cifras no están disponibles. Si es la primera vez que se despliega este panel, verifica que la migración de auditoría esté aplicada en Supabase.
          </p>
        ) : null}
      </motion.header>

      <section aria-label="Indicadores de auditoría" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} {...metric} index={index} reduceMotion={reduceMotion} />
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <Clock3 size={18} className="text-emerald-800" />
                Actividad reciente
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {errors.events ? errors.events : `${events.length} eventos · últimos 7 días`}
              </p>
            </div>
            <label className="relative block w-full sm:max-w-60">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <span className="sr-only">Buscar en la actividad reciente</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar actividad"
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {errors.events ? (
            <div role="alert" className="px-5 py-8 text-sm text-amber-800">{errors.events} Puedes revisar el registro completo más tarde.</div>
          ) : loading && events.length === 0 ? (
            <p role="status" className="px-5 py-8 text-sm text-slate-500">Cargando actividad reciente...</p>
          ) : visibleEvents.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              {search ? "No hay eventos que coincidan con la búsqueda." : "No hay eventos registrados en los últimos 7 días."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleEvents.map((event, index) => (
                <motion.article
                  key={event.id || `${event.evento}-${event.ocurrido_en}-${index}`}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : index * 0.035 }}
                  className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                      <FileClock size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{formatEventName(event.evento)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {event.actor || "Sistema"}
                        {event.objetivo ? ` · ${event.objetivo}` : ""}
                        {event.grupo_nombre ? ` · ${event.grupo_nombre}` : ""}
                      </p>
                    </div>
                  </div>
                  <time className="pl-11 text-xs text-slate-500 sm:pl-0" dateTime={event.ocurrido_en}>
                    {formatDate(event.ocurrido_en)}
                  </time>
                </motion.article>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
            <span className="text-xs text-slate-500">
              {search ? `Coincidencias visibles: ${visibleEvents.length}` : "Vista resumida"}
            </span>
            <Link to="/auditoria" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              Abrir registro completo <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Cobertura de revisión</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Grupos con al menos una revisión completada</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-900">
                {errors.groups ? "—" : `${coverage}%`}
              </span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${errors.groups ? 0 : coverage}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-teal-500"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {errors.groups ? errors.groups : `${groupsWithReview} de ${groups.length} grupos`}
            </p>

            <div className="mt-5 space-y-3">
              <ProgressRow label="Pendientes" count={reviewsByStatus.pendiente} total={reviewCount} color="bg-amber-400" reduceMotion={reduceMotion} />
              <ProgressRow label="En revisión" count={reviewsByStatus.en_revision} total={reviewCount} color="bg-sky-500" reduceMotion={reduceMotion} />
              <ProgressRow label="Completadas" count={reviewsByStatus.completada} total={reviewCount} color="bg-emerald-600" reduceMotion={reduceMotion} />
              {errors.reviews ? <p className="text-xs text-amber-800">{errors.reviews}</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <CircleAlert size={18} className="text-amber-600" />
                Puntos de atención
              </h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${attentionCount ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                {errors.groups || errors.findings ? "—" : attentionCount}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <ReceiptText size={16} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{errors.groups ? "—" : pendingReceipts}</span> comprobantes pendientes de revisión
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeAlert size={16} className="mt-0.5 shrink-0 text-rose-700" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{errors.findings ? "—" : openFindings.length}</span> hallazgos abiertos
                </p>
              </div>
              <div className="flex items-start gap-3">
                <FileSearch size={16} className="mt-0.5 shrink-0 text-sky-700" />
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{errors.groups ? "—" : groupsNeedingReview}</span> grupos sin revisión completada
                </p>
              </div>
              {errors.groups || errors.findings ? (
                <p className="text-xs text-amber-800">{errors.groups || errors.findings}</p>
              ) : null}
            </div>
            <Link
              to="/revision-auditoria"
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              Revisar prioridades <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Herramientas de auditoría</h2>
            <p className="mt-1 text-sm text-slate-600">Accesos rápidos de consulta y seguimiento, sin acciones operativas.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 size={14} /> Acceso de solo lectura
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { to: "/revision-auditoria", icon: ClipboardCheck, title: "Revisiones y hallazgos", description: "Planifica revisiones y da seguimiento a observaciones." },
            { to: "/auditoria", icon: FileClock, title: "Registro de actividad", description: "Consulta eventos, filtra y exporta el historial." },
            { to: "/aportes", icon: CircleAlert, title: "Aportes", description: "Revisa estados, períodos y comprobantes." },
            { to: "/egresos", icon: ReceiptText, title: "Egresos", description: "Consulta gastos y movimientos reportados." }
          ].map(({ to, icon: Icon, title, description }, index) => (
            <motion.div
              key={to}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, delay: reduceMotion ? 0 : index * 0.05 }}
            >
              <Link
                to={to}
                className="group flex h-full min-h-32 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                    {title}
                    <ArrowRight size={14} className="text-emerald-800 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardAuditor;
