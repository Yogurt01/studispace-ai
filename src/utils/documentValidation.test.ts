import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  validateDocumentFile,
} from "./documentValidation";

const MB = 1024 * 1024;

test("the sample study PDFs are accepted", () => {
  // The two files in material_for_test/books, at their real sizes.
  assert.equal(
    validateDocumentFile({
      name: "20250221-WP-Developers_Guide_to_RAG.pdf",
      size: 16180186,
      type: "application/pdf",
    }).ok,
    true
  );

  assert.equal(
    validateDocumentFile({
      name: "20250423-EB-Event-Driven_Design_for_Agents.pdf",
      size: 5808339,
      type: "application/pdf",
    }).ok,
    true
  );
});

test("a file past the size limit is refused before the upload starts", () => {
  const result = validateDocumentFile({
    name: "whole-library.pdf",
    size: MAX_DOCUMENT_BYTES + 1,
    type: "application/pdf",
  });

  assert.equal(result.ok, false);
  assert.match(String(result.message), /25\.00 MB/);
});

test("an unsupported type is refused however it was dragged in", () => {
  // Drag-and-drop never consults the input's accept list, so this is the only
  // place the rule is actually applied.
  const result = validateDocumentFile({ name: "lecture.mp4", size: 2 * MB, type: "video/mp4" });

  assert.equal(result.ok, false);
  assert.match(String(result.message), /\.mp4/);
});

test("a known extension is accepted when the browser reports no MIME type", () => {
  assert.equal(validateDocumentFile({ name: "notes.md", size: 2048, type: "" }).ok, true);
  assert.equal(validateDocumentFile({ name: "syllabus.PDF", size: 2048, type: "" }).ok, true);
});

test("a valid MIME type is accepted even when the name has no extension", () => {
  assert.equal(validateDocumentFile({ name: "scan", size: 2048, type: "image/png" }).ok, true);
});

test("an empty file is refused rather than stored as a broken document", () => {
  const result = validateDocumentFile({ name: "empty.pdf", size: 0, type: "application/pdf" });

  assert.equal(result.ok, false);
  assert.match(String(result.message), /empty/i);
});

test("file sizes are reported in units a student reads", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(16180186), "15.43 MB");
  assert.equal(formatFileSize(-1), "0 KB");
});
