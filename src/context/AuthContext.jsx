import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { supabase } from "../services/supabase";
import { obtenerSaldoFondo} from "../services/fondoService";
import { PERMISSIONS } from "../config/permissions";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  const [profile, setProfile] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [grupo, setGrupo] = useState(null);
  const [fondoComunitario, setFondoComunitario] = useState(0);
  

  const [loading, setLoading] = useState(true);
  const authRequest = useRef(0);


  // =========================
  // CARGAR PERFIL
  // =========================

  const cargarPerfil = async (userId) => {

    if (!userId) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select(`
        id,
        nombre,
        apellido,
        telefono,
        rol
      `)
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error cargando perfil:", error);
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  };


  // =========================
  // CARGAR GRUPO
  // =========================

  const cargarGrupo = async (
    grupoId,
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true
  ) => {

    if (!grupoId) {
      setGrupo(null);
      return;
    }

    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("id", grupoId)
      .single();

    if (error) {
      console.error("Error cargando grupo:", error);
      setGrupo(null);
      setFondoComunitario(0);
      return;
    }

    setGrupo(data);
    if (puedeVerFondo) {
      await cargarFondoComunitario(data.id, puedeVerFondo);
    } else {
      setFondoComunitario(0);
    }
  };


  // =========================
  // CARGAR PARTICIPANTE
  // =========================

  const cargarParticipante = async (
    userId,
    rol = profile?.rol
  ) => {

    if (!userId) {
      setParticipant(null);
      setGrupo(null);
      setFondoComunitario(0);
      return;
    }

    const { data, error } = await supabase
      .from("participantes")
      .select(`
        id,
        nombre,
        posicion,
        estado,
        grupo_id,
        perfil_id
      `)
      .eq("perfil_id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "Error cargando participante:",
        error
      );

      setParticipant(null);
      setGrupo(null);
      setFondoComunitario(0);

      return;
    }

    setParticipant(data);

    // Cargar grupo del participante
    if (data?.grupo_id) {
      const puedeVerFondo =
        PERMISSIONS[rol?.toLowerCase()]?.verFondoComunitario === true;
      await cargarGrupo(data.grupo_id, puedeVerFondo);
    } else {
      setGrupo(null);
      setFondoComunitario(0);
    }
  };


  // =========================
  // CARGAR USUARIO
  // =========================

  const cargarDatosUsuario = async (session) => {

    setSession(session);

    const currentUser =
      session?.user ?? null;

    setUser(currentUser);

    if (!currentUser) {

      setProfile(null);
      setParticipant(null);
      setGrupo(null);
      setFondoComunitario(0);

      return;
    }

    const currentProfile = await cargarPerfil(
      currentUser.id
    );

    await cargarParticipante(
      currentUser.id,
      currentProfile?.rol
    );
  };

  // =========================
  // CARGAR FONDO COMUNITARIO
  // =========================


const cargarFondoComunitario =
  async (
    grupoId,
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true
  ) => {

    if (!grupoId || !puedeVerFondo) {

      setFondoComunitario(0);

      return 0;

    }


    try {

      const saldo =
        await obtenerSaldoFondo(
          grupoId
        );


      setFondoComunitario(
        saldo
      );


      return saldo;

    } catch (error) {

      console.error(
        "Error cargando fondo comunitario:",
        error
      );

      setFondoComunitario(0);

      return 0;

    }

  };


  // =========================
  // SESIÓN
  // =========================

  useEffect(() => {
    const {
      data: { subscription }
    } =
      supabase.auth.onAuthStateChange(
        (event, nextSession) => {
          const requestId = ++authRequest.current;

          setSession(nextSession);
          setUser(nextSession?.user ?? null);

          if (event === "TOKEN_REFRESHED") {
            return;
          }

          setLoading(true);

          // Supabase recomienda salir del callback antes de hacer otras consultas.
          setTimeout(async () => {
            try {
              await cargarDatosUsuario(nextSession);
            } finally {
              if (requestId === authRequest.current) {
                setLoading(false);
              }
            }
          }, 0);
        }
      );

    return () => {
      authRequest.current += 1;
      subscription.unsubscribe();
    };

  }, []);


  // =========================
  // CONTEXTO
  // =========================

  const value = {
    user,
    session,

    profile,
    participant,
    grupo,
    fondoComunitario,
    loading,

    cargarPerfil,
    cargarParticipante,
    cargarGrupo,
    cargarFondoComunitario
  };


  return (

    <AuthContext.Provider
      value={value}
    >

      {children}

    </AuthContext.Provider>

  );
};

// =========================
// HOOK
// =========================

export const useAuth = () => {

  return useContext(
    AuthContext
  );

};