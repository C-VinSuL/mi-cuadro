export const evaluateProtectedRoute = ({ loading, user, mfaState, location }) => {
  if (loading) {
    return {
      type: "loading",
      message: "Verificando tu sesión...",
    };
  }

  if (!user) {
    return {
      type: "redirect",
      to: "/login",
      replace: true,
    };
  }

  if (mfaState.userId !== user.id || mfaState.loading) {
    return {
      type: "loading",
      message: "Verificando la seguridad de tu cuenta...",
    };
  }

  if (!mfaState.verified) {
    return {
      type: "redirect",
      to: "/seguridad/mfa",
      replace: true,
      state: { from: location },
    };
  }

  return { type: "allow" };
};

export const evaluateRoleRoute = ({ loading, profile, permission, canPermission }) => {
  if (loading) {
    return {
      type: "loading",
      message: "Cargando tu espacio...",
    };
  }

  if (!profile) {
    return {
      type: "redirect",
      to: "/login",
      replace: true,
    };
  }

  if (!canPermission(permission)) {
    return {
      type: "redirect",
      to: "/",
      replace: true,
    };
  }

  return { type: "allow" };
};
