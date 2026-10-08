import { usePermissions } from "../../hooks/usePermissions";

import DashboardAdmin from "./components/DashboardAdmin";
import DashboardTesorero from "./components/DashboardTesorero";
import DashboardSocio from "./components/DashboardSocio";
import { Link } from "react-router-dom";

const Dashboard = () => {

  const { rol } =
    usePermissions();

  if (
    rol === "administrador"
  ) {
    return (
      <DashboardAdmin />
    );
  }

  if (
    rol === "tesorero"
  ) {
    return (
      <DashboardTesorero />
    );
  }

  if (rol === "auditor") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-7">
        <p className="text-sm font-semibold text-emerald-700">Acceso de auditoría</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Bienvenido al registro de auditoría</h1>
        <p className="mt-2 text-sm text-slate-600">Consulta los eventos registrados por grupo, usuario y fecha. Los permisos no incluyen operaciones financieras.</p>
        <Link to="/auditoria" className="mt-5 inline-flex rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Abrir auditoría</Link>
      </section>
    );
  }

  return (
    <DashboardSocio />
  );
};

export default Dashboard;