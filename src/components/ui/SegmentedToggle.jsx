const defaultOptions = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" }
];

const SegmentedToggle = ({
  options = defaultOptions,
  value,
  onChange,
  label = "Seleccionar periodo",
  className = ""
}) => (
  <div
    role="group"
    aria-label={label}
    className={`inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 ${className}`}
  >
    {options.map((option) => {
      const selected = option.value === value;

      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange?.(option.value)}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-emerald focus-visible:ring-offset-2 ${
            selected
              ? "bg-flash-forest text-white"
              : "text-slate-600 hover:text-slate-950"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default SegmentedToggle;
