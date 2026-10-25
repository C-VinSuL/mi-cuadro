import assert from "node:assert/strict";
import { test } from "node:test";
import { logOperationalError } from "./logOperationalError.js";

test("logs diagnostic metadata without exposing error messages or payloads", () => {
  const originalConsoleError = console.error;
  let loggedArguments;
  console.error = (...args) => {
    loggedArguments = args;
  };

  try {
    logOperationalError("Financial operation failed", {
      name: "StorageError",
      code: "403",
      status: 403,
      message: "private URL or uploaded-file contents",
      details: "sensitive response details",
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(loggedArguments, [
    "Financial operation failed",
    { name: "StorageError", code: "403", status: 403 },
  ]);
});
