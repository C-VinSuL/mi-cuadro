
import {
    Home,
    Users,
    Wallet,
    Landmark,
    HandCoins,
    History,
    Settings
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menu = [
  {
    title: "Inicio",
    icon: Home,
    path: "/"
  },
  {
    title: "Mi Grupo",
    icon: Users,
    path: "/grupo"
  },
  {
    title: "Aportes",
    icon: Wallet,
    path: "/aportes"
  },
  {
    title: "Mi Cuadro",
    icon: Landmark,
    path: "/cuadro"
  },
  {
    title: "Préstamos",
    icon: HandCoins,
    path: "/prestamos"
  },
  {
    title: "Historial",
    icon: History,
    path: "/historial"
  },
  {
    title: "Configuración",
    icon: Settings,
    path: "/configuracion"
  }
];

const Sidebar = () => {

    return (

        <aside className="w-72 min-h-screen bg-teal-800 text-white flex flex-col">

            {/* Logo */}

            <div className="p-8 border-b border-teal-700">

                <h1 className="text-3xl font-bold">

                    🏡 Mi Cuadro

                </h1>

                <p className="text-teal-200 mt-2">

                    Caja Comunal

                </p>

            </div>

            {/* Información del grupo */}

            <div className="p-6">

                <h2 className="font-semibold">

                    Grupo

                </h2>

                <p className="text-xl mt-2">

                    Los Amigos

                </p>

                <div className="mt-5">

                    <div className="flex justify-between text-sm">

                        <span>Semana</span>

                        <span>4 / 10</span>

                    </div>

                    <div className="bg-teal-700 rounded-full h-3 mt-2">

                        <div className="bg-emerald-400 h-3 rounded-full w-2/5"></div>

                    </div>

                </div>

            </div>

            {/* Menú */}

            <nav className="flex-1 px-4 space-y-1">

  {menu.map((item) => {

    const Icon = item.icon;

    return (
      <NavLink
        key={item.title}
        to={item.path}
        className={({ isActive }) =>
          `
          flex
          items-center
          gap-3
          px-4
          py-3
          rounded-xl
          transition-all
          duration-200

          ${
            isActive
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-teal-50 hover:bg-teal-700"
          }
          `
        }
      >

        <Icon size={20} />

        <span className="font-medium">
          {item.title}
        </span>

      </NavLink>
    );
  })}

</nav>

            {/* Footer */}

            <div className="p-6 border-t border-teal-700">

                <div className="text-sm text-teal-200">

                    Fondo comunitario

                </div>

                <div className="text-3xl font-bold mt-2">

                    $350

                </div>

            </div>

        </aside>

    );

};

export default Sidebar;