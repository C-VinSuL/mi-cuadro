import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import Sidebar from "./Sidebar/Sidebar";
import Navbar from "./Navbar/Navbar";
import MobileBottomNavigation from "./MobileBottomNavigation";
import MobileAssistant from "./MobileAssistant";
import { useNotifications } from "../../hooks/useNotifications";

const MainLayout = ({ children }) => {
  const { unreadCount } = useNotifications();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileAssistantOpen, setMobileAssistantOpen] = useState(false);
  const [desktopAssistantOpen, setDesktopAssistantOpen] = useState(false);

  useEffect(() => {
    if (!mobileMoreOpen && !mobileAssistantOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMoreOpen(false);
        setMobileAssistantOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMoreOpen, mobileAssistantOpen]);

  return (
    <div className="min-h-dvh min-w-0 bg-[#F4F7F5]">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex min-h-dvh min-w-0 w-full flex-col md:pl-28">
        <Navbar onOpenMobileMenu={() => {
          setMobileAssistantOpen(false);
          setMobileMoreOpen(true);
        }} />
        <main className="min-w-0 w-full max-w-full flex-1 px-4 py-6 pb-28 sm:px-6 md:px-8 md:pb-6 xl:px-10 2xl:px-12">
          <div className="mx-auto w-full min-w-0 max-w-[1440px]">
            {children}
          </div>
        </main>
        <footer className="hidden border-t border-slate-200/80 bg-white/70 px-8 py-4 text-center text-xs text-slate-500 md:block xl:px-10 2xl:px-12">
          <div className="mx-auto w-full max-w-[1440px]">
            © {new Date().getFullYear()} FlashMonkey. Todos los derechos reservados.
          </div>
        </footer>
      </div>

      <MobileBottomNavigation
        assistantOpen={mobileAssistantOpen}
        moreOpen={mobileMoreOpen}
        notificationCount={unreadCount}
        onNavigate={() => {
          setMobileAssistantOpen(false);
          setMobileMoreOpen(false);
        }}
        onOpenAssistant={() => {
          setMobileMoreOpen(false);
          setMobileAssistantOpen((open) => !open);
        }}
        onOpenMore={() => {
          setMobileAssistantOpen(false);
          setMobileMoreOpen((open) => !open);
        }}
        onCloseMore={() => setMobileMoreOpen(false)}
      />
      <div className="fixed bottom-6 right-6 z-40 hidden md:block">
        <AnimatePresence>
          {desktopAssistantOpen && (
            <motion.div
              key="desktop-assistant-panel"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-[4.5rem] right-0 h-[min(680px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <MobileAssistant
                desktop
                onClose={() => setDesktopAssistantOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setDesktopAssistantOpen((open) => !open)}
          aria-label={`${desktopAssistantOpen ? "Cerrar chat de Moki" : "Abrir chat de Moki"}${unreadCount ? `, ${unreadCount} notificaciones sin leer` : ""}`}
          aria-expanded={desktopAssistantOpen}
          className="relative flex size-14 items-center justify-center rounded-full bg-[#064E3B] text-white shadow-lg shadow-emerald-950/25 transition hover:scale-105 hover:bg-[#0B6651] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
        >
          {desktopAssistantOpen ? <X size={23} /> : (
            <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-full bg-white">
              <img src="/flashmonkey-mascot.png" alt="" className="h-full w-full object-cover object-top" />
              <MessageCircle className="absolute bottom-0 right-0 rounded-full bg-[#16835D] p-0.5 text-white" size={17} />
            </span>
          )}
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
      <AnimatePresence>
        {mobileAssistantOpen && (
          <motion.div
            key="mobile-assistant"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <MobileAssistant
              onClose={() => setMobileAssistantOpen(false)}
              onOpenMenu={() => {
                setMobileAssistantOpen(false);
                setMobileMoreOpen(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainLayout;
