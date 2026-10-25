import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Archive,
  CheckCircle2,
  Clock3,
  Inbox,
  Menu,
  Paperclip,
  Plus,
  Smile,
  X,
  Send,
  Trash2,
  Users
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import DesktopAdminOverview from "./DesktopAdminOverview";
import { supabase } from "../../services/supabase";
import {
  cambiarEstadoConversacionMoki,
  archivarConversacionMoki,
  enviarMensajeMoki,
  enviarArchivoMoki,
  obtenerUrlAdjuntoMoki,
  iniciarConversacionMoki,
  listarConversacionesArchivadasMoki,
  listarBandejaMoki,
  listarMensajesMoki,
  listarMisConversacionesMoki,
  restaurarConversacionMoki
} from "../../services/mokiService";
import { getVisibleMenu } from "./Sidebar/navigationItems";

const QUICK_HELP = {
  socio: [
    {
      label: "Consultar mis aportes",
      answer: "Puedes revisar tus aportes y su estado en la sección Aportes.",
      path: "/aportes"
    },
    {
      label: "Ver mi billetera",
      answer: "En Billetera puedes consultar tu saldo y tus movimientos.",
      path: "/billetera"
    },
    {
      label: "Consultar mi turno",
      answer: "En Cuadro puedes consultar el orden y el avance de la ronda.",
      path: "/cuadro"
    }
  ],
  tesorero: [
    { label: "Revisar aportes", answer: "Abre el control de aportes para revisar pagos y pendientes.", path: "/aportes" },
    { label: "Revisar el grupo", answer: "Consulta los integrantes y el avance del grupo.", path: "/grupo" },
    { label: "Ver el cuadro", answer: "Abre el cuadro para revisar el orden de la ronda.", path: "/cuadro" }
  ],
  administrador: [
    { label: "Control de aportes", answer: "Abre el control de aportes para revisar el estado de los pagos.", path: "/aportes" },
    { label: "Gestionar grupos", answer: "Consulta los grupos y su actividad.", path: "/grupo" },
    { label: "Revisar auditoría", answer: "Consulta los eventos registrados en Auditoría.", path: "/auditoria" },
    { label: "Solicitudes de billetera", answer: "Revisa las solicitudes que esperan una decisión administrativa.", path: "/admin/billetera" }
  ],
  auditor: [
    { label: "Abrir auditoría", answer: "En Auditoría puedes consultar los eventos del sistema.", path: "/auditoria" },
    { label: "Ver historial", answer: "Abre Historial para revisar los registros disponibles.", path: "/historial" }
  ]
};

const formatMessageTime = (value) => new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit"
}).format(new Date(value));
const CHAT_EMOJIS = ["😀", "😊", "👍", "🙏", "🎉", "❤️", "📎", "✅"];

const MobileAssistant = ({ onClose, onOpenMenu, desktop = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can, rol } = usePermissions();
  const items = getVisibleMenu(can, rol);
  const isMember = rol === "socio";
  const allowedQuickHelp = useMemo(
    () => (QUICK_HELP[rol] || QUICK_HELP.socio)
      .filter((entry) => items.some((item) => item.path === entry.path)),
    [items, rol]
  );
  const isAdministrator = rol === "administrador";
  const [adminView, setAdminView] = useState("chat");
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [memberConversation, setMemberConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [swipedConversationId, setSwipedConversationId] = useState(null);
  const touchStartX = useRef(null);
  const attachmentInputRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const adminInbox = isAdministrator && ["inbox", "archived"].includes(adminView);
  const activeConversation = isAdministrator ? selectedConversation : memberConversation;
  const listedConversations = adminView === "archived" ? archivedConversations : conversations;
  const chatMessages = [...messages, ...localMessages];
  const suggestions = activeConversation?.estado === "resuelta" ? [] : allowedQuickHelp;

  const goTo = (path) => {
    onClose();
    navigate(path);
  };

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    const load = async () => {
      try {
        if (isAdministrator && adminInbox) {
          const inbox = adminView === "archived"
            ? await listarConversacionesArchivadasMoki()
            : await listarBandejaMoki();
          if (!active) return;
          if (adminView === "archived") setArchivedConversations(inbox || []);
          else setConversations(inbox || []);
          const openConversation = selectedConversation
            ? inbox?.find((item) => item.id === selectedConversation.id)
            : null;
          if (selectedConversation && !openConversation) setSelectedConversation(null);
          if (openConversation) {
            const thread = await listarMensajesMoki(openConversation.id);
            if (active) setMessages(thread);
          }
        } else if (isMember) {
          const conversation = await listarMisConversacionesMoki(user.id);
          if (!active) return;
          setMemberConversation(conversation);
          if (conversation) {
            const thread = await listarMensajesMoki(conversation.id);
            if (active) setMessages(thread);
          } else {
            setMessages([]);
          }
        }
        if (active) setErrorMessage("");
      } catch (error) {
        console.error("Error cargando Moki:", error);
        if (active) setErrorMessage("No se pudo cargar Moki. Intenta actualizar la conversación.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const intervalId = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [adminInbox, adminView, isAdministrator, isMember, refreshVersion, selectedConversation, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase.channel(`moki-chat-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "moki_conversaciones",
        ...(isAdministrator ? {} : { filter: `socio_id=eq.${user.id}` })
      }, () => setRefreshVersion((version) => version + 1))
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "moki_mensajes",
        ...(isAdministrator
          ? {}
          : memberConversation?.id
            ? { filter: `conversacion_id=eq.${memberConversation.id}` }
            : {})
      }, () => setRefreshVersion((version) => version + 1))
      .subscribe((status, subscriptionError) => {
        if (subscriptionError) console.error("Error en tiempo real de Moki:", subscriptionError);
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          console.error(`El canal de Moki terminó con estado ${status}. Se mantendrá la actualización periódica.`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdministrator, memberConversation?.id, user?.id]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [chatMessages.length, loading, adminInbox, selectedConversation?.id]);

  const handleQuickHelp = (entry) => {
    const now = new Date().toISOString();
    setLocalMessages((current) => [
      ...current,
      { id: `question-${now}`, remitente_rol: rol, contenido: entry.label, creado_en: now },
      {
        id: `answer-${now}`,
        remitente_rol: "moki",
        contenido: entry.answer,
        creado_en: now,
        ruta: entry.path,
        rutaTitulo: items.find((item) => item.path === entry.path)?.title
      }
    ]);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if ((!message && !pendingAttachment) || sending) return;
    if (isMember && (!memberConversation || memberConversation.estado === "resuelta") && !message) {
      setErrorMessage("Escribe un mensaje para iniciar una conversación antes de adjuntar el archivo.");
      return;
    }

    setSending(true);
    setErrorMessage("");
    try {
      let conversationId = selectedConversation?.id || memberConversation?.id;
      if (isAdministrator && selectedConversation) {
        if (pendingAttachment) await enviarArchivoMoki(conversationId, pendingAttachment, message);
        else await enviarMensajeMoki(conversationId, message);
      } else if (isMember) {
        if (memberConversation?.estado === "resuelta") {
          conversationId = await iniciarConversacionMoki(message);
          setMemberConversation({ id: conversationId, estado: "abierta" });
          if (pendingAttachment) await enviarArchivoMoki(conversationId, pendingAttachment);
        } else if (memberConversation) {
          if (pendingAttachment) await enviarArchivoMoki(conversationId, pendingAttachment, message);
          else await enviarMensajeMoki(conversationId, message);
        } else {
          conversationId = await iniciarConversacionMoki(message);
          setMemberConversation({ id: conversationId, estado: "abierta" });
          if (pendingAttachment) await enviarArchivoMoki(conversationId, pendingAttachment);
        }
      }
      setDraft("");
      setPendingAttachment(null);
      setEmojiPickerOpen(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      if (isAdministrator) {
        setAdminView("inbox");
      }
      setLoading(true);
      if (isAdministrator) {
        const inbox = await listarBandejaMoki();
        setConversations(inbox || []);
        if (selectedConversation) {
          setMessages(await listarMensajesMoki(selectedConversation.id));
        }
      } else if (isMember) {
        const conversation = await listarMisConversacionesMoki(user.id);
        setMemberConversation(conversation);
        setMessages(conversation ? await listarMensajesMoki(conversation.id) : []);
      }
    } catch (error) {
      console.error("Error enviando mensaje de Moki:", error);
      setErrorMessage("No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setSending(false);
    }
  };

  const selectAttachment = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Adjunta una imagen JPG, PNG, WebP o un documento PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("El archivo no puede superar 5 MB.");
      event.target.value = "";
      return;
    }
    setErrorMessage("");
    setPendingAttachment(file);
  };

  const openAttachment = async (message) => {
    if (!message.archivo_path || openingAttachmentId) return;
    setOpeningAttachmentId(message.id);
    try {
      const signedUrl = await obtenerUrlAdjuntoMoki(message.archivo_path);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error abriendo archivo del chat:", error);
      setErrorMessage("No se pudo abrir el archivo adjunto. Inténtalo de nuevo.");
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const changeConversationStatus = async () => {
    if (!selectedConversation) return;
    if (adminView === "archived") {
      await handleRestoreConversation(selectedConversation);
      return;
    }
    setErrorMessage("");
    const nextStatus = selectedConversation.estado === "resuelta" ? "en_atencion" : "resuelta";
    try {
      await cambiarEstadoConversacionMoki(selectedConversation.id, nextStatus);
      const inbox = await listarBandejaMoki();
      setConversations(inbox || []);
      if (nextStatus === "resuelta") {
        setSelectedConversation(null);
        setMessages([]);
      } else {
        setSelectedConversation((current) => current ? { ...current, estado: nextStatus } : current);
      }
    } catch (error) {
      console.error("Error actualizando conversación de Moki:", error);
      setErrorMessage("No se pudo actualizar la conversación. Inténtalo de nuevo.");
    }
  };

  const handleArchiveConversation = async (conversation) => {
    if (!window.confirm(`¿Archivar la conversación de ${conversation.socio_nombre || "este socio"}? Podrás restaurarla desde Archivadas.`)) return;
    setErrorMessage("");
    try {
      await archivarConversacionMoki(conversation.id);
      setSwipedConversationId(null);
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
        setMessages([]);
      }
      const inbox = await listarBandejaMoki();
      setConversations(inbox || []);
    } catch (error) {
      console.error("Error archivando conversación de Moki:", error);
      setErrorMessage("No se pudo archivar la conversación. Inténtalo de nuevo.");
    }
  };

  const handleRestoreConversation = async (conversation) => {
    setErrorMessage("");
    try {
      await restaurarConversacionMoki(conversation.id);
      setArchivedConversations((current) => current.filter((item) => item.id !== conversation.id));
      setSelectedConversation(null);
      setMessages([]);
    } catch (error) {
      console.error("Error restaurando conversación de Moki:", error);
      setErrorMessage("No se pudo restaurar la conversación. Inténtalo de nuevo.");
    }
  };

  return (
    <section
      aria-label={isAdministrator && adminInbox ? "Bandeja de Moki" : "Chat de Moki"}
      className={desktop
        ? "flex h-full min-h-0 flex-col bg-[#F7F8F7]"
        : "fixed inset-x-0 top-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-50 flex flex-col bg-[#F7F8F7] md:hidden"}
    >
      <header className="flex items-center gap-3 bg-[#064E3B] px-4 py-3 text-white shadow-sm">
        {!desktop && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menú de navegación"
            aria-haspopup="dialog"
            className="rounded-full p-2 transition-colors hover:bg-white/10"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-white">
          <img
            src="/flashmonkey-mascot.png"
            alt=""
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-tight">
            {adminInbox && selectedConversation ? selectedConversation.socio_nombre : "Moki"}
          </h2>
          <p className="mt-0.5 text-xs text-emerald-100">
            {desktop && isAdministrator
              ? "Pendientes y accesos administrativos"
              : adminInbox
              ? selectedConversation
                ? selectedConversation.grupo_nombre || "Conversación con socio"
                : "Atención a socios"
              : isAdministrator
                ? "Asistente de administración"
                : "Tu guía de FlashMonkey"}
          </p>
        </div>
        {desktop ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar chat de Moki"
            className="rounded-full p-2 transition-colors hover:bg-white/10"
          >
            <X size={19} />
          </button>
        ) : adminInbox && selectedConversation && (
          <button
            type="button"
            onClick={changeConversationStatus}
            aria-label={adminView === "archived" ? "Restaurar conversación" : selectedConversation.estado === "resuelta" ? "Reabrir conversación" : "Marcar conversación como resuelta"}
            title={adminView === "archived" ? "Restaurar conversación" : selectedConversation.estado === "resuelta" ? "Reabrir conversación" : "Resolver conversación"}
            className="rounded-full p-2 transition-colors hover:bg-white/10"
          >
            {adminView === "archived" ? <Inbox size={20} /> : <CheckCircle2 size={20} />}
          </button>
        )}
      </header>

      {desktop && isAdministrator ? (
        <DesktopAdminOverview onClose={onClose} />
      ) : (
      <>
      {isAdministrator && !desktop && (
        <div className="flex border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            onClick={() => {
              setAdminView("chat");
              setSelectedConversation(null);
              setMessages([]);
            }}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${adminView === "chat" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}
          >
            Moki
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminView("inbox");
              setSelectedConversation(null);
              setMessages([]);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${adminInbox ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}
          >
            <Inbox size={16} />
            Bandeja
            {conversations.filter((conversation) => conversation.estado !== "resuelta").length > 0 && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                {conversations.filter((conversation) => conversation.estado !== "resuelta").length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminView("archived");
              setSelectedConversation(null);
              setMessages([]);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${adminView === "archived" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500"}`}
          >
            <Archive size={16} />
            Archivadas
            {archivedConversations.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                {archivedConversations.length}
              </span>
            )}
          </button>
        </div>
      )}

      {adminInbox && !selectedConversation ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">{adminView === "archived" ? "Conversaciones archivadas" : "Conversaciones de socios"}</h3>
            <p className="mt-1 text-sm text-slate-500">{adminView === "archived" ? "Historial conservado; puedes restaurar una conversación." : "Mensajes que requieren seguimiento del equipo."}</p>
          </div>
          {errorMessage && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          )}
          {loading && listedConversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando conversaciones…</p>
          ) : listedConversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
              <Inbox size={28} className="mx-auto text-emerald-700" />
              <p className="mt-3 font-medium text-slate-700">{adminView === "archived" ? "No hay conversaciones archivadas" : "Aún no hay conversaciones"}</p>
              <p className="mt-1 text-sm text-slate-500">{adminView === "archived" ? "Las conversaciones archivadas aparecerán aquí." : "Cuando un socio escriba a administración, aparecerá aquí."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {listedConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="relative overflow-hidden rounded-xl"
                  onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return;
                    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
                    if (deltaX < -45 && adminView !== "archived") setSwipedConversationId(conversation.id);
                    if (deltaX > 45) setSwipedConversationId(null);
                    touchStartX.current = null;
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (swipedConversationId === conversation.id) {
                        setSwipedConversationId(null);
                        return;
                      }
                      setSelectedConversation(conversation);
                      setMessages([]);
                    }}
                    className={`relative z-10 w-full border border-slate-200 bg-white p-4 text-left shadow-sm transition-transform duration-200 hover:border-emerald-700/30 ${swipedConversationId === conversation.id ? "-translate-x-16" : "translate-x-0"}`}
                  >
                  <span className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
                      <Users size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{conversation.socio_nombre}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatMessageTime(conversation.actualizado_en)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{conversation.grupo_nombre || "Sin grupo asociado"}</span>
                      <span className="mt-2 block truncate text-sm text-slate-600">{conversation.ultimo_mensaje}</span>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] capitalize text-slate-600">
                        <Clock3 size={12} /> {adminView === "archived" ? "archivada" : conversation.estado.replace("_", " ")}
                      </span>
                    </span>
                  </span>
                  </button>
                  {adminView === "archived" ? (
                    <button type="button" onClick={() => handleRestoreConversation(conversation)} aria-label={`Restaurar conversación de ${conversation.socio_nombre}`} className="absolute right-0 top-0 flex h-full w-16 items-center justify-center bg-emerald-700 text-white">
                      <Inbox size={19} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleArchiveConversation(conversation)} aria-label={`Archivar conversación de ${conversation.socio_nombre}`} className="absolute right-0 top-0 flex h-full w-16 items-center justify-center bg-red-600 text-white">
                      <Trash2 size={19} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {adminInbox && selectedConversation && (
            <button
              type="button"
              onClick={() => {
                setSelectedConversation(null);
                setMessages([]);
              }}
              className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800"
            >
              <ArrowLeft size={16} /> Volver a la bandeja
            </button>
          )}
          {!adminInbox && suggestions.length > 0 && (
            <section
              aria-label={isAdministrator ? "Accesos administrativos" : "Preguntas rápidas"}
              className="shrink-0 border-b border-slate-200 bg-white px-4 py-3"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {isAdministrator ? "Accesos administrativos" : "Preguntas rápidas"}
              </p>
              <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
                {suggestions.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={() => (isAdministrator ? goTo(entry.path) : handleQuickHelp(entry))}
                    className="min-h-10 shrink-0 rounded-full border border-emerald-800/15 bg-emerald-50 px-3.5 py-2 text-left text-xs font-medium text-emerald-950 transition hover:border-emerald-700/30 hover:bg-emerald-100"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5">
            {!adminInbox && (
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
                  <img src="/flashmonkey-mascot.png" alt="" className="h-full w-full object-cover object-top" />
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                  ¡Hola! Soy Moki, el asistente de FlashMonkey. Puedo orientarte con las secciones de tu cuenta o enviar tu consulta al equipo administrador.
                </div>
              </div>
            )}
            {isAdministrator && adminView === "chat" && (
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
                  <img src="/flashmonkey-mascot.png" alt="" className="h-full w-full object-cover object-top" />
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                  Hola. Desde aquí puedes acceder a tareas administrativas y revisar en Bandeja las consultas de los socios.
                </div>
              </div>
            )}
            {chatMessages.map((message) => {
              const fromStaff = message.remitente_rol === "administrador" || message.remitente_rol === "moki";
              return (
                <div key={message.id} className={`flex ${fromStaff ? "items-end gap-2" : "justify-end"}`}>
                  {fromStaff && (
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white">
                      <img src="/flashmonkey-mascot.png" alt="" className="h-full w-full object-cover object-top" />
                    </div>
                  )}
                  <div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${fromStaff ? "rounded-bl-sm bg-white text-slate-700" : "rounded-br-sm bg-[#DDF3E8] text-slate-800"}`}>
                    {message.contenido && <p className="whitespace-pre-wrap break-words">{message.contenido}</p>}
                    {message.archivo_path && (
                      <button
                        type="button"
                        onClick={() => openAttachment(message)}
                        disabled={openingAttachmentId === message.id}
                        className="mt-1 flex max-w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2 text-left text-xs font-semibold text-emerald-900 transition hover:bg-white disabled:opacity-60"
                      >
                        <Paperclip size={15} className="shrink-0" />
                        <span className="truncate">{openingAttachmentId === message.id ? "Abriendo…" : message.archivo_nombre}</span>
                      </button>
                    )}
                    {message.ruta && (
                      <button
                        type="button"
                        onClick={() => goTo(message.ruta)}
                        className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-800"
                      >
                        {message.rutaTitulo || "Abrir sección"} <ArrowUpRight size={14} />
                      </button>
                    )}
                    {message.creado_en && (
                      <p className="mt-1 text-right text-[10px] text-slate-400">{formatMessageTime(message.creado_en)}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {errorMessage && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {activeConversation?.estado === "resuelta" && (
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-center">
              <p className="text-sm text-slate-600">Esta conversación fue resuelta.</p>
              {!isAdministrator && <p className="mt-1 text-xs text-slate-500">Escribe un nuevo mensaje para iniciar otra consulta.</p>}
            </div>
          )}
          {((adminInbox && adminView !== "archived" && selectedConversation?.estado !== "resuelta") || isMember) && (
            <form onSubmit={sendMessage} className="relative border-t border-slate-200 bg-white px-3 py-3">
              {pendingAttachment && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                  <Paperclip size={14} />
                  <span className="min-w-0 flex-1 truncate">{pendingAttachment.name}</span>
                  <button type="button" onClick={() => { setPendingAttachment(null); if (attachmentInputRef.current) attachmentInputRef.current.value = ""; }} className="font-semibold text-emerald-800">Quitar</button>
                </div>
              )}
              {emojiPickerOpen && (
                <div className="absolute bottom-full left-3 mb-2 flex gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" aria-label="Seleccionar emoji">
                  {CHAT_EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => setDraft((current) => `${current}${emoji}`)} className="flex size-9 items-center justify-center rounded-lg text-xl transition hover:bg-emerald-50" aria-label={`Agregar ${emoji}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={selectAttachment}
                className="sr-only"
                tabIndex={-1}
                aria-label="Seleccionar imagen o PDF"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  aria-label="Adjuntar archivo"
                  title="Adjuntar imagen o PDF (máximo 5 MB)"
                  disabled={sending || (isAdministrator && !selectedConversation)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-emerald-800 disabled:opacity-50"
                >
                  <Plus size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen((open) => !open)}
                  aria-label="Abrir emojis"
                  aria-expanded={emojiPickerOpen}
                  disabled={sending}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-emerald-800 disabled:opacity-50"
                >
                  <Smile size={19} />
                </button>
              <label htmlFor="moki-message" className="sr-only">Escribe un mensaje</label>
              <input
                id="moki-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder={isAdministrator ? "Responder al socio…" : "Escribe un mensaje…"}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                disabled={sending || (isAdministrator && !selectedConversation)}
              />
              <button
                type="submit"
                aria-label="Enviar mensaje"
                disabled={(!draft.trim() && !pendingAttachment) || sending}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#16835D] text-white transition hover:bg-[#064E3B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={18} />
              </button>
              </div>
            </form>
          )}
        </>
      )}

      <p className="border-t border-slate-200 bg-white px-4 py-2 text-center text-[11px] text-slate-500">
        Moki usa respuestas guiadas; la IA se conectará en una etapa posterior.
      </p>
      </>
      )}
    </section>
  );
};

export default MobileAssistant;
