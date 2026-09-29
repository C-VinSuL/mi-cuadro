import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import LoadingScreen from "../components/ui/Loader/LoadingScreen";

const RoleRoute = ({
  permission,
  children
}) => {
  const { loading, profile } = useAuth();
  const { can } = usePermissions();

  // Esperar a que Supabase cargue sesión y perfil
  if (loading) {
    return <LoadingScreen message="Cargando tu espacio..." />;
  }

  // Si no existe perfil, volver al login
  if (!profile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Si no tiene el permiso solicitado
  if (!can(permission)) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
};

export default RoleRoute;