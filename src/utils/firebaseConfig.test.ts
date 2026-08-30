import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FirebaseWebConfig,
  PLACEHOLDER_API_KEY,
  resolveFirebaseConfig,
} from "./firebaseConfig";

function config(overrides: Partial<FirebaseWebConfig> = {}): FirebaseWebConfig {
  return {
    apiKey: "AIzaSyExample",
    authDomain: "studispace.firebaseapp.com",
    projectId: "studispace",
    storageBucket: "studispace.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:abc",
    ...overrides,
  };
}

test("a complete configuration is passed through untouched", () => {
  const raw = config();
  const { config: resolved, error } = resolveFirebaseConfig(raw);

  assert.equal(error, null);
  assert.deepEqual(resolved, raw);
});

test("a missing API key is replaced so getAuth cannot throw at import time", () => {
  // getAuth() throws auth/invalid-api-key synchronously on a blank key, during
  // module evaluation, which used to blank the whole app before it rendered.
  const { config: resolved, error } = resolveFirebaseConfig(config({ apiKey: "" }));

  assert.equal(resolved.apiKey, PLACEHOLDER_API_KEY);
  assert.notEqual(error, null);
  assert.match(String(error), /VITE_FIREBASE_API_KEY/);
});

test("the placeholder is obviously not a real key", () => {
  assert.match(PLACEHOLDER_API_KEY, /missing/i);
});

test("every missing variable is named, so the fix is not guesswork", () => {
  const { error } = resolveFirebaseConfig(
    config({ apiKey: "", authDomain: "", projectId: "", appId: "" })
  );

  for (const name of [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ]) {
    assert.match(String(error), new RegExp(name));
  }
});

test("the error says Guest Scholar still works, because it does", () => {
  const { error } = resolveFirebaseConfig(config({ apiKey: "" }));
  assert.match(String(error), /Guest Scholar/);
});

test("a key supplied by the student is never overwritten by the placeholder", () => {
  // A wrong-but-present key must reach Firebase: it fails at the network with a
  // specific error, which is more useful than pretending the key is absent.
  const { config: resolved, error } = resolveFirebaseConfig(
    config({ apiKey: "wrong-but-present", projectId: "" })
  );

  assert.equal(resolved.apiKey, "wrong-but-present");
  assert.notEqual(error, null);
});

test("optional variables do not make the configuration incomplete", () => {
  // storageBucket and messagingSenderId are not in the required set: a project
  // without Storage configured should still sign students in.
  const { error } = resolveFirebaseConfig(config({ storageBucket: "", messagingSenderId: "" }));
  assert.equal(error, null);
});
