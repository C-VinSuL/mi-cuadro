import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import { NavLink } from "react-router-dom";

import { usePermissions } from "../../hooks/usePermissions";
import { getVisibleMenu } from "./Sidebar/navigationItems";
import Sidebar from "./Sidebar/Sidebar";

const MobileBottomNavigation = ({
  onOpenAssistant,
  onNavigate,
  assistantOpen = false,
  moreOpen = false,
  notificationCount = 0,
  onOpenMore,
  onCloseMore
}) => {
  const { can, rol } = usePermissions();
  const reduceMotion = useReducedMotion();
  const items = getVisibleMenu(can, rol);
  const preferredPaths = rol === "socio"
    ? ["/", "/aportes", "/billetera"]
    : rol === "auditor"
      ? ["/", "/auditoria", "/historial"]
      : rol === "tesorero"
        ? ["/", "/aportes", "/cuadro"]
        : ["/", "/grupo", "/aportes", "/cuadro"];
  const primaryItems = preferredPaths
    .map((path) => items.find((item) => item.path === path))
    .filter(Boolean)
    .slice(0, 4);
  items.forEach((item) => {
    if (primaryItems.length < 3 && !primaryItems.some((primary) => primary.path === item.path)) {
      primaryItems.push(item);
    }
  });

  const mobileTitles = {
    "/": "Inicio",
    "/grupo": "Grupo",
    "/aportes": "Aportes",
    "/billetera": "Billetera",
    "/cuadro": "Cuadro",
    "/prestamos": "Préstamos",
    "/auditoria": "Auditoría",
    "/historial": "Historial"
  };
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeOut" };

  if (!items.length) return null;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[55] mx-auto max-w-xl rounded-[1.75rem] bg-[#064E3B] p-1 text-white shadow-xl shadow-emerald-950/25 md:hidden"
      >
        <div className="flex min-h-[60px] items-stretch justify-around">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onNavigate}
                aria-label={item.title}
                className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-medium leading-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {({ isActive }) => {
                  const selected = isActive && !assistantOpen && !moreOpen;
                  return (
                    <>
                      {selected && (
                        <motion.span
                          layoutId="mobile-navigation-active"
                          initial={false}
                          transition={transition}
                          className="absolute inset-0 rounded-2xl bg-white/15"
                        />
                      )}
                      <Icon className="relative z-10 shrink-0" size={19} aria-hidden="true" />
                      <span className="relative z-10 max-w-full whitespace-nowrap">
                        {mobileTitles[item.path] || item.title}
                      </span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={`${assistantOpen ? "Cerrar Moki, asistente FlashMonkey" : "Abrir Moki, asistente FlashMonkey"}${notificationCount ? `, ${notificationCount} notificaciones sin leer` : ""}`}
            aria-pressed={assistantOpen}
            className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-medium leading-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {assistantOpen && (
              <motion.span
                layoutId="mobile-navigation-active"
                initial={false}
                transition={transition}
                className="absolute inset-0 rounded-2xl bg-white/15"
              />
            )}
            <img
              src="/flashmonkey-mascot.png"
              alt=""
              className="relative z-10 size-5 shrink-0 object-contain"
              aria-hidden="true"
            />
            <span className="relative z-10">Moki</span>
            {notificationCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-1 z-20 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-[#064E3B] bg-red-500 px-1 text-[9px] font-bold leading-none text-white"
              >
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="Más opciones de navegación"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-medium leading-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {moreOpen && (
              <motion.span
                layoutId="mobile-navigation-active"
                initial={false}
                transition={transition}
                className="absolute inset-0 rounded-2xl bg-white/15"
              />
            )}
            <MoreHorizontal className="relative z-10 shrink-0" size={19} aria-hidden="true" />
            <span className="relative z-10">Más</span>
          </button>
        </div>
      </nav>

      <AnimatePresence initial={false}>
        {moreOpen && (
          <motion.div
            key="mobile-more-backdrop"
            className="fixed inset-0 z-[60] bg-slate-950/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onCloseMore?.();
            }}
          >
            <motion.div
              key="mobile-more-sheet"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={transition}
              className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto max-w-xl md:hidden"
            >
              <Sidebar
                mobile
                sheet
                onClose={onCloseMore}
                onNavigate={onNavigate}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileBottomNavigation;
