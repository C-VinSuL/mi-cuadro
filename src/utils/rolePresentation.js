export const ROLE_LABELS = {
  socio: "Socio",
  tesorero: "Tesorería",
  administrador: "Administración",
  auditor: "Auditoría"
};

export const getRoleLabel = (role) => (
  ROLE_LABELS[role?.toLowerCase()] || ROLE_LABELS.socio
);
