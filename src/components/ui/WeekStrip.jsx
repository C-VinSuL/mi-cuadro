const WeekStrip = ({
  days = [],
  value,
  onChange,
  label = "Días de la semana",
  className = ""
}) => (
  <div
    role="group"
    aria-label={label}
    className={`scrollbar-hidden flex min-w-0 items-center gap-2 overflow-x-auto ${className}`}
  >
    {days.map((day) => {
      const selected = day.value === value;

      return (
        <button
          key={day.value}
          type="button"
          aria-pressed={selected}
          aria-label={day.ariaLabel ?? `${day.label}${day.date ? ` ${day.date}` : ""}`}
          disabled={day.disabled}
          onClick={() => onChange?.(day.value)}
          className={`flex min-h-16 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-emerald focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
            selected
              ? "bg-flash-forest text-white"
              : "text-slate-500 hover:bg-white hover:text-slate-950"
          }`}
        >
          <span className="text-xs font-medium">{day.label}</span>
          {day.date !== undefined && (
            <span className="text-sm font-bold">{day.date}</span>
          )}
        </button>
      );
    })}
  </div>
);

export default WeekStrip;
