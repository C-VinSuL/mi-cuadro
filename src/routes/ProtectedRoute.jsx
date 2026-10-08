import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/ui/Loader/LoadingScreen";
import { supabase } from "../services/supabase";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mfaState, setMfaState] = useState({ userId: null, verified: false, loading: true });

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Error verificando nivel de MFA:", error);
        setMfaState({ userId: user.id, verified: false, loading: false });
        return;
      }
      setMfaState({
        userId: user.id,
        verified: data.currentLevel === "aal2",
        loading: false
      });
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (loading) {
    return <LoadingScreen message="Verificando tu sesión..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (mfaState.userId !== user.id || mfaState.loading) {
    return <LoadingScreen message="Verificando la seguridad de tu cuenta..." />;
  }

  if (!mfaState.verified) {
    return <Navigate to="/seguridad/mfa" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;