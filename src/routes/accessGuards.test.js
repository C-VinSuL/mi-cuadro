import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateProtectedRoute,
  evaluateRoleRoute,
} from "./accessGuards.js";

test("protected route keeps authenticated users in a loading screen while MFA is being checked", () => {
  const result = evaluateProtectedRoute({
    loading: false,
    user: { id: "u-1" },
    mfaState: { userId: "u-1", verified: false, loading: true },
    location: { pathname: "/grupos" },
  });

  assert.deepEqual(result, {
    type: "loading",
    message: "Verificando la seguridad de tu cuenta...",
  });
});

test("protected route redirects unauthenticated users to login", () => {
  const result = evaluateProtectedRoute({
    loading: false,
    user: null,
    mfaState: { userId: null, verified: false, loading: true },
    location: { pathname: "/grupos" },
  });

  assert.deepEqual(result, {
    type: "redirect",
    to: "/login",
    replace: true,
    state: { from: { pathname: "/grupos" } },
  });
});

test("protected route blocks users until MFA is confirmed for the active session", () => {
  const result = evaluateProtectedRoute({
    loading: false,
    user: { id: "u-9" },
    mfaState: { userId: "u-9", verified: false, loading: false },
    location: { pathname: "/reportes" },
  });

  assert.deepEqual(result, {
    type: "redirect",
    to: "/seguridad/mfa",
    replace: true,
    state: { from: { pathname: "/reportes" } },
  });
});

test("role route redirects unauthenticated users and users without permission", () => {
  assert.deepEqual(
    evaluateRoleRoute({
      loading: false,
      profile: null,
      permission: "gestionarUsuarios",
      canPermission: () => true,
    }),
    {
      type: "redirect",
      to: "/login",
      replace: true,
    }
  );

  assert.deepEqual(
    evaluateRoleRoute({
      loading: false,
      profile: { rol: "socio" },
      permission: "gestionarUsuarios",
      canPermission: () => false,
    }),
    {
      type: "redirect",
      to: "/",
      replace: true,
    }
  );
});

test("role route allows access when the user has the required permission", () => {
  const result = evaluateRoleRoute({
    loading: false,
    profile: { rol: "administrador" },
    permission: "gestionarUsuarios",
    canPermission: (permission) => permission === "gestionarUsuarios",
  });

  assert.deepEqual(result, { type: "allow" });
});
