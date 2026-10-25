import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import LoadingScreen from "../components/ui/Loader/LoadingScreen";
import { evaluateRoleRoute } from "./accessGuards";

const RoleRoute = ({
  permission,
  children
}) => {
  const { loading, profile } = useAuth();
  const { can } = usePermissions();

  const routeState = evaluateRoleRoute({
    loading,
    profile,
    permission,
    canPermission: can,
  });

  if (routeState.type === "loading") {
    return <LoadingScreen message={routeState.message} />;
  }

  if (routeState.type === "redirect") {
    return <Navigate to={routeState.to} replace={routeState.replace} />;
  }

  return children;
};

export default RoleRoute;