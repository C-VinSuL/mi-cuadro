import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSeenStartupSplash,
  markStartupSplashShown,
} from "./startupSplash.js";

test("startup splash is marked once and remains hidden for the browser tab session", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(hasSeenStartupSplash(storage), false);
  markStartupSplashShown(storage);
  assert.equal(hasSeenStartupSplash(storage), true);
});
