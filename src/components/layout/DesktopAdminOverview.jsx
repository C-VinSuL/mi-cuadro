import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  FileCheck2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { listarDocumentosPendientes } from "../../services/adminService";
import { listarBandejaMoki } from "../../services/mokiService";
import { supabase } from "../../services/supabase";
import { listarSolicitudesBilleteraAdmin } from "../../services/walletService";
import { createUniqueId } from "../../utils/uniqueId";

const DesktopAdminOverview = ({ onClose }) => {
  const navigate = useNavigate();
  const { grupos } = useAuth();
  const { can } = usePermissions();
  const groupIds = useMemo(() => (grupos || []).map((group) => group.id).filter(Boolean), [grupos]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const loadContributions = async () => {
      if (!can("gestionarAportes") || !groupIds.length) return 0;
      const response = await supabase
        .from("aportes")
        .select("id", { count: "exact", head: true })
        .in("grupo_id", groupIds)
        .eq("estado_revision", "pendiente")
        .not("comprobante_path", "is", null);
      if (response.error) throw response.error;
      return response.count || 0;
    };

    try {
      const results = await Promise.allSettled([
        can("gestionarAtencionSocios") ? listarBandejaMoki() : Promise.resolve([]),
        can("gestionarBilletera") ? listarSolicitudesBilleteraAdmin() : Promise.resolve([]),
        can("verificarDocumentos") ? listarDocumentosPendientes() : Promise.resolve([]),
        loadContributions()
      ]);
      const [inboxResult, walletResult, documentsResult, contributionsResult] = results;
      const inbox = inboxResult.status === "fulfilled" ? inboxResult.value || [] : null;
      const walletRequests = walletResult.status === "fulfilled" ? walletResult.value || [] : null;
      const documents = documentsResult.status === "fulfilled" ? documentsResult.value || [] : null;
      const contributions = contributionsResult.status === "fulfilled" ? contributionsResult.value : null;
      const activeConversations = inbox?.filter((item) => item.estado !== "resuelta") || [];
      setCounts({
        conversations: inbox ? activeConversations.length : null,
        newMessages: inbox
          ? activeConversations.filter((item) => item.ultimo_remitente_rol === "socio").length
          : null,
        walletRequests: walletRequests ? walletRequests.length : null,
        documents: documents ? documents.length : null,
        contributions
      });
      setErrorMessage(results.some((result) => result.status === "rejected")
        ? "No se pudieron actualizar algunos pendientes. Revisa tu conexión o tus permisos."
        : "");
    } catch (error) {
      console.error("Error cargando el resumen operativo de Moki:", error);
      setErrorMessage("No se pudo actualizar el resumen. Revisa tu conexión o tus permisos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [can, groupIds]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    const intervalId = window.setInterval(refresh, 30000);
    let refreshTimeoutId;
    const channel = supabase.channel(`moki-admin-overview-${createUniqueId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "moki_conversaciones" }, () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(refresh, 250);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moki_mensajes" }, () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(refresh, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes_billetera" }, () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(refresh, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "perfiles" }, () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(refresh, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "aportes" }, () => {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = window.setTimeout(refresh, 250);
      })
      .subscribe((status, subscriptionError) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("active");
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setRealtimeStatus("offline");
          if (subscriptionError) console.error("Error de sesión en tiempo real de Moki:", subscriptionError);
        }
      });
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.clearTimeout(refreshTimeoutId);
      supabase.removeChannel(channel);
    };
  }, [groupIds, refresh]);

  const goTo = (path) => {
    onClose();
    navigate(path);
  };

  const tasks = [
    can("gestionarAtencionSocios") && {
      title: "Atención a socios",
      description: counts
        ? `${counts.conversations ?? "—"} activas · ${counts.newMessages ?? "—"} con respuesta pendiente`
        : "Consultas y mensajes de los socios",
      count: counts?.newMessages,
      icon: MessageCircle,
      path: "/atencion-socios",
      emphasis: counts?.newMessages > 0
    },
    can("gestionarBilletera") && {
      title: "Solicitudes de billetera",
      description: "Depósitos y retiros por revisar",
      count: counts?.walletRequests,
      icon: Wallet,
      path: "/admin/billetera",
      emphasis: counts?.walletRequests > 0
    },
    can("verificarDocumentos") && {
      title: "Documentos por verificar",
      description: "Revisión de identidad pendiente",
      count: counts?.documents,
      icon: ShieldCheck,
      path: "/verificar-documentos",
      emphasis: counts?.documents > 0
    },
    can("gestionarAportes") && {
      title: "Comprobantes de aportes",
      description: "Pagos que esperan validación",
      count: counts?.contributions,
      icon: FileCheck2,
      path: "/aportes",
      emphasis: counts?.contributions > 0
    }
  ].filter(Boolean);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F8F7] px-4 py-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Centro de control</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Resumen operativo</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Pendientes administrativos y accesos directos.</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${realtimeStatus === "active" ? "bg-emerald-100 text-emerald-800" : realtimeStatus === "offline" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
            <span className={`size-1.5 rounded-full ${realtimeStatus === "active" ? "animate-pulse bg-emerald-600" : realtimeStatus === "offline" ? "bg-amber-500" : "bg-slate-400"}`} />
            {realtimeStatus === "active" ? "Sesión en tiempo real · Activo" : realtimeStatus === "offline" ? "Tiempo real desconectado" : "Conectando en tiempo real…"}
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Actualizar pendientes"
          title="Actualizar"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-700/30 hover:text-emerald-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {errorMessage && (
        <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          {errorMessage}{counts ? " Se muestran los últimos datos disponibles." : ""}
        </p>
      )}

      <div className="space-y-2">
        {tasks.map(({ title, description, count, icon: Icon, path, emphasis }) => (
          <button
            key={path}
            type="button"
            onClick={() => goTo(path)}
            className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${emphasis ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              <Icon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-800">{title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span>
            </span>
            <span className={`flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${count > 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-500"}`}>
              {loading && counts === null ? "…" : count ?? "—"}
            </span>
            <ArrowUpRight size={15} className="shrink-0 text-slate-400 transition group-hover:text-emerald-800" />
          </button>
        ))}
        {!loading && tasks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
            No hay accesos administrativos disponibles para tu rol.
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Otros accesos</p>
        <div className="grid grid-cols-2 gap-2">
          {can("gestionarGrupo") && (
            <button type="button" onClick={() => goTo("/grupo")} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-emerald-800">
              <Users size={15} /> Grupos
            </button>
          )}
          {can("gestionarUsuarios") && (
            <button type="button" onClick={() => goTo("/usuarios")} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-emerald-800">
              <Users size={15} /> Socios y roles
            </button>
          )}
          {can("verAuditoria") && (
            <button type="button" onClick={() => goTo("/auditoria")} className="col-span-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-emerald-800">
              <CircleDollarSign size={15} /> Auditoría y seguimiento
            </button>
          )}
        </div>
      </div>
      {realtimeStatus !== "active" && <p className="mt-4 text-center text-[10px] text-slate-400">Los pendientes se actualizan periódicamente mientras se reconecta.</p>}
    </div>
  );
};

export default DesktopAdminOverview;
