import { usePermissions } from "../../hooks/usePermissions";
import DashboardAdmin from "./components/DashboardAdmin";
import DashboardTesorero from "./components/DashboardTesorero";
import DashboardSocio from "./components/DashboardSocio";
import { LayoutDashboard } from "lucide-react";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
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
      <section className="space-y-5">
        <SectionPageTitle
          icon={LayoutDashboard}
          eyebrow="Resumen de auditoría"
          title="Inicio"
          description="Consulta los eventos registrados por grupo, usuario y fecha. Los permisos no incluyen operaciones financieras."
        />
        <Link to="/auditoria" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Abrir auditoría</Link>
      </section>
    );
  }

  return (
    <DashboardSocio />
  );
};

export default Dashboard;