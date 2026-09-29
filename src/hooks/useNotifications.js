import { useContext } from "react";
import { NotificationContext } from "../context/notificationStore";

export const useNotifications = () => useContext(NotificationContext);