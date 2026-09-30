export const PERMISSIONS = {
  administrador: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: true,
    iniciarCuadro: true,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: true,
    verFondoComunitario: true,
    verVistaSocio: true,
  
    
    verHistorialCompleto: true,
    verConfiguracion: true
  },

  tesorero: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: false,
    iniciarCuadro: true,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: true,
    verFondoComunitario: true,
    verVistaSocio: false,

    verHistorialCompleto: true,
    verConfiguracion: false
  },

  socio: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: false,
    iniciarCuadro: false,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: false,

    verCuadro: true,
    cerrarRonda: false,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verVistaSocio: false,

    verHistorialCompleto: false,
    verConfiguracion: false
  }
};