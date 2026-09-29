import { LoaderCircle } from "lucide-react";

const LoadingScreen = ({ message = "Preparando tu espacio..." }) => (
  <main
    className="flex min-h-screen items-center justify-center bg-slate-50 px-6"
    role="status"
    aria-live="polite"
  >
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
        <LoaderCircle className="motion-safe:animate-spin" size={28} aria-hidden="true" />
      </div>
      <p className="mb-5 text-sm font-semibold text-slate-700">{message}</p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-label={message}
        aria-valuetext="En progreso"
      >
        <div className="loading-progress h-full w-2/5 rounded-full bg-emerald-600" />
      </div>
    </div>
  </main>
);

export default LoadingScreen;