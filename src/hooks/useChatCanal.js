import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useChatUnread } from "../context/chatUnreadStore";
import {
  eliminarMensajeChat,
  establecerEscribiendoChat,
  listarEscribiendoChat,
  listarMensajesChat,
  marcarCanalChatLeido,
  enviarMensajeChat
} from "../services/chatService";
import { supabase } from "../services/supabase";
import { createUniqueId } from "../utils/uniqueId";
import { logOperationalError } from "../utils/logOperationalError";

const PAGE_SIZE = 30;
const REALTIME_REFRESH_DELAY = 120;
const TYPING_TIMEOUT = 1400;
const TYPING_REFRESH_INTERVAL = 2500;

const normalizeMessage = (message) => ({
  id: message.id,
  channelId: message.canal_id,
  authorId: message.autor_id,
  authorName: message.autor_nombre,
  authorRole: message.autor_rol,
  content: message.contenido,
  type: message.tipo,
  attachmentPath: message.adjunto_path,
  replyTo: message.responde_a,
  replyContent: message.respuesta_contenido,
  replyAuthorName: message.respuesta_autor_nombre,
  deleted: message.eliminado,
  deletedBy: message.eliminado_por,
  createdAt: message.creado_en,
  sendState: "sent"
});

const mergeMessages = (current, incoming, currentUserId) => {
  const merged = new Map(current.map((message) => [message.id, message]));

  for (const row of incoming) {
    let serverMessage = normalizeMessage(row);
    const optimistic = [...merged.values()].find((message) => (
      message.id.startsWith("local:")
      && message.authorId === currentUserId
      && message.content === serverMessage.content
      && message.replyTo === serverMessage.replyTo
      && message.type === serverMessage.type
      && Math.abs(new Date(message.createdAt).getTime() - new Date(serverMessage.createdAt).getTime()) < 10000
    ));

    if (optimistic) {
      serverMessage = {
        ...serverMessage,
        localId: optimistic.localId || optimistic.id,
        previewUrl: optimistic.previewUrl
      };
      merged.delete(optimistic.id);
    }
    merged.set(serverMessage.id, serverMessage);
  }

  const incomingIds = new Set(incoming.map((message) => message.id));
  const optimisticMessages = [...merged.values()].filter((message) => (
    message.id.startsWith("local:")
    && !incomingIds.has(message.id)
  ));
  return [...merged.values()]
    .filter((message) => !message.id.startsWith("local:"))
    .concat(optimisticMessages)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
};

const errorText = (error) => (
  error?.name === "FileUploadError"
    ? error.message
    : error?.message || "No se pudo completar la operación. Inténtalo nuevamente."
);

export const useChatCanal = (canalId) => {
  const { user, profile } = useAuth();
  const { channels, refresh: refreshChannels } = useChatUnread();
  const channel = useMemo(
    () => channels.find((item) => item.canal_id === canalId) || null,
    [canalId, channels]
  );
  const [messageState, setMessageState] = useState({
    channelId: canalId,
    messages: [],
    loading: true,
    loadingOlder: false,
    hasMore: true,
    error: "",
    realtimeStatus: "connecting",
    typingCount: 0
  });
  const [initialUnreadCount, setInitialUnreadCount] = useState(() => Number(channel?.no_leidos || 0));
  const pendingPayloadsRef = useRef(new Map());
  const previewUrlsRef = useRef(new Set());
  const realtimeRefreshTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);
  const typingActiveRef = useRef(false);
  const loadLatestRef = useRef(null);

  const updateMessages = useCallback((update) => {
    setMessageState((current) => {
      if (current.channelId !== canalId) return current;
      return { ...current, messages: update(current.messages) };
    });
  }, [canalId]);

  const loadLatest = useCallback(async () => {
    const rows = await listarMensajesChat(canalId, null, PAGE_SIZE);
    const orderedRows = rows.slice().reverse();
    updateMessages((current) => mergeMessages(current, orderedRows, user?.id));
    setMessageState((current) => current.channelId === canalId
      ? { ...current, loading: false, error: "", hasMore: rows.length === PAGE_SIZE }
      : current);
    return orderedRows;
  }, [canalId, updateMessages, user?.id]);

  loadLatestRef.current = loadLatest;

  useEffect(() => {
    if (!canalId || !user?.id) return undefined;
    let active = true;
    const pendingPayloads = pendingPayloadsRef.current;
    const previewUrls = previewUrlsRef.current;
    const rowsChannel = supabase
      .channel(`chat-messages-${canalId}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chat_mensajes",
        filter: `canal_id=eq.${canalId}`
      }, (payload) => {
        if (!active) return;
        if (payload.eventType === "UPDATE" && payload.new?.eliminado) {
          updateMessages((current) => current.map((message) => (
            message.id === payload.new.id
              ? {
                ...message,
                deleted: true,
                content: "Mensaje eliminado por moderación",
                attachmentPath: null,
                previewUrl: null
              }
              : message
          )));
        }
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = window.setTimeout(async () => {
          if (!active) return;
          try {
            await loadLatestRef.current?.();
            if (payload.eventType === "INSERT") {
              await marcarCanalChatLeido(canalId);
              await refreshChannels();
            }
          } catch (error) {
            logOperationalError("No se pudo actualizar la conversación en tiempo real:", error);
            setMessageState((current) => current.channelId === canalId
              ? { ...current, error: "No se pudo actualizar la conversación. Intenta reconectar." }
              : current);
          }
        }, REALTIME_REFRESH_DELAY);
      })
      .subscribe((status, subscriptionError) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setMessageState((current) => current.channelId === canalId
            ? { ...current, realtimeStatus: "active" }
            : current);
          void loadLatestRef.current?.().catch((error) => {
            logOperationalError("No se pudo recuperar el historial del chat:", error);
            setMessageState((current) => current.channelId === canalId
              ? { ...current, loading: false, error: "No se pudo cargar la conversación." }
              : current);
          });
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setMessageState((current) => current.channelId === canalId
            ? { ...current, realtimeStatus: "offline" }
            : current);
          if (subscriptionError) {
            logOperationalError("Se perdió la actualización Realtime de la conversación:", subscriptionError);
          }
        }
      });

    const refreshTyping = async () => {
      try {
        const typers = await listarEscribiendoChat(canalId);
        if (active) {
          setMessageState((current) => current.channelId === canalId
            ? { ...current, typingCount: typers.length }
            : current);
        }
      } catch (error) {
        logOperationalError("No se pudo actualizar el estado de escritura:", error);
      }
    };

    const typingChannel = supabase
      .channel(`chat-typing-${canalId}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chat_escribiendo",
        filter: `canal_id=eq.${canalId}`
      }, () => {
        if (active) void refreshTyping();
      })
      .subscribe((status, subscriptionError) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          void refreshTyping();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && subscriptionError) {
          logOperationalError("No se pudo conectar la actualización de escritura:", subscriptionError);
        }
      });
    typingChannelRef.current = typingChannel;
    const typingRefreshInterval = window.setInterval(() => {
      if (active) void refreshTyping();
    }, TYPING_REFRESH_INTERVAL);

    setMessageState({
      channelId: canalId,
      messages: [],
      loading: true,
      loadingOlder: false,
      hasMore: true,
      error: "",
      realtimeStatus: "connecting",
      typingCount: 0
    });

    const loadInitial = async () => {
      try {
        await loadLatestRef.current?.();
        if (active) {
          const currentChannels = await refreshChannels();
          const currentChannel = currentChannels?.find((item) => item.canal_id === canalId);
          if (currentChannel) setInitialUnreadCount(Number(currentChannel.no_leidos || 0));
          await marcarCanalChatLeido(canalId);
          await refreshChannels();
        }
      } catch (error) {
        logOperationalError("No se pudo cargar el chat:", error);
        if (active) {
          setMessageState((current) => current.channelId === canalId
            ? { ...current, loading: false, error: errorText(error) }
            : current);
        }
      }
    };

    void loadInitial();
    return () => {
      active = false;
      window.clearTimeout(realtimeRefreshTimeoutRef.current);
      window.clearTimeout(typingTimeoutRef.current);
      window.clearInterval(typingRefreshInterval);
      for (const previewUrl of previewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.clear();
      pendingPayloads.clear();
      if (typingActiveRef.current) {
        void establecerEscribiendoChat(canalId, false).catch((error) => {
          logOperationalError("No se pudo limpiar el estado de escritura:", error);
        });
      }
      typingActiveRef.current = false;
      typingChannelRef.current = null;
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(rowsChannel);
    };
  }, [canalId, refreshChannels, updateMessages, user?.id]);

  const loadOlder = useCallback(async () => {
    if (!messageState.hasMore || messageState.loadingOlder) return;
    const oldest = messageState.messages.find((message) => !message.id.startsWith("local:"));
    if (!oldest) return;

    setMessageState((current) => ({ ...current, loadingOlder: true, error: "" }));
    try {
      const rows = await listarMensajesChat(
        canalId,
        oldest.createdAt,
        PAGE_SIZE,
        oldest.id
      );
      updateMessages((current) => mergeMessages(current, rows.slice().reverse(), user?.id));
      setMessageState((current) => current.channelId === canalId
        ? { ...current, hasMore: rows.length === PAGE_SIZE, loadingOlder: false }
        : current);
    } catch (error) {
      logOperationalError("No se pudieron cargar mensajes anteriores:", error);
      setMessageState((current) => current.channelId === canalId
        ? {
          ...current,
          loadingOlder: false,
          error: "No se pudieron cargar mensajes anteriores. Inténtalo nuevamente."
        }
        : current);
    }
  }, [
    canalId,
    messageState.hasMore,
    messageState.loadingOlder,
    messageState.messages,
    updateMessages,
    user?.id
  ]);

  const sendMessage = useCallback(async ({ content, replyTo = null, file = null }) => {
    const localId = `local:${createUniqueId()}`;
    const messageContent = content.trim() || (file ? "Imagen adjunta" : "");
    const previewUrl = file ? URL.createObjectURL(file) : null;
    if (previewUrl) previewUrlsRef.current.add(previewUrl);
    const optimisticMessage = {
      id: localId,
      localId,
      channelId: canalId,
      authorId: user?.id,
      authorName: "Tú",
      authorRole: profile?.rol || "socio",
      content: messageContent,
      type: file ? "imagen" : "texto",
      attachmentPath: null,
      previewUrl,
      replyTo,
      replyContent: null,
      replyAuthorName: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      sendState: "sending"
    };
    pendingPayloadsRef.current.set(localId, { content: messageContent, replyTo, file });
    updateMessages((current) => [...current, optimisticMessage]);

    try {
      const sent = await enviarMensajeChat({
        canalId,
        contenido: messageContent,
        respondeA: replyTo,
        archivo: file
      });
      pendingPayloadsRef.current.delete(localId);
      updateMessages((current) => current.map((message) => (
        message.id === localId
          ? {
            ...message,
            id: sent.id,
            attachmentPath: sent.adjuntoPath,
            sendState: "sent"
          }
          : message
      )));
      void loadLatestRef.current?.();
      return sent.id;
    } catch (error) {
      logOperationalError("No se pudo enviar el mensaje del chat:", error);
      updateMessages((current) => current.map((message) => (
        message.id === localId ? { ...message, sendState: "error", error: errorText(error) } : message
      )));
      return null;
    }
  }, [canalId, profile?.rol, updateMessages, user?.id]);

  const retryMessage = useCallback(async (localId) => {
    const pending = pendingPayloadsRef.current.get(localId);
    if (!pending) return;

    updateMessages((current) => current.map((message) => (
      message.id === localId ? { ...message, sendState: "sending", error: "" } : message
    )));

    try {
      const sent = await enviarMensajeChat({
        canalId,
        contenido: pending.content,
        respondeA: pending.replyTo,
        archivo: pending.file
      });
      pendingPayloadsRef.current.delete(localId);
      updateMessages((current) => current.map((message) => (
        message.id === localId
          ? { ...message, id: sent.id, attachmentPath: sent.adjuntoPath, sendState: "sent" }
          : message
      )));
      void loadLatestRef.current?.();
    } catch (error) {
      logOperationalError("No se pudo reintentar el mensaje del chat:", error);
      updateMessages((current) => current.map((message) => (
        message.id === localId ? { ...message, sendState: "error", error: errorText(error) } : message
      )));
    }
  }, [canalId, updateMessages]);

  const moderateMessage = useCallback(async (messageId) => {
    try {
      await eliminarMensajeChat(messageId);
      await loadLatestRef.current?.();
    } catch (error) {
      logOperationalError("No se pudo moderar el mensaje:", error);
      setMessageState((current) => ({ ...current, error: errorText(error) }));
      throw error;
    }
  }, []);

  const setTyping = useCallback((typing) => {
    if (!canalId || !user?.id) return;

    window.clearTimeout(typingTimeoutRef.current);
    if (typing && !typingActiveRef.current) {
      typingActiveRef.current = true;
      void establecerEscribiendoChat(canalId, true).catch((error) => {
        typingActiveRef.current = false;
        logOperationalError("No se pudo publicar el estado de escritura:", error);
      });
    }
    if (!typing) {
      typingActiveRef.current = false;
      void establecerEscribiendoChat(canalId, false).catch((error) => {
        logOperationalError("No se pudo borrar el estado de escritura:", error);
      });
      return;
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      typingActiveRef.current = false;
      void establecerEscribiendoChat(canalId, false).catch((error) => {
        logOperationalError("No se pudo borrar el estado de escritura:", error);
      });
    }, TYPING_TIMEOUT);
  }, [canalId, user?.id]);

  const messages = messageState.channelId === canalId ? messageState.messages : [];

  return {
    channel,
    messages,
    loading: messageState.channelId === canalId ? messageState.loading : true,
    loadingOlder: messageState.loadingOlder,
    hasMore: messageState.hasMore,
    error: messageState.error,
    realtimeStatus: messageState.realtimeStatus,
    typingCount: messageState.typingCount,
    initialUnreadCount,
    loadOlder,
    sendMessage,
    retryMessage,
    moderateMessage,
    setTyping
  };
};
