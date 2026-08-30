import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeGpa,
  detectNumericScale,
  isLikelyNonGpaCourse,
  resolveGrade,
  toTenPoint,
} from "./grading";
import { CourseGrade } from "../types";

function course(overrides: Partial<CourseGrade>): CourseGrade {
  return {
    id: "c1",
    courseCode: "CSC10001",
    courseName: "Introduction to Programming 1",
    term: "Unspecified",
    credits: 4,
    letterGrade: "",
    category: "Core",
    qualityPoints4: 0,
    qualityPoints10: 0,
    ...overrides,
  };
}

test("a grade nobody supplied does not become an A", () => {
  const result = resolveGrade({});

  assert.equal(result.resolved, false);
  assert.equal(result.gradePoints4, 0);
  assert.equal(result.gradePoints10, 0);
});

test("an unrecognised letter grade is unresolved rather than assumed perfect", () => {
  // The old code fell through to 4.0 for anything not in the table.
  assert.equal(resolveGrade({ letterGrade: "PASS" }).resolved, false);
  assert.equal(resolveGrade({ letterGrade: "?" }).resolved, false);
});

test("the registrar's own 4-point grade wins over any conversion table", () => {
  // 8.30 on a ten-point scale with the transcript stating 3.65.
  const result = resolveGrade({ numericGrade: 8.3, gradePoints4: 3.65 });

  assert.equal(result.resolved, true);
  assert.equal(result.gradePoints4, 3.65);
  assert.equal(result.gradePoints10, 8.3);
});

test("numeric scales are told apart so a 10-point grade is not read as a percentage", () => {
  assert.equal(detectNumericScale(9), "ten-point");
  assert.equal(detectNumericScale(92), "percentage");

  assert.equal(toTenPoint(9), 9);
  assert.equal(toTenPoint(92), 9.2);
});

test("a zero grade is a real grade, not a missing one", () => {
  // `numericGrade ? ... : ...` used to treat an outright fail as absent.
  const result = resolveGrade({ numericGrade: 0 });

  assert.equal(result.resolved, true);
  assert.equal(result.gradePoints10, 0);
  assert.equal(result.gradePoints4, 0);
});

test("letter grades still resolve when that is all the transcript printed", () => {
  assert.equal(resolveGrade({ letterGrade: "A-" }).gradePoints4, 3.7);
  assert.equal(resolveGrade({ letterGrade: "b+" }).gradePoints4, 3.3);
  assert.equal(resolveGrade({ letterGrade: "F" }).resolved, true);
  assert.equal(resolveGrade({ letterGrade: "F" }).gradePoints4, 0);
});

test("courses with no readable grade are reported, not averaged in", () => {
  const summary = computeGpa([
    course({ id: "a", credits: 4, numericGrade: 10, gradePoints4: 4 }),
    course({ id: "b", credits: 4 }),
  ]);

  assert.equal(summary.totalCredits, 8);
  assert.equal(summary.gradedCredits, 4);
  assert.equal(summary.gpa4, 4);
  assert.deepEqual(
    summary.unresolved.map((c) => c.id),
    ["b"]
  );
});

test("excluded courses keep their credits but stay out of the average", () => {
  const summary = computeGpa([
    course({ id: "a", credits: 4, numericGrade: 10, gradePoints4: 4 }),
    course({ id: "gym", credits: 2, numericGrade: 6, gradePoints4: 2.5, excludedFromGpa: true }),
  ]);

  assert.equal(summary.totalCredits, 6);
  assert.equal(summary.gradedCredits, 4);
  assert.equal(summary.gpa4, 4);
  assert.equal(summary.gpa10, 10);
});

test("physical education and defence education are recognised as non-GPA courses", () => {
  assert.equal(isLikelyNonGpaCourse("Gymnastics 1"), true);
  assert.equal(isLikelyNonGpaCourse("Gymnastics 2"), true);
  assert.equal(isLikelyNonGpaCourse("National Defence Education"), true);
  assert.equal(isLikelyNonGpaCourse("Physical Education"), true);

  assert.equal(isLikelyNonGpaCourse("Data Structures and Algorithms"), false);
  assert.equal(isLikelyNonGpaCourse("General physics 1 (Mechanics - Thermodynamics)"), false);
});

test("an empty transcript averages to zero instead of dividing by zero", () => {
  const summary = computeGpa([]);

  assert.equal(summary.gpa4, 0);
  assert.equal(summary.gpa10, 0);
  assert.equal(summary.totalCredits, 0);
});

/**
 * End to end over the real transcript in material_for_test/GPA: the same rows
 * the table parser test uses, carried through the grade resolver the GPA manager
 * calls, must land on the figures the registrar printed.
 */
test("the real transcript reaches the GPA manager as 8.59 / 3.69 over 136 graded credits", () => {
  const rows: [string, string, number, number, number][] = [
    ["BAA00003", "HoChiMinh's Ideology", 2, 9.0, 4.0],
    ["BAA00004", "General law", 3, 7.6, 3.3],
    ["BAA00005", "Basic Economics", 2, 9.0, 4.0],
    ["BAA00021", "Gymnastics 1", 2, 6.0, 2.5],
    ["BAA00022", "Gymnastics 2", 2, 7.0, 3.0],
    ["BAA00030", "National Defence Education", 4, 8.6, 3.8],
    ["BAA00101", "Marxist-Leninist Philosophy", 3, 8.2, 3.6],
    ["BAA00102", "Marxist-Leninist Political Economics", 2, 8.3, 3.65],
    ["BAA00103", "Scientific Socialism", 2, 7.0, 3.0],
    ["BAA00104", "History of Vietnamese Communist Party", 2, 7.0, 3.0],
    ["CSC00004", "Introduction to Information Technology", 4, 7.1, 3.05],
    ["CSC10001", "Introduction to Programming 1", 4, 10.0, 4.0],
    ["CSC10002", "Introduction to Programming 2", 4, 8.4, 3.7],
    ["CSC10003", "Object-Oriented Programming", 4, 8.8, 3.9],
    ["CSC10004", "Data Structures and Algorithms", 4, 7.2, 3.1],
    ["CSC10006", "Introduction to Databases", 4, 9.6, 4.0],
    ["CSC10007", "Operating Systems", 4, 7.6, 3.3],
    ["CSC10008", "Computer Networks", 4, 7.5, 3.25],
    ["CSC10009", "Computer Systems", 2, 8.1, 3.55],
    ["CSC10102", "Career & Internship", 2, 7.0, 3.0],
    ["CSC10108", "Data Visualization", 4, 9.1, 4.0],
    ["CSC13002", "Introduction to Software Engineering", 4, 9.3, 4.0],
    ["CSC14003", "Fundamentals of Artificial Intelligence", 4, 8.9, 3.95],
    ["CSC14004", "Data Mining and Applications", 4, 6.3, 2.65],
    ["CSC14005", "Introduction to Machine Learning", 4, 9.0, 4.0],
    ["CSC14118", "Introduction to Big Data", 4, 8.8, 3.9],
    ["CSC14119", "Introduction to Data Science", 4, 9.3, 4.0],
    ["CSC15007", "Computer Statistics and Applications", 4, 9.2, 4.0],
    ["CSC17001", "Intelligent Data Analysis", 4, 9.6, 4.0],
    ["CSC17103", "Graph Mining", 4, 10.0, 4.0],
    ["CSC17104", "Programming for Data Science", 4, 9.5, 4.0],
    ["CSC17107", "Applications of Intelligent Data Analysis", 4, 9.4, 4.0],
    ["ENV00003", "Human and Environment", 2, 9.5, 4.0],
    ["MTH00003", "Calculus 1B", 3, 8.6, 3.8],
    ["MTH00004", "Calculus 2B", 3, 9.5, 4.0],
    ["MTH00030", "Linear Algebra", 3, 8.0, 3.5],
    ["MTH00040", "Probability and Statistics", 3, 6.1, 2.55],
    ["MTH00041", "Discrete Mathematics", 3, 9.2, 4.0],
    ["MTH00050", "Combination mathematics and discrete structures", 4, 9.0, 4.0],
    ["MTH00052", "Numerical Methods", 4, 8.6, 3.8],
    ["MTH00081", "Calculus Laboratory 1B", 1, 10.0, 4.0],
    ["MTH00082", "Calculus Laboratory 2B", 1, 7.0, 3.0],
    ["MTH00083", "Linear Algebra Laboratory", 1, 10.0, 4.0],
    ["MTH00085", "Probability And Statistics Laboratory", 1, 8.5, 3.75],
    ["MTH00086", "Applied Discrete Mathematics Laboratory", 1, 8.8, 3.9],
    ["PHY00001", "General physics 1 (Mechanics - Thermodynamics)", 3, 9.6, 4.0],
    ["PHY00002", "General physics 2 (Electromagnetic - Optics)", 3, 8.1, 3.55],
  ];

  const courses: CourseGrade[] = rows.map(([code, name, credits, ten, four], i) =>
    course({
      id: `t${i}`,
      courseCode: code,
      courseName: name,
      credits,
      numericGrade: ten,
      gradePoints4: four,
      excludedFromGpa: isLikelyNonGpaCourse(name),
    })
  );

  const summary = computeGpa(courses);

  assert.equal(courses.length, 47);
  assert.equal(summary.totalCredits, 144);
  assert.equal(summary.gradedCredits, 136);
  assert.equal(summary.gpa10.toFixed(2), "8.59");
  assert.equal(summary.gpa4.toFixed(2), "3.69");
  assert.deepEqual(summary.unresolved, []);
});
