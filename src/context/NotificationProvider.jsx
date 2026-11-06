import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  getNotificationType,
  isIncomingSocioMessage,
  isAllowedNotification,
  NotificationContext
} from "./notificationStore";
import NotificationToast from "../components/common/NotificationToast";
import { createUniqueId } from "../utils/uniqueId";
import { useAuth } from "./AuthContext";
import { obtenerSolicitudesGrupo } from "../services/grupoService";
import { supabase } from "../services/supabase";
import { logOperationalError } from "../utils/logOperationalError";

const TOAST_DURATION = 5000;

const toNotification = (row) => ({
  id: row.id,
  title: row.titulo,
  message: row.mensaje,
  type: row.tipo,
  actionPath: row.ruta_accion,
  actionLabel: row.etiqueta_accion,
  createdAt: row.creada_en,
  read: row.leida,
  source: row.fuente,
  category: getNotificationType({ source: row.fuente })
});

const NotificationProvider = ({ children }) => {
  const { user, profile, grupos } = useAuth();
  const navigate = useNavigate();
  const [notificationState, setNotificationState] = useState({ userId: null, items: [] });
  const [groupRequests, setGroupRequests] = useState([]);
  const [groupRequestsError, setGroupRequestsError] = useState("");
  const messageAudioContextRef = useRef(null);
  const seenSupportMessageIdsRef = useRef(new Set());
  const notifications = useMemo(
    () => notificationState.userId === user?.id ? notificationState.items : [],
    [notificationState, user?.id]
  );

  const updateNotifications = useCallback((userId, update) => {
    setNotificationState((current) => ({
      userId,
      items: update(current.userId === userId ? current.items : [])
    }));
  }, []);

  const playIncomingMessageSound = useCallback(() => {
    const audioContext = messageAudioContextRef.current;
    if (!audioContext || audioContext.state !== "running") return;

    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, startAt);
      oscillator.frequency.setValueAtTime(660, startAt + 0.12);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.31);
    } catch (error) {
      logOperationalError("No se pudo reproducir el sonido de mensaje nuevo:", error);
    }
  }, []);

  useEffect(() => {
    const enableMessageSound = () => {
      if (!window.AudioContext || messageAudioContextRef.current) return;

      try {
        const audioContext = new window.AudioContext();
        messageAudioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          void audioContext.resume().catch((error) => {
            logOperationalError("No se pudo habilitar el sonido de mensajes:", error);
          });
        }
      } catch (error) {
        logOperationalError("No se pudo preparar el sonido de mensajes:", error);
      }
    };

    window.addEventListener("pointerdown", enableMessageSound, { once: true });
    window.addEventListener("keydown", enableMessageSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enableMessageSound);
      window.removeEventListener("keydown", enableMessageSound);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from("notificaciones")
        .select("id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, creada_en, leida, fuente")
        .eq("usuario_id", user.id)
        .order("creada_en", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Error cargando el historial de notificaciones:", error);
        toast.error("No se pudo cargar el historial de notificaciones.");
        return;
      }

      const loadedNotifications = (data || []).map(toNotification).filter(isAllowedNotification);
      updateNotifications(user.id, (current) => {
        const loadedIds = new Set(loadedNotifications.map((item) => item.id));
        return [
          ...current.filter((item) => !loadedIds.has(item.id)),
          ...loadedNotifications
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
    };

    loadNotifications();

    const channel = supabase
      .channel(`notificaciones-${user.id}-${createUniqueId()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${user.id}`
        },
        (payload) => {
          if (!active) return;
          if (payload.eventType === "INSERT") {
            const notification = toNotification(payload.new);
            if (!isAllowedNotification(notification)) return;

            updateNotifications(user.id, (current) => current.some((item) => item.id === notification.id)
              ? current
              : [notification, ...current]);
          } else if (payload.eventType === "UPDATE") {
            const notification = toNotification(payload.new);
            updateNotifications(user.id, (current) => isAllowedNotification(notification)
              ? current.map((item) => item.id === notification.id ? notification : item)
              : current.filter((item) => item.id !== notification.id));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, updateNotifications]);

  useEffect(() => {
    if (!user?.id || profile?.rol?.toLowerCase() !== "administrador") {
      return undefined;
    }

    let active = true;
    const seenMessageIds = seenSupportMessageIdsRef.current;
    const channel = supabase
      .channel(`moki-incoming-messages-${user.id}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "moki_mensajes"
      }, (payload) => {
        if (!active) return;
        const message = payload.new;
        if (!isIncomingSocioMessage(message, profile?.rol)) return;
        if (!message?.id || seenMessageIds.has(message.id)) return;

        seenMessageIds.add(message.id);
        if (seenMessageIds.size > 500) {
          seenMessageIds.delete(seenMessageIds.values().next().value);
        }

        const content = typeof message.contenido === "string" ? message.contenido.trim() : "";
        const notification = {
          title: "Nuevo mensaje de socio",
          message: content ? content.slice(0, 160) : "El socio envió un mensaje.",
          type: "info",
          actionPath: "/atencion-socios",
          actionLabel: "Abrir Atención a socios"
        };

        toast.custom((toastItem) => (
          <NotificationToast
            notification={notification}
            visible={toastItem.visible}
            onDismiss={() => toast.dismiss(toastItem.id)}
            onAction={() => {
              toast.dismiss(toastItem.id);
              navigate(notification.actionPath);
            }}
          />
        ), { duration: 8000, id: `moki-message-${message.id}` });
        playIncomingMessageSound();
      })
      .subscribe((status, subscriptionError) => {
        if (!active || !["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) return;
        if (subscriptionError) {
          logOperationalError("Se perdió la actualización Realtime de los mensajes de socios:", subscriptionError);
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [navigate, playIncomingMessageSound, profile?.rol, user?.id]);

  const notify = useCallback(async ({
    title,
    message,
    type = "info",
    actionPath,
    actionLabel
  }) => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const notification = {
      title,
      message,
      type,
      actionPath,
      actionLabel,
      createdAt: new Date().toISOString(),
      read: false
    };

    toast.custom((toastItem) => (
      <NotificationToast
        notification={notification}
        visible={toastItem.visible}
        onDismiss={() => toast.dismiss(toastItem.id)}
      />
    ), { duration: TOAST_DURATION, id: toastId });

  }, []);

  const markRead = useCallback(async (notificationId) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("id", notificationId)
      .eq("usuario_id", user.id);

    if (error) {
      console.error("Error marcando notificación como leída:", error);
      toast.error("No se pudo actualizar la notificación.");
      return;
    }

    updateNotifications(user.id, (current) => current.map((item) => (
      item.id === notificationId ? { ...item, read: true } : item
    )));
  }, [user, updateNotifications]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_id", user.id)
      .in("id", unreadIds);

    if (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      toast.error("No se pudieron marcar las notificaciones como leídas.");
      return;
    }

    updateNotifications(user.id, (current) => current.map((item) => (
      unreadIds.includes(item.id) ? { ...item, read: true } : item
    )));
  }, [notifications, user, updateNotifications]);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("id", notificationId)
      .eq("usuario_id", user.id);

    if (error) {
      console.error("Error eliminando notificación:", error);
      toast.error("No se pudo eliminar la notificación.");
      return;
    }

    updateNotifications(user.id, (current) => current.filter((item) => item.id !== notificationId));
  }, [user, updateNotifications]);

  const clearNotifications = useCallback(async () => {
    if (!user?.id) return;
    const visibleIds = notifications.map((item) => item.id);
    if (visibleIds.length === 0) return;

    const { error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("usuario_id", user.id)
      .in("id", visibleIds);

    if (error) {
      console.error("Error limpiando notificaciones:", error);
      toast.error("No se pudo limpiar el historial de notificaciones.");
      return;
    }

    updateNotifications(user.id, () => []);
    toast.dismiss();
  }, [notifications, user, updateNotifications]);

  const refreshGroupRequests = useCallback(async () => {
    const role = profile?.rol?.toLowerCase();
    if (!user?.id || !["administrador", "tesorero"].includes(role)) {
      setGroupRequests([]);
      setGroupRequestsError("");
      return [];
    }

    try {
      const requestLists = await Promise.all(
        grupos.map(async (group) => {
          const rows = await obtenerSolicitudesGrupo(group.id);
          return rows.map((request) => ({
            ...request,
            grupo_id: group.id,
            grupo_nombre: group.nombre
          }));
        })
      );
      const requests = requestLists.flat();
      setGroupRequests(requests);
      setGroupRequestsError("");
      return requests;
    } catch (error) {
      logOperationalError("Error actualizando solicitudes de grupo:", error);
      setGroupRequestsError("No se pudieron consultar las solicitudes pendientes. Inténtalo nuevamente.");
      return null;
    }
  }, [user, profile, grupos]);

  useEffect(() => {
    if (!user?.id || !["administrador", "tesorero"].includes(profile?.rol?.toLowerCase())) {
      return undefined;
    }

    let active = true;
    const checkRequests = async () => {
      if (active) await refreshGroupRequests();
    };

    checkRequests();
    const intervalId = window.setInterval(checkRequests, 20000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id, profile?.rol, refreshGroupRequests]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    groupRequests,
    groupRequestsError,
    notify,
    markRead,
    markAllRead,
    deleteNotification,
    clearNotifications,
    refreshGroupRequests
  }), [
    notifications,
    groupRequests,
    groupRequestsError,
    notify,
    markRead,
    markAllRead,
    deleteNotification,
    clearNotifications,
    refreshGroupRequests
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" gutter={10} />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
