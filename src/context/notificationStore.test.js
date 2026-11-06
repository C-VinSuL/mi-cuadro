import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_NOTIFICATION_TYPES,
  getNotificationType,
  isAllowedNotification,
  NOTIFICATION_TYPES
} from "./notificationStore.js";

test("the allowlist contains only attention-worthy events and incoming chat messages", () => {
  assert.deepEqual(ALLOWED_NOTIFICATION_TYPES, [
    "chat_message",
    "group_access_request",
    "contribution_receipt",
    "wallet_request",
    "support_conversation",
    "document_verification"
  ]);
});

test("notification sources map to their approved categories", () => {
  const allowedSources = [
    ["chat-mensaje:channel-1", NOTIFICATION_TYPES.CHAT_MESSAGE],
    ["solicitud-grupo:request-1:pendiente:2026-01-01", NOTIFICATION_TYPES.GROUP_ACCESS_REQUEST],
    ["invitacion-grupo:request-2:pendiente", NOTIFICATION_TYPES.GROUP_ACCESS_REQUEST],
    ["aporte-pendiente:receipt-1:2026-01-01", NOTIFICATION_TYPES.CONTRIBUTION_RECEIPT],
    ["billetera-pendiente:wallet-1", NOTIFICATION_TYPES.WALLET_REQUEST],
    ["solicitud-billetera:wallet-2:pendiente", NOTIFICATION_TYPES.WALLET_REQUEST],
    ["moki-conversacion:conversation-1", NOTIFICATION_TYPES.SUPPORT_CONVERSATION],
    ["documento-por-verificar:profile-1", NOTIFICATION_TYPES.DOCUMENT_VERIFICATION]
  ];

  for (const [source, category] of allowedSources) {
    assert.equal(getNotificationType({ source }), category);
    assert.equal(isAllowedNotification({ source }), true);
  }
});

test("notifications for sessions, new accounts, own decisions, and system events are hidden", () => {
  const disallowedSources = [
    "nueva-cuenta:user-1",
    "mfa-reset:user-1:request-1",
    "solicitud-grupo:request-1:aprobada:2026-01-01",
    "solicitud-billetera:wallet-1:aprobada",
    null
  ];

  for (const source of disallowedSources) {
    assert.equal(isAllowedNotification({ source }), false);
  }

  assert.equal(isAllowedNotification({ title: "Sesión iniciada" }), false);
  assert.equal(isAllowedNotification({ title: "Nueva cuenta registrada" }), false);
});
