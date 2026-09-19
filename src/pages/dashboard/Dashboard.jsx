import { usePermissions } from "../../hooks/usePermissions";

import DashboardAdmin from "./components/DashboardAdmin";
import DashboardTesorero from "./components/DashboardTesorero";
import DashboardSocio from "./components/DashboardSocio";

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

  return (
    <DashboardSocio />
  );
};

export default Dashboard;