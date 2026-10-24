import { useEffect, useRef, useState } from "react";

import Sidebar from "./Sidebar/Sidebar";
import Navbar from "./Navbar/Navbar";

const MainLayout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(() => (
    window.innerWidth >= 1024 && window.innerWidth < 1280
  ));
  const menuButtonRef = useRef(null);
  const navigationRef = useRef(null);
  const menuWasOpen = useRef(false);

  useEffect(() => {
    if (!menuOpen || window.innerWidth >= 1024) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = navigationRef.current
        ?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const focusIsOutsideMenu = !navigationRef.current?.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsideMenu)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutsideMenu)) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    navigationRef.current
      ?.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    let previousMode = window.innerWidth < 1024
      ? "mobile"
      : window.innerWidth < 1280
        ? "tablet"
        : "desktop";

    const handleResize = () => {
      const currentMode = window.innerWidth < 1024
        ? "mobile"
        : window.innerWidth < 1280
          ? "tablet"
          : "desktop";

      if (currentMode !== previousMode) {
        setMenuOpen(currentMode === "tablet");
        previousMode = currentMode;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      menuWasOpen.current = true;
    } else if (menuWasOpen.current) {
      menuWasOpen.current = false;
      if (window.innerWidth < 1280) menuButtonRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <div className="min-h-dvh min-w-0 bg-[#F4F7F5]">

      {/* SIDEBAR DESKTOP AND TABLET */}
      <div className="hidden lg:block">
        <Sidebar desktopCollapsed={!menuOpen} />
      </div>

      {/* SIDEBAR MOBILE / TABLET */}
      {menuOpen && (
        <div className="mobile-menu-backdrop fixed inset-0 z-50 bg-slate-950/45 lg:hidden">
          <Sidebar
            mobile
            onClose={() => setMenuOpen(false)}
            navigationRef={navigationRef}
            desktopCollapsed={false}
          />
        </div>
      )}

      {/* CONTENIDO */}
      <div className={`min-h-dvh min-w-0 w-full transition-[padding] duration-300 ease-in-out motion-reduce:transition-none ${menuOpen ? "lg:pl-[290px]" : "xl:pl-[290px]"}`}>
        <Navbar
          onMenuClick={() => setMenuOpen((open) => !open)}
          menuOpen={menuOpen}
          menuButtonRef={menuButtonRef}
        />

        <main
          className="
            w-full
            px-4
            py-6
            sm:px-6
            md:px-8
            xl:px-10
            2xl:px-12
          "
        >
          <div
            className="
              mx-auto
              w-full
              max-w-[1440px]
            "
          >
            {children}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        ref={menuButtonRef}
        className={`fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] flex size-11 items-center justify-center rounded-xl transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:transition-none lg:hidden ${
          menuOpen
            ? "border border-white/30 bg-white/15 text-white shadow-lg hover:bg-white/25"
            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        }`}
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
      >
        <span className="relative flex size-6 items-center justify-center" aria-hidden="true">
          <span className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out motion-reduce:transition-none ${menuOpen ? "rotate-45" : "-translate-y-1.5"}`} />
          <span className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out motion-reduce:transition-none ${menuOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"}`} />
          <span className={`absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out motion-reduce:transition-none ${menuOpen ? "-rotate-45" : "translate-y-1.5"}`} />
        </span>
      </button>

    </div>
  );
};

export default MainLayout;