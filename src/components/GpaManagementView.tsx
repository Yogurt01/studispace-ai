import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Upload,
  Sparkles,
  Calculator,
  Award,
  TrendingUp,
  Filter,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Sliders,
  Target,
  Check,
  Zap,
} from "lucide-react";
import { CourseGrade, CourseCategory } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";
import confetti from "canvas-confetti";

interface GpaManagementViewProps {
  courses: CourseGrade[];
  onAddCourse: (course: CourseGrade) => void;
  onUpdateCourse: (course: CourseGrade) => void;
  onDeleteCourse: (id: string) => void;
  onBatchAddCourses: (courses: CourseGrade[]) => void;
  onAwardXp: (amount: number) => void;
}

const GRADE_POINTS_4: Record<string, number> = {
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

const GRADE_POINTS_10: Record<string, number> = {
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

const DEGREE_CREDIT_PRESETS = [
  { credits: 120, label: "120 Credits", desc: "Standard US Bachelor's (4-Year)" },
  { credits: 128, label: "128 Credits", desc: "Science & Engineering Track" },
  { credits: 136, label: "136 Credits", desc: "Honors / Extended Curriculum" },
  { credits: 144, label: "144 Credits", desc: "Intensive / Global Degree Standard" },
  { credits: 160, label: "160 Credits", desc: "5-Year Program / Double Major" },
  { credits: 60, label: "60 Credits", desc: "Associate Degree / Minor Track" },
];

export const GpaManagementView: React.FC<GpaManagementViewProps> = ({
  courses,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onBatchAddCourses,
  onAwardXp,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseGrade | null>(null);

  // Degree Total Required Credits & Goal Tracker
  const [totalRequiredCredits, setTotalRequiredCredits] = useState<number>(() => {
    const saved = localStorage.getItem("studispace_total_degree_credits");
    return saved ? Number(saved) : 144;
  });
  const [showCreditGoalModal, setShowCreditGoalModal] = useState(false);
  const [tempRequiredCredits, setTempRequiredCredits] = useState<number>(totalRequiredCredits);

  // Transcript Parsing States
  const [isParserOpen, setIsParserOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<CourseGrade[] | null>(null);
  const [parserFeedback, setParserFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formTerm, setFormTerm] = useState("Fall 2026");
  const [formCredits, setFormCredits] = useState(3);
  const [formGrade, setFormGrade] = useState("A");
  const [formNumeric, setFormNumeric] = useState<number | "">(92);
  const [formCategory, setFormCategory] = useState<CourseCategory>("Core");

  // Compute Terms list
  const terms = useMemo(() => {
    const set = new Set(courses.map((c) => c.term));
    return Array.from(set);
  }, [courses]);

  // Overall Cumulative GPA & Stats
  const { totalCredits, totalQualityPoints4, totalQualityPoints10, cumulativeGpa4, cumulativeGpa10 } =
    useMemo(() => {
      let credits = 0;
      let qp4 = 0;
      let qp10 = 0;

      courses.forEach((c) => {
        const cr = Number(c.credits) || 0;
        const gp4 = GRADE_POINTS_4[c.letterGrade] ?? 0;
        const gp10 = c.numericGrade ? c.numericGrade / 10 : GRADE_POINTS_10[c.letterGrade] ?? 0;
        credits += cr;
        qp4 += cr * gp4;
        qp10 += cr * gp10;
      });

      const gpa4 = credits > 0 ? qp4 / credits : 0;
      const gpa10 = credits > 0 ? qp10 / credits : 0;

      return {
        totalCredits: credits,
        totalQualityPoints4: qp4,
        totalQualityPoints10: qp10,
        cumulativeGpa4: gpa4,
        cumulativeGpa10: gpa10,
      };
    }, [courses]);

  // Degree completion calculations
  const degreeProgressPercent = useMemo(() => {
    if (totalRequiredCredits <= 0) return 0;
    return Math.min(100, (totalCredits / totalRequiredCredits) * 100);
  }, [totalCredits, totalRequiredCredits]);

  const remainingDegreeCredits = useMemo(() => {
    return Math.max(0, totalRequiredCredits - totalCredits);
  }, [totalRequiredCredits, totalCredits]);

  // What-If Calculator States (Initialized & synced to remaining degree credits)
  const [targetGpa, setTargetGpa] = useState<number>(3.8);
  const [futureCredits, setFutureCredits] = useState<number>(() => {
    const saved = localStorage.getItem("studispace_total_degree_credits");
    const req = saved ? Number(saved) : 144;
    let cr = 0;
    courses.forEach((c) => (cr += Number(c.credits) || 0));
    const rem = Math.max(0, req - cr);
    return rem > 0 ? rem : 30;
  });

  // Keep localStorage updated with degree credits goal
  useEffect(() => {
    localStorage.setItem("studispace_total_degree_credits", String(totalRequiredCredits));
  }, [totalRequiredCredits]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (selectedTerm !== "all" && c.term !== selectedTerm) return false;
      if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
      return true;
    });
  }, [courses, selectedTerm, selectedCategory]);

  // Term-specific GPA stats for selected term
  const termStats = useMemo(() => {
    if (selectedTerm === "all") return null;
    const termCourses = courses.filter((c) => c.term === selectedTerm);
    let credits = 0;
    let qp4 = 0;
    termCourses.forEach((c) => {
      const cr = Number(c.credits) || 0;
      const gp4 = GRADE_POINTS_4[c.letterGrade] ?? 0;
      credits += cr;
      qp4 += cr * gp4;
    });
    return {
      termCredits: credits,
      termGpa4: credits > 0 ? qp4 / credits : 0,
      courseCount: termCourses.length,
    };
  }, [courses, selectedTerm]);

  // Academic Standing calculation
  const academicStanding = useMemo(() => {
    if (totalCredits === 0) return { title: "New Scholar", color: "bg-gray-100", badge: "🌱" };
    if (cumulativeGpa4 >= 3.85) return { title: "Summa Cum Laude / Dean's List", color: "bg-[#73EC8E]", badge: "🏆" };
    if (cumulativeGpa4 >= 3.65) return { title: "Magna Cum Laude", color: "bg-[#00F0FF]", badge: "⭐" };
    if (cumulativeGpa4 >= 3.4) return { title: "Cum Laude Honors", color: "bg-[#FFE600]", badge: "✨" };
    if (cumulativeGpa4 >= 2.0) return { title: "Good Academic Standing", color: "bg-white", badge: "👍" };
    return { title: "Academic Notice", color: "bg-[#FF66C4]", badge: "⚠️" };
  }, [cumulativeGpa4, totalCredits]);

  // Target GPA What-If Simulation
  const requiredFutureGpa = useMemo(() => {
    if (futureCredits <= 0) return 0;
    const currentQp = totalQualityPoints4;
    const targetTotalQp = targetGpa * (totalCredits + futureCredits);
    const neededQp = targetTotalQp - currentQp;
    return neededQp / futureCredits;
  }, [targetGpa, futureCredits, totalCredits, totalQualityPoints4]);

  // Handler to sync remaining degree credits into simulator
  const handleSyncDegreeRemainingCredits = () => {
    const rem = Math.max(0, totalRequiredCredits - totalCredits);
    setFutureCredits(rem > 0 ? rem : 15);
    soundEngine.playChime("click");
  };

  // Handler to save Degree Credit Goal
  const handleSaveDegreeGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(tempRequiredCredits);
    if (val && val > 0 && val <= 400) {
      setTotalRequiredCredits(val);
      setShowCreditGoalModal(false);
      soundEngine.playChime("levelup");
      confetti({ particleCount: 60, spread: 60 });
      onAwardXp(15);
      // Auto sync future credits if desired
      const newRem = Math.max(0, val - totalCredits);
      if (newRem > 0) {
        setFutureCredits(newRem);
      }
    }
  };

  // Grade Distribution Counts
  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    courses.forEach((c) => {
      const letter = c.letterGrade.charAt(0);
      if (dist[letter] !== undefined) {
        dist[letter]++;
      }
    });
    return dist;
  }, [courses]);

  const handleOpenAdd = () => {
    setEditingCourse(null);
    setFormCode("");
    setFormName("");
    setFormTerm(terms[terms.length - 1] || "Fall 2026");
    setFormCredits(3);
    setFormGrade("A");
    setFormNumeric(92);
    setFormCategory("Core");
    setShowAddModal(true);
  };

  const handleOpenEdit = (course: CourseGrade) => {
    setEditingCourse(course);
    setFormCode(course.courseCode);
    setFormName(course.courseName);
    setFormTerm(course.term);
    setFormCredits(course.credits);
    setFormGrade(course.letterGrade);
    setFormNumeric(course.numericGrade ?? "");
    setFormCategory(course.category);
    setShowAddModal(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) return;

    const cr = Number(formCredits) || 3;
    const gp4 = GRADE_POINTS_4[formGrade] ?? 4.0;
    const numGrade = formNumeric === "" ? undefined : Number(formNumeric);
    const gp10 = numGrade ? numGrade / 10 : (GRADE_POINTS_10[formGrade] ?? 9.5);

    if (editingCourse) {
      const updated: CourseGrade = {
        ...editingCourse,
        courseCode: formCode.trim().toUpperCase(),
        courseName: formName.trim(),
        term: formTerm.trim(),
        credits: cr,
        letterGrade: formGrade,
        numericGrade: numGrade,
        category: formCategory,
        qualityPoints4: Number((cr * gp4).toFixed(2)),
        qualityPoints10: Number((cr * gp10).toFixed(2)),
      };
      onUpdateCourse(updated);
      soundEngine.playChime("click");
    } else {
      const newCourse: CourseGrade = {
        id: `course-${Date.now()}`,
        courseCode: formCode.trim().toUpperCase(),
        courseName: formName.trim(),
        term: formTerm.trim(),
        credits: cr,
        letterGrade: formGrade,
        numericGrade: numGrade,
        category: formCategory,
        qualityPoints4: Number((cr * gp4).toFixed(2)),
        qualityPoints10: Number((cr * gp10).toFixed(2)),
      };
      onAddCourse(newCourse);
      soundEngine.playChime("success");
      onAwardXp(15);
    }

    setShowAddModal(false);
  };

  // Transcript Parsing Handler
  const handleParseTranscript = async () => {
    if (!transcriptText.trim()) return;
    setIsParsing(true);
    setParserFeedback(null);
    soundEngine.playChime("click");

    try {
      const res = await fetch("/api/gemini/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText }),
      });

      const data = await res.json();
      if (data.courses && Array.isArray(data.courses)) {
        const mapped: CourseGrade[] = data.courses.map((item: any, idx: number) => {
          const cr = Number(item.credits) || 3;
          const letter = (item.letterGrade || "A").toUpperCase().trim();
          const gp4 = GRADE_POINTS_4[letter] ?? 4.0;
          const num = item.numericGrade ? Number(item.numericGrade) : undefined;
          const gp10 = num ? num / 10 : (GRADE_POINTS_10[letter] ?? 9.5);

          return {
            id: `parsed-${Date.now()}-${idx}`,
            courseCode: item.courseCode || "CRS 101",
            courseName: item.courseName || "Untitled Course",
            term: item.term || "Fall 2026",
            credits: cr,
            letterGrade: letter,
            numericGrade: num,
            category: item.category || "Core",
            qualityPoints4: Number((cr * gp4).toFixed(2)),
            qualityPoints10: Number((cr * gp10).toFixed(2)),
          };
        });

        setParsedResults(mapped);
        setParserFeedback(`Successfully extracted ${mapped.length} courses! Review and import below.`);
        soundEngine.playChime("success");
      } else {
        setParserFeedback("Could not extract courses. Please check transcript format.");
      }
    } catch (err) {
      console.error("Transcript parsing error:", err);
      setParserFeedback("Error contacting Gemini AI transcript parser.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setTranscriptText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!parsedResults || parsedResults.length === 0) return;
    onBatchAddCourses(parsedResults);
    soundEngine.playChime("levelup");
    confetti({ particleCount: 90, spread: 75 });
    onAwardXp(parsedResults.length * 10);
    setParsedResults(null);
    setIsParserOpen(false);
    setTranscriptText("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#FF4B4B] p-2 border-2 border-black shadow-[4px_4px_0px_#000]">
              <GraduationCap className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              GPA & Transcript Command Station
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            4.0 & 10.0 scale GPA engine, AI transcript document extractor, and graduation target simulator
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setTempRequiredCredits(totalRequiredCredits);
              setShowCreditGoalModal(true);
            }}
            id="btn-degree-goal-settings"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
            title="Configure Degree Credits Goal"
          >
            <Sliders className="w-4 h-4 text-black" />
            <span>Degree Goal ({totalRequiredCredits} Cr)</span>
          </button>

          <button
            onClick={() => setIsParserOpen((prev) => !prev)}
            id="btn-toggle-transcript-parser"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00F0FF] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#20f3ff] active:translate-x-0.5 active:translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>{isParserOpen ? "Close Parser" : "AI Transcript Parser"}</span>
          </button>

          <button
            onClick={handleOpenAdd}
            id="btn-add-course"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>Add Course</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cumulative GPA (4.0 Scale) */}
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-1">
          <div className="flex items-center justify-between text-xs font-black uppercase text-gray-700">
            <span>Cumulative GPA (4.0)</span>
            <Award className="w-4 h-4 text-black" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            {cumulativeGpa4.toFixed(2)}
          </div>
          <div className="text-[11px] font-bold text-gray-600">
            {totalQualityPoints4.toFixed(1)} Quality Points / {totalCredits} Credits
          </div>
        </div>

        {/* Cumulative GPA (10.0 Scale) */}
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-1">
          <div className="flex items-center justify-between text-xs font-black uppercase text-gray-700">
            <span>10-Point Scale CGPA</span>
            <Calculator className="w-4 h-4 text-black" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            {cumulativeGpa10.toFixed(2)}
          </div>
          <div className="text-[11px] font-bold text-gray-600">
            Weighted numerical average
          </div>
        </div>

        {/* Total Credits Completed & Degree Goal Progress */}
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2 relative">
          <div className="flex items-center justify-between text-xs font-black uppercase text-gray-700">
            <span className="flex items-center gap-1.5">
              <span>Total Units / Credits</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setTempRequiredCredits(totalRequiredCredits);
                setShowCreditGoalModal(true);
              }}
              className="flex items-center gap-1 text-[10px] font-black uppercase bg-[#F4F4F0] px-2 py-0.5 border border-black hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              title="Click to edit required graduation credits"
              id="btn-quick-edit-degree-credits"
            >
              <Sliders className="w-2.5 h-2.5 text-black" />
              <span>Goal: {totalRequiredCredits} Cr</span>
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <div className="text-2xl sm:text-3xl font-black text-black tracking-tight">
              {totalCredits} <span className="text-gray-400 font-bold text-base">/</span> {totalRequiredCredits}{" "}
              <span className="text-[11px] font-bold uppercase text-gray-600">Credits Completed</span>
            </div>
            <div className="bg-[#FF4B4B] text-white text-[11px] font-black px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000]">
              {degreeProgressPercent.toFixed(1)}%
            </div>
          </div>

          {/* Stylized Neo-brutalist Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-[#EAEAE6] h-3 border-2 border-black p-0.5 shadow-[1px_1px_0px_#000] relative">
              <div
                className="h-full bg-[#FF4B4B] border-r-2 border-black transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(degreeProgressPercent, 1))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-600">
              <span>0 Cr</span>
              <span className="font-black text-black">
                {remainingDegreeCredits === 0
                  ? "🎉 Degree Goal Met!"
                  : `${remainingDegreeCredits} Cr to Graduate`}
              </span>
              <span>{totalRequiredCredits} Cr</span>
            </div>
          </div>

          <div className="text-[11px] font-bold text-gray-600 pt-1 border-t border-gray-100 flex items-center justify-between">
            <span>Across {courses.length} enrolled courses</span>
            <button
              onClick={() => {
                setTempRequiredCredits(totalRequiredCredits);
                setShowCreditGoalModal(true);
              }}
              className="text-[10px] font-black underline hover:text-[#FF4B4B] text-black"
            >
              Edit Goal ⚙️
            </button>
          </div>
        </div>

        {/* Academic Standing */}
        <div
          className={`border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-1 ${academicStanding.color}`}
        >
          <div className="flex items-center justify-between text-xs font-black uppercase text-black">
            <span>Academic Standing</span>
            <span>{academicStanding.badge}</span>
          </div>
          <div className="text-base sm:text-lg font-black text-black leading-tight line-clamp-2">
            {academicStanding.title}
          </div>
          <div className="text-[11px] font-bold text-gray-800">
            {cumulativeGpa4 >= 3.5 ? "Honor Roll Distinction" : "Good Progress"}
          </div>
        </div>
      </div>

      {/* AI Transcript Parser Drawer / Panel */}
      {isParserOpen && (
        <div className="bg-white border-2 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-black" />
              <h2 className="text-base sm:text-lg font-black uppercase text-black">
                Gemini AI Transcript & Grade Sheet Parser
              </h2>
            </div>
            <button
              onClick={() => setIsParserOpen(false)}
              className="text-sm font-black px-2 border border-black hover:bg-gray-100"
            >
              ✕
            </button>
          </div>

          <p className="text-xs font-bold text-gray-700">
            Paste raw transcript text or upload your syllabus/grade sheet. Gemini extracts course codes, titles, credits, and letter grades automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <textarea
                rows={5}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste transcript text here (e.g. 'CS 201 Data Structures 4.0 A, MATH 240 Linear Algebra 3.0 A-...')"
                className="w-full p-3 bg-[#F4F4F0] border-2 border-black font-mono text-xs text-black focus:outline-none focus:bg-white"
              />
            </div>

            <div className="flex flex-col justify-between p-4 bg-[#F4F4F0] border-2 border-black space-y-3">
              <div>
                <span className="text-xs font-black uppercase text-black block mb-1">
                  Upload Document / Text File:
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.csv,.json,.doc,.pdf"
                  className="w-full text-xs font-bold file:mr-2 file:py-1 file:px-2 file:border-2 file:border-black file:bg-[#FFE600] file:font-black file:text-xs file:cursor-pointer"
                />
              </div>

              <button
                onClick={handleParseTranscript}
                disabled={isParsing || !transcriptText.trim()}
                id="btn-run-transcript-parse"
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Parsing Courses...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Parse With AI
                  </>
                )}
              </button>
            </div>
          </div>

          {parserFeedback && (
            <div className="p-3 bg-[#00F0FF]/20 border-2 border-black font-bold text-xs text-black">
              ⚡ {parserFeedback}
            </div>
          )}

          {/* Parsed Staging Results */}
          {parsedResults && parsedResults.length > 0 && (
            <div className="pt-3 border-t-2 border-black space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs uppercase text-black">
                  Extracted Courses Preview ({parsedResults.length}):
                </span>
                <button
                  onClick={handleConfirmImport}
                  id="btn-confirm-import-courses"
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#73EC8E] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-0.5 active:translate-y-0.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import All to Transcript (+{parsedResults.length * 10} XP)</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border-2 border-black bg-[#F4F4F0]">
                <table className="w-full text-left text-xs font-bold border-collapse">
                  <thead>
                    <tr className="bg-black text-white text-[11px] uppercase">
                      <th className="p-2">Code</th>
                      <th className="p-2">Course Title</th>
                      <th className="p-2">Term</th>
                      <th className="p-2">Credits</th>
                      <th className="p-2">Grade</th>
                      <th className="p-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedResults.map((c, i) => (
                      <tr key={i} className="border-b border-black/20 hover:bg-white">
                        <td className="p-2 font-mono font-black">{c.courseCode}</td>
                        <td className="p-2">{c.courseName}</td>
                        <td className="p-2">{c.term}</td>
                        <td className="p-2">{c.credits}</td>
                        <td className="p-2">
                          <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black">
                            {c.letterGrade}
                          </span>
                        </td>
                        <td className="p-2">{c.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main 2-Section Grid: Course Table + Target Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Course Records Table & Term Filter */}
        <div className="lg:col-span-2 bg-white border-2 border-black p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
          {/* Table Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-black" />
              <h2 className="font-black text-sm uppercase text-black">
                Course Catalog & Grade Record
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Term Filter */}
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="p-1.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs cursor-pointer"
              >
                <option value="all">All Terms ({courses.length})</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-1.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Core">Core</option>
                <option value="Major Elective">Major Elective</option>
                <option value="Gen Ed">Gen Ed</option>
                <option value="Lab">Lab</option>
                <option value="Honors">Honors</option>
              </select>
            </div>
          </div>

          {/* Term Sub-total Banner (if specific term filtered) */}
          {termStats && (
            <div className="p-3 bg-[#FFE600] border-2 border-black font-black text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span>{selectedTerm} SUMMARY:</span>
              <div className="flex items-center gap-4">
                <span>{termStats.termCredits} Credits</span>
                <span>Term GPA: {termStats.termGpa4.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Courses Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold border-collapse border-2 border-black">
              <thead>
                <tr className="bg-black text-white text-[11px] uppercase border-b-2 border-black">
                  <th className="p-3">Course</th>
                  <th className="p-3 hidden sm:table-cell">Term</th>
                  <th className="p-3">Credits</th>
                  <th className="p-3">Grade</th>
                  <th className="p-3 hidden md:table-cell">Quality Pts</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-black hover:bg-[#F4F4F0] transition-all"
                  >
                    <td className="p-3">
                      <div className="font-mono font-black text-black">{c.courseCode}</div>
                      <div className="text-[11px] text-gray-700 font-medium">{c.courseName}</div>
                      <span className="inline-block sm:hidden text-[9px] uppercase px-1 border border-black bg-white mt-1">
                        {c.term}
                      </span>
                    </td>

                    <td className="p-3 hidden sm:table-cell">
                      <span className="bg-[#F4F4F0] px-2 py-0.5 border border-black text-[10px] uppercase font-bold">
                        {c.term}
                      </span>
                    </td>

                    <td className="p-3 font-mono font-black text-sm">{c.credits}</td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-black text-xs px-2 py-0.5 border border-black ${
                            c.letterGrade.startsWith("A")
                              ? "bg-[#73EC8E]"
                              : c.letterGrade.startsWith("B")
                              ? "bg-[#FFE600]"
                              : c.letterGrade.startsWith("C")
                              ? "bg-[#FFA94D]"
                              : "bg-[#FF66C4]"
                          }`}
                        >
                          {c.letterGrade}
                        </span>
                        {c.numericGrade && (
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({c.numericGrade}%)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 hidden md:table-cell font-mono font-bold">
                      {c.qualityPoints4.toFixed(1)} pts
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 bg-white border border-black hover:bg-gray-100"
                          title="Edit course"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${c.courseCode} from transcript?`)) {
                              onDeleteCourse(c.id);
                              soundEngine.playChime("click");
                            }
                          }}
                          className="p-1.5 bg-white border border-black hover:bg-[#FF66C4]"
                          title="Delete course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCourses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs font-bold text-gray-500">
                      No courses found matching filter. Click "+ Add Course" or use AI Transcript Parser.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Target GPA Simulator & Grade Distribution */}
        <div className="space-y-6">
          {/* Target GPA What-If Calculator */}
          <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-black" />
                <h2 className="font-black text-xs uppercase text-black">
                  Target GPA & What-If Simulator
                </h2>
              </div>
              <span className="text-[10px] font-black bg-[#FFE600] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000]">
                Live Simulator
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-black uppercase text-black">
                    Target Cumulative GPA (4.0 max):
                  </label>
                  <span className="text-[11px] font-black text-black bg-[#EAEAE6] px-1.5 py-0.2 border border-black">
                    {targetGpa.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={2.0}
                    max={4.0}
                    step={0.01}
                    value={targetGpa}
                    onChange={(e) => setTargetGpa(Number(e.target.value))}
                    className="flex-1 accent-[#FF4B4B] cursor-pointer"
                  />
                  <input
                    type="number"
                    min={1.0}
                    max={4.0}
                    step={0.05}
                    value={targetGpa}
                    onChange={(e) => setTargetGpa(Number(e.target.value))}
                    className="w-16 p-1 bg-[#F4F4F0] border-2 border-black font-black text-xs text-center"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <label className="text-[11px] font-black uppercase text-black">
                    Remaining Future Credits:
                  </label>
                  <button
                    type="button"
                    onClick={handleSyncDegreeRemainingCredits}
                    className="text-[10px] font-black bg-[#FF4B4B] text-white px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000] hover:bg-[#ff3636] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1 transition-all"
                    title="Reset to remaining degree credits based on total goal"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-white" />
                    <span>Sync Remainder ({remainingDegreeCredits} Cr)</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={futureCredits}
                    onChange={(e) => setFutureCredits(Number(e.target.value) || 1)}
                    className="flex-1 p-2 bg-[#F4F4F0] border-2 border-black font-black text-xs text-black"
                  />
                  <span className="text-[11px] font-bold text-gray-600 whitespace-nowrap">
                    credits workload
                  </span>
                </div>
                <p className="text-[10px] font-bold text-gray-500 mt-1">
                  💡 Auto-calculated: {totalRequiredCredits} required − {totalCredits} earned = {remainingDegreeCredits} Cr remaining. You can manually adjust for custom simulations.
                </p>
              </div>

              {/* Simulation Result Box */}
              <div
                className={`p-4 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-1.5 ${
                  requiredFutureGpa > 4.0
                    ? "bg-[#FF4B4B] text-white"
                    : requiredFutureGpa >= 3.7
                    ? "bg-[#FFE600] text-black"
                    : "bg-[#73EC8E] text-black"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider block">
                    Required Future Semester GPA:
                  </span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="text-2xl font-black">
                  {requiredFutureGpa > 4.0
                    ? "Exceeds 4.0 Max"
                    : requiredFutureGpa < 0
                    ? "Target Already Met!"
                    : `${requiredFutureGpa.toFixed(2)} GPA`}
                </div>
                <p className="text-[10px] font-bold leading-tight opacity-95">
                  {requiredFutureGpa > 4.0
                    ? "⚠️ Target is mathematically impossible with this credit count. Increase future credits."
                    : requiredFutureGpa >= 3.7
                    ? "🔥 Requires near-perfect straight A/A- grades across all remaining credits."
                    : requiredFutureGpa >= 3.0
                    ? "✨ Easily attainable with consistent B+ and A averages."
                    : "🎯 You are well on track to exceed this target!"}
                </p>
              </div>
            </div>
          </div>

          {/* Grade Distribution Bar Graph */}
          <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-black">
              <BarChart3 className="w-4 h-4 text-black" />
              <h2 className="font-black text-xs uppercase text-black">
                Grade Distribution
              </h2>
            </div>

            <div className="space-y-2">
              {(Object.entries(gradeDistribution) as [string, number][]).map(([grade, count]) => {
                const pct = courses.length > 0 ? (count / courses.length) * 100 : 0;
                return (
                  <div key={grade} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-black text-black">
                      <span>Grade {grade}'s</span>
                      <span>
                        {count} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#E4E4DF] h-3.5 border border-black overflow-hidden">
                      <div
                        className={`h-full border-r border-black transition-all ${
                          grade === "A"
                            ? "bg-[#73EC8E]"
                            : grade === "B"
                            ? "bg-[#FFE600]"
                            : grade === "C"
                            ? "bg-[#FFA94D]"
                            : "bg-[#FF66C4]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCourse}
            className="bg-white border-2 border-black p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <h3 className="font-black text-lg uppercase text-black">
                {editingCourse ? "Edit Course Entry" : "Add Course to Record"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. CS 201"
                    required
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Term / Semester
                  </label>
                  <input
                    type="text"
                    value={formTerm}
                    onChange={(e) => setFormTerm(e.target.value)}
                    placeholder="e.g. Fall 2026"
                    required
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Course Name / Title
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  required
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={formCredits}
                    onChange={(e) => setFormCredits(Number(e.target.value) || 1)}
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Letter Grade
                  </label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs cursor-pointer"
                  >
                    {Object.keys(GRADE_POINTS_4).map((g) => (
                      <option key={g} value={g}>
                        {g} ({GRADE_POINTS_4[g].toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Score (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formNumeric}
                    onChange={(e) =>
                      setFormNumeric(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="e.g. 94"
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as CourseCategory)}
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs cursor-pointer"
                >
                  <option value="Core">Core</option>
                  <option value="Major Elective">Major Elective</option>
                  <option value="Gen Ed">Gen Ed</option>
                  <option value="Lab">Lab</option>
                  <option value="Honors">Honors</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d]"
              >
                {editingCourse ? "Save Changes" : "Add Course"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Degree Credit Goal & Graduation Target Modal */}
      {showCreditGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDegreeGoal}
            className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="bg-[#FF4B4B] p-1.5 border border-black shadow-[2px_2px_0px_#000]">
                  <Sliders className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-black text-base sm:text-lg uppercase text-black">
                  Degree Credit Goal & Roadmap
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditGoalModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-bold text-gray-700 leading-relaxed">
              Configure the total required units or credits for your university degree. StudiSpace uses this to calculate graduation completion percentage and sync the Target GPA simulator.
            </p>

            {/* Degree Presets */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-black block">
                Standard Degree Programs:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEGREE_CREDIT_PRESETS.map((preset) => {
                  const isSelected = tempRequiredCredits === preset.credits;
                  return (
                    <button
                      key={preset.credits}
                      type="button"
                      onClick={() => setTempRequiredCredits(preset.credits)}
                      className={`text-left p-2.5 border-2 border-black transition-all ${
                        isSelected
                          ? "bg-[#FFE600] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black"
                          : "bg-[#F4F4F0] hover:bg-gray-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] font-bold"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-black">{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                      </div>
                      <div className="text-[10px] text-gray-600 font-normal leading-tight mt-0.5">
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Numeric Input */}
            <div className="p-3.5 bg-[#F4F4F0] border-2 border-black space-y-2">
              <label className="text-xs font-black uppercase text-black block">
                Custom Required Credits Target:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  max={400}
                  value={tempRequiredCredits}
                  onChange={(e) => setTempRequiredCredits(Number(e.target.value) || 120)}
                  className="w-32 p-2 bg-white border-2 border-black font-black text-sm text-center"
                />
                <div className="text-xs font-bold text-gray-700">
                  <span className="font-black text-black">{totalCredits}</span> Credits completed (
                  <span className="font-black text-[#FF4B4B]">
                    {tempRequiredCredits > 0
                      ? ((totalCredits / tempRequiredCredits) * 100).toFixed(1)
                      : 0}
                    %
                  </span>{" "}
                  of degree)
                </div>
              </div>
            </div>

            {/* Live Progress Preview */}
            <div className="p-3 bg-white border-2 border-black space-y-1.5 shadow-[2px_2px_0px_#000]">
              <div className="flex items-center justify-between text-[11px] font-black uppercase text-black">
                <span>Calculated Graduation Roadmap</span>
                <span className="text-[#FF4B4B]">
                  {Math.max(0, tempRequiredCredits - totalCredits)} Credits Remaining
                </span>
              </div>
              <div className="w-full bg-[#EAEAE6] h-3 border-2 border-black p-0.5">
                <div
                  className="h-full bg-[#FF4B4B] border-r-2 border-black transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      tempRequiredCredits > 0 ? (totalCredits / tempRequiredCredits) * 100 : 0
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setShowCreditGoalModal(false)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#FF4B4B] text-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ff3636] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Save Degree Goal (+15 XP)</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
