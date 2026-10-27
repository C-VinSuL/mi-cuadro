import {
  ArrowLeft,
  CalendarDays,
  LogOut,
  Pin,
  PiggyBank,
  ReceiptText,
  Wallet
} from "lucide-react";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { etiquetaPeriodo } from "../../../services/grupoService";
import { supabase } from "../../../services/supabase";
import { obtenerResumenBilletera } from "../../../services/walletService";
import { useNotifications } from "../../../hooks/useNotifications";
import { getVisibleMenu } from "./navigationItems";

const Sidebar = ({
  mobile = false,
  onClose,
  onNavigate,
  navigationRef,
  sheet = false
}) => {

  const { can, rol } =  usePermissions();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const [pinned, setPinned] = useState(() => {
    try {
      return window.localStorage.getItem("flashmonkey-sidebar-pinned") === "true";
    } catch (error) {
      console.error("No se pudo leer la preferencia del menú lateral:", error);
      return false;
    }
  });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = !mobile && (pinned || hovered || focused);

  useEffect(() => {
    if (mobile) return;
    try {
      window.localStorage.setItem("flashmonkey-sidebar-pinned", String(pinned));
    } catch (error) {
      console.error("No se pudo guardar la preferencia del menú lateral:", error);
    }
  }, [mobile, pinned]);

  const {
    user,
    profile,
    grupo,
    grupos,
    participant,
    fondoComunitario,
    seleccionarGrupo
  } = useAuth();
  const [walletState, setWalletState] = useState({ userId: null, summary: null, error: false });

  useEffect(() => {
    if (!user?.id || profile?.rol?.toLowerCase() !== "socio") return undefined;

    let active = true;
    const refreshBalance = async () => {
      try {
        const summary = await obtenerResumenBilletera();
        if (active) setWalletState({ userId: user.id, summary, error: false });
      } catch (error) {
        console.error("Error cargando saldo del socio:", error);
        if (active) setWalletState({ userId: user.id, summary: null, error: true });
      }
    };

    const timeoutId = window.setTimeout(refreshBalance, 0);
    const intervalId = window.setInterval(refreshBalance, 30000);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [user?.id, profile?.rol]);
  const walletSummary = walletState.userId === user?.id ? walletState.summary : null;
  const walletLoadError = walletState.userId === user?.id && walletState.error;

  


  const semanaActual =
    grupo?.semana_actual || 0;

  const totalSemanas =
    grupo?.numero_integrantes || 0;
  const periodoActual = etiquetaPeriodo(grupo?.aporte_periodicidad);


  const porcentaje =
    totalSemanas > 0
      ? Math.min(
          (semanaActual / totalSemanas) * 100,
          100
        )
      : 0;


  const menuVisible = getVisibleMenu(can, rol).flatMap((item) => (
    item.path === "/aportes" && can("gestionarEgresos")
      ? [item, { title: "Egresos", icon: ReceiptText, path: "/egresos" }]
      : [item]
  ));

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error cerrando sesión:", error);
      notify({
        title: "No se pudo cerrar sesión",
        message: "Inténtalo nuevamente.",
        type: "error"
      });
      return;
    }

    navigate("/login");
  };

  return (
    <aside
      className={`text-white ${
        mobile
          ? `flex w-full flex-col bg-[#064E3B] ${sheet ? "max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-[2rem] pb-[calc(4.25rem+env(safe-area-inset-bottom))]" : "h-full min-h-0 overflow-hidden"}`
          : "pointer-events-none fixed inset-y-4 left-4 z-40 w-[240px] overflow-visible"
      }`}
      id={mobile ? "mobile-navigation" : "desktop-navigation"}
      ref={mobile ? navigationRef : undefined}
      role={mobile ? "dialog" : undefined}
      aria-modal={mobile ? true : undefined}
      aria-label={mobile ? "Más opciones de navegación" : "Menú lateral"}
      onMouseEnter={() => {
        if (!mobile) setHovered(true);
      }}
      onMouseLeave={() => {
        if (!mobile) setHovered(false);
      }}
      onFocusCapture={() => {
        if (!mobile) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      {!mobile && (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scaleX: expanded ? 1 : 1 / 3 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 w-full origin-left rounded-[2.25rem] bg-[#064E3B] shadow-xl shadow-emerald-950/25"
        />
      )}
      <div
        className={`relative z-10 flex min-h-0 flex-col ${
          mobile
            ? sheet
              ? "w-full"
              : "h-full w-full"
            : "pointer-events-none h-full w-[240px]"
        }`}
      >

      {/* LOGO */}

      {mobile ? (
        <div
          className={`flex shrink-0 items-center bg-[#064E3B] px-3 sm:px-4 ${
            sheet ? "min-h-14 justify-between py-1" : "justify-between py-3 sm:py-4"
          }`}
          style={!sheet ? { paddingTop: "max(1rem, env(safe-area-inset-top))" } : undefined}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú Más"
              className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="flex min-w-0 flex-1 items-center">
              <img
                src="/flashmonkey-logo.png"
                alt="FlashMonkey, caja comunal"
                className={`${sheet ? "h-12" : "h-[82px]"} w-auto max-w-full object-contain object-left`}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className={`pointer-events-none flex shrink-0 items-center py-5 ${
          expanded ? "justify-start gap-3 px-4" : "justify-center"
        }`}>
          <img
            src="/flashmonkey-mascot.png"
            alt="FlashMonkey"
            className="size-10 object-contain"
          />
          <motion.span
            initial={false}
            animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            className={`text-sm font-bold tracking-wide ${expanded ? "relative" : "absolute"}`}
            aria-hidden={!expanded}
          >
            FlashMonkey
          </motion.span>
        </div>
      )}


      {/* GRUPO */}

      <div className={mobile ? (sheet ? "px-3 pt-2" : "px-4 pt-5") : "hidden"}>

        <div
          className={`
            bg-white/10

            border
            border-white/10

            rounded-2xl

            ${sheet ? "p-3" : "p-4"}
          `}
        >

          <p
            className="
              text-[10px]
              uppercase
              tracking-widest
              text-emerald-300
            "
          >
            {rol === "administrador" ? "Centro administrativo" : "Grupo actual"}
          </p>


          <p
            className="
              mt-2
              text-base
              font-semibold
              text-white
            "
          >
            {rol === "administrador" ? "Gestión de grupos y operaciones" : grupo?.nombre || "Sin grupo"}
          </p>

          {grupos.length > 1 && (
            <label className="mt-3 block text-xs text-emerald-100">
              {rol === "administrador" ? "Grupo de trabajo" : "Cambiar de grupo"}
              <select
                value={grupo?.id || ""}
                onChange={(event) => {
                  seleccionarGrupo(event.target.value);
                  if (mobile) onClose?.();
                }}
                className="mt-1.5 w-full rounded-lg border border-white/20 bg-emerald-950 px-2.5 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {grupos.map((item) => (
                  <option key={item.id} value={item.id}>{item.nombre}</option>
                ))}
              </select>
            </label>
          )}

          <p className="text-xs text-emerald-200 capitalize mt-1">
            {rol === "administrador" ? "Supervisión general" : rol}
          </p>


          {rol !== "administrador" && participant && grupo?.estado !== "borrador" && participant.posicion && (

            <p
              className="
                mt-1
                text-xs
                text-emerald-200
              "
            >
              Tu puesto #{participant.posicion}
            </p>

          )}


          {/* PROGRESO */}

          {rol !== "administrador" && <div className="mt-5">

            <div
              className="
                flex
                items-center
                justify-between

                text-xs
              "
            >

              <div
                className="
                  flex
                  gap-2
                  items-center
                  text-emerald-200
                "
              >

                <CalendarDays size={14} />

                <span>
                  Progreso
                </span>

              </div>


              <span className="font-semibold">
                {periodoActual} {semanaActual} / {totalSemanas}
              </span>

            </div>


            <div
              className="
                mt-3
                h-2

                bg-white/10

                rounded-full
                overflow-hidden
              "
            >

              <div
                className="
                  h-full

                  bg-gradient-to-r
                  from-lime-300
                  to-emerald-300

                  rounded-full

                  transition-all
                  duration-500
                "
                style={{
                  width: `${porcentaje}%`
                }}
              />

            </div>

          </div>}

        </div>

      </div>


      {/* MENÚ */}

      {mobile ? (
        <nav
          aria-label="Navegación principal"
          className={`space-y-1 px-3 pt-3 pb-2 ${sheet ? "flex-none" : "min-h-0 flex-1 overflow-y-auto"}`}
        >
          <p className="mb-2 px-3 text-[10px] uppercase tracking-widest text-emerald-300">
            Menú
          </p>
          {menuVisible.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (onClose) {
                    onClose();
                    onNavigate?.();
                  }
                }}
                aria-label={item.title}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? "bg-emerald-400 text-emerald-950 shadow-sm"
                      : "text-emerald-50 hover:bg-white/10"
                  }`
                }
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : (
        <nav
          aria-label="Navegación principal"
          className={`relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-2 scrollbar-hidden ${
            expanded ? "pointer-events-none items-stretch px-4" : "items-start pl-[18px]"
          }`}
        >
          {menuVisible.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                aria-label={item.title}
                title={item.title}
                className={({ isActive }) =>
                  `group relative flex min-h-11 shrink-0 items-center rounded-2xl text-emerald-50 outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    expanded
                      ? "pointer-events-auto w-full justify-start gap-3 px-3"
                      : "pointer-events-auto w-11 justify-center"
                  } ${isActive ? "font-semibold text-flash-forest" : "hover:bg-white/10"}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-indicator"
                        initial={false}
                        transition={reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 500, damping: 36, duration: 0.2 }}
                        className="absolute inset-0 rounded-2xl bg-white"
                      />
                    )}
                    <Icon
                      size={20}
                      aria-hidden="true"
                      className={`relative z-10 ${isActive ? "text-flash-forest" : ""}`}
                    />
                    <motion.span
                      initial={false}
                      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
                      transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
                      className={expanded
                        ? "relative z-10 min-w-0 flex-1 truncate text-left text-sm"
                        : "pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg"}
                      aria-hidden={!expanded}
                    >
                      {item.title}
                    </motion.span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {mobile && rol === "socio" && (
        <NavLink
          to="/billetera"
          onClick={() => {
            if (mobile && onClose) {
              onClose();
              onNavigate?.();
            }
          }}
          className={`mx-3 mb-2 flex min-h-11 items-center rounded-2xl border border-white/10 bg-[#0B6651] transition hover:bg-emerald-800 ${
            sheet ? "p-3" : "p-4"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Wallet size={19} /></span>
            <span className="min-w-0">
              <span className="block text-xs text-emerald-100">Dinero disponible</span>
              <span className="mt-0.5 block truncate text-lg font-bold text-white">
                {walletLoadError ? "Saldo no disponible" : walletSummary ? `$${Number(walletSummary.saldo).toFixed(2)}` : "Cargando..."}
              </span>
            </span>
          </span>
        </NavLink>
      )}


      {/* FONDO */}

      {mobile && can("verFondoComunitario") && rol !== "administrador" && (
      <div className={sheet ? "px-3 pb-3 pt-1" : "p-4"}>

        <div
          className="
            bg-[#0B6651]

            border
            border-white/10

            rounded-2xl

            p-3
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                w-10
                h-10

                rounded-xl

                bg-amber-300/15
                text-amber-300

                flex
                items-center
                justify-center
              "
            >

              <PiggyBank size={21} />

            </div>


            <div>

              <p
                className="
                  text-[11px]
                  text-emerald-200
                "
              >
                Fondo comunitario
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  text-white
                "
              >
                  ${Number(fondoComunitario).toFixed(2)}
              </p>

            </div>

          </div>


          <p className="mt-2 text-[11px] text-emerald-200">
            Saldo del fondo del grupo.
          </p>

        </div>

      </div>
      )}

      {!mobile && (
        <div className={`relative z-10 mb-4 mt-2 flex shrink-0 ${
          expanded ? "pointer-events-none px-4" : "justify-start pl-[18px]"
        }`}>
          <button
            type="button"
            onClick={() => setPinned((current) => !current)}
            aria-label={pinned ? "Desfijar menú" : "Fijar menú"}
            title={pinned ? "Desfijar menú" : "Fijar menú"}
            aria-pressed={pinned}
            className={`group relative flex min-h-11 items-center rounded-2xl text-emerald-50 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white ${
              expanded
                ? "pointer-events-auto w-full justify-start gap-3 px-3"
                : "pointer-events-auto w-11 justify-center"
            }`}
          >
            <Pin size={19} aria-hidden="true" />
            <motion.span
              initial={false}
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
              className={expanded
                ? "relative min-w-0 flex-1 truncate text-left text-sm"
                : "pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg group-hover:opacity-100 group-focus-visible:opacity-100"}
              aria-hidden={!expanded}
            >
              {pinned ? "Menú fijado" : "Fijar menú"}
            </motion.span>
          </button>
        </div>
      )}
      {!mobile && (
        <div className={`relative z-10 mb-4 flex shrink-0 ${
          expanded ? "pointer-events-none px-4" : "justify-start pl-[18px]"
        }`}>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className={`group relative flex min-h-11 items-center rounded-2xl text-emerald-50 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white ${
              expanded
                ? "pointer-events-auto w-full justify-start gap-3 px-3"
                : "pointer-events-auto w-11 justify-center"
            }`}
          >
            <LogOut size={20} aria-hidden="true" />
            <motion.span
              initial={false}
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
              className={expanded
                ? "relative min-w-0 flex-1 truncate text-left text-sm"
                : "pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-lg"}
              aria-hidden={!expanded}
            >
              Cerrar sesión
            </motion.span>
          </button>
        </div>
      )}
      </div>
    </aside>
  );
};


export default Sidebar;