import { Suspense } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation } from "react-router-dom";
import Skeleton from "../ui/Skeleton";

const PageTransition = ({ children }) => {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
      >
        <Suspense
          fallback={(
            <div className="space-y-5" role="status" aria-live="polite">
              <span className="sr-only">Cargando pantalla</span>
              <Skeleton className="h-36 w-full rounded-3xl" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-36 w-full rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-56 w-full rounded-3xl" />
            </div>
          )}
        >
          {children}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
