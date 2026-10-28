const LoadingScreen = ({ message = "Preparando tu espacio..." }) => (
  <main
    className="session-loading-screen grid min-h-dvh place-items-center overflow-hidden px-5 py-8"
    role="status"
    aria-live="polite"
  >
    <section className="w-full max-w-sm rounded-3xl border border-white/80 bg-white/90 p-8 text-center shadow-xl shadow-emerald-950/10 backdrop-blur sm:p-10">
      <div className="session-loading-emblem relative mx-auto grid size-24 place-items-center rounded-full bg-emerald-50">
        <span className="session-loading-orbit absolute inset-0 rounded-full border-2 border-emerald-100 border-t-emerald-700" aria-hidden="true" />
        <span className="grid size-[4.25rem] place-items-center rounded-full bg-white shadow-sm">
          <img src="/flashmonkey.svg" alt="" className="size-12 object-contain" />
        </span>
      </div>
      <div className="mt-7 flex items-center justify-center gap-2">
        <h1 className="text-base font-semibold text-slate-900">{message}</h1>
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="session-loading-dot size-1.5 rounded-full bg-emerald-600" style={{ animationDelay: `${dot * 160}ms` }} />
          ))}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Estamos preparando tu espacio seguro.
      </p>
      <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-emerald-100" aria-hidden="true">
        <div className="session-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-800" />
      </div>
    </section>
  </main>
);

export default LoadingScreen;