import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";

import NotificationToast from "../components/common/NotificationToast";
import { useAuth } from "./AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { ChatUnreadContext } from "./chatUnreadStore";
import { listarCanalesChat, marcarCanalChatLeido } from "../services/chatService";
import { supabase } from "../services/supabase";
import { createUniqueId } from "../utils/uniqueId";
import { logOperationalError } from "../utils/logOperationalError";

const CHAT_REFRESH_DELAY = 250;
const CHAT_TOAST_GROUP_DELAY = 700;
const CHAT_TOAST_DURATION = 5000;

const getOpenChannelId = (pathname) => {
  const match = pathname.match(/^\/chat\/([^/]+)\/?$/);
  return match?.[1] || null;
};

export const ChatUnreadProvider = ({ children }) => {
  const { user } = useAuth();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { pathname } = useLocation();
  const userId = user?.id;
  const pathnameRef = useRef(pathname);
  const channelsRef = useRef([]);
  const seenMessageIdsRef = useRef(new Set());
  const pendingToastsRef = useRef(new Map());
  const [channelState, setChannelState] = useState({
    userId: null,
    channels: [],
    status: "connecting",
    error: ""
  });

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refresh = useCallback(async () => {
    if (!userId) {
      channelsRef.current = [];
      return [];
    }

    try {
      const channels = await listarCanalesChat();
      channelsRef.current = channels;
      setChannelState({
        userId,
        channels,
        status: "active",
        error: ""
      });
      return channels;
    } catch (error) {
      logOperationalError("No se pudieron cargar los canales del chat:", error);
      setChannelState((current) => ({
        ...current,
        userId,
        status: "error",
        error: "No se pudieron actualizar los chats. Revisa tu conexión e inténtalo nuevamente."
      }));
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      channelsRef.current = [];
      return undefined;
    }

    let active = true;
    let refreshTimeoutId;
    let refreshIntervalId;
    const pending = pendingToastsRef.current;
    const seenIds = seenMessageIdsRef.current;

    const queueRefresh = () => {
      window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = window.setTimeout(() => {
        if (active) void refresh();
      }, CHAT_REFRESH_DELAY);
    };

    const channel = supabase
      .channel(`chat-unread-${userId}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_mensajes"
      }, (payload) => {
        if (!active) return;
        const message = payload.new;
        if (!message?.id || seenIds.has(message.id)) return;
        seenIds.add(message.id);
        if (seenIds.size > 500) seenIds.delete(seenIds.values().next().value);

        const openChannelId = getOpenChannelId(pathnameRef.current);
        if (message.autor_id !== userId && message.canal_id !== openChannelId) {
          const targetChannel = channelsRef.current.find((item) => item.canal_id === message.canal_id);
          if (targetChannel) {
            const existing = pending.get(message.canal_id);
            if (existing) window.clearTimeout(existing.timeoutId);
            const count = (existing?.count || 0) + 1;
            const name = targetChannel.nombre;
            const timeoutId = window.setTimeout(() => {
              pending.delete(message.canal_id);
              toast.custom((toastItem) => (
                <NotificationToast
                  notification={{
                    title: `${count} ${count === 1 ? "mensaje nuevo" : "mensajes nuevos"} en ${name}`,
                    message: "Abre el chat para leer la conversación.",
                    type: "info"
                  }}
                  visible={toastItem.visible}
                  onDismiss={() => toast.dismiss(toastItem.id)}
                />
              ), { duration: CHAT_TOAST_DURATION, id: `chat-message-${message.canal_id}` });
            }, CHAT_TOAST_GROUP_DELAY);
            pending.set(message.canal_id, { count, timeoutId });
          }
        }

        queueRefresh();
      })
      .subscribe((status, subscriptionError) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setChannelState((current) => ({ ...current, status: "active" }));
          void refresh();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setChannelState((current) => ({ ...current, status: "offline" }));
          if (subscriptionError) {
            logOperationalError("Se perdió la actualización Realtime de los chats:", subscriptionError);
          }
        }
      });

    refreshIntervalId = window.setInterval(() => {
      if (active) void refresh();
    }, 30000);

    return () => {
      active = false;
      window.clearTimeout(refreshTimeoutId);
      window.clearInterval(refreshIntervalId);
      for (const item of pending.values()) window.clearTimeout(item.timeoutId);
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  const channels = useMemo(
    () => (channelState.userId === userId ? channelState.channels : []),
    [channelState.channels, channelState.userId, userId]
  );
  const status = userId ? channelState.status : "closed";
  const error = userId ? channelState.error : "";
  const chatNotifications = useMemo(() => channels
    .filter((channel) => Number(channel.no_leidos) > 0)
    .map((channel) => ({
      id: `chat-${channel.canal_id}`,
      channelId: channel.canal_id,
      category: "chat_message",
      title: `${channel.no_leidos} ${Number(channel.no_leidos) === 1 ? "mensaje nuevo" : "mensajes nuevos"} en ${channel.nombre}`,
      message: channel.ultimo_mensaje || "Abre el chat para leer la conversación.",
      createdAt: channel.ultima_hora,
      read: false,
      actionPath: `/chat/${channel.canal_id}`
    })), [channels]);
  const chatUnreadCount = channels.reduce((total, channel) => total + Number(channel.no_leidos || 0), 0);

  const markRead = useCallback(async (channelId) => {
    try {
      await marcarCanalChatLeido(channelId);
      await refresh();
    } catch (error) {
      logOperationalError("No se pudo marcar el canal del chat como leído:", error);
      throw error;
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const unreadChannels = channels.filter((channel) => Number(channel.no_leidos) > 0);
    try {
      await Promise.all(unreadChannels.map((channel) => marcarCanalChatLeido(channel.canal_id)));
      await refresh();
    } catch (error) {
      logOperationalError("No se pudieron marcar todos los chats como leídos:", error);
      throw error;
    }
  }, [channels, refresh]);

  const value = useMemo(() => ({
    channels,
    chatNotifications,
    unreadCount: chatUnreadCount,
    status,
    error,
    refresh,
    markRead,
    markAllRead
  }), [
    channels,
    chatNotifications,
    chatUnreadCount,
    status,
    error,
    refresh,
    markRead,
    markAllRead
  ]);

  useEffect(() => {
    const currentTitle = document.title.replace(/^\(\d+\)\s*/, "");
    const total = notificationUnreadCount + chatUnreadCount;
    document.title = total > 0 ? `(${total}) ${currentTitle}` : currentTitle;
    return () => {
      document.title = currentTitle;
    };
  }, [chatUnreadCount, notificationUnreadCount]);

  return (
    <ChatUnreadContext.Provider value={value}>
      {children}
    </ChatUnreadContext.Provider>
  );
};
