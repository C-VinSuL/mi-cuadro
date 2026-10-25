import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Archive,
  Inbox,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Users
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import {
  cambiarEstadoConversacionMoki,
  archivarConversacionMoki,
  enviarMensajeMoki,
  listarConversacionesArchivadasMoki,
  listarBandejaMoki,
  listarMensajesMoki,
  restaurarConversacionMoki
} from "../../services/mokiService";

const FILTERS = [
  { id: "pendientes", label: "Pendientes" },
  { id: "en_atencion", label: "En atención" },
  { id: "resuelta", label: "Resueltas" },
  { id: "archivadas", label: "Archivadas" },
  { id: "todas", label: "Todas" }
];

const formatDateTime = (value) => new Intl.DateTimeFormat("es-EC", {
  dateStyle: "short",
  timeStyle: "short"
}).format(new Date(value));

const formatTime = (value) => new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit"
}).format(new Date(value));

const statusLabel = (status) => ({
  abierta: "Pendiente",
  en_atencion: "En atención",
  resuelta: "Resuelta"
}[status] || status);

const AtencionSocios = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("pendientes");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const messagesEndRef = useRef(null);

  const refreshInbox = useCallback(async () => {
    try {
      const [inbox, archived] = await Promise.all([
        listarBandejaMoki(),
        listarConversacionesArchivadasMoki()
      ]);
      setConversations(inbox || []);
      setArchivedConversations(archived || []);
      setSelectedConversation((current) => {
        if (!current) return current;
        return [...(inbox || []), ...(archived || [])]
          .find((conversation) => conversation.id === current.id) || null;
      });
      setErrorMessage("");
    } catch (error) {
      console.error("Error cargando la atención a socios:", error);
      setErrorMessage("No se pudo cargar la bandeja. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    const intervalId = window.setInterval(refreshInbox, 15000);
    const channel = supabase.channel(`moki-inbox-page-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "moki_conversaciones"
      }, () => setRefreshVersion((version) => version + 1))
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "moki_mensajes"
      }, () => setRefreshVersion((version) => version + 1))
      .subscribe((status, subscriptionError) => {
        if (subscriptionError) console.error("Error en tiempo real de atención a socios:", subscriptionError);
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          console.error(`El canal de atención a socios terminó con estado ${status}. Se mantendrá la actualización periódica.`);
        }
      });

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [refreshInbox, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const timeoutId = window.setTimeout(() => refreshInbox(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshInbox, refreshVersion, user?.id]);

  const selectedConversationId = selectedConversation?.id;
  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }
      try {
        const thread = await listarMensajesMoki(selectedConversationId);
        if (active) {
          setMessages(thread);
          setErrorMessage("");
        }
      } catch (error) {
        console.error("Error cargando los mensajes de la conversación:", error);
        if (active) setErrorMessage("No se pudieron cargar los mensajes de esta conversación.");
      }
    };

    loadMessages();
    return () => {
      active = false;
    };
  }, [refreshVersion, selectedConversationId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [messages.length, selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    const source = filter === "archivadas" ? archivedConversations : conversations;
    return source.filter((conversation) => {
      const matchesStatus = filter === "todas" || filter === "archivadas"
        || (filter === "pendientes"
          ? conversation.estado === "abierta"
          : conversation.estado === filter);
      const searchableText = [
        conversation.socio_nombre,
        conversation.grupo_nombre,
        conversation.ultimo_mensaje
      ].filter(Boolean).join(" ").toLocaleLowerCase("es");
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [archivedConversations, conversations, filter, search]);

  const counts = useMemo(() => ({
    pendientes: conversations.filter((conversation) => conversation.estado === "abierta").length,
    en_atencion: conversations.filter((conversation) => conversation.estado === "en_atencion").length,
    resuelta: conversations.filter((conversation) => conversation.estado === "resuelta").length
  }), [conversations]);
  const selectedConversationArchived = archivedConversations.some(
    (conversation) => conversation.id === selectedConversation?.id
  );

  const handleSend = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selectedConversation || sending) return;

    setSending(true);
    setErrorMessage("");
    try {
      await enviarMensajeMoki(selectedConversation.id, message);
      setDraft("");
      const [thread] = await Promise.all([
        listarMensajesMoki(selectedConversation.id),
        refreshInbox()
      ]);
      setMessages(thread);
    } catch (error) {
      console.error("Error respondiendo al socio:", error);
      setErrorMessage("No se pudo enviar la respuesta. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedConversation) return;
    const nextStatus = selectedConversation.estado === "resuelta" ? "en_atencion" : "resuelta";
    setErrorMessage("");
    try {
      await cambiarEstadoConversacionMoki(selectedConversation.id, nextStatus);
      await refreshInbox();
    } catch (error) {
      console.error("Error actualizando el estado de la conversación:", error);
      setErrorMessage("No se pudo actualizar el estado. Inténtalo de nuevo.");
    }
  };

  const handleArchive = async (conversation) => {
    if (!window.confirm(`¿Archivar la conversación de ${conversation.socio_nombre || "este socio"}? Se ocultará de la bandeja activa y podrás restaurarla desde “Archivadas”.`)) return;
    setErrorMessage("");
    try {
      await archivarConversacionMoki(conversation.id);
      if (selectedConversation?.id === conversation.id) setSelectedConversation(null);
      await refreshInbox();
    } catch (error) {
      console.error("Error archivando conversación:", error);
      setErrorMessage("No se pudo archivar la conversación. Inténtalo de nuevo.");
    }
  };

  const handleRestore = async (conversation) => {
    setErrorMessage("");
    try {
      await restaurarConversacionMoki(conversation.id);
      await refreshInbox();
    } catch (error) {
      console.error("Error restaurando conversación:", error);
      setErrorMessage("No se pudo restaurar la conversación. Inténtalo de nuevo.");
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Centro de soporte</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Atención a socios</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Revisa consultas, responde desde la plataforma y da seguimiento al estado de cada conversación.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshInbox}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-700/30 hover:text-emerald-800"
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pendientes", value: counts.pendientes, icon: Inbox, color: "text-amber-700 bg-amber-50" },
          { label: "En atención", value: counts.en_atencion, icon: Clock3, color: "text-blue-700 bg-blue-50" },
          { label: "Resueltas", value: counts.resuelta, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" }
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`flex size-11 items-center justify-center rounded-xl ${color}`}><Icon size={20} /></span>
            <span>
              <span className="block text-sm text-slate-500">{label}</span>
              <span className="block text-xl font-bold text-slate-900">{value}</span>
            </span>
          </div>
        ))}
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      )}

      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)]">
        <aside className={`flex min-h-[560px] flex-col border-slate-200 lg:border-r ${selectedConversation ? "hidden lg:flex" : "flex"}`}>
          <div className="border-b border-slate-100 p-4">
            <label className="relative block">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar socio o mensaje"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === item.id ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {item.label}
                  {item.id === "pendientes" || item.id === "en_atencion" || item.id === "resuelta"
                    ? <span className="ml-1 opacity-75">{counts[item.id]}</span>
                    : item.id === "archivadas" && <span className="ml-1 opacity-75">{archivedConversations.length}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Cargando conversaciones…</p>
            ) : filteredConversations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Inbox size={30} className="mx-auto text-emerald-700" />
                <p className="mt-3 font-semibold text-slate-800">No hay conversaciones en esta vista</p>
                <p className="mt-1 text-sm text-slate-500">Prueba otro filtro o vuelve a buscar más tarde.</p>
              </div>
            ) : filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex w-full items-stretch border-b border-slate-100 text-left transition hover:bg-emerald-50/60 ${selectedConversation?.id === conversation.id ? "bg-emerald-50" : ""}`}
              >
                <button type="button" onClick={() => setSelectedConversation(conversation)} className="min-w-0 flex-1 p-4 text-left">
                <span className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Users size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{conversation.socio_nombre || "Socio"}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatTime(conversation.actualizado_en)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{conversation.grupo_nombre || "Sin grupo asociado"}</span>
                    <span className="mt-2 block truncate text-sm text-slate-600">{conversation.ultimo_mensaje}</span>
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{statusLabel(conversation.estado)}</span>
                  </span>
                </span>
                </button>
                {filter === "archivadas" ? (
                  <button type="button" onClick={() => handleRestore(conversation)} aria-label={`Restaurar conversación de ${conversation.socio_nombre}`} title="Restaurar conversación" className="m-3 flex size-10 shrink-0 items-center justify-center self-center rounded-xl bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100">
                    <Inbox size={18} />
                  </button>
                ) : (
                  <button type="button" onClick={() => handleArchive(conversation)} aria-label={`Archivar conversación de ${conversation.socio_nombre}`} title="Archivar conversación" className="m-3 flex size-10 shrink-0 items-center justify-center self-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100">
                    <Archive size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        <div className={`${selectedConversation ? "flex" : "hidden lg:flex"} min-h-[560px] min-w-0 flex-col bg-[#F8FAF9]`}>
          {selectedConversation ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" onClick={() => setSelectedConversation(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Volver a conversaciones">
                    <span aria-hidden="true">←</span>
                  </button>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><Users size={18} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">{selectedConversation.socio_nombre || "Socio"}</span>
                    <span className="block truncate text-xs text-slate-500">{selectedConversation.grupo_nombre || "Sin grupo asociado"}</span>
                  </span>
                </div>
                {selectedConversationArchived ? (
                  <button type="button" onClick={() => handleRestore(selectedConversation)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:text-sm">
                    <Inbox size={16} /> Restaurar
                  </button>
                ) : <button
                  type="button"
                  onClick={handleStatusChange}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-700/30 hover:text-emerald-800 sm:text-sm"
                >
                  <CheckCircle2 size={16} />
                  {selectedConversation.estado === "resuelta" ? "Reabrir" : "Resolver"}
                </button>}
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                <p className="text-center text-xs text-slate-400">Conversación actualizada {formatDateTime(selectedConversation.actualizado_en)}</p>
                {messages.map((message) => {
                  const fromStaff = message.remitente_rol === "administrador" || message.remitente_rol === "moki";
                  return (
                    <div key={message.id} className={`flex ${fromStaff ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${fromStaff ? "rounded-br-sm bg-[#DDF3E8] text-slate-800" : "rounded-bl-sm bg-white text-slate-700"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.contenido}</p>
                        <p className="mt-1 text-right text-[10px] text-slate-400">{formatTime(message.creado_en)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {selectedConversationArchived ? (
                <div className="border-t border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-500">Esta conversación está archivada y no admite nuevas respuestas.</div>
              ) : selectedConversation.estado === "resuelta" ? (
                <div className="border-t border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-500">Esta conversación está resuelta. Puedes reabrirla para responder.</div>
              ) : (
                <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 sm:p-4">
                  <label htmlFor="support-message" className="sr-only">Escribe una respuesta</label>
                  <input
                    id="support-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={2000}
                    placeholder="Escribe una respuesta al socio…"
                    className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                    disabled={sending}
                  />
                  <button type="submit" aria-label="Enviar respuesta" disabled={!draft.trim() || sending} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#16835D] text-white transition hover:bg-[#064E3B] disabled:cursor-not-allowed disabled:opacity-50">
                    <Send size={18} />
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="m-auto max-w-sm px-6 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><MessageCircle size={26} /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">Selecciona una conversación</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">Elige una consulta de la lista para revisar el hilo y responder al socio.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AtencionSocios;
