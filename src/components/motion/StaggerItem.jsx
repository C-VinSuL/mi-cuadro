import { motion, useReducedMotion } from "motion/react";

const StaggerItem = ({ children, className = "", ...props }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
        visible: { opacity: 1, y: 0 }
      }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default StaggerItem;
