import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getPermissionsForRole,
  normalizeRole
} from "../config/permissions";

export const usePermissions = () => {
  const { profile } = useAuth();

  const rol = normalizeRole(profile?.rol);
  const permissions = getPermissionsForRole(rol);

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