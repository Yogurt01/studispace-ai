import assert from "node:assert/strict";
import test from "node:test";
import { createDeveloperMode, DEVELOPER_TOKEN_TTL_MS } from "./developerMode";

const PASSWORD = "correct horse battery staple";
const env = (overrides: Record<string, string> = {}) => ({ DEVELOPER_MODE_PASSWORD: PASSWORD, ...overrides }) as NodeJS.ProcessEnv;

test("the correct password yields a token that verifies", () => {
  const guard = createDeveloperMode(env());
  const result = guard.unlock(PASSWORD);
  assert.equal(result.status, "unlocked");
  assert.ok(result.status === "unlocked" && guard.verify(result.token));
});

test("an incorrect password is rejected and yields no token", () => {
  // A fresh guard per case, so the brute-force brake never masks the rejection.
  for (const wrong of [PASSWORD.toUpperCase(), `${PASSWORD} `, PASSWORD.slice(0, -1), "", "admin"]) {
    assert.equal(createDeveloperMode(env()).unlock(wrong).status, "invalid", `"${wrong}" must not unlock`);
  }
  // Non-strings from a hand-rolled request body must not throw or pass.
  for (const junk of [undefined, null, 42, {}, [], true]) {
    assert.equal(createDeveloperMode(env()).unlock(junk).status, "invalid");
  }
});

test("the token carries no trace of the password", () => {
  const guard = createDeveloperMode(env());
  const result = guard.unlock(PASSWORD);
  assert.ok(result.status === "unlocked");
  assert.doesNotMatch(result.token, /correct|horse|battery|staple/i);
  // Its payload is an expiry and nothing else.
  const [, payload] = result.token.split(".");
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))), ["exp"]);
});

test("a forged or tampered token never verifies", () => {
  const guard = createDeveloperMode(env());
  const result = guard.unlock(PASSWORD);
  assert.ok(result.status === "unlocked");
  const [version, payload, signature] = result.token.split(".");

  // A payload edited to extend the expiry invalidates the signature.
  const farFuture = Buffer.from(JSON.stringify({ exp: Date.now() + 10 ** 12 })).toString("base64url");
  assert.equal(guard.verify(`${version}.${farFuture}.${signature}`), false);
  // A signature from nowhere.
  assert.equal(guard.verify(`${version}.${payload}.${Buffer.from("nope").toString("base64url")}`), false);
  // Structural junk of every shape.
  for (const junk of ["", "v1", "v1..", "v2.a.b", payload, undefined, null, 7, {}]) {
    assert.equal(guard.verify(junk), false);
  }
});

test("a token signed by a different password does not verify here", () => {
  const mine = createDeveloperMode(env());
  const theirs = createDeveloperMode(env({ DEVELOPER_MODE_PASSWORD: "some other password" }));
  const result = theirs.unlock("some other password");
  assert.ok(result.status === "unlocked");
  assert.equal(mine.verify(result.token), false);
});

test("a token stops verifying once it expires", () => {
  let clock = Date.parse("2026-08-29T09:00:00Z");
  const guard = createDeveloperMode(env(), () => clock);
  const result = guard.unlock(PASSWORD);
  assert.ok(result.status === "unlocked");
  assert.equal(guard.verify(result.token), true);

  clock += DEVELOPER_TOKEN_TTL_MS - 1000;
  assert.equal(guard.verify(result.token), true);
  clock += 2000;
  assert.equal(guard.verify(result.token), false);
});

test("an unconfigured server fails closed: nothing unlocks and nothing verifies", () => {
  const guard = createDeveloperMode({} as NodeJS.ProcessEnv);
  assert.equal(guard.configured, false);
  assert.equal(guard.unlock("").status, "unconfigured");
  assert.equal(guard.unlock("anything at all").status, "unconfigured");
  assert.equal(guard.verify("v1.x.y"), false);
  // A blank password in the environment is not a password.
  assert.equal(createDeveloperMode({ DEVELOPER_MODE_PASSWORD: "   " } as NodeJS.ProcessEnv).configured, false);
});

test("repeated wrong guesses are throttled, and the window reopens later", () => {
  let clock = Date.parse("2026-08-29T09:00:00Z");
  const guard = createDeveloperMode(env(), () => clock);
  let throttled = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (guard.unlock("wrong").status === "throttled") throttled += 1;
  }
  assert.ok(throttled > 0, "an online guessing run must hit the brake");
  // Even the right password is refused while the brake is on.
  assert.equal(guard.unlock(PASSWORD).status, "throttled");

  // ...and the window reopens once it has passed.
  clock += 61_000;
  assert.equal(guard.unlock(PASSWORD).status, "unlocked");
});

test("a successful unlock clears the failure count", () => {
  const guard = createDeveloperMode(env());
  guard.unlock("wrong");
  guard.unlock("wrong");
  assert.equal(guard.unlock(PASSWORD).status, "unlocked");
  // The earlier failures are forgotten, so the next run starts from zero.
  for (let attempt = 0; attempt < 7; attempt += 1) assert.equal(guard.unlock("wrong").status, "invalid");
});
