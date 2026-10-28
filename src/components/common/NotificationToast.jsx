import { useRef } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const styles = {
  success: { icon: CircleCheck, accent: "text-emerald-700", bar: "bg-emerald-600" },
  error: { icon: CircleAlert, accent: "text-red-700", bar: "bg-red-600" },
  info: { icon: Info, accent: "text-blue-700", bar: "bg-blue-600" }
};

const NotificationToast = ({ notification, visible, onDismiss }) => {
  const touchStart = useRef(null);
  const style = styles[notification.type] || styles.info;
  const Icon = style.icon;

  return (
    <div
      className={`toast-notification ${visible ? "toast-notification-enter" : "toast-notification-exit"} w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl`}
      role="status"
      aria-live="polite"
      style={{ touchAction: "pan-y" }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(event) => {
        if (!touchStart.current) return;
        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStart.current.x;
        const deltaY = touch.clientY - touchStart.current.y;
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
          const content = event.currentTarget.firstElementChild;
          if (content) content.style.transform = `translateX(${deltaX}px)`;
        }
      }}
      onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStart.current.x;
        const deltaY = touch.clientY - touchStart.current.y;
        touchStart.current = null;
        const content = event.currentTarget.firstElementChild;
        if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY)) {
          onDismiss();
          return;
        }
        if (content) {
          content.style.transition = "transform 160ms ease";
          content.style.transform = "translateX(0)";
          window.setTimeout(() => {
            content.style.transition = "";
          }, 160);
        }
      }}
      onTouchCancel={(event) => {
        touchStart.current = null;
        const content = event.currentTarget.firstElementChild;
        if (content) {
          content.style.transition = "transform 160ms ease";
          content.style.transform = "translateX(0)";
          window.setTimeout(() => {
            content.style.transition = "";
          }, 160);
        }
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon size={20} className={`mt-0.5 shrink-0 ${style.accent}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
          <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
        </div>
        <button onClick={onDismiss} aria-label="Cerrar aviso" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
      <div className="h-1 bg-slate-100">
        <div className={`toast-progress h-full ${style.bar}`} />
      </div>
    </div>
  );
};

export default NotificationToast;