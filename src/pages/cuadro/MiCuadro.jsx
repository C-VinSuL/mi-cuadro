
import CuadroSummary from "../../components/cuadro/CuadroSummary";
import CuadroBoard from "../../components/cuadro/CuadroBoard";
import RondaAdmin from "../../components/cuadro/RondaAdmin";

import { useAuth } from "../../context/AuthContext";

const MiCuadro = () => {
  const {
    grupo,
    participant,
    profile,
    loading
  } = useAuth();


  if (loading) {
    return (
      <div
        className="
          rounded-2xl
          bg-white
          p-6
          text-slate-500
        "
      >
        Cargando información...
      </div>
    );
  }


  if (!grupo) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-6
        "
      >

        <h2
          className="
            text-xl
            font-bold
            text-slate-900
          "
        >
          No perteneces a ningún cuadro
        </h2>

        <p
          className="
            mt-2
            text-slate-500
          "
        >
          Cuando seas agregado a un grupo,
          podrás consultar aquí toda la
          información de tu cuadro.
        </p>

      </div>
    );
  }


  const puedeGestionar =
    profile?.rol === "administrador" ||
    profile?.rol === "tesorero";


  return (
    <div className="space-y-8">

      {/* ==================================
          HEADER
      =================================== */}

      <div
        className="
          flex
          flex-col
          gap-5
          lg:flex-row
          lg:items-end
          lg:justify-between
        "
      >

        <div>

          <p
            className="
              text-sm
              font-semibold
              text-emerald-700
            "
          >
            Caja Comunal
          </p>

          <h1
            className="
              mt-1
              text-3xl
              font-bold
              text-slate-900
              md:text-4xl
            "
          >
            Mi Cuadro
          </h1>

          <p
            className="
              mt-2
              text-slate-500
            "
          >
            {grupo.nombre}
          </p>

        </div>


        {/* ESTADO */}

        <div
          className={`
            inline-flex
            w-fit
            items-center
            rounded-full
            px-4
            py-2
            text-sm
            font-semibold

            ${
              grupo.estado === "activo"
                ? `
                  bg-emerald-100
                  text-emerald-700
                `
                : grupo.estado ===
                  "finalizado"
                ? `
                  bg-slate-200
                  text-slate-700
                `
                : `
                  bg-amber-100
                  text-amber-700
                `
            }
          `}
        >

          {grupo.estado === "activo"
            ? "● Cuadro activo"
            : grupo.estado === "finalizado"
            ? "Cuadro finalizado"
            : "● Borrador"
          }

        </div>

      </div>


      {/* ==================================
          RESUMEN
      =================================== */}

      <CuadroSummary
        grupo={grupo}
        participant={participant}
      />


      {/* ==================================
          ADMINISTRACIÓN DE RONDA
      =================================== */}

      {puedeGestionar &&
        grupo.estado === "activo" && (

        <RondaAdmin />

      )}


      {/* ==================================
          TABLERO
      =================================== */}

      <CuadroBoard
        grupo={grupo}
      />

    </div>
  );
};

export default MiCuadro;
