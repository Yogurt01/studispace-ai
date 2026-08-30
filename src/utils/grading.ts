/**
 * One place for grade arithmetic.
 *
 * The transcript parser and the GPA manager both need to turn a grade into
 * grade points, and they used to carry private copies of these tables that had
 * already drifted apart. Worse, both filled a missing grade with a default that
 * happened to be a perfect one, so a row the parser could not read raised the
 * student's GPA instead of being questioned.
 *
 * The rule here is that an unreadable grade has no grade points. It is reported
 * as unresolved and left out of the average rather than guessed at.
 */

import { CourseGrade } from "../types";

export const GRADE_POINTS_4: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

export const GRADE_POINTS_10: Record<string, number> = {
  "A+": 10.0,
  A: 9.5,
  "A-": 8.5,
  "B+": 8.0,
  B: 7.5,
  "B-": 7.0,
  "C+": 6.5,
  C: 6.0,
  "C-": 5.5,
  "D+": 5.0,
  D: 4.0,
  F: 0.0,
};

/**
 * Transcripts print numeric grades on either a 0-10 or a 0-100 scale and rarely
 * say which. Anything above 10 can only be a percentage; at or below 10 it is
 * read as a 10-point grade, which is the scale the app's own 10-point CGPA uses.
 *
 * The ambiguity is real but narrow: it only bites for a percentage of 10 or
 * less, which is a failing mark either way.
 */
export type NumericScale = "ten-point" | "percentage";

export function detectNumericScale(value: number): NumericScale {
  return value > 10 ? "percentage" : "ten-point";
}

/** Normalises a numeric grade of either scale onto 0..10. */
export function toTenPoint(value: number): number {
  return detectNumericScale(value) === "percentage" ? value / 10 : value;
}

export interface GradeInput {
  letterGrade?: string;
  numericGrade?: number;
  /** A 4-point grade point printed on the transcript itself, when there is one. */
  gradePoints4?: number;
}

export interface ResolvedGrade {
  gradePoints4: number;
  gradePoints10: number;
  /** False when nothing in the input said what the student actually scored. */
  resolved: boolean;
}

const UNRESOLVED: ResolvedGrade = { gradePoints4: 0, gradePoints10: 0, resolved: false };

/**
 * Works out grade points, preferring whatever the transcript stated outright.
 *
 * Order matters: a 4-point column printed by the registrar is the institution's
 * own conversion and beats any table we could apply, and a numeric score beats a
 * letter because letters are buckets. Only when none of the three is present is
 * the grade unresolved.
 */
export function resolveGrade(input: GradeInput): ResolvedGrade {
  const { letterGrade, numericGrade, gradePoints4 } = input;

  const hasStatedPoints =
    typeof gradePoints4 === "number" && Number.isFinite(gradePoints4) && gradePoints4 >= 0 && gradePoints4 <= 4;
  const hasNumeric = typeof numericGrade === "number" && Number.isFinite(numericGrade) && numericGrade >= 0;

  if (hasStatedPoints) {
    // The registrar's own 4-point figure. Pair it with the numeric grade when
    // there is one, since that is the finer-grained of the two.
    return {
      gradePoints4: gradePoints4 as number,
      gradePoints10: hasNumeric ? toTenPoint(numericGrade as number) : (gradePoints4 as number) * 2.5,
      resolved: true,
    };
  }

  if (hasNumeric) {
    const tenPoint = toTenPoint(numericGrade as number);
    return {
      gradePoints4: Math.min(4, Math.max(0, tenPoint * 0.5 - 0.5)),
      gradePoints10: tenPoint,
      resolved: true,
    };
  }

  const key = letterGrade?.toUpperCase().trim();
  if (key && key in GRADE_POINTS_4) {
    return { gradePoints4: GRADE_POINTS_4[key], gradePoints10: GRADE_POINTS_10[key], resolved: true };
  }

  return UNRESOLVED;
}

/**
 * Courses that earn credit towards a degree without counting towards the GPA.
 *
 * Physical education and national defence education are graduation requirements
 * at Vietnamese universities and appear on the transcript with a grade, but the
 * registrar leaves them out of the published average. Including them puts the
 * app's GPA below the one printed on the student's own transcript, so they are
 * flagged on import — as a suggestion the student can overrule, never silently.
 */
const NON_GPA_COURSE_PATTERNS = [
  /\bgymnastics?\b/i,
  /\bphysical education\b/i,
  /\bnational defence education\b/i,
  /\bnational defense education\b/i,
];

export function isLikelyNonGpaCourse(courseName: string): boolean {
  return NON_GPA_COURSE_PATTERNS.some((pattern) => pattern.test(courseName));
}

export interface GpaSummary {
  /** Every credit on the transcript, including courses excluded from the GPA. */
  totalCredits: number;
  /** Credits that actually fed the average. */
  gradedCredits: number;
  qualityPoints4: number;
  qualityPoints10: number;
  gpa4: number;
  gpa10: number;
  /** Courses whose grade could not be resolved, so they were left out. */
  unresolved: CourseGrade[];
}

/**
 * Cumulative GPA over a set of courses.
 *
 * A course contributes only when its grade resolves and it is not marked as
 * excluded. Everything else still counts towards total credits, because the
 * student did earn them.
 */
export function computeGpa(courses: CourseGrade[]): GpaSummary {
  let totalCredits = 0;
  let gradedCredits = 0;
  let qualityPoints4 = 0;
  let qualityPoints10 = 0;
  const unresolved: CourseGrade[] = [];

  for (const course of courses) {
    const credits = Number(course.credits);
    if (!Number.isFinite(credits) || credits < 0) continue;

    totalCredits += credits;
    if (course.excludedFromGpa) continue;

    const grade = resolveGrade(course);
    if (!grade.resolved) {
      unresolved.push(course);
      continue;
    }

    gradedCredits += credits;
    qualityPoints4 += credits * grade.gradePoints4;
    qualityPoints10 += credits * grade.gradePoints10;
  }

  return {
    totalCredits,
    gradedCredits,
    qualityPoints4,
    qualityPoints10,
    gpa4: gradedCredits > 0 ? qualityPoints4 / gradedCredits : 0,
    gpa10: gradedCredits > 0 ? qualityPoints10 / gradedCredits : 0,
    unresolved,
  };
}
