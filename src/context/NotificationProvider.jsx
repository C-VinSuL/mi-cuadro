import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  getNotificationType,
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
  const [notificationState, setNotificationState] = useState({ userId: null, items: [] });
  const [groupRequests, setGroupRequests] = useState([]);
  const [groupRequestsError, setGroupRequestsError] = useState("");
  const realtimeNotificationIdsRef = useRef(new Map());
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
            const now = Date.now();
            for (const [id, seenAt] of realtimeNotificationIdsRef.current) {
              if (now - seenAt > TOAST_DURATION) realtimeNotificationIdsRef.current.delete(id);
            }
            if (realtimeNotificationIdsRef.current.has(notification.id)) return;
            realtimeNotificationIdsRef.current.set(notification.id, now);

            updateNotifications(user.id, (current) => current.some((item) => item.id === notification.id)
              ? current
              : [notification, ...current]);

            toast.custom((toastItem) => (
              <NotificationToast
                notification={notification}
                visible={toastItem.visible}
                onDismiss={() => toast.dismiss(toastItem.id)}
              />
            ), { duration: TOAST_DURATION, id: `notification-${notification.id}` });
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
