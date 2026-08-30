import React, { useState, useRef } from "react";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Eye,
  Building2,
  Award,
  Zap,
  HelpCircle,
} from "lucide-react";
import { CourseGrade, CourseCategory, ExtractedCourse, TranscriptEngine } from "../types";
import { GRADE_POINTS_4, isLikelyNonGpaCourse, resolveGrade } from "../utils/grading";
import { soundEngine } from "../utils/audioSynthesizer";
import confetti from "canvas-confetti";

interface TranscriptParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCourses: (courses: CourseGrade[]) => void;
  onAwardXp: (amount: number) => void;
}

export const TranscriptParserModal: React.FC<TranscriptParserModalProps> = ({
  isOpen,
  onClose,
  onImportCourses,
  onAwardXp,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>("image/png");
  const [isDragOver, setIsDragOver] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [detectedInstitution, setDetectedInstitution] = useState<string>("");
  // Which engine actually answered. The two do not read equally well, so the
  // student is told which one produced the rows they are about to import.
  const [engineUsed, setEngineUsed] = useState<TranscriptEngine | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [extractedCourses, setExtractedCourses] = useState<CourseGrade[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showFullImageModal, setShowFullImageModal] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<"file" | "text">("file");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setParseError(null);
    setWarningMessage(null);
    setEngineUsed(null);
    setSelectedFile(file);
    setFileMimeType(file.type || "image/png");

    const reader = new FileReader();

    if (file.type.startsWith("image/")) {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
        setBase64Data(result);
      };
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      setFileMimeType("application/pdf");
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(null);
        setBase64Data(result);
      };
      reader.readAsDataURL(file);
    } else {
      // Plain text or CSV or others
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setTranscriptText(text);
        setPreviewUrl(null);
        setBase64Data(null);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setBase64Data(null);
    setParseError(null);
    setWarningMessage(null);
    setEngineUsed(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Named for what it does, not for which engine answers: the server picks
  // Gemini or the local OCR fallback per request and reports which it used.
  const handleExtractCourses = async () => {
    if (!base64Data && !transcriptText.trim()) {
      setParseError("Please select an image/document or enter transcript text.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setWarningMessage(null);
    setEngineUsed(null);
    soundEngine.playChime("click");

    try {
      const payload: {
        transcriptText?: string;
        base64Data?: string;
        mimeType?: string;
      } = {};

      if (base64Data) {
        payload.base64Data = base64Data;
        payload.mimeType = fileMimeType;
      }
      if (transcriptText.trim()) {
        payload.transcriptText = transcriptText.trim();
      }

      const res = await fetch("/api/gemini/parse-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || "Failed to parse document");
      }

      const data = await res.json();
      const rawCourses = data.extractedCourses || data.courses || [];

      if (rawCourses.length === 0) {
        setWarningMessage(
          data.warning ||
            "No course records could be detected in this document. Please ensure the image shows clear course codes, credits, and grades."
        );
      } else {
        if (data.institution) {
          setDetectedInstitution(data.institution);
        }
        if (data.engine) {
          setEngineUsed(data.engine as TranscriptEngine);
        }
        if (data.warning) {
          setWarningMessage(data.warning);
        }

        const mappedCourses: CourseGrade[] = rawCourses.map(
          (c: ExtractedCourse, index: number) => {
            const creditsNum = Number(c.credits) || 0;
            const letterGrade = (c.letterGrade || c.grade || "").toUpperCase().trim();
            const numericGrade =
              typeof c.numericGrade === "number" && Number.isFinite(c.numericGrade)
                ? c.numericGrade
                : undefined;

            // Nothing is defaulted to a pass here. A row the engine could not
            // read arrives with no grade, resolves to nothing, and is shown for
            // the student to fill in — it used to arrive as an A.
            const grade = resolveGrade({ letterGrade, numericGrade, gradePoints4: c.gradePoints4 });
            const courseName = (c.courseName || "Extracted Course").trim();

            return {
              id: `parsed-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
              courseCode: (c.courseCode || "CRS 101").toUpperCase().trim(),
              courseName,
              // Most transcripts have no term column; say so rather than
              // inventing a semester the student never enrolled in.
              term: (c.term || "Unspecified").trim(),
              credits: creditsNum,
              letterGrade,
              numericGrade,
              gradePoints4: c.gradePoints4,
              category: (c.category as CourseCategory) || "Core",
              qualityPoints4: Number((creditsNum * grade.gradePoints4).toFixed(2)),
              qualityPoints10: Number((creditsNum * grade.gradePoints10).toFixed(2)),
              excludedFromGpa: isLikelyNonGpaCourse(courseName),
              confidence: grade.resolved ? c.confidence ?? "high" : "low",
              parseNote: grade.resolved
                ? c.note
                : c.note ?? "No grade was read for this row — enter it before importing.",
            };
          }
        );

        setExtractedCourses(mappedCourses);
        soundEngine.playChime("success");
      }
    } catch (err: any) {
      console.error("Transcript extraction error:", err);
      setParseError(err.message || "Failed to extract courses from this transcript");
      soundEngine.playChime("click");
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateCourseRow = (
    index: number,
    field: keyof CourseGrade,
    value: any
  ) => {
    setExtractedCourses((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === "credits" || field === "letterGrade" || field === "numericGrade") {
        const cr = Number(target.credits) || 0;
        const num =
          typeof target.numericGrade === "number" && Number.isFinite(target.numericGrade)
            ? target.numericGrade
            : undefined;
        // Editing a row by hand re-resolves it: typing a grade in clears the
        // "no grade" flag, and clearing one puts it back.
        const grade = resolveGrade({
          letterGrade: target.letterGrade,
          numericGrade: num,
          // A hand-edited grade replaces whatever the registrar's column said.
          gradePoints4: field === "credits" ? target.gradePoints4 : undefined,
        });
        target.qualityPoints4 = Number((cr * grade.gradePoints4).toFixed(2));
        target.qualityPoints10 = Number((cr * grade.gradePoints10).toFixed(2));
        target.confidence = grade.resolved ? "high" : "low";
        target.parseNote = grade.resolved ? undefined : "No grade yet — enter one before importing.";
      }

      updated[index] = target;
      return updated;
    });
  };

  const handleDeleteCourseRow = (index: number) => {
    setExtractedCourses((prev) => prev.filter((_, i) => i !== index));
    soundEngine.playChime("click");
  };

  const handleAddManualRow = () => {
    const newCourse: CourseGrade = {
      id: `manual-${Date.now()}`,
      courseCode: "NEW 101",
      courseName: "New Course Subject",
      term: extractedCourses[0]?.term || "Unspecified",
      credits: 3,
      // Deliberately ungraded: a blank row the student fills in, rather than one
      // that silently arrives as a 95.
      letterGrade: "",
      category: "Core",
      qualityPoints4: 0,
      qualityPoints10: 0,
      confidence: "low",
      parseNote: "Enter a grade for this row.",
    };
    setExtractedCourses((prev) => [...prev, newCourse]);
    soundEngine.playChime("click");
  };

  const handleConfirmImportAll = () => {
    if (extractedCourses.length === 0) return;
    onImportCourses(extractedCourses);
    soundEngine.playChime("levelup");
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    onAwardXp(extractedCourses.length * 15);
    onClose();
  };

  // Stats for the extracted courses
  const totalExtractedCredits = extractedCourses.reduce(
    (acc, curr) => acc + (Number(curr.credits) || 0),
    0
  );
  const totalExtractedQp4 = extractedCourses.reduce(
    (acc, curr) => acc + (curr.qualityPoints4 || 0),
    0
  );
  const batchGpa4 =
    totalExtractedCredits > 0 ? (totalExtractedQp4 / totalExtractedCredits).toFixed(2) : "0.00";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_#000] w-full max-w-5xl my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-[#FFE600] border-b-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2 shadow-[2px_2px_0px_#fff]">
              <Sparkles className="w-5 h-5 text-[#FFE600]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase text-black tracking-tight">
                AI Multimodal Transcript Parser
              </h2>
              <p className="text-[11px] font-bold text-black/80">
                Visual OCR & Document Extractor — Google Gemini, with local OCR as a fallback
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-white border-2 border-black font-black hover:bg-gray-100 shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            title="Close modal"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Upload & Input Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-black text-white text-xs font-black px-2 py-0.5">
                  STEP 1
                </span>
                <h3 className="font-black text-xs sm:text-sm uppercase text-black">
                  Select Transcript File or Image
                </h3>
              </div>

              {/* Mode Toggle Pills */}
              <div className="flex items-center border-2 border-black p-0.5 bg-[#F4F4F0] text-xs font-black">
                <button
                  type="button"
                  onClick={() => setActiveInputTab("file")}
                  className={`px-3 py-1 uppercase ${
                    activeInputTab === "file"
                      ? "bg-[#00F0FF] text-black border border-black shadow-[1px_1px_0px_#000]"
                      : "text-gray-700 hover:text-black"
                  }`}
                >
                  Upload File / Image
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("text")}
                  className={`px-3 py-1 uppercase ${
                    activeInputTab === "text"
                      ? "bg-[#00F0FF] text-black border border-black shadow-[1px_1px_0px_#000]"
                      : "text-gray-700 hover:text-black"
                  }`}
                >
                  Paste Raw Text
                </button>
              </div>
            </div>

            {activeInputTab === "file" ? (
              <div className="space-y-3">
                {/* Drag and Drop Zone */}
                {!selectedFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? "border-[#FF4B4B] bg-[#FFE600]/20 scale-[0.99]"
                        : "border-black bg-[#F4F4F0] hover:bg-[#EAEAE6]"
                    }`}
                  >
                    <input
                      id="input-transcript-file"
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileProcess(e.target.files[0]);
                        }
                      }}
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="bg-white p-3 border-2 border-black shadow-[3px_3px_0px_#000]">
                        <Upload className="w-6 h-6 text-black" />
                      </div>
                      <div className="font-black text-sm sm:text-base uppercase text-black">
                        Upload Transcript (PDF, PNG, JPG, WEBP)
                      </div>
                      <p className="text-xs font-bold text-gray-700 max-w-md">
                        Clear photos or scans of your academic transcript / portal screenshot.
                        Drag and drop here, or click to browse files.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-[10px] font-black uppercase bg-white px-2 py-0.5 border border-black">
                          PNG
                        </span>
                        <span className="text-[10px] font-black uppercase bg-white px-2 py-0.5 border border-black">
                          JPG
                        </span>
                        <span className="text-[10px] font-black uppercase bg-white px-2 py-0.5 border border-black">
                          WEBP
                        </span>
                        <span className="text-[10px] font-black uppercase bg-white px-2 py-0.5 border border-black">
                          PDF
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* File Selected / Image Preview Card */
                  <div className="border-2 border-black p-4 bg-[#F4F4F0] shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {previewUrl ? (
                          <div className="relative group w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-black overflow-hidden flex-shrink-0">
                            <img
                              src={previewUrl}
                              alt="Transcript Thumbnail"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => setShowFullImageModal(true)}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                              title="Click to view full preview"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#FF4B4B] border-2 border-black flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#000]">
                            <FileText className="w-8 h-8 text-white" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-black break-all line-clamp-1">
                              {selectedFile.name}
                            </span>
                            <span className="text-[10px] font-black bg-[#FFE600] px-1.5 py-0.5 border border-black uppercase">
                              {selectedFile.type || "Document"}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-gray-600 mt-0.5">
                            Size: {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to extract
                          </p>
                          {previewUrl && (
                            <button
                              type="button"
                              onClick={() => setShowFullImageModal(true)}
                              className="text-[11px] font-black text-black underline hover:text-[#FF4B4B] mt-1 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Inspect Uploaded Image
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white border-2 border-black font-black text-xs uppercase hover:bg-gray-100 shadow-[2px_2px_0px_#000]"
                        >
                          Change File
                        </button>
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="p-1.5 bg-[#FF66C4] border-2 border-black font-black text-xs hover:bg-[#ff4db7] shadow-[2px_2px_0px_#000]"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4 text-black" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Raw Text Input Tab */
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Paste student transcript text or degree audit summary here (e.g. 'CS 201 Data Structures 4.0 A, MATH 240 Linear Algebra 3.0 A-...')"
                  className="w-full p-3 bg-[#F4F4F0] border-2 border-black font-mono text-xs text-black focus:outline-none focus:bg-white"
                />
              </div>
            )}

            {/* Optional Additional Context Field */}
            {activeInputTab === "file" && (
              <div>
                <label className="text-[11px] font-black uppercase text-black block mb-1">
                  Optional notes or special prompt instructions:
                </label>
                <input
                  type="text"
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="e.g. 'Only parse the 2025-2026 academic year courses' or 'Grading scale is 4.0'"
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs text-black"
                />
              </div>
            )}

            {/* Parse Action Trigger Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExtractCourses}
                disabled={isParsing || (!base64Data && !transcriptText.trim())}
                id="btn-parse-multimodal-transcript"
                className="w-full py-3.5 bg-[#73EC8E] border-2 border-black font-black text-sm uppercase shadow-[4px_4px_0px_#000] hover:bg-[#5de07b] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Extracting Courses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Extract Courses with AI / OCR</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback & Error / Warning Banners */}
          {parseError && (
            <div className="p-3 bg-[#FF4B4B] text-white border-2 border-black font-black text-xs flex items-center gap-2 shadow-[3px_3px_0px_#000]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {warningMessage && (
            <div className="p-3 bg-[#FFE600] border-2 border-black font-black text-xs text-black flex items-center gap-2 shadow-[3px_3px_0px_#000]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Step 2: Extracted Courses Staging & Verification Table */}
          {extractedCourses.length > 0 && (
            <div className="space-y-3 pt-4 border-t-2 border-black">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-white text-xs font-black px-2 py-0.5">
                      STEP 2
                    </span>
                    <h3 className="font-black text-sm uppercase text-black">
                      Review & Verify Extracted Courses ({extractedCourses.length})
                    </h3>
                  </div>
                  {detectedInstitution && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mt-1">
                      <Building2 className="w-3.5 h-3.5 text-black" />
                      <span>
                        Detected University / School:{" "}
                        <strong className="text-black font-black">{detectedInstitution}</strong>
                      </span>
                    </div>
                  )}
                  {engineUsed && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mt-1">
                      <Zap className="w-3.5 h-3.5 text-black" />
                      <span>
                        Extracted by:{" "}
                        <strong className="text-black font-black">
                          {engineUsed === "gemini"
                            ? "Google Gemini Vision"
                            : engineUsed === "ocr-fallback"
                            ? "Local OCR fallback — check every row"
                            : "Local text parser — check every row"}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-[#F4F4F0] px-3 py-1 border-2 border-black text-xs font-bold">
                    <span>Batch Units: </span>
                    <strong className="font-black text-black">{totalExtractedCredits} Cr</strong> &bull;{" "}
                    <span>Batch GPA: </span>
                    <strong className="font-black text-black">{batchGpa4}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-black font-black text-xs uppercase hover:bg-gray-100 shadow-[2px_2px_0px_#000]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              {/* Editable Staging Table */}
              <div className="overflow-x-auto border-2 border-black shadow-[3px_3px_0px_#000] bg-white max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs font-bold border-collapse">
                  <thead className="sticky top-0 z-10 bg-black text-white text-[11px] uppercase border-b-2 border-black">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Course Name</th>
                      <th className="p-2.5">Term</th>
                      <th className="p-2.5 w-16">Credits</th>
                      <th className="p-2.5 w-20">Score</th>
                      <th className="p-2.5 w-20">Letter</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedCourses.map((course, idx) => (
                      <tr
                        key={course.id}
                        className="border-b border-black/20 hover:bg-[#F4F4F0] transition-colors"
                      >
                        {/* Course Code */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={course.courseCode}
                            onChange={(e) =>
                              handleUpdateCourseRow(idx, "courseCode", e.target.value.toUpperCase())
                            }
                            className="w-full p-1 bg-white border border-black font-mono font-black text-xs"
                          />
                        </td>

                        {/* Course Name */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={course.courseName}
                            onChange={(e) =>
                              handleUpdateCourseRow(idx, "courseName", e.target.value)
                            }
                            className="w-full p-1 bg-white border border-black font-bold text-xs"
                          />
                        </td>

                        {/* Term */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={course.term}
                            onChange={(e) => handleUpdateCourseRow(idx, "term", e.target.value)}
                            className="w-full p-1 bg-white border border-black font-bold text-xs"
                          />
                        </td>

                        {/* Credits */}
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={course.credits}
                            onChange={(e) =>
                              handleUpdateCourseRow(
                                idx,
                                "credits",
                                Number(e.target.value) || 1
                              )
                            }
                            className="w-16 p-1 bg-white border border-black font-black text-xs text-center"
                          />
                        </td>

                        {/* Numeric score. Many transcripts grade on a 10-point
                            or percentage scale and print no letter at all, so
                            without this column the row reads as ungraded even
                            though the parser read its grade correctly. */}
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={course.numericGrade ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              handleUpdateCourseRow(
                                idx,
                                "numericGrade",
                                e.target.value === "" ? undefined : Number(e.target.value)
                              )
                            }
                            className={`w-16 p-1 border border-black font-black text-xs text-center ${
                              course.confidence === "low" ? "bg-[#FF66C4]" : "bg-white"
                            }`}
                            title={course.parseNote ?? "Grade as printed on the transcript"}
                          />
                          {typeof course.gradePoints4 === "number" && (
                            <div
                              className="text-[9px] font-bold text-gray-500 text-center mt-0.5"
                              title="4-point grade as printed on the transcript"
                            >
                              {course.gradePoints4.toFixed(2)} / 4
                            </div>
                          )}
                        </td>

                        {/* Letter grade, for transcripts that print one */}
                        <td className="p-2">
                          <select
                            value={course.letterGrade}
                            onChange={(e) =>
                              handleUpdateCourseRow(idx, "letterGrade", e.target.value)
                            }
                            className="p-1 bg-[#FFE600] border border-black font-black text-xs cursor-pointer"
                          >
                            {/* A row whose grade could not be read holds "",
                                which needs an option of its own — otherwise the
                                select displays A+ while the row is ungraded. */}
                            <option value="">— no grade —</option>
                            {Object.keys(GRADE_POINTS_4).map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Category */}
                        <td className="p-2">
                          <select
                            value={course.category}
                            onChange={(e) =>
                              handleUpdateCourseRow(
                                idx,
                                "category",
                                e.target.value as CourseCategory
                              )
                            }
                            className="p-1 bg-white border border-black font-bold text-xs cursor-pointer"
                          >
                            <option value="Core">Core</option>
                            <option value="Major Elective">Major Elective</option>
                            <option value="Gen Ed">Gen Ed</option>
                            <option value="Lab">Lab</option>
                            <option value="Honors">Honors</option>
                          </select>
                        </td>

                        {/* Delete Row */}
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCourseRow(idx)}
                            className="p-1 bg-white border border-black hover:bg-[#FF66C4]"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-black" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Confirmation CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                <p className="text-xs font-bold text-gray-700">
                  ⚡ All course entries above can be modified. When satisfied, import them into your GPA Command Record.
                </p>

                <button
                  type="button"
                  onClick={handleConfirmImportAll}
                  id="btn-confirm-import-transcript-courses"
                  className="w-full sm:w-auto px-6 py-3 bg-[#00F0FF] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:bg-[#2fe5f0] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import {extractedCourses.length} Courses (+{extractedCourses.length * 15} XP)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F4F4F0] border-t-2 border-black flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-600 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#FF4B4B]" />
            Encrypted client-to-server processing
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border-2 border-black font-black text-xs uppercase hover:bg-gray-100 shadow-[2px_2px_0px_#000]"
          >
            Close
          </button>
        </div>
      </div>

      {/* Full Image Zoom Modal */}
      {showFullImageModal && previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-4 max-w-4xl w-full shadow-[8px_8px_0px_#000] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <span className="font-black text-xs uppercase text-black">
                Uploaded Document Scan Preview
              </span>
              <button
                type="button"
                onClick={() => setShowFullImageModal(false)}
                className="p-1 bg-white border border-black font-black hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-gray-100 border border-black p-2">
              <img
                src={previewUrl}
                alt="Transcript Zoom"
                className="max-w-full max-h-[70vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
