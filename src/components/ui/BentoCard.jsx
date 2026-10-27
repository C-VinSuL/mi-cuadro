import { motion, useReducedMotion } from "motion/react";

const BentoCard = ({ children, className = "", hover = true, ...props }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      {...props}
      whileHover={hover && !reduceMotion ? { y: -5 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default BentoCard;
