import { createContext } from "react";

export const NOTIFICATION_TYPES = Object.freeze({
  CHAT_MESSAGE: "chat_message",
  GROUP_ACCESS_REQUEST: "group_access_request",
  CONTRIBUTION_RECEIPT: "contribution_receipt",
  WALLET_REQUEST: "wallet_request",
  SUPPORT_CONVERSATION: "support_conversation",
  DOCUMENT_VERIFICATION: "document_verification"
});

export const ALLOWED_NOTIFICATION_TYPES = Object.freeze(Object.values(NOTIFICATION_TYPES));

export const getNotificationType = (notification) => {
  const source = typeof notification?.source === "string"
    ? notification.source
    : typeof notification?.fuente === "string"
      ? notification.fuente
      : "";

  if (source.startsWith("chat-mensaje:")) return NOTIFICATION_TYPES.CHAT_MESSAGE;
  if (
    (source.startsWith("solicitud-grupo:") && source.includes(":pendiente:"))
    || source.startsWith("invitacion-grupo:")
  ) {
    return NOTIFICATION_TYPES.GROUP_ACCESS_REQUEST;
  }
  if (source.startsWith("aporte-pendiente:")) return NOTIFICATION_TYPES.CONTRIBUTION_RECEIPT;
  if (
    source.startsWith("billetera-pendiente:")
    || /^solicitud-billetera:[^:]+:pendiente$/.test(source)
  ) {
    return NOTIFICATION_TYPES.WALLET_REQUEST;
  }
  if (source.startsWith("moki-conversacion:")) return NOTIFICATION_TYPES.SUPPORT_CONVERSATION;
  if (source.startsWith("documento-por-verificar:")) return NOTIFICATION_TYPES.DOCUMENT_VERIFICATION;

  return null;
};

export const isAllowedNotification = (notification) => (
  ALLOWED_NOTIFICATION_TYPES.includes(getNotificationType(notification))
);

export const NotificationContext = createContext(null);