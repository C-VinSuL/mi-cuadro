import {
  Home,
  Users,
  Wallet,
  Landmark,
  HandCoins,
  History,
  Settings,
  PiggyBank,
  CalendarDays,
  X
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";


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
    title: "Aportes",
    icon: Wallet,
    path: "/aportes",
    permission: "verAportes"
  },
  {
    title: "Mi Cuadro",
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
    permission: "verDashboard"
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
    grupo,
    participant,
    fondoComunitario
  } = useAuth();

  


  const semanaActual =
    grupo?.semana_actual || 0;

  const totalSemanas =
    grupo?.numero_integrantes || 0;


  const porcentaje =
    totalSemanas > 0
      ? Math.min(
          (semanaActual / totalSemanas) * 100,
          100
        )
      : 0;


  const menuVisible =
  menu.filter(
    (item) =>
      can(item.permission)
  );    


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

            <div
              className="
                w-11
                h-11

                bg-emerald-400/15

                rounded-xl

                flex
                items-center
                justify-center

                text-xl
              "
            >
              🏡
            </div>


            <div>

              <p
                className="
                  text-xl
                  font-bold
                  text-white
                "
              >
                Mi Cuadro
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
            Grupo actual
          </p>


          <p
            className="
              mt-2
              text-base
              font-semibold
              text-white
            "
          >
            {grupo?.nombre || "Sin grupo"}
          </p>

          <p className="text-xs text-emerald-200 capitalize mt-1">
            {rol}
          </p>


          {participant && (

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

          <div className="mt-5">

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
                {semanaActual} / {totalSemanas}
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

          </div>

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


        {menu.map((item) => {

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


      {/* FONDO */}

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

    </aside>
  );
};


export default Sidebar;