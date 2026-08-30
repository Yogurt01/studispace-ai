/**
 * Local OCR for transcript images, used only when the Gemini Vision engine is
 * unavailable — no API key, an unreachable endpoint, or a 429 once the quota is
 * spent.
 *
 * Tesseract is imported lazily so a server that never falls back never pays for
 * loading it, and so a broken or absent install degrades into a clear message
 * rather than stopping the process from booting.
 *
 * Everything here is written so that a failure returns an error to one request
 * instead of taking the server down. That is not the default: see the notes on
 * errorHandler and langPath below, both of which have bitten this endpoint.
 */

import fs from "fs";
import os from "os";
import path from "path";

/**
 * Where the ~5MB English language model is cached.
 *
 * Tesseract writes it into the process working directory by default, which in
 * the container is /app running as an unprivileged user, so point it somewhere
 * writable and out of the way. Pre-populate this directory with
 * `eng.traineddata` to skip the first-use download entirely.
 */
const CACHE_PATH = process.env.TESSERACT_CACHE_PATH || path.join(os.tmpdir(), "studispace-tesseract");

/** OCR of a full transcript page runs in seconds; anything beyond this is stuck. */
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 60_000);

export class OcrUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

/**
 * The cache directory must exist before the worker starts.
 *
 * Tesseract does not create it. Without it the download still succeeds but is
 * never written back, so every single request re-fetches 5MB — which is most of
 * why the fallback felt like it was hanging.
 */
function ensureCacheDirectory(): void {
  try {
    fs.mkdirSync(CACHE_PATH, { recursive: true });
  } catch (err) {
    // Not fatal: without a cache the engine still works, it just re-downloads.
    console.warn(`Could not create the OCR cache directory at ${CACHE_PATH}:`, err);
  }
}

let workerPromise: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      let createWorker: (...args: any[]) => Promise<any>;
      try {
        ({ createWorker } = await import("tesseract.js"));
      } catch (err) {
        throw new OcrUnavailableError(
          "The local OCR engine (tesseract.js) is not installed on this server.",
          err
        );
      }

      ensureCacheDirectory();

      try {
        return await createWorker("eng", 1, {
          // cachePath only, never langPath. Setting langPath to a directory
          // tells Tesseract the language data is already on disk there and to
          // load it from the filesystem instead of fetching it, so a first run
          // died on `ENOENT ... eng.traineddata.gz` — and creating the directory
          // did not help, because an empty directory still has no model in it.
          // As a cache path the same directory is populated by the first
          // download and reused afterwards, which is the behaviour intended all
          // along.
          cachePath: CACHE_PATH,
          // Without an errorHandler, tesseract.js rethrows any worker-side
          // rejection from inside its message callback:
          //     if (errorHandler) errorHandler(data); else throw Error(data);
          // That throw lands in process.nextTick, where no try/catch of ours can
          // reach it, so a failed model download killed the whole Node process
          // rather than failing one request. Supplying a handler is what turns
          // it back into a value we can act on.
          errorHandler: (err: unknown) => {
            console.error("Tesseract worker error:", err);
          },
          // Tesseract's own progress logging is noise in the server log.
          logger: () => {},
        });
      } catch (err) {
        throw new OcrUnavailableError(
          "The local OCR engine could not load its English language data. It is downloaded on first use, so this server needs either outbound network access or an `eng.traineddata` file in TESSERACT_CACHE_PATH.",
          err
        );
      }
    })();

    // A failed start must not be cached, or every later request inherits it.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }

  return workerPromise;
}

/**
 * Reads the text out of a transcript image. The result is deliberately raw:
 * turning it into course rows is parseTranscriptTable's job.
 *
 * Throws OcrUnavailableError rather than letting anything escape asynchronously,
 * so the caller can fall back or report, and the server stays up either way.
 */
export async function recognizeTranscriptImage(image: Buffer): Promise<string> {
  if (!image || image.length === 0) {
    throw new OcrUnavailableError("There was no image data to read.");
  }

  const worker = await getWorker();

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new OcrUnavailableError(`Local OCR did not finish within ${OCR_TIMEOUT_MS}ms.`)),
      OCR_TIMEOUT_MS
    );
    timer.unref?.();
  });

  try {
    const recognition = worker
      .recognize(image)
      .then((result: any) => result?.data?.text ?? "");

    return await Promise.race([recognition, timeout]);
  } catch (err) {
    if (err instanceof OcrUnavailableError) {
      // A timed-out worker is in an unknown state; drop it so the next request
      // starts a fresh one rather than queueing behind a stuck job.
      void shutdownOcr();
      throw err;
    }
    throw new OcrUnavailableError(
      "The local OCR engine failed while reading this image.",
      err
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Releases the worker; used on timeout and when the process is shutting down. */
export async function shutdownOcr(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Nothing to release.
  }
}
