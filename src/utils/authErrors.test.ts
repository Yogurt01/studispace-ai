import assert from "node:assert/strict";
import test from "node:test";
import { describeAuthError } from "./authErrors";

test("a duplicate registration points the student at signing in", () => {
  assert.match(describeAuthError({ code: "auth/email-already-in-use" }), /already registered/i);
});

test("invalid credentials never reveal whether the account exists", () => {
  const wrongPassword = describeAuthError({ code: "auth/wrong-password" });
  assert.equal(describeAuthError({ code: "auth/invalid-credential" }), wrongPassword);
});

test("weak passwords and malformed emails get their own guidance", () => {
  assert.match(describeAuthError({ code: "auth/weak-password" }), /at least 6 characters/i);
  assert.match(describeAuthError({ code: "auth/invalid-email" }), /email address/i);
});

test("unmapped codes fall back to the provider message, then to a generic one", () => {
  assert.equal(describeAuthError({ code: "auth/unknown", message: "Firebase: boom" }), "Firebase: boom");
  assert.equal(describeAuthError(null), "Authentication error occurred.");
  assert.equal(describeAuthError({}), "Authentication error occurred.");
});
