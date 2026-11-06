import { usePermissions } from "../../hooks/usePermissions";
import DashboardAdmin from "./components/DashboardAdmin";
import DashboardTesorero from "./components/DashboardTesorero";
import DashboardSocio from "./components/DashboardSocio";
import DashboardAuditor from "./components/DashboardAuditor";

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
    return <DashboardAuditor />;
  }

  return (
    <DashboardSocio />
  );
};

export default Dashboard;