import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { NotificationContext } from "./notificationStore";
import NotificationToast from "../components/common/NotificationToast";

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
  const [notifications, setNotifications] = useState(readNotifications);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const notify = useCallback(({ title, message, type = "info" }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const notification = {
      id,
      title,
      message,
      type,
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

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((item) => !item.read).length,
    notify,
    markAllRead,
    clearNotifications
  }), [notifications, notify, markAllRead, clearNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster position="bottom-right" gutter={10} />
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;