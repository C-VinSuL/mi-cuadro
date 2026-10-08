import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../config/permissions";

export const usePermissions = () => {
  const { profile } = useAuth();

  const rol =
    profile?.rol?.toLowerCase() || "socio";

  const permissions =
    PERMISSIONS[rol] ||
    PERMISSIONS.socio;

  const can = useCallback((permission) => {
    return Boolean(
      permissions?.[permission]
    );
  }, [permissions]);

  return {
    rol,
    permissions,
    can
  };
};