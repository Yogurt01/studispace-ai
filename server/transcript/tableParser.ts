/**
 * Deterministic transcript table parser — the open-source fallback engine.
 *
 * This runs when the Gemini Vision engine cannot: no API key, an unreachable
 * endpoint, an exhausted quota, or a response that came back empty. It has no
 * dependencies and no network calls, so it degrades predictably.
 *
 * It reads plain text — either pasted by the student or produced by the local
 * Tesseract OCR pass in ./ocr.ts. OCR text is noisy, so the guiding rule here is
 * that a row is either understood well enough to import or it is handed back as
 * skipped. Nothing is invented: a row whose grade cannot be read does not become
 * an A, it becomes a line the student is told to check.
 */

export type RowConfidence = "high" | "low";

export interface ParsedCourseRow {
  courseCode: string;
  courseName: string;
  term?: string;
  credits: number;
  /** Grade on the institution's 10-point scale, when the transcript carries one. */
  numericGrade?: number;
  /** Grade point on a 4.0 scale, when the transcript states it outright. */
  gradePoints4?: number;
  letterGrade?: string;
  confidence: RowConfidence;
  /** Why this row is only "low" confidence, for display next to it. */
  note?: string;
}

export interface SkippedRow {
  line: string;
  reason: string;
}

export interface TableParseResult {
  institution?: string;
  courses: ParsedCourseRow[];
  skipped: SkippedRow[];
  warnings: string[];
}

/** Course codes: "CSC10001", "BAA00003", "MTH00081", "CS 301", "MATH 302". */
const COURSE_CODE = /\b([A-Z]{2,4})\s?(\d{3,6})\b/;

/** A numeric cell, tolerating the comma decimal separator used outside the US. */
const NUMERIC_CELL = /\d[\d.,]*/g;

// A trailing \b cannot follow the optional +/-, because "-" is not a word
// character, so the suffix would always be dropped and "A-" would read as "A".
const LETTER_GRADE = /\b([A-F][+-]?)(?![\w])/;

/**
 * Plausible ranges per column. These are what make a misread cell detectable:
 * a credit hour of 40 or a 4-point grade of 400 is not a transcript value, it is
 * a lost decimal point.
 */
const MAX_CREDITS = 12;
/** Above this, an integer credit cell is far likelier to be a lost decimal point. */
const IMPLAUSIBLE_INTEGER_CREDITS = 10;
const MAX_TEN_POINT = 10;
const MAX_FOUR_POINT = 4;

/**
 * Reads one numeric cell, repairing the decimal point when OCR has dropped it.
 *
 * Scanned tables lose "." far more often than they lose digits, so "9.00" comes
 * back as "900" and "2.0" as "20". The repair is only attempted when the literal
 * reading is already outside the column's plausible range, which keeps a genuine
 * 10-credit course from being rewritten as 1.0.
 */
function readCell(token: string, max: number): { value: number; repaired: boolean } | null {
  const literal = Number(token.replace(",", "."));
  if (Number.isFinite(literal) && literal >= 0 && literal <= max) {
    return { value: literal, repaired: false };
  }

  if (/^\d{2,5}$/.test(token)) {
    const withPoint = Number(`${token[0]}.${token.slice(1)}`);
    if (Number.isFinite(withPoint) && withPoint >= 0 && withPoint <= max) {
      return { value: withPoint, repaired: true };
    }
  }

  return null;
}

/**
 * Reads the credit-hours cell.
 *
 * "10" is a legal credit value, so the range check that rescues "20" leaves it
 * alone — but on a transcript whose other rows print "2.0" and "4.0", a bare
 * "10" is a one-credit lab that lost its decimal point. Rather than guess from a
 * fixed threshold, the document is asked: if its credit column uses decimals
 * anywhere, then an integer of 10 or more in that column is a misread.
 */
function readCreditCell(token: string, columnUsesDecimals: boolean): { value: number; repaired: boolean } | null {
  if (columnUsesDecimals && /^\d+$/.test(token) && Number(token) >= IMPLAUSIBLE_INTEGER_CREDITS) {
    const withPoint = Number(`${token[0]}.${token.slice(1)}`);
    if (Number.isFinite(withPoint) && withPoint > 0 && withPoint <= MAX_CREDITS) {
      return { value: withPoint, repaired: true };
    }
  }

  return readCell(token, MAX_CREDITS);
}

/**
 * A transcript that prints both a 10-point and a 4-point grade states the same
 * result twice, so the two must agree. Normalising both to 0..1 and comparing
 * catches the row where one column was misread but still landed in range — the
 * failure mode that range checks alone cannot see.
 */
const GRADE_DRIFT_TOLERANCE = 0.15;

function gradesDisagree(tenPoint: number, fourPoint: number): boolean {
  return Math.abs(tenPoint / MAX_TEN_POINT - fourPoint / MAX_FOUR_POINT) > GRADE_DRIFT_TOLERANCE;
}

/** Header keywords that tell us which grade columns this transcript prints. */
function detectLayout(text: string): { hasTenPoint: boolean; hasFourPoint: boolean } {
  const header = text.toLowerCase();
  return {
    hasTenPoint: /10[\s-]*point|ten[\s-]*point/.test(header),
    hasFourPoint: /4[\s-]*point|four[\s-]*point/.test(header),
  };
}

/**
 * The institution name, taken out of the letterhead.
 *
 * A scanned banner line carries the name alongside OCR speckle and whatever else
 * shares the top of the page ("SOCIALIST REPUBLIC OF VIETNAM"), so this matches
 * the name itself rather than keeping the whole line.
 */
const INSTITUTION_NAME =
  /\b([A-Z][A-Za-z.'&-]*(?:[ ][A-Z][A-Za-z.'&-]*){0,5}[ ](?:UNIVERSITY|COLLEGE|INSTITUTE|SCHOOL|ACADEMY)(?:[ ]OF[ ][A-Z][A-Za-z.'&-]*(?:[ ][A-Z][A-Za-z.'&-]*){0,2})?)/i;

function detectInstitution(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    const cleaned = line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length < 8) continue;
    if (COURSE_CODE.test(cleaned)) continue;

    const match = cleaned.match(INSTITUTION_NAME);
    if (match) return match[1].trim();
  }
  return undefined;
}

/** "Total Accumulated Credits: 144" — a stated total we can check our sum against. */
function detectStatedCredits(text: string): number | undefined {
  const match = text.match(/total\s+(?:accumulated\s+)?credits?\s*[:.]?\s*(\d{1,3}(?:\.\d)?)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function titleFrom(segment: string): string {
  return (
    segment
      .replace(/[|]/g, " ")
      // OCR sprays isolated punctuation and stray glyphs into the column gaps.
      .replace(/[~_]{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\s\-–—:.,]+/, "")
      .replace(/[\s\-–—:.,]+$/, "")
      // Trailing debris: leftover digits and one-character noise from the gap
      // between the title and the first numeric column.
      .replace(/(?:\s+(?:\d[\d.,]*|[^\w\s(]|[a-zA-Z]))+$/, "")
      .trim()
  );
}

/**
 * Parses transcript text into course rows.
 *
 * Recognises two shapes, which between them cover the transcripts this app sees:
 *   - numeric scales, e.g. "CSC10001 | Introduction to Programming 1 | 4.0 | 10.00 | 4.00"
 *   - letter grades,  e.g. "CS 301 | Algorithms | Fall 2025 | 4 | A-"
 */
export function parseTranscriptTable(text: string): TableParseResult {
  const warnings: string[] = [];
  const courses: ParsedCourseRow[] = [];
  const skipped: SkippedRow[] = [];

  if (!text || !text.trim()) {
    return { courses, skipped, warnings: ["No text was supplied to parse."] };
  }

  const lines = text.split(/\r?\n/);
  const layout = detectLayout(text);
  const institution = detectInstitution(lines);

  // Does this transcript write its credit hours with a decimal point? Answering
  // once, from the whole document, is what lets a single misread "10" be told
  // apart from a genuine ten-credit course.
  const creditColumnUsesDecimals = lines.some((line) => {
    const normalised = line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    if (!COURSE_CODE.test(normalised)) return false;
    const cells = normalised.match(NUMERIC_CELL) ?? [];
    return cells.length >= 3 && /^\d+\.\d+$/.test(cells[cells.length - 3]);
  });

  for (const rawLine of lines) {
    const line = rawLine.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    if (!line) continue;

    const codeMatch = line.match(COURSE_CODE);
    if (!codeMatch) continue;

    const courseCode = `${codeMatch[1]}${codeMatch[2]}`;
    const afterCode = line.slice(line.indexOf(codeMatch[0]) + codeMatch[0].length);
    const cellMatches = [...afterCode.matchAll(NUMERIC_CELL)];
    const cells = cellMatches.map((m) => m[0]);
    // Where the trailing run of numeric columns begins, so the title is cut at
    // the column boundary rather than at the first place its digits happen to
    // reappear ("General law ... 30 760 330" must not keep "30 760 3").
    const cutAt = (fromEnd: number) => cellMatches[cellMatches.length - fromEnd]?.index ?? afterCode.length;

    const letterMatch = afterCode.match(LETTER_GRADE);
    const letterGrade = letterMatch ? letterMatch[1] : undefined;

    // Numeric-scale layout: the trailing cells are credits, then the grades.
    if (cells.length >= 3 && (layout.hasTenPoint || layout.hasFourPoint || !letterGrade)) {
      const [creditCell, tenCell, fourCell] = cells.slice(-3);
      const credits = readCreditCell(creditCell, creditColumnUsesDecimals);
      const tenPoint = readCell(tenCell, MAX_TEN_POINT);
      const fourPoint = readCell(fourCell, MAX_FOUR_POINT);

      if (credits && tenPoint && fourPoint) {
        const disagree = gradesDisagree(tenPoint.value, fourPoint.value);
        courses.push({
          courseCode,
          courseName: titleFrom(afterCode.slice(0, cutAt(3))),
          credits: credits.value,
          numericGrade: tenPoint.value,
          gradePoints4: fourPoint.value,
          confidence: disagree ? "low" : "high",
          note: disagree
            ? `The 10-point grade (${tenPoint.value}) and the 4-point grade (${fourPoint.value}) do not agree; one of them was misread.`
            : undefined,
        });
        continue;
      }

      skipped.push({
        line: line.slice(0, 120),
        reason: "A credit or grade cell could not be read as a plausible value.",
      });
      continue;
    }

    // Letter-grade layout: credits are the last number, the grade is a letter.
    if (letterGrade && cells.length >= 1) {
      const credits = readCreditCell(cells[cells.length - 1], creditColumnUsesDecimals);
      if (credits) {
        courses.push({
          courseCode,
          courseName: titleFrom(afterCode.slice(0, cutAt(1))),
          credits: credits.value,
          letterGrade,
          confidence: "high",
        });
        continue;
      }
    }

    skipped.push({
      line: line.slice(0, 120),
      reason: "The row has a course code but too few readable columns.",
    });
  }

  if (courses.length === 0) {
    warnings.push(
      "No course rows could be read from this document. If it is a scan, a clearer image or pasting the table as text will parse far more reliably."
    );
  }

  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} row${skipped.length === 1 ? "" : "s"} could not be read and ${
        skipped.length === 1 ? "was" : "were"
      } left out rather than guessed. Add ${skipped.length === 1 ? "it" : "them"} by hand before importing.`
    );
  }

  const lowConfidence = courses.filter((c) => c.confidence === "low").length;
  if (lowConfidence > 0) {
    warnings.push(
      `${lowConfidence} row${lowConfidence === 1 ? "" : "s"} had grade columns that disagree with each other. Check ${
        lowConfidence === 1 ? "it" : "them"
      } before importing.`
    );
  }

  // The transcript often prints its own credit total, which is a free check on
  // whether we actually read the whole table.
  const statedCredits = detectStatedCredits(text);
  const parsedCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  if (statedCredits !== undefined && Math.abs(statedCredits - parsedCredits) > 0.5) {
    warnings.push(
      `This transcript states ${statedCredits} total credits but only ${parsedCredits} were read, so some rows are missing.`
    );
  }

  return { institution, courses, skipped, warnings };
}
