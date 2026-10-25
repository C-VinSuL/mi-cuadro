import { motion } from "motion/react";

const StaggerItem = ({ children, className = "", ...props }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0 }
    }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    {...props}
  >
    {children}
  </motion.div>
);

export default StaggerItem;
