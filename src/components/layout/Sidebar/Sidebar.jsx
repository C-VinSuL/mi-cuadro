import { Wallet, PiggyBank, CalendarDays, ArrowLeft } from "lucide-react";

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { etiquetaPeriodo } from "../../../services/grupoService";
import { obtenerResumenBilletera } from "../../../services/walletService";
import { getVisibleMenu } from "./navigationItems";

const Sidebar = ({
  mobile = false,
  onClose,
  onNavigate,
  navigationRef,
  desktopCollapsed = false
}) => {

  const { can, rol } =  usePermissions();

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


  const menuVisible = getVisibleMenu(can, rol);


  return (
  <aside
    className={`
      bg-[#064E3B]
      text-white
      flex
      flex-col
      overflow-hidden
      md:border-r md:border-white/20 md:shadow-[10px_0_28px_rgba(255,255,255,0.2)]
      ${mobile ? "" : "transition-transform duration-300 ease-in-out motion-reduce:transition-none"}
      ${
        mobile
          ? "h-full min-h-0 w-full"
          : `fixed inset-y-0 left-0 min-h-dvh w-[290px] ${desktopCollapsed ? "-translate-x-full xl:translate-x-0" : "translate-x-0"}`
      }
    `}
    id={mobile ? "mobile-navigation" : "desktop-navigation"}
    ref={mobile ? navigationRef : undefined}
    role={mobile ? "dialog" : undefined}
    aria-modal={mobile ? true : undefined}
    aria-label={mobile ? "Menú de navegación" : undefined}
  >

      {/* LOGO */}

      <div
        className={`shrink-0 bg-[#064E3B] ${
          mobile ? "px-3 py-3 sm:px-4 sm:py-4" : "px-5 py-5"
        }`}
        style={mobile ? { paddingTop: "max(1rem, env(safe-area-inset-top))" } : undefined}
      >
        <div
          className="
            flex
            items-center
            justify-between
          "
        >
          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Volver a la aplicación"
              className="mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/10"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center">
            <img
              src="/flashmonkey-logo.png"
              alt="FlashMonkey, caja comunal"
              className={mobile
                ? "h-[82px] w-auto max-w-[calc(100%-3.25rem)] object-contain object-left"
                : "h-auto w-full max-w-[220px] object-contain object-left"}
            />
          </div>
        </div>

      </div>


      {/* GRUPO */}

      <div className="px-4 pt-5">

        <div
          className="
            bg-white/10

            border
            border-white/10

            rounded-2xl

            p-4
          "
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

      <nav
        className="
          flex-1
          min-h-0

          px-4
          pt-6

          space-y-1

          overflow-y-auto
          overscroll-contain
          scrollbar-hidden
        "
      >

        <p
          className="
            px-3
            mb-3

            text-[10px]

            uppercase
            tracking-widest

            text-emerald-300
          "
        >
          Menú
        </p>


          {menuVisible.map((item) => {

          const Icon = item.icon;

          return (

            <NavLink
              key={item.title}
              to={item.path}

              onClick={() => {
                if (mobile && onClose) {
                  onClose();
                  onNavigate?.();
                }
              }}

              className={({ isActive }) =>
                `
                  flex
                  items-center
                  gap-3

                  px-4
                  py-3

                  rounded-xl

                  text-sm
                  font-medium

                  transition-all

                  ${
                    isActive
                      ? `
                        bg-emerald-400
                        text-emerald-950
                        shadow-sm
                      `
                      : `
                        text-emerald-50
                        hover:bg-white/10
                      `
                  }
                `
              }
            >

              <Icon size={19} />

              <span>
                {item.title}
              </span>

            </NavLink>

          );

        })}

      </nav>

      {rol === "socio" && (
        <NavLink
          to="/billetera"
          onClick={() => {
            if (mobile && onClose) {
              onClose();
              onNavigate?.();
            }
          }}
          className="mx-4 mb-3 rounded-2xl border border-white/10 bg-[#0B6651] p-4 transition hover:bg-emerald-800"
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

      {can("verFondoComunitario") && rol !== "administrador" && (
      <div className="p-4">

        <div
          className="
            bg-[#0B6651]

            border
            border-white/10

            rounded-2xl

            p-4
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


          <p
            className="
              text-[11px]
              text-emerald-200

              mt-3
            "
          >
            Disponible para préstamos del grupo.
          </p>

        </div>

      </div>
      )}

    </aside>
  );
};


export default Sidebar;