import {
  Home,
  Users,
  Wallet,
  Landmark,
  HandCoins,
  History,
  Settings,
  ShieldCheck,
  UserRoundCog,
  FileClock,
  PiggyBank,
  CalendarDays,
  X
} from "lucide-react";

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { etiquetaPeriodo } from "../../../services/grupoService";
import { obtenerResumenBilletera } from "../../../services/walletService";


const menu = [
  {
    title: "Inicio",
    icon: Home,
    path: "/",
    permission: "verDashboard"
  },
  {
    title: "Mi Grupo",
    icon: Users,
    path: "/grupo",
    permission: "verGrupo"
  },
  {
    title: "Mi billetera",
    icon: Wallet,
    path: "/billetera",
    permission: "verBilletera"
  },
  {
    title: "Aportes",
    icon: Wallet,
    path: "/aportes",
    permission: "verAportes"
  },
  {
    title: "Cuadro rotativo",
    icon: Landmark,
    path: "/cuadro",
    permission: "verCuadro"
  },
  {
    title: "Préstamos",
    icon: HandCoins,
    path: "/prestamos",
    permission: "verPrestamos"
  },
  {
    title: "Historial",
    icon: History,
    path: "/historial",
    permission: "verFondoComunitario"
  },
  {
    title: "Auditoría",
    icon: FileClock,
    path: "/auditoria",
    permission: "verAuditoria"
  },
  {
    title: "Socios y roles",
    icon: UserRoundCog,
    path: "/usuarios",
    permission: "gestionarUsuarios"
  },
  {
    title: "Verificar documentos",
    icon: ShieldCheck,
    path: "/verificar-documentos",
    permission: "verificarDocumentos"
  },
  {
    title: "Solicitudes de billetera",
    icon: Wallet,
    path: "/admin/billetera",
    permission: "gestionarBilletera"
  },
  {
    title: "Configuración",
    icon: Settings,
    path: "/configuracion",
    permission: "verConfiguracion"
  }
];


const Sidebar = ({
  mobile = false,
  onClose
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


  const menuVisible = menu
    .filter((item) => can(item.permission))
    .map((item) => {
      if (rol !== "administrador") return item;
      const adminTitles = {
        "/grupo": "Grupos",
        "/aportes": "Control de aportes",
        "/cuadro": "Revisar cuadro",
        "/historial": "Reportes"
      };
      return { ...item, title: adminTitles[item.path] || item.title };
    });


  return (
  <aside
    className={`
      h-screen
      bg-[#064E3B]
      text-white
      flex
      flex-col
      overflow-y-auto

      ${
        mobile
          ? "w-full"
          : "fixed inset-y-0 left-0 w-[290px]"
      }
    `}
  >

      {/* LOGO */}

      <div
        className="
          px-5
          py-5

          border-b
          border-white/10
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
          "
        >

          <div className="flex items-center gap-3">

            <img
              src="/flashmonkey.svg"
              alt=""
              className="h-11 w-11 rounded-xl"
            />


            <div>

              <p
                className="
                  text-xl
                  font-bold
                  text-white
                "
              >
                FlashMonkey
              </p>

              <p
                className="
                  text-xs
                  text-emerald-200
                "
              >
                Caja Comunal
              </p>

            </div>

          </div>


          {/* CERRAR MOBILE */}

          {mobile && (

            <button
              onClick={onClose}
              className="
                w-10
                h-10

                flex
                items-center
                justify-center

                rounded-xl

                hover:bg-white/10
              "
            >
              <X size={21} />
            </button>

          )}

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
                onChange={(event) => seleccionarGrupo(event.target.value)}
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

          px-4
          pt-6

          space-y-1

          overflow-y-auto
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
            if (mobile && onClose) onClose();
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