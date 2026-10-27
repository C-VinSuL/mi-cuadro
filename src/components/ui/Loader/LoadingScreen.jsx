import { LoaderCircle } from "lucide-react";
import Skeleton from "../Skeleton";

const LoadingScreen = ({ message = "Preparando tu espacio..." }) => (
  <main
    className="min-h-screen bg-[#F4F7F5] px-4 py-6 sm:px-6 sm:py-8"
    role="status"
    aria-live="polite"
  >
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <LoaderCircle className="motion-safe:animate-spin" size={22} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{message}</p>
      </div>
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 w-full rounded-3xl" />
      </div>
      <div
        className="mt-6 h-1.5 overflow-hidden rounded-full bg-emerald-100"
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