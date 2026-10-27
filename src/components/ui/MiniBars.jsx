const MiniBars = ({
  values = [],
  label = "Gráfico de barras",
  className = "",
  barClassName = "bg-flash-emerald"
}) => {
  const bars = values.map((entry) => {
    const value = typeof entry === "number" ? entry : entry?.value;
    return {
      label: typeof entry === "object" ? entry.label : undefined,
      value: Number.isFinite(value) && value > 0 ? value : 0
    };
  });
  const maxValue = Math.max(0, ...bars.map((bar) => bar.value));

  return (
    <div
      role="img"
      aria-label={label}
      className={`flex h-16 items-end gap-1.5 ${className}`}
    >
      {bars.map((bar, index) => (
        <span
          key={bar.label ?? index}
          aria-hidden="true"
          className={`min-w-1 flex-1 rounded-t-md ${barClassName}`}
          style={{ height: `${maxValue ? Math.max((bar.value / maxValue) * 100, 8) : 8}%` }}
        />
      ))}
    </div>
  );
};

export default MiniBars;
