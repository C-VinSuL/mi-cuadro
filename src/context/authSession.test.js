import assert from "node:assert/strict";
import test from "node:test";

import {
  getSessionIdentity,
  getSessionUser,
  isProfileActive,
  shouldClearSessionForInactiveProfile,
  shouldResetIdentity,
  shouldSendWelcomeEmail,
} from "./authSession.js";

test("session helpers resolve the current user and identity consistently", () => {
  const session = { user: { id: "user-42", email: "user@example.com" } };

  assert.deepEqual(getSessionUser(session), { id: "user-42", email: "user@example.com" });
  assert.equal(getSessionIdentity(session), "user-42");
  assert.equal(getSessionIdentity(null), null);
});

test("welcome email is sent only for sign-in events with an active user session", () => {
  assert.equal(shouldSendWelcomeEmail("SIGNED_IN", { user: { id: "u-1" } }), true);
  assert.equal(shouldSendWelcomeEmail("INITIAL_SESSION", { user: { id: "u-2" } }), true);
  assert.equal(shouldSendWelcomeEmail("TOKEN_REFRESHED", { user: { id: "u-3" } }), false);
  assert.equal(shouldSendWelcomeEmail("SIGNED_IN", null), false);
});

test("identity resets when the auth user changes and stays stable across the same session", () => {
  assert.equal(shouldResetIdentity("user-1", { user: { id: "user-2" } }), true);
  assert.equal(shouldResetIdentity("user-2", { user: { id: "user-2" } }), false);
  assert.equal(shouldResetIdentity(null, { user: { id: "user-2" } }), true);
});

test("inactive profiles are blocked and require logout while active profiles remain valid", () => {
  assert.equal(isProfileActive({ activo: true }), true);
  assert.equal(isProfileActive({ activo: false }), false);
  assert.equal(isProfileActive(null), false);

  assert.equal(shouldClearSessionForInactiveProfile({ activo: false }), true);
  assert.equal(shouldClearSessionForInactiveProfile({ activo: true }), false);
  assert.equal(shouldClearSessionForInactiveProfile(null), false);
});
