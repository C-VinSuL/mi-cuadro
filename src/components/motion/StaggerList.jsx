import { Children } from "react";
import { motion, useReducedMotion } from "motion/react";
import StaggerItem from "./StaggerItem";

const StaggerList = ({ children, className = "", ...props }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: reduceMotion ? 0 : 0.04 }
        }
      }}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      {...props}
    >
      {Children.map(children, (child, index) => (
        <StaggerItem key={child?.key ?? index}>
          {child}
        </StaggerItem>
      ))}
    </motion.div>
  );
};

export default StaggerList;
