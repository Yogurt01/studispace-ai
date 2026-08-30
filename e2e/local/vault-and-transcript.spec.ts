import { expect, Page, test } from "@playwright/test";
import path from "path";

/**
 * Full integration journey for the Document Vault and the transcript parser.
 * Requires, on this machine:
 *   - a real Firebase account in E2E_EMAIL / E2E_PASSWORD
 *   - the sample documents in material_for_test/
 *
 * Never run in CI: it signs into a real project and writes to it. See
 * docs/LOCAL_DEVELOPMENT.md — `npm run test:e2e:local`.
 *
 * The credentials are read from the environment, exactly as qwen3.spec.ts does.
 * They are never written into this file.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!EMAIL || !PASSWORD, "E2E_EMAIL / E2E_PASSWORD are not set");

// The project is ESM, so __dirname does not exist here; the config resolves
// testDir from the repo root, which is where Playwright is invoked.
const MATERIAL = path.resolve(process.cwd(), "material_for_test");
const BOOKS = [
  { file: "20250221-WP-Developers_Guide_to_RAG.pdf", title: "Developers Guide to RAG" },
  { file: "20250423-EB-Event-Driven_Design_for_Agents.pdf", title: "Event-Driven Design for Agents" },
];
const TRANSCRIPT = path.join(MATERIAL, "GPA", "NgHBen_GPA_2026_1.jpg");

// A 16MB upload over a real connection is not fast, and the point of these
// tests is that it completes rather than hangs.
const UPLOAD_TIMEOUT = 180_000;

async function signIn(page: Page) {
  await page.goto("/");
  const alreadyIn = page.locator("#nav-tab-documents");
  const signInTab = page.locator("#tab-auth-signin");
  await Promise.race([
    alreadyIn.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {}),
    signInTab.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {}),
  ]);
  if (await alreadyIn.isVisible().catch(() => false)) return;

  await signInTab.click();
  await page.locator('input[type="email"]').fill(EMAIL!);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator("#btn-auth-submit").click();
  await expect(page.locator("#nav-tab-documents")).toBeVisible({ timeout: 45_000 });
}

/** Fails loudly on a server-side crash rather than on a vague UI timeout. */
function watchForServerErrors(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 500) failures.push(`${res.status()} ${res.url()}`);
  });
  return failures;
}

/**
 * Cloud Storage is a provisioned Firebase resource. On the Spark plan it may not
 * exist at all, and this project's does not, so the test asserts on the two
 * outcomes the app is allowed to have — never on an unhandled failure:
 *
 *   Storage provisioned  → both books upload, persist a reload, and open in the
 *                          reader from an https URL.
 *   Storage unprovisioned → the vault says so in its own notice, and stays fully
 *                          usable: the workspace must not be taken down by a
 *                          capability it does not have.
 */
test("the vault either stores both sample books or degrades gracefully without Storage", async ({
  page,
}) => {
  test.setTimeout(UPLOAD_TIMEOUT * 2);
  const serverErrors = watchForServerErrors(page);

  await signIn(page);
  await page.locator("#nav-tab-documents").click();
  await expect(page.locator("#btn-vault-upload-trigger")).toBeVisible();

  const storageNotice = page.locator("#vault-storage-unavailable-notice");
  let storageProvisioned = true;

  for (const book of BOOKS) {
    if (await page.getByText(book.title, { exact: false }).first().isVisible().catch(() => false)) {
      continue;
    }

    await page.locator("#btn-vault-upload-trigger").click();
    await page.locator("#input-vault-file").setInputFiles(path.join(MATERIAL, "books", book.file));

    // The size readout confirms the file was accepted rather than rejected by
    // the format and size rules before the upload begins.
    await expect(page.getByText(/MB/).first()).toBeVisible();
    await page.locator("#btn-vault-save-document").click();

    // Whichever way it goes, it must resolve into a visible outcome rather than
    // spinning: either the card appears or the vault explains why it cannot.
    const stored = page.getByText(book.title, { exact: false }).first();
    const refused = page.getByText(
      /could not start uploading|cannot be stored right now|Cloud Storage is not enabled/i
    ).first();

    await Promise.race([
      stored.waitFor({ state: "visible", timeout: UPLOAD_TIMEOUT }).catch(() => {}),
      refused.waitFor({ state: "visible", timeout: UPLOAD_TIMEOUT }).catch(() => {}),
    ]);

    if (await refused.isVisible().catch(() => false)) {
      storageProvisioned = false;
      break;
    }

    await expect(stored).toBeVisible({ timeout: UPLOAD_TIMEOUT });
  }

  if (!storageProvisioned) {
    // The drawer stays open on the error so the message can be read; close it
    // the way a student would before checking the rest of the workspace.
    await page.locator("#btn-vault-cancel-upload").click();

    // The diagnostic has to be in the app, not only in the console, and it has
    // to name the cause and the fix.
    await expect(storageNotice).toBeVisible();
    await expect(storageNotice).toContainText(/Cloud Storage is not enabled/i);
    await expect(storageNotice).toContainText(/VITE_FIREBASE_STORAGE_BUCKET/);

    // And the workspace must still be a workspace.
    await expect(page.locator("#input-vault-search")).toBeEnabled();
    await page.locator("#nav-tab-gpa").click();
    await expect(page.getByText(/Cumulative GPA \(4\.0\)/i)).toBeVisible({ timeout: 30_000 });
    await page.locator("#nav-tab-documents").click();
    await expect(page.locator("#btn-vault-upload-trigger")).toBeVisible();

    expect(serverErrors, `server returned 5xx: ${serverErrors.join(", ")}`).toEqual([]);
    test.info().annotations.push({
      type: "storage",
      description:
        "Cloud Storage is not provisioned for this Firebase project; the vault's degraded path was verified instead of the upload path.",
    });
    return;
  }

  // Storage is provisioned: the uploads must genuinely have persisted.
  await page.reload();
  await page.locator("#nav-tab-documents").click();
  for (const book of BOOKS) {
    await expect(page.getByText(book.title, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  }

  // And each must open in the reader from a real stored URL, not an expired
  // object URL and not the "File Not Stored" placeholder.
  for (const book of BOOKS) {
    const title = page.getByText(book.title, { exact: false }).first();
    const card = title.locator("xpath=ancestor::*[.//button[normalize-space()='READ']][1]");
    await card.getByRole("button", { name: /^READ$/i }).click();

    await expect(page.getByText(/File Not Stored/i)).toHaveCount(0);
    const frame = page.locator("iframe").first();
    await expect(frame).toBeVisible({ timeout: 30_000 });
    expect(await frame.getAttribute("src")).toMatch(/^https:\/\//);

    await page.keyboard.press("Escape");
  }

  expect(serverErrors, `server returned 5xx: ${serverErrors.join(", ")}`).toEqual([]);
});

test("the transcript image is extracted and imported into the GPA manager", async ({ page }) => {
  test.setTimeout(UPLOAD_TIMEOUT);
  const serverErrors = watchForServerErrors(page);

  await signIn(page);
  await page.locator("#nav-tab-gpa").click();
  await page.locator("#btn-toggle-transcript-parser").click();

  await page.locator("#input-transcript-file").setInputFiles(TRANSCRIPT);
  await page.locator("#btn-parse-multimodal-transcript").click();

  // Whichever engine answers, the review table must appear with real rows. The
  // fallback path is the one that used to take the server down.
  const reviewHeading = page.getByText(/Review & Verify Extracted Courses \((\d+)\)/i);
  await expect(reviewHeading).toBeVisible({ timeout: 120_000 });

  const heading = await reviewHeading.innerText();
  const extracted = Number(/\((\d+)\)/.exec(heading)?.[1] ?? 0);
  expect(extracted, "no courses were extracted from the transcript").toBeGreaterThan(0);

  // The engine that actually ran is named, so a fallback run is never presented
  // as a Gemini one.
  await expect(page.getByText(/Extracted by:/i)).toBeVisible();

  await page.locator("#btn-confirm-import-transcript-courses").click();

  // The imported courses must reach the GPA manager and produce a real average.
  await expect(page.getByText(/Cumulative GPA \(4\.0\)/i)).toBeVisible({ timeout: 30_000 });

  // The quality-points line is the unambiguous evidence that the arithmetic ran
  // over the imported rows: it names both the points and the credits they were
  // divided by, and it only renders once computeGpa has resolved grades.
  const summary = page.getByText(/Quality Points \/ \d+ Graded Credits/i);
  await expect(summary).toBeVisible({ timeout: 30_000 });

  const summaryText = await summary.innerText();
  const [, points, credits] = /([\d.]+) Quality Points \/ (\d+) Graded Credits/i.exec(summaryText) ?? [];
  expect(Number(points), `no quality points were computed (read "${summaryText}")`).toBeGreaterThan(0);
  expect(Number(credits), `no credits were graded (read "${summaryText}")`).toBeGreaterThan(0);

  // And the headline figure must be a plausible 4.0-scale GPA.
  const gpaCard = page.getByText(/Cumulative GPA \(4\.0\)/i).locator("xpath=ancestor::div[1]/..");
  const gpa = Number(/(\d+\.\d{2})/.exec(await gpaCard.innerText())?.[1] ?? 0);
  expect(gpa, `GPA did not compute (read "${await gpaCard.innerText()}")`).toBeGreaterThan(0);
  expect(gpa).toBeLessThanOrEqual(4);

  // Reload to prove the courses reached Firestore rather than living in local
  // React state: this is what "the account has the transcript" actually means.
  await page.reload();
  await page.locator("#nav-tab-gpa").click();
  const persisted = page.getByText(/Quality Points \/ \d+ Graded Credits/i);
  await expect(persisted).toBeVisible({ timeout: 30_000 });
  const persistedText = await persisted.innerText();
  expect(
    Number(/([\d.]+) Quality Points/i.exec(persistedText)?.[1] ?? 0),
    `courses did not survive a reload (read "${persistedText}")`
  ).toBeGreaterThan(0);

  expect(serverErrors, `server returned 5xx: ${serverErrors.join(", ")}`).toEqual([]);
});
