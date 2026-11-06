import { createContext, useContext } from "react";

export const ChatUnreadContext = createContext(null);

export const useChatUnread = () => {
  const context = useContext(ChatUnreadContext);
  if (!context) throw new Error("useChatUnread debe usarse dentro de ChatUnreadProvider");
  return context;
};
