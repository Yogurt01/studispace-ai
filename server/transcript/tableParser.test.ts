import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscriptTable } from "./tableParser";

/**
 * The fixture is the real transcript in material_for_test/GPA, transcribed from
 * the scan. It is worth using verbatim because the document states its own
 * totals, so the parser can be held to the registrar's arithmetic rather than to
 * numbers this test made up:
 *
 *   Total Accumulated Credits: 144
 *   Grade Point Average (Ten-point-scale): 8.59
 *   Grade Point Average (Four-point-scale): 3.69
 *
 * Averaging all 47 rows gives 8.53, not 8.59. The difference is the two
 * Gymnastics courses and National Defence Education, which earn credit but are
 * left out of the published average — the rule isLikelyNonGpaCourse encodes.
 */
const CLEAN_TRANSCRIPT = `VIETNAM NATIONAL UNIVERSITY - HCMC
UNIVERSITY OF SCIENCE
ACADEMIC TRANSCRIPT
Full name of student : NGUYEN HUU BEN   Student ID: 22120029
No | Course ID | Course title | Credits | 10-Point grade | 4-Point grade
1 | BAA00003 | HoChiMinh's Ideology | 2.0 | 9.00 | 4.00
2 | BAA00004 | General law | 3.0 | 7.60 | 3.30
3 | BAA00005 | Basic Economics | 2.0 | 9.00 | 4.00
4 | BAA00021 | Gymnastics 1 | 2.0 | 6.00 | 2.50
5 | BAA00022 | Gymnastics 2 | 2.0 | 7.00 | 3.00
6 | BAA00030 | National Defence Education | 4.0 | 8.60 | 3.80
7 | BAA00101 | Marxist-Leninist Philosophy | 3.0 | 8.20 | 3.60
8 | BAA00102 | Marxist-Leninist Political Economics | 2.0 | 8.30 | 3.65
9 | BAA00103 | Scientific Socialism | 2.0 | 7.00 | 3.00
10 | BAA00104 | History of Vietnamese Communist Party | 2.0 | 7.00 | 3.00
11 | CSC00004 | Introduction to Information Technology | 4.0 | 7.10 | 3.05
12 | CSC10001 | Introduction to Programming 1 | 4.0 | 10.00 | 4.00
13 | CSC10002 | Introduction to Programming 2 | 4.0 | 8.40 | 3.70
14 | CSC10003 | Object-Oriented Programming | 4.0 | 8.80 | 3.90
15 | CSC10004 | Data Structures and Algorithms | 4.0 | 7.20 | 3.10
16 | CSC10006 | Introduction to Databases | 4.0 | 9.60 | 4.00
17 | CSC10007 | Operating Systems | 4.0 | 7.60 | 3.30
18 | CSC10008 | Computer Networks | 4.0 | 7.50 | 3.25
19 | CSC10009 | Computer Systems | 2.0 | 8.10 | 3.55
20 | CSC10102 | Career & Internship | 2.0 | 7.00 | 3.00
21 | CSC10108 | Data Visualization | 4.0 | 9.10 | 4.00
22 | CSC13002 | Introduction to Software Engineering | 4.0 | 9.30 | 4.00
23 | CSC14003 | Fundamentals of Artificial Intelligence | 4.0 | 8.90 | 3.95
24 | CSC14004 | Data Mining and Applications | 4.0 | 6.30 | 2.65
25 | CSC14005 | Introduction to Machine Learning | 4.0 | 9.00 | 4.00
26 | CSC14118 | Introduction to Big Data | 4.0 | 8.80 | 3.90
27 | CSC14119 | Introduction to Data Science | 4.0 | 9.30 | 4.00
28 | CSC15007 | Computer Statistics and Applications | 4.0 | 9.20 | 4.00
29 | CSC17001 | Intelligent Data Analysis | 4.0 | 9.60 | 4.00
30 | CSC17103 | Graph Mining | 4.0 | 10.00 | 4.00
31 | CSC17104 | Programming for Data Science | 4.0 | 9.50 | 4.00
32 | CSC17107 | Applications of Intelligent Data Analysis | 4.0 | 9.40 | 4.00
33 | ENV00003 | Human and Environment | 2.0 | 9.50 | 4.00
34 | MTH00003 | Calculus 1B | 3.0 | 8.60 | 3.80
35 | MTH00004 | Calculus 2B | 3.0 | 9.50 | 4.00
36 | MTH00030 | Linear Algebra | 3.0 | 8.00 | 3.50
37 | MTH00040 | Probability and Statistics | 3.0 | 6.10 | 2.55
38 | MTH00041 | Discrete Mathematics | 3.0 | 9.20 | 4.00
39 | MTH00050 | Combination mathematics and discrete structures | 4.0 | 9.00 | 4.00
40 | MTH00052 | Numerical Methods | 4.0 | 8.60 | 3.80
41 | MTH00081 | Calculus Laboratory 1B | 1.0 | 10.00 | 4.00
42 | MTH00082 | Calculus Laboratory 2B | 1.0 | 7.00 | 3.00
43 | MTH00083 | Linear Algebra Laboratory | 1.0 | 10.00 | 4.00
44 | MTH00085 | Probability And Statistics Laboratory | 1.0 | 8.50 | 3.75
45 | MTH00086 | Applied Discrete Mathematics Laboratory | 1.0 | 8.80 | 3.90
46 | PHY00001 | General physics 1 (Mechanics - Thermodynamics) | 3.0 | 9.60 | 4.00
47 | PHY00002 | General physics 2 (Electromagnetic - Optics) | 3.0 | 8.10 | 3.55
Total Accumulated Credits: 144
Grade Point Average (Ten-point-scale) : 8.59
Grade Point Average (Four-point-scale) 3.69
`;

/**
 * Verbatim Tesseract output for the same two pages, kept as-is because the point
 * of these rows is the damage: lost decimal points ("900" for 9.00, "20" for
 * 2.0), a grade column misread into a plausible-looking wrong number, and rows
 * whose cells vanished entirely.
 */
const NOISY_OCR = `oon, VIETNAM NATIONAL UNIVERSITY - HCMC SOCIALIST REPUBLIC OF VIETNAM
n= ACADEMIC TRANSCRIPT 112
10-Point grade 4-Point grade
1|BAA00003 | HoChiMinh's Ideology ~~ 20 | 900 | 400
2|BAA00004 | General law a 30 760 | 330
~ 3|BAA0000S | Basic Economics ETN oe 9000 | 460
_ 4|BAA00021 | Gymnasties! | 20 6.00 | 250
| 24/CSC14004 | Data Mining and Applications Bh: | 40 | 30 2.65
 38|MTHO0041 | Discrete Mathematics | 30 | 920
| 47|PHY00002 | General physics 2 (Electromagnetic - Optics) CEE ER
`;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

test("the clean transcript yields every course the registrar listed", () => {
  const result = parseTranscriptTable(CLEAN_TRANSCRIPT);

  assert.equal(result.courses.length, 47);
  assert.equal(result.skipped.length, 0);
  assert.equal(sum(result.courses.map((c) => c.credits)), 144);
});

test("the parsed credits and grades reproduce the GPA printed on the transcript", () => {
  const { courses } = parseTranscriptTable(CLEAN_TRANSCRIPT);

  // Physical education and national defence earn credit but are not averaged.
  const nonGpa = new Set(["BAA00021", "BAA00022", "BAA00030"]);
  const graded = courses.filter((c) => !nonGpa.has(c.courseCode));
  const credits = sum(graded.map((c) => c.credits));

  const gpa10 = sum(graded.map((c) => c.credits * (c.numericGrade ?? 0))) / credits;
  const gpa4 = sum(graded.map((c) => c.credits * (c.gradePoints4 ?? 0))) / credits;

  assert.equal(credits, 136);
  assert.equal(gpa10.toFixed(2), "8.59");
  assert.equal(gpa4.toFixed(2), "3.69");
});

test("individual rows keep the exact values printed on the page", () => {
  const { courses } = parseTranscriptTable(CLEAN_TRANSCRIPT);
  const byCode = new Map(courses.map((c) => [c.courseCode, c]));

  const algorithms = byCode.get("CSC10004");
  assert.equal(algorithms?.courseName, "Data Structures and Algorithms");
  assert.equal(algorithms?.credits, 4);
  assert.equal(algorithms?.numericGrade, 7.2);
  assert.equal(algorithms?.gradePoints4, 3.1);

  // A one-credit lab, to prove small credit values survive the range checks.
  assert.equal(byCode.get("MTH00081")?.credits, 1);
  assert.equal(byCode.get("MTH00081")?.numericGrade, 10);
});

test("the institution is read off the letterhead", () => {
  const result = parseTranscriptTable(CLEAN_TRANSCRIPT);
  assert.match(String(result.institution), /UNIVERSITY/i);
});

test("a lost decimal point is repaired rather than imported as a wild number", () => {
  const { courses } = parseTranscriptTable(NOISY_OCR);
  const ideology = courses.find((c) => c.courseCode === "BAA00003");

  // "20 | 900 | 400" is 2.0 credits at 9.00 / 4.00, not 20 credits at 900.
  assert.equal(ideology?.credits, 2);
  assert.equal(ideology?.numericGrade, 9);
  assert.equal(ideology?.gradePoints4, 4);
});

test("a grade column misread into a plausible number is flagged, not trusted", () => {
  const { courses } = parseTranscriptTable(NOISY_OCR);
  // OCR turned this row's 6.30 into "30". Both cells are individually in range,
  // so only cross-checking the two grade columns catches it.
  const dataMining = courses.find((c) => c.courseCode === "CSC14004");

  assert.equal(dataMining?.confidence, "low");
  assert.match(String(dataMining?.note), /do not agree/i);
});

test("rows whose cells did not survive OCR are skipped, never invented", () => {
  const result = parseTranscriptTable(NOISY_OCR);

  const skippedCodes = result.skipped.map((s) => s.line);
  assert.ok(skippedCodes.some((line) => line.includes("MTHO0041")));
  assert.ok(skippedCodes.some((line) => line.includes("PHY00002")));

  // The critical property: nothing that failed to parse came back as a pass.
  for (const course of result.courses) {
    const hasRealGrade =
      typeof course.numericGrade === "number" ||
      typeof course.gradePoints4 === "number" ||
      typeof course.letterGrade === "string";
    assert.ok(hasRealGrade, `${course.courseCode} was imported with no grade at all`);
  }
});

test("a partial read is reported against the transcript's own stated total", () => {
  const result = parseTranscriptTable(NOISY_OCR + "\nTotal Accumulated Credits: 144\n");
  assert.ok(
    result.warnings.some((w) => /144 total credits/.test(w)),
    `expected a credit-total warning, got: ${result.warnings.join(" / ")}`
  );
});

test("a US letter-grade transcript parses too", () => {
  const result = parseTranscriptTable(`Course | Title | Credits | Grade
CS 301 | Algorithms and Complexity | 4 | A-
MATH 302 | Probability for Engineers | 3 | B+
`);

  assert.equal(result.courses.length, 2);
  assert.equal(result.courses[0].courseCode, "CS301");
  assert.equal(result.courses[0].credits, 4);
  assert.equal(result.courses[0].letterGrade, "A-");
  assert.equal(result.courses[1].letterGrade, "B+");
});

test("text with no course rows reports that plainly instead of returning samples", () => {
  const result = parseTranscriptTable("Dear student, your enrolment is confirmed. Regards, the office.");

  assert.equal(result.courses.length, 0);
  assert.ok(result.warnings.some((w) => /No course rows/i.test(w)));
});

test("empty input is handled without throwing", () => {
  const result = parseTranscriptTable("");
  assert.equal(result.courses.length, 0);
  assert.equal(result.skipped.length, 0);
});

test("a one-credit lab that lost its decimal point is not imported as ten credits", () => {
  // Verbatim OCR of the lab rows on page 2: "1.0" came back as "10" on one row.
  const { courses } = parseTranscriptTable(`No | Course ID | Course title | Credits | 10-Point grade | 4-Point grade
41|MTH00081 | Calculus Laboratory 1B 1.0 10.00 4.00
44|MTH00085 | Probability And Statistics Laboratory 10 | 850 | 375 |
`);

  const lab = courses.find((c) => c.courseCode.endsWith("00085"));
  assert.equal(lab?.credits, 1, "a 10-credit lab on a transcript of 1.0-credit labs is a misread");
  assert.equal(lab?.numericGrade, 8.5);
  assert.equal(lab?.gradePoints4, 3.75);
});

test("a genuine ten-credit course survives when the transcript uses integer credits", () => {
  // No decimals anywhere in the credit column, so 10 is taken at face value.
  const { courses } = parseTranscriptTable(`Course | Title | Credits | Grade
CS 301 | Advanced Systems Project | 10 | A
`);

  assert.equal(courses[0].credits, 10);
});
