import { motion, useReducedMotion } from "motion/react";

const ProgressBar = ({
  value,
  max = 100,
  label = "Progreso",
  className = "",
  trackClassName = "bg-slate-100",
  barClassName = "bg-flash-emerald"
}) => {
  const reduceMotion = useReducedMotion();
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const progress = safeMax ? safeValue / safeMax : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={`h-2 overflow-hidden rounded-full ${trackClassName} ${className}`}
    >
      <motion.div
        initial={false}
        animate={{ scaleX: progress }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
        className={`h-full origin-left rounded-full ${barClassName}`}
      />
    </div>
  );
};

export default ProgressBar;
