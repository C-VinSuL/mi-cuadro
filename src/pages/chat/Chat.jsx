import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Check,
  Clock3,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Reply,
  Search,
  Send,
  Shield,
  Trash2,
  Users,
  VolumeX,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useChatUnread } from "../../context/chatUnreadStore";
import { useChatCanal } from "../../hooks/useChatCanal";
import {
  listarMiembrosChat,
  obtenerUrlAdjuntoChat,
  silenciarUsuarioChat
} from "../../services/chatService";
import { logOperationalError } from "../../utils/logOperationalError";
import { useNotifications } from "../../hooks/useNotifications";
import { getRoleLabel } from "../../utils/rolePresentation";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const initialsFor = (name = "") => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toLocaleUpperCase("es"))
  .join("") || "C";

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(date);
};

const dayKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Hoy";
  if (dayKey(date) === dayKey(yesterday)) return "Ayer";
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
};

const ChatChannelList = ({ channels, loading, error, activeChannelId, onOpen, search, onSearch }) => {
  const filteredChannels = useMemo(() => channels.filter((channel) => (
    channel.nombre.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))
  )), [channels, search]);

  return (
    <aside className="flex min-h-0 w-full min-w-0 flex-col border-r border-slate-200 bg-white md:w-[21rem] md:shrink-0">
      <div className="border-b border-slate-100 px-4 pb-4 pt-5 sm:px-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Comunidad</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Chats</h1>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
            <MessageCircle size={21} aria-hidden="true" />
          </span>
        </div>
        <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar chats</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar chats"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <nav aria-label="Conversaciones" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {loading ? (
          <div role="status" className="space-y-2 p-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-3 rounded-2xl p-3">
                <span className="size-12 rounded-full bg-slate-200" />
                <span className="min-w-0 flex-1">
                  <span className="mb-2 block h-3 w-2/5 rounded bg-slate-200" />
                  <span className="block h-3 w-4/5 rounded bg-slate-100" />
                </span>
              </div>
            ))}
            <span className="sr-only">Cargando tus chats</span>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="mx-auto flex max-w-xs flex-col items-center px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <MessageCircle size={24} aria-hidden="true" />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              {search ? "No encontramos chats" : "Todavía no tienes chats"}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {search ? "Prueba con otro nombre." : "Cuando tengas acceso a un canal, aparecerá aquí."}
            </p>
          </div>
        ) : filteredChannels.map((channel) => {
          const unread = Number(channel.no_leidos || 0);
          const preview = channel.ultimo_mensaje || "Aún no hay mensajes";
          return (
            <button
              type="button"
              key={channel.canal_id}
              onClick={() => onOpen(channel.canal_id)}
              aria-current={activeChannelId === channel.canal_id ? "page" : undefined}
              className={`chat-channel-row flex min-h-[76px] w-full min-w-0 items-center gap-3 rounded-2xl p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                activeChannelId === channel.canal_id
                  ? "bg-emerald-50"
                  : "hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              <span className={`relative flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                channel.tipo === "equipo"
                  ? "bg-indigo-100 text-indigo-900"
                  : "bg-emerald-100 text-emerald-900"
              }`}>
                {initialsFor(channel.nombre)}
                {channel.tipo === "equipo" && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-indigo-700 text-white">
                    <Shield size={10} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-950">{channel.nombre}</span>
                  <time className="shrink-0 text-[11px] text-slate-500" dateTime={channel.ultima_hora || undefined}>
                    {formatTime(channel.ultima_hora)}
                  </time>
                </span>
                <span className="mt-1 flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-600">{preview}</span>
                  {unread > 0 && (
                    <span aria-label={`${unread} mensajes sin leer`} className="flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 px-1.5 text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

const ChatImage = ({ path, previewUrl, onOpen }) => {
  const [imageUrl, setImageUrl] = useState(() => previewUrl || "");
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (previewUrl || !path) return undefined;
    let active = true;
    obtenerUrlAdjuntoChat(path)
      .then((url) => {
        if (active) setImageUrl(url);
      })
      .catch((error) => {
        logOperationalError("No se pudo cargar una imagen del chat:", error);
        if (active) setImageError("No se pudo cargar esta imagen.");
      });
    return () => {
      active = false;
    };
  }, [path, previewUrl]);

  if (imageError) {
    return <p className="mt-2 flex items-center gap-1 text-xs text-red-700"><AlertCircle size={14} />{imageError}</p>;
  }
  if (!imageUrl) {
    return <span role="status" className="mt-2 flex h-28 w-48 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><LoaderCircle size={20} className="animate-spin" /><span className="sr-only">Cargando imagen</span></span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(path, imageUrl)}
      aria-label="Ampliar imagen adjunta"
      className="mt-2 block max-w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
    >
      <img src={imageUrl} alt="Imagen adjunta al mensaje" className="max-h-64 max-w-full rounded-xl object-contain" />
    </button>
  );
};

const ChatConversation = ({ canalId, channels }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { notify } = useNotifications();
  const {
    channel,
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    realtimeStatus,
    typingCount,
    initialUnreadCount,
    loadOlder,
    sendMessage,
    retryMessage,
    moderateMessage,
    setTyping
  } = useChatCanal(canalId);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [reply, setReply] = useState(null);
  const [showLatest, setShowLatest] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [muteMinutes, setMuteMinutes] = useState("60");
  const [muteReason, setMuteReason] = useState("");
  const [muteError, setMuteError] = useState("");
  const [muting, setMuting] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const inputRef = useRef(null);
  const messageLogRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const restoreScrollHeightRef = useRef(null);
  const initialFocusRef = useRef(null);
  const canModerate = ["administrador", "tesorero"].includes(profile?.rol?.toLowerCase());
  const canMute = profile?.rol?.toLowerCase() === "administrador";
  const channelTitle = channel?.nombre || channels.find((item) => item.canal_id === canalId)?.nombre || "Chat";
  const unreadMarkerIndex = initialUnreadCount > 0
    ? Math.max(0, messages.length - initialUnreadCount)
    : -1;

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [canalId]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const updateKeyboardOffset = () => {
      setKeyboardOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);
    window.addEventListener("resize", updateKeyboardOffset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
      window.removeEventListener("resize", updateKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    if (!viewer) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setViewer(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewer]);

  useLayoutEffect(() => {
    const log = messageLogRef.current;
    if (!log) return;
    if (restoreScrollHeightRef.current !== null) {
      log.scrollTop += log.scrollHeight - restoreScrollHeightRef.current;
      restoreScrollHeightRef.current = null;
      return;
    }
    if (wasAtBottomRef.current) {
      log.scrollTop = log.scrollHeight;
      setShowLatest(false);
    } else {
      setShowLatest(true);
    }
  }, [messages]);

  const openImage = useCallback(async (path, currentUrl) => {
    if (!path) {
      setViewer({ url: currentUrl });
      return;
    }
    try {
      const url = await obtenerUrlAdjuntoChat(path);
      setViewer({ url });
    } catch (imageError) {
      logOperationalError("No se pudo abrir una imagen del chat:", imageError);
      notify({
        title: "No se pudo abrir la imagen",
        message: "Vuelve a intentarlo. El enlace temporal puede haber caducado.",
        type: "error"
      });
    }
  }, [notify]);

  const handleFile = (selectedFile) => {
    setFileError("");
    if (!selectedFile) return;
    if (!ACCEPTED_IMAGE_TYPES.has(selectedFile.type)) {
      setFileError("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (selectedFile.size > MAX_IMAGE_SIZE) {
      setFileError("La imagen no puede superar 2 MB.");
      return;
    }
    setFile(selectedFile);
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim() && !file) return;
    await sendMessage({ content: draft, replyTo: reply?.id || null, file });
    setDraft("");
    setFile(null);
    setReply(null);
    setFileError("");
    setTyping(false);
    wasAtBottomRef.current = true;
    inputRef.current?.focus();
  };

  const loadPreviousMessages = async () => {
    const log = messageLogRef.current;
    if (log) restoreScrollHeightRef.current = log.scrollHeight;
    await loadOlder();
  };

  const openModeration = async () => {
    setMembersOpen(true);
    setMembersLoading(true);
    setMuteError("");
    try {
      const result = await listarMiembrosChat(canalId);
      setMembers(result);
      setSelectedMemberId(result.find((member) => member.usuario_id !== user?.id)?.usuario_id || "");
    } catch (error) {
      logOperationalError("No se pudieron cargar miembros para moderación:", error);
      setMuteError("No se pudieron cargar los integrantes. Inténtalo nuevamente.");
    } finally {
      setMembersLoading(false);
    }
  };

  const submitMute = async (event) => {
    event.preventDefault();
    setMuteError("");
    setMuting(true);
    try {
      await silenciarUsuarioChat({
        canalId,
        usuarioId: selectedMemberId,
        minutos: Number(muteMinutes),
        motivo: muteReason.trim()
      });
      notify({
        title: "Silencio aplicado",
        message: "El usuario no podrá enviar mensajes en este canal durante el tiempo indicado.",
        type: "success"
      });
      setMembersOpen(false);
      setMuteReason("");
    } catch (error) {
      logOperationalError("No se pudo silenciar al usuario:", error);
      setMuteError(error?.message || "No se pudo silenciar al usuario. Verifica los datos e inténtalo nuevamente.");
    } finally {
      setMuting(false);
    }
  };

  const handleMessageScroll = () => {
    const log = messageLogRef.current;
    if (!log) return;
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    wasAtBottomRef.current = atBottom;
    if (atBottom) setShowLatest(false);
  };

  const jumpToMessage = (messageId) => {
    const target = document.querySelector(`[data-message-id="${messageId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.classList.add("ring-2", "ring-emerald-400");
    window.setTimeout(() => target?.classList.remove("ring-2", "ring-emerald-400"), 1000);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8f6]" aria-label={`Conversación ${channelTitle}`}>
      <header className="z-10 flex min-h-[68px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
        <button
          type="button"
          onClick={() => navigate("/chat")}
          aria-label="Volver a la lista de chats"
          ref={initialFocusRef}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <ArrowLeft size={21} aria-hidden="true" />
        </button>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          channel?.tipo === "equipo" ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
        }`}>
          {initialsFor(channelTitle)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-slate-950">{channelTitle}</h1>
          <p className="truncate text-xs text-slate-500">
            {channel?.tipo === "equipo"
              ? "Canal privado del equipo"
              : `${Number(channel?.integrantes || 0)} integrantes`}
            {typingCount > 0 ? " · Escribiendo…" : ""}
          </p>
        </div>
        {realtimeStatus !== "active" && (
          <span className="hidden items-center gap-1 text-xs text-amber-800 sm:flex" role="status">
            <AlertCircle size={14} aria-hidden="true" />
            {realtimeStatus === "offline" ? "Reconectando" : "Conectando"}
          </span>
        )}
        {canMute && (
          <button
            type="button"
            onClick={openModeration}
            aria-label="Silenciar a un integrante"
            title="Silenciar a un integrante"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <VolumeX size={19} aria-hidden="true" />
          </button>
        )}
      </header>

      <div
        ref={messageLogRef}
        role="log"
        aria-live="polite"
        aria-label="Mensajes de la conversación"
        tabIndex={0}
        onScroll={handleMessageScroll}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-28 pt-4 outline-none sm:px-6 sm:pb-28 md:pb-5"
      >
        {hasMore && !loading && messages.length > 0 && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={loadPreviousMessages}
              disabled={loadingOlder}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingOlder ? <LoaderCircle size={15} className="animate-spin" /> : <Clock3 size={15} />}
              Cargar mensajes anteriores
            </button>
          </div>
        )}

        {loading ? (
          <div role="status" className="mx-auto mt-8 max-w-sm space-y-3">
            <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-white shadow-sm" />
            <div className="ml-auto h-12 w-2/3 animate-pulse rounded-2xl bg-emerald-100" />
            <div className="h-16 w-4/5 animate-pulse rounded-2xl bg-white shadow-sm" />
            <span className="sr-only">Cargando mensajes</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center py-14 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-white text-emerald-800 shadow-sm">
              <MessageCircle size={27} aria-hidden="true" />
            </span>
            <p className="mt-4 text-base font-semibold text-slate-800">Inicia la conversación</p>
            <p className="mt-1 text-sm text-slate-500">Comparte una novedad o una pregunta con el grupo.</p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-1">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const next = messages[index + 1];
              const mine = message.authorId === user?.id;
              const sameAuthorBefore = previous?.authorId === message.authorId
                && dayKey(previous.createdAt) === dayKey(message.createdAt);
              const sameAuthorAfter = next?.authorId === message.authorId
                && dayKey(next.createdAt) === dayKey(message.createdAt);
              const isNewDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
              const repliedMessage = messages.find((item) => item.id === message.replyTo);

              return (
                <div key={message.id}>
                  {isNewDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                        {dayLabel(message.createdAt)}
                      </span>
                    </div>
                  )}
                  {index === unreadMarkerIndex && initialUnreadCount > 0 && (
                    <div className="my-4 flex items-center gap-3" aria-label={`${initialUnreadCount} mensajes sin leer`}>
                      <span className="h-px flex-1 bg-emerald-300" />
                      <span className="shrink-0 text-[11px] font-semibold text-emerald-800">
                        {initialUnreadCount} {initialUnreadCount === 1 ? "mensaje" : "mensajes"} sin leer
                      </span>
                      <span className="h-px flex-1 bg-emerald-300" />
                    </div>
                  )}
                  <motion.div
                    data-message-id={message.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className={`group flex min-w-0 items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${sameAuthorBefore ? "mt-0.5" : "mt-2"}`}
                  >
                    {!mine && (
                      <span className={`mb-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        message.authorRole === "administrador"
                          ? "bg-indigo-200 text-indigo-950"
                          : message.authorRole === "tesorero"
                            ? "bg-cyan-100 text-cyan-950"
                            : "bg-emerald-100 text-emerald-950"
                      }`} aria-hidden="true">
                        {sameAuthorAfter ? "" : initialsFor(message.authorName)}
                      </span>
                    )}
                    <div className={`flex max-w-[88%] min-w-0 items-end gap-1 sm:max-w-[75%] ${mine ? "flex-row-reverse" : ""}`}>
                      <article className={`min-w-0 rounded-2xl px-3 py-2 shadow-sm ${
                        mine
                          ? "chat-own-bubble rounded-br-md text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                      } ${sameAuthorAfter ? (mine ? "rounded-tr-md" : "rounded-tl-md") : ""}`}
                      >
                        {!mine && !sameAuthorBefore && (
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-800">{message.authorName || "Usuario eliminado"}</span>
                            {["administrador", "tesorero"].includes(message.authorRole) && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                message.authorRole === "administrador"
                                  ? "bg-indigo-100 text-indigo-950"
                                  : "bg-cyan-100 text-cyan-950"
                              }`}>
                                {getRoleLabel(message.authorRole)}
                              </span>
                            )}
                          </div>
                        )}
                        {message.replyTo && (
                          <button
                            type="button"
                            onClick={() => repliedMessage && jumpToMessage(repliedMessage.id)}
                            className={`mb-2 block w-full min-w-0 border-l-2 px-2 py-1 text-left ${
                              mine ? "border-emerald-200 bg-emerald-900/40 text-emerald-50" : "border-emerald-600 bg-slate-50 text-slate-700"
                            }`}
                            aria-label="Ir al mensaje citado"
                          >
                            <span className="block truncate text-[10px] font-semibold">
                              {message.replyAuthorName || repliedMessage?.authorName || "Mensaje"}
                            </span>
                            <span className="block truncate text-xs">
                              {message.replyContent || repliedMessage?.content || "Mensaje eliminado"}
                            </span>
                          </button>
                        )}
                        {message.deleted ? (
                          <p className={`text-sm italic ${mine ? "text-emerald-100" : "text-slate-500"}`}>
                            Mensaje eliminado por moderación
                          </p>
                        ) : (
                          <>
                            {message.type === "imagen" && (
                              <ChatImage
                                path={message.attachmentPath}
                                previewUrl={message.previewUrl}
                                onOpen={openImage}
                              />
                            )}
                            {message.content && message.content !== "Imagen adjunta" && (
                              <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p>
                            )}
                            {message.content === "Imagen adjunta" && message.type === "imagen" && !message.attachmentPath && !message.previewUrl && (
                              <p className="text-sm">Imagen adjunta</p>
                            )}
                          </>
                        )}
                        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-emerald-100" : "text-slate-500"
                        }`}>
                          {message.sendState === "sending" && <Clock3 size={11} aria-label="Enviando" />}
                          {message.sendState === "sent" && mine && <Check size={12} aria-label="Enviado" />}
                          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                        </div>
                        {message.sendState === "error" && (
                          <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-xs text-red-100">
                            <span>{message.error || "No se pudo enviar."}</span>
                            <button type="button" onClick={() => retryMessage(message.localId || message.id)} className="font-bold underline underline-offset-2">
                              Reintentar
                            </button>
                          </div>
                        )}
                      </article>
                      {!message.deleted && message.sendState !== "sending" && (
                        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setReply(message);
                              inputRef.current?.focus();
                            }}
                            aria-label={`Responder a ${message.authorName || "este mensaje"}`}
                            className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Reply size={15} aria-hidden="true" />
                          </button>
                          {canModerate && !message.id.startsWith("local:") && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("¿Eliminar este mensaje? Se conservará como moderado en el historial.")) {
                                  void moderateMessage(message.id).catch(() => {});
                                }
                              }}
                              aria-label="Eliminar mensaje por moderación"
                              className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLatest && (
        <button
          type="button"
          onClick={() => {
            const log = messageLogRef.current;
            if (log) log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
            wasAtBottomRef.current = true;
            setShowLatest(false);
          }}
          className="absolute bottom-24 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50 md:bottom-20 md:right-8"
          aria-label="Ir al último mensaje"
        >
          <ArrowDown size={20} aria-hidden="true" />
        </button>
      )}

      {(error || fileError) && (
        <p role="alert" className="absolute bottom-[calc(6.7rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 mx-auto max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 shadow sm:left-6 sm:right-6">
          {fileError || error}
        </p>
      )}

      <form
        onSubmit={submitMessage}
        style={{ transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined }}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:static md:transform-none md:px-5 md:py-3"
      >
        {reply && (
          <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2">
            <Reply size={16} className="shrink-0 text-emerald-800" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
              Respondiendo a <strong>{reply.authorName || "ti"}</strong>: {reply.content || "Imagen adjunta"}
            </span>
            <button type="button" onClick={() => setReply(null)} aria-label="Cancelar respuesta" className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-white">
              <X size={16} />
            </button>
          </div>
        )}
        {file && (
          <div className="mx-auto mb-2 flex max-w-4xl items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
            <ImagePlus size={16} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <button type="button" onClick={() => setFile(null)} aria-label="Quitar imagen adjunta" className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 outline-none hover:bg-slate-100 focus-within:ring-2 focus-within:ring-emerald-600" aria-label="Adjuntar una imagen">
            <Paperclip size={20} aria-hidden="true" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Escribe un mensaje</span>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setTyping(Boolean(event.target.value.trim()));
              }}
              onBlur={() => setTyping(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={2000}
              rows={1}
              placeholder="Escribe un mensaje"
              className="max-h-28 min-h-11 w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-base leading-5 text-slate-950 outline-none placeholder:text-slate-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            disabled={!draft.trim() && !file}
            aria-label="Enviar mensaje"
            className="chat-send-button flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-white outline-none transition hover:bg-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={19} aria-hidden="true" />
          </button>
        </div>
      </form>

      <AnimatePresence>
        {viewer && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Vista ampliada de imagen"
            onClick={(event) => {
              if (event.target === event.currentTarget) setViewer(null);
            }}
          >
            <button type="button" onClick={() => setViewer(null)} aria-label="Cerrar imagen" className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <X size={22} />
            </button>
            <motion.img
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              src={viewer.url}
              alt="Imagen adjunta ampliada"
              className="max-h-full max-w-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {membersOpen && canMute && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMembersOpen(false);
        }}>
          <form onSubmit={submitMute} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="mute-dialog-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="mute-dialog-title" className="text-lg font-bold text-slate-950">Silenciar integrante</h2>
                <p className="mt-1 text-sm text-slate-600">El silencio se aplica únicamente en este canal.</p>
              </div>
              <button type="button" onClick={() => setMembersOpen(false)} aria-label="Cerrar" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
                <X size={19} />
              </button>
            </div>
            {membersLoading ? (
              <p role="status" className="py-6 text-center text-sm text-slate-600">Cargando integrantes…</p>
            ) : (
              <>
                <label className="mt-5 block text-sm font-medium text-slate-800">
                  Integrante
                  <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
                    <option value="">Selecciona un integrante</option>
                    {members.filter((member) => member.usuario_id !== user?.id).map((member) => (
                      <option key={member.usuario_id} value={member.usuario_id}>
                        {member.nombre} · {                        getRoleLabel(member.rol)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-800">
                  Duración en minutos
                  <input type="number" min="1" max="10080" value={muteMinutes} onChange={(event) => setMuteMinutes(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 text-base" />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-800">
                  Motivo
                  <textarea value={muteReason} onChange={(event) => setMuteReason(event.target.value)} minLength={3} maxLength={500} required rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 p-3 text-base" />
                </label>
              </>
            )}
            {muteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{muteError}</p>}
            <button type="submit" disabled={membersLoading || muting || !selectedMemberId} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {muting ? <LoaderCircle size={17} className="animate-spin" /> : <VolumeX size={17} />}
              Aplicar silencio
            </button>
          </form>
        </div>
      )}
    </section>
  );
};

const Chat = () => {
  const { canalId } = useParams();
  const navigate = useNavigate();
  const { channels, status, error } = useChatUnread();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const loading = status === "connecting" || status === "closed";
  const chatError = error || (status === "offline" ? "Conexión en recuperación. Los chats se actualizarán al reconectar." : "");

  const openChannel = (channelId) => navigate(`/chat/${channelId}`);

  return (
    <>
      {canalId ? (
        <div className="fixed inset-0 z-[70] flex h-[100dvh] min-w-0 overflow-hidden bg-white">
          <div className="hidden min-h-0 md:flex">
            <ChatChannelList
              channels={channels}
              loading={loading}
              error={chatError}
              activeChannelId={canalId}
              onOpen={openChannel}
              search={search}
              onSearch={setSearch}
            />
          </div>
          <ChatConversation
            key={canalId}
            canalId={canalId}
            channels={channels}
          />
        </div>
      ) : (
        <section className="flex min-h-[calc(100dvh-13rem)] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:min-h-[calc(100dvh-12rem)]" aria-label="Chats">
          <ChatChannelList
            channels={channels}
            loading={loading}
            error={chatError}
            activeChannelId={null}
            onOpen={openChannel}
            search={search}
            onSearch={setSearch}
          />
          <div className="hidden min-w-0 flex-1 flex-col items-center justify-center bg-[#f7f8f6] px-8 text-center md:flex">
            <span className="flex size-16 items-center justify-center rounded-full bg-white text-emerald-800 shadow-sm">
              <Users size={27} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Tus conversaciones, en un solo lugar</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">
              Selecciona un canal para conversar con tu grupo o con el equipo.
            </p>
            {profile?.rol && (
              <span className={`role-badge role-badge-${profile.rol}`}>
                Acceso como {getRoleLabel(profile.rol)}
              </span>
            )}
          </div>
        </section>
      )}
    </>
  );
};

export default Chat;
