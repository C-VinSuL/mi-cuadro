import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

import CuadroSummary from "../../components/cuadro/CuadroSummary";
import CuadroBoard from "../../components/cuadro/CuadroBoard";
import { useAuth } from "../../context/AuthContext";

const MiCuadro = () => {
  const {
    grupo,
    participant,
    loading
  } = useAuth();

  if (loading) {
    return <p>Cargando información...</p>;
  }

  if (!grupo) {
    return (
      <div className="bg-white rounded-2xl p-6">
        <h2 className="text-xl font-bold">
          No perteneces a ningún cuadro
        </h2>

        <p className="text-slate-500 mt-2">
          Cuando seas agregado a un grupo, podrás verlo aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      <div>
        <p className="text-sm font-semibold text-emerald-700">
          Caja Comunal
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Mi Cuadro
        </h1>

        <p className="text-slate-500 mt-1">
          {grupo.nombre}
        </p>
      </div>

      <CuadroSummary
        grupo={grupo}
        participant={participant}
      />

      <CuadroBoard
        grupo={grupo}
      />

    </div>
  );
};

export default MiCuadro;