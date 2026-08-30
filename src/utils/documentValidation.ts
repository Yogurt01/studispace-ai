/**
 * What the Document Vault will accept.
 *
 * The file input carries an `accept` list, but that is a filter in the file
 * picker and nothing more: drag-and-drop bypasses it completely, and so does a
 * renamed file. The vault needs one rule it applies to every file however it
 * arrived, and it needs to say no *before* an upload starts rather than after a
 * student has waited on a transfer that was never going to be stored.
 */

/** Firebase Storage would take more, but a study document this large is a mistake. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Accepted types, by MIME type and by extension.
 *
 * Both are needed: browsers report an empty or wrong `type` often enough
 * (notably for .md and for files dragged from some archive tools) that MIME
 * alone rejects legitimate uploads.
 */
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ACCEPTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "md", "docx"];

export const ACCEPTED_FILE_INPUT = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

export interface DocumentValidation {
  ok: boolean;
  /** Present when ok is false: what to show the student. */
  message?: string;
}

/** Just the parts of File this needs, so the rule is testable without a browser. */
export interface ValidatableFile {
  name: string;
  size: number;
  type: string;
}

export function validateDocumentFile(file: ValidatableFile): DocumentValidation {
  if (!file.name.trim()) {
    return { ok: false, message: "That file has no name and cannot be stored." };
  }

  if (file.size === 0) {
    return { ok: false, message: `"${file.name}" is empty, so there is nothing to store.` };
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      message: `"${file.name}" is ${formatFileSize(file.size)}. The vault accepts files up to ${formatFileSize(
        MAX_DOCUMENT_BYTES
      )} — try splitting it or uploading a compressed copy.`,
    };
  }

  const extension = extensionOf(file.name);
  const typeAccepted = Boolean(file.type) && ACCEPTED_MIME_TYPES.has(file.type);
  const extensionAccepted = ACCEPTED_EXTENSIONS.includes(extension);

  if (!typeAccepted && !extensionAccepted) {
    return {
      ok: false,
      message: `The vault does not handle ${
        extension ? `.${extension}` : "that"
      } files. Accepted formats: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    };
  }

  return { ok: true };
}
