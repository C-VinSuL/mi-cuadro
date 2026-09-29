import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const styles = {
  success: { icon: CircleCheck, accent: "text-emerald-700", bar: "bg-emerald-600" },
  error: { icon: CircleAlert, accent: "text-red-700", bar: "bg-red-600" },
  info: { icon: Info, accent: "text-blue-700", bar: "bg-blue-600" }
};

const NotificationToast = ({ notification, visible, onDismiss }) => {
  const style = styles[notification.type] || styles.info;
  const Icon = style.icon;

  return (
    <div
      className={`toast-notification ${visible ? "toast-notification-enter" : "toast-notification-exit"} w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl`}
      role="status"
      aria-live="polite"
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