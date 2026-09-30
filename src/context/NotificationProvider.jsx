import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { NotificationContext } from "./notificationStore";
import NotificationToast from "../components/common/NotificationToast";
import { useAuth } from "./AuthContext";
import { obtenerSolicitudesGrupo } from "../services/grupoService";

const STORAGE_KEY = "mi-cuadro-notifications";
const TOAST_DURATION = 5000;

const readNotifications = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const NotificationProvider = ({ children }) => {
  const { user, profile, grupos } = useAuth();
  const [notifications, setNotifications] = useState(readNotifications);
  const [groupRequests, setGroupRequests] = useState([]);
  const [groupRequestsError, setGroupRequestsError] = useState("");

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const notify = useCallback(({ title, message, type = "info", actionPath, actionLabel }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const notification = {
      id,
      title,
      message,
      type,
      actionPath,
      actionLabel,
      createdAt: new Date().toISOString(),
      read: false
    };

    setNotifications((current) => [notification, ...current].slice(0, 40));
    toast.custom((toastItem) => (
      <NotificationToast
        notification={notification}
        visible={toastItem.visible}
        onDismiss={() => toast.dismiss(toastItem.id)}
      />
    ), { duration: TOAST_DURATION, id });
    return id;
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    toast.dismiss();
  }, []);

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

      const seenKey = `mi-cuadro-solicitudes-notificadas-${user.id}`;
      let seen = new Set();
      try {
        seen = new Set(JSON.parse(window.sessionStorage.getItem(seenKey) || "[]"));
      } catch {
        seen = new Set();
      }

      const currentKeys = requests.map((request) => `${request.id}:${request.creada_en}`);
      requests.forEach((request, index) => {
        const requestKey = currentKeys[index];
        if (seen.has(requestKey)) return;
        const memberName = [request.nombre, request.apellido].filter(Boolean).join(" ") || "Un socio";
        notify({
          title: "Nueva solicitud de acceso",
          message: `${memberName} solicita unirse a ${request.grupo_nombre}.`,
          type: "info",
          actionPath: "/grupo",
          actionLabel: "Revisar solicitud"
        });
        seen.add(requestKey);
      });
      window.sessionStorage.setItem(seenKey, JSON.stringify([...seen].slice(-200)));
      return requests;
    } catch (error) {
      console.error("Error actualizando solicitudes de grupo:", error);
      setGroupRequestsError(error.message || "No se pudieron consultar las solicitudes pendientes.");
      return null;
    }
  }, [user, profile, grupos, notify]);

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
    markAllRead,
    clearNotifications,
    refreshGroupRequests
  }), [notifications, groupRequests, groupRequestsError, notify, markAllRead, clearNotifications, refreshGroupRequests]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" gutter={10} />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;