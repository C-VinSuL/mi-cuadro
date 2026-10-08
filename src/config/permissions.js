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

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: true,
    verHistorialCompleto: true,
    verConfiguracion: true,
    gestionarUsuarios: true,
    verAuditoria: true,
    verificarDocumentos: true,
    verBilletera: false,
    gestionarBilletera: true,
    verListaParticipantesGrupo: true
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

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: true,
    verHistorialCompleto: true,
    verConfiguracion: false,
    gestionarUsuarios: false,
    verAuditoria: false,
    verificarDocumentos: true,
    verBilletera: false,
    gestionarBilletera: true,
    verListaParticipantesGrupo: true
  },

  auditor: {
    verDashboard: true,
    verGrupo: false,
    gestionarGrupo: false,
    iniciarCuadro: false,
    verAportes: false,
    registrarAporte: false,
    gestionarAportes: false,
    verCuadro: false,
    cerrarRonda: false,
    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verHistorialCompleto: false,
    verConfiguracion: false,
    gestionarUsuarios: false,
    verAuditoria: true,
    verificarDocumentos: false,
    verBilletera: false,
    gestionarBilletera: false,
    verListaParticipantesGrupo: false
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

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verHistorialCompleto: false,
    verConfiguracion: false,
    gestionarUsuarios: false,
    verAuditoria: false,
    verificarDocumentos: false,
    verBilletera: true,
    gestionarBilletera: false,
    verListaParticipantesGrupo: false
  }
};