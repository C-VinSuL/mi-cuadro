import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/ui/Loader/LoadingScreen";
import { supabase } from "../services/supabase";
import { evaluateProtectedRoute } from "./accessGuards";

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

  const routeState = evaluateProtectedRoute({
    loading,
    user,
    mfaState,
    location,
  });

  if (routeState.type === "loading") {
    return <LoadingScreen message={routeState.message} />;
  }

  if (routeState.type === "redirect") {
    return <Navigate to={routeState.to} replace={routeState.replace} state={routeState.state} />;
  }

  return children;
};

export default ProtectedRoute;