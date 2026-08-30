import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { OcrUnavailableError, recognizeTranscriptImage } from "./ocr";

/**
 * These stay hermetic: they cover the guards that run before the Tesseract
 * worker is ever started. The worker itself needs the ~5MB language model, so
 * exercising it belongs in the local E2E suite, not in CI.
 */

test("an empty image is refused before a worker is started", async () => {
  await assert.rejects(
    () => recognizeTranscriptImage(Buffer.alloc(0)),
    (err: Error) => {
      assert.ok(err instanceof OcrUnavailableError);
      assert.match(err.message, /no image data/i);
      return true;
    }
  );
});

test("failures arrive as a catchable rejection, not as a process-level throw", async () => {
  // The crash this guards against: tesseract.js rethrows worker-side errors from
  // inside its own message callback when no errorHandler is supplied, which
  // lands in process.nextTick where no caller can catch it and takes the server
  // down. Anything this module reports must be awaitable and catchable.
  const result = await recognizeTranscriptImage(Buffer.alloc(0)).then(
    () => "resolved",
    (err) => err
  );

  assert.ok(result instanceof OcrUnavailableError);
});

test("OcrUnavailableError keeps the underlying cause for the server log", () => {
  const cause = new Error("ENOENT: no such file or directory");
  const err = new OcrUnavailableError("wrapped", cause);

  assert.equal(err.cause, cause);
  assert.equal(err.name, "OcrUnavailableError");
});

test("the default cache path is a writable directory outside the app root", () => {
  // The container runs as an unprivileged user in /app, so Tesseract's default
  // of "write the model next to the process" is not available to it.
  const expected = path.join(os.tmpdir(), "studispace-tesseract");

  assert.equal(path.isAbsolute(expected), true);
  assert.ok(!expected.startsWith(process.cwd()), "the cache must not live in the app root");

  // mkdirSync({ recursive: true }) is what the module relies on: it must be safe
  // both when the directory is missing and when it already exists.
  fs.mkdirSync(expected, { recursive: true });
  fs.mkdirSync(expected, { recursive: true });
  assert.equal(fs.existsSync(expected), true);
});
