import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessFinancialOperation,
  canAccessPermission,
  getPermissionsForRole,
  normalizeRole
} from "./permissions.js";

test("normalizeRole defaults to socio for empty or unknown values", () => {
  assert.equal(normalizeRole(" ADMINISTRADOR "), "administrador");
  assert.equal(normalizeRole(undefined), "socio");
  assert.equal(normalizeRole("invitado"), "invitado");
  assert.equal(normalizeRole(""), "socio");
});

test("permission checks grant access only to the matching role scopes", () => {
  assert.equal(getPermissionsForRole("administrador").gestionarUsuarios, true);
  assert.equal(getPermissionsForRole("tesorero").gestionarEgresos, true);
  assert.equal(getPermissionsForRole("auditor").verAuditoria, true);
  assert.equal(getPermissionsForRole("socio").verBilletera, true);

  assert.equal(canAccessPermission("administrador", "gestionarUsuarios"), true);
  assert.equal(canAccessPermission("tesorero", "gestionarEgresos"), true);
  assert.equal(canAccessPermission("socio", "gestionarUsuarios"), false);
  assert.equal(canAccessPermission("auditor", "verGrupo"), false);
  assert.equal(canAccessPermission("desconocido", "verDashboard"), true);
});

test("financial operations enforce the expected role gate for auth and treasury flows", () => {
  assert.equal(canAccessFinancialOperation("administrador", "registrarAporte"), true);
  assert.equal(canAccessFinancialOperation("tesorero", "gestionarEgresos"), true);
  assert.equal(canAccessFinancialOperation("socio", "consultarSaldo"), true);
  assert.equal(canAccessFinancialOperation("auditor", "gestionarBilletera"), false);
  assert.equal(canAccessFinancialOperation("desconocido", "consultarSaldo"), false);
});
