import { Children } from "react";
import { motion } from "motion/react";
import StaggerItem from "./StaggerItem";

const StaggerList = ({ children, className = "", ...props }) => (
  <motion.div
    className={className}
    variants={{
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.06 }
      }
    }}
    initial="hidden"
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

export default StaggerList;
