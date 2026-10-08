import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { NotificationContext } from "./notificationStore";
import NotificationToast from "../components/common/NotificationToast";
import { useAuth } from "./AuthContext";
import { obtenerSolicitudesGrupo } from "../services/grupoService";
import { supabase } from "../services/supabase";

const TOAST_DURATION = 5000;

const toNotification = (row) => ({
  id: row.id,
  title: row.titulo,
  message: row.mensaje,
  type: row.tipo,
  actionPath: row.ruta_accion,
  actionLabel: row.etiqueta_accion,
  createdAt: row.creada_en,
  read: row.leida
});

const NotificationProvider = ({ children }) => {
  const { user, profile, grupos } = useAuth();
  const [notificationState, setNotificationState] = useState({ userId: null, items: [] });
  const [groupRequests, setGroupRequests] = useState([]);
  const [groupRequestsError, setGroupRequestsError] = useState("");
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
        .select("id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, creada_en, leida")
        .eq("usuario_id", user.id)
        .order("creada_en", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Error cargando el historial de notificaciones:", error);
        toast.error("No se pudo cargar el historial de notificaciones.");
        return;
      }

      const loadedNotifications = (data || []).map(toNotification);
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
      .channel(`notificaciones-${user.id}`)
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
            updateNotifications(user.id, (current) => current.some((item) => item.id === notification.id)
              ? current
              : [notification, ...current]);
          } else if (payload.eventType === "UPDATE") {
            const notification = toNotification(payload.new);
            updateNotifications(user.id, (current) => current.map((item) => (
              item.id === notification.id ? notification : item
            )));
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

    if (!user?.id) return null;

    const { data, error } = await supabase
      .from("notificaciones")
      .insert({
        usuario_id: user.id,
        titulo: title,
        mensaje: message,
        tipo: type,
        ruta_accion: actionPath || null,
        etiqueta_accion: actionLabel || null
      })
      .select("id, titulo, mensaje, tipo, ruta_accion, etiqueta_accion, creada_en, leida")
      .single();

    if (error) {
      console.error("Error guardando notificación:", error);
      toast.error("La notificación se mostró, pero no se pudo guardar en el historial.");
      return null;
    }

    const savedNotification = toNotification(data);
    updateNotifications(user.id, (current) => current.some((item) => item.id === savedNotification.id)
      ? current
      : [savedNotification, ...current]);
    return savedNotification.id;
  }, [user, updateNotifications]);

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
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("usuario_id", user.id)
      .eq("leida", false);

    if (error) {
      console.error("Error marcando notificaciones como leídas:", error);
      toast.error("No se pudieron marcar las notificaciones como leídas.");
      return;
    }

    updateNotifications(user.id, (current) => current.map((item) => ({ ...item, read: true })));
  }, [user, updateNotifications]);

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
    const { error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("usuario_id", user.id);

    if (error) {
      console.error("Error limpiando notificaciones:", error);
      toast.error("No se pudo limpiar el historial de notificaciones.");
      return;
    }

    updateNotifications(user.id, () => []);
    toast.dismiss();
  }, [user, updateNotifications]);

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
      console.error("Error actualizando solicitudes de grupo:", error);
      setGroupRequestsError(error.message || "No se pudieron consultar las solicitudes pendientes.");
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
