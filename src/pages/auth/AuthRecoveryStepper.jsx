const steps = [
  "Solicitar enlace",
  "Revisar correo",
  "Crear contraseña"
];

const AuthRecoveryStepper = ({ currentStep }) => (
  <nav className="mb-6 md:hidden" aria-label="Pasos para recuperar la contraseña">
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const completed = stepNumber < currentStep;
        const active = stepNumber === currentStep;

        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={`relative flex flex-1 flex-col items-center text-center text-[11px] font-semibold leading-4 ${
              active || completed ? "text-emerald-800" : "text-slate-400"
            }`}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full ${
                  completed ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex size-8 items-center justify-center rounded-full border text-xs ${
                active
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-900/15"
                  : completed
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              {stepNumber}
            </span>
            <span className="mt-2 px-1">{step}</span>
          </li>
        );
      })}
    </ol>
    <p className="sr-only" aria-live="polite">Paso {currentStep} de {steps.length}</p>
  </nav>
);

export default AuthRecoveryStepper;
