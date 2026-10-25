import { motion } from "motion/react";
import { NavLink } from "react-router-dom";

import { usePermissions } from "../../hooks/usePermissions";
import { getVisibleMenu } from "./Sidebar/navigationItems";

const MobileBottomNavigation = ({
  onOpenAssistant,
  onNavigate,
  assistantOpen = false
}) => {
  const { can, rol } = usePermissions();
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
    .slice(0, 3);
  items.forEach((item) => {
    if (primaryItems.length < 3 && !primaryItems.some((primary) => primary.path === item.path)) {
      primaryItems.push(item);
    }
  });

  const mobileTitles = {
    "/grupo": "Grupo",
    "/aportes": "Aportes",
    "/billetera": "Billetera",
    "/cuadro": "Cuadro",
    "/prestamos": "Préstamos",
    "/auditoria": "Auditoría",
    "/historial": "Historial"
  };

  if (!items.length) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] text-slate-500 shadow-[0_-4px_18px_rgba(15,23,42,0.08)] md:hidden"
    >
      <div className="mx-auto flex min-h-[68px] max-w-xl items-stretch justify-around px-1">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              className={({ isActive }) => {
                const selected = isActive && !assistantOpen;
                return `relative flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors ${selected ? "font-semibold text-[#064E3B]" : "font-medium text-slate-500"}`;
              }}
            >
              {({ isActive }) => (
                <>
                  {isActive && !assistantOpen && (
                    <motion.span
                      layoutId="mobile-navigation-active"
                      className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[#16835D]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon size={20} aria-hidden="true" />
                  <span className="max-w-full truncate">{mobileTitles[item.path] || item.title}</span>
                </>
              )}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onOpenAssistant}
          aria-label={assistantOpen ? "Cerrar Moki, asistente FlashMonkey" : "Abrir Moki, asistente FlashMonkey"}
          aria-pressed={assistantOpen}
          className={`relative flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors ${assistantOpen ? "font-semibold text-[#064E3B]" : "font-medium text-slate-500"}`}
        >
          {assistantOpen && (
            <motion.span
              layoutId="mobile-navigation-active"
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[#16835D]"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <img
            src="/flashmonkey-mascot.png"
            alt=""
            className="size-6 object-contain"
            aria-hidden="true"
          />
          <span>Moki</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNavigation;
