import {
  Bell,
  LogOut,
  Menu,
  ChevronDown
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";

const Navbar = ({ onMenuClick }) => {

  const navigate = useNavigate();

  const {
    profile,
    participant
  } = useAuth();


  const handleLogout = async () => {

    const { error } =
      await supabase.auth.signOut();

    if (error) {

      console.error(
        "Error cerrando sesión:",
        error
      );

      return;
    }

    navigate("/login");
  };


  const inicial =
    profile?.nombre
      ?.charAt(0)
      ?.toUpperCase() || "U";


  return (
    <header
      className="
        sticky
        top-0
        z-30

        min-h-[82px]

        bg-white/95
        backdrop-blur

        border-b
        border-slate-200

        flex
        items-center
        justify-between

        px-4
        sm:px-6
        md:px-8
        xl:px-12
      "
    >

      {/* IZQUIERDA */}

      <div className="flex items-center gap-4">

        {/* BOTÓN MOBILE */}

        <button
          onClick={onMenuClick}
          className="
            lg:hidden

            w-11
            h-11

            flex
            items-center
            justify-center

            rounded-xl

            bg-emerald-50
            text-emerald-800

            hover:bg-emerald-100
            transition
          "
          aria-label="Abrir menú"
        >
          <Menu size={23} />
        </button>


        {/* SALUDO */}

        <div>

          <p
            className="
              hidden
              sm:block

              text-[11px]
              uppercase
              tracking-[0.15em]
              text-emerald-700
              font-semibold
            "
          >
            Panel principal
          </p>

          <h1
            className="
              text-lg
              sm:text-xl
              md:text-2xl
              font-bold
              text-slate-900
            "
          >
            Hola, {profile?.nombre || "Usuario"} 👋
          </h1>

          <p
            className="
              hidden
              sm:block
              text-sm
              text-slate-500
              mt-1
            "
          >
            Bienvenido a tu caja comunal.
          </p>

        </div>

      </div>


      {/* DERECHA */}

      <div className="flex items-center gap-2 sm:gap-3">

        {/* NOTIFICACIONES */}

        <button
          className="
            relative

            w-11
            h-11

            flex
            items-center
            justify-center

            rounded-xl

            text-slate-600
            hover:bg-slate-100

            transition
          "
        >

          <Bell size={20} />

          <span
            className="
              absolute
              top-[9px]
              right-[9px]

              w-2
              h-2

              bg-red-500
              rounded-full

              border-2
              border-white
            "
          />

        </button>


        {/* USUARIO */}

        <div
          className="
            hidden
            sm:flex

            items-center
            gap-3

            px-3
            py-2

            rounded-xl

            hover:bg-slate-50
          "
        >

          <div
            className="
              w-10
              h-10

              rounded-full

              bg-emerald-100
              text-emerald-700

              flex
              items-center
              justify-center

              font-bold
            "
          >
            {inicial}
          </div>

          <div className="hidden md:block">

            <p
              className="
                text-sm
                font-semibold
                text-slate-900
              "
            >
              {profile?.nombre}{" "}
              {profile?.apellido}
            </p>

            <div
              className="
                flex
                gap-2

                text-xs
                text-slate-500
              "
            >

              <span className="capitalize">
                {profile?.rol || "Socio"}
              </span>

              {participant && (
                <>
                  <span>•</span>

                  <span>
                    Puesto #{participant.posicion}
                  </span>
                </>
              )}

            </div>

          </div>

          <ChevronDown
            size={15}
            className="
              hidden
              md:block
              text-slate-400
            "
          />

        </div>


        {/* SALIR */}

        <button
          onClick={handleLogout}
          className="
            flex
            items-center
            gap-2

            px-3
            sm:px-4

            py-2.5

            rounded-xl

            text-red-600

            hover:bg-red-50

            transition
          "
        >

          <LogOut size={18} />

          <span className="hidden xl:block text-sm font-medium">
            Cerrar sesión
          </span>

        </button>

      </div>

    </header>
  );
};

export default Navbar;