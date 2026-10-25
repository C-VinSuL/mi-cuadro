export const PERMISSIONS = {
  administrador: {
    verDashboard: true,
    verGrupo: true,
    gestionarGrupo: true,
    iniciarCuadro: true,

    verAportes: true,
    registrarAporte: true,
    gestionarAportes: true,
    gestionarEgresos: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: true,
    verHistorialCompleto: true,
    verConfiguracion: true,
    gestionarUsuarios: true,
    gestionarAtencionSocios: true,
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
    gestionarEgresos: true,

    verCuadro: true,
    cerrarRonda: true,

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: true,
    verHistorialCompleto: true,
    verConfiguracion: false,
    gestionarUsuarios: false,
    gestionarAtencionSocios: false,
    verAuditoria: false,
    verificarDocumentos: false,
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
    gestionarEgresos: false,
    verCuadro: false,
    cerrarRonda: false,
    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verHistorialCompleto: false,
    verConfiguracion: false,
    gestionarUsuarios: false,
    gestionarAtencionSocios: false,
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
    gestionarEgresos: false,

    verCuadro: true,
    cerrarRonda: false,

    verPrestamos: false,
    solicitarPrestamo: false,
    aprobarPrestamos: false,
    verFondoComunitario: false,
    verHistorialCompleto: false,
    verConfiguracion: false,
    gestionarUsuarios: false,
    gestionarAtencionSocios: false,
    verAuditoria: false,
    verificarDocumentos: false,
    verBilletera: true,
    gestionarBilletera: false,
    verListaParticipantesGrupo: false
  }
};

export const normalizeRole = (role) => {
  if (typeof role !== "string") {
    return "socio";
  }

  const normalizedRole = role.trim().toLowerCase();
  return normalizedRole || "socio";
};

export const getPermissionsForRole = (role = "socio") => {
  const normalizedRole = normalizeRole(role);
  return PERMISSIONS[normalizedRole] || PERMISSIONS.socio;
};

export const canAccessPermission = (role, permission) => {
  if (!permission) {
    return false;
  }

  return Boolean(getPermissionsForRole(role)?.[permission]);
};

export const FINANCIAL_OPERATION_ACCESS = {
  consultarSaldo: ["administrador", "tesorero", "socio"],
  registrarAporte: ["administrador", "tesorero", "socio"],
  gestionarEgresos: ["administrador", "tesorero"],
  gestionarBilletera: ["administrador", "tesorero"],
  verHistorialFinanciero: ["administrador", "tesorero"]
};

export const canAccessFinancialOperation = (role, operation) => {
  const allowedRoles = FINANCIAL_OPERATION_ACCESS[operation];
  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(normalizeRole(role));
};