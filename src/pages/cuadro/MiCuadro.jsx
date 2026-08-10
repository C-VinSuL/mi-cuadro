import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

import CuadroSummary from "../../components/cuadro/CuadroSummary";
import CuadroBoard from "../../components/cuadro/CuadroBoard";

const MiCuadro = () => {
  const [grupo, setGrupo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obtenerGrupo();
  }, []);

  const obtenerGrupo = async () => {
    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("estado", "activo")
      .limit(1)
      .single();

    if (error) {
      console.error("Error al cargar grupo:", error);
    } else {
      setGrupo(data);
    }

    setLoading(false);
  };

  if (loading) {
    return <p>Cargando grupo...</p>;
  }

  if (!grupo) {
    return <p>No se encontró un grupo activo.</p>;
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

      <CuadroSummary grupo={grupo} />

      <CuadroBoard grupo={grupo} />

    </div>
  );
};

export default MiCuadro;