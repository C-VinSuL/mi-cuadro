export const PERMISSIONS = {
  administrador: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: true,
    agregarIntegrantes: true,
    iniciarCuadro: true,
    corregirCapacidad: true,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: true,
    verFondoComunitario: true,
    verSimulacion: true,
    verVistaSocio: true,
  
    
    verHistorialCompleto: true,
    verConfiguracion: true
  },

  tesorero: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: false,
    agregarIntegrantes: false,
    iniciarCuadro: false,
    corregirCapacidad: false,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: true,
    verFondoComunitario: true,
    verSimulacion: false,
    verVistaSocio: false,

    verHistorialCompleto: true,
    verConfiguracion: false
  },

  socio: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: false,
    agregarIntegrantes: false,
    iniciarCuadro: false,
    corregirCapacidad: false,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: false,

    verCuadro: true,
    cerrarRonda: false,

    verPrestamos: true,
    solicitarPrestamo: true,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verSimulacion: false,
    verVistaSocio: false,

    verHistorialCompleto: false,
    verConfiguracion: false
  }
};