/**
 * Local OCR for transcript images, used only when the Gemini Vision engine is
 * unavailable.
 *
 * Tesseract is imported lazily so that a server which never falls back never
 * pays for loading it, and so a broken or absent install degrades into a clear
 * message instead of stopping the process from booting.
 */

import os from "os";
import path from "path";

/**
 * Where the ~5MB English language model is kept. Tesseract writes it into the
 * process working directory by default, which in the container is /app running
 * as an unprivileged user, so point it somewhere writable and out of the way.
 * Set TESSERACT_CACHE_PATH to a baked-in directory to avoid the first-use
 * download entirely.
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

      try {
        return await createWorker("eng", 1, {
          langPath: CACHE_PATH,
          cachePath: CACHE_PATH,
          // Tesseract's own progress logging is noise in the server log.
          logger: () => {},
        });
      } catch (err) {
        throw new OcrUnavailableError(
          "The local OCR engine could not load its English language data. It is downloaded on first use, so this server needs either outbound network access or a pre-populated TESSERACT_CACHE_PATH.",
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
 */
export async function recognizeTranscriptImage(image: Buffer): Promise<string> {
  const worker = await getWorker();

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new OcrUnavailableError(`Local OCR did not finish within ${OCR_TIMEOUT_MS}ms.`)),
      OCR_TIMEOUT_MS
    ).unref?.();
  });

  const recognition = worker.recognize(image).then((result: any) => result?.data?.text ?? "");

  return Promise.race([recognition, timeout]);
}

/** Releases the worker; used when the process is shutting down. */
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
