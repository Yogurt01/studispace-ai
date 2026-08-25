import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  Sparkles,
  Play,
  RotateCcw,
  Trophy,
  AlertCircle,
  HelpCircle,
  Zap,
  Flame,
  Award,
  ArrowRight,
  Plus,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Check,
} from "lucide-react";
import confetti from "canvas-confetti";
import { Quiz, QuizQuestion } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";

interface QuizArenaViewProps {
  quizzes: Quiz[];
  onAddQuiz: (quiz: Quiz) => void;
  onUpdateQuizScore: (quizId: string, score: number) => void;
  onAwardXp: (amount: number) => void;
  initialQuizId?: string;
}

export const QuizArenaView: React.FC<QuizArenaViewProps> = ({
  quizzes,
  onAddQuiz,
  onUpdateQuizScore,
  onAwardXp,
  initialQuizId,
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string | null>(
    initialQuizId || null
  );
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [userAnswers, setUserAnswers] = useState<
    Array<{ questionId: string; selectedIdx: number; isCorrect: boolean }>
  >([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isExported, setIsExported] = useState(false);

  // AI Quiz Generator Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<
    "Easy" | "Medium" | "Hard" | "Genius"
  >("Medium");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || null;
  const currentQuestion: QuizQuestion | undefined =
    activeQuiz?.questions[currentQIndex];

  const handleStartQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setCurrentQIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setStreak(0);
    setIsCompleted(false);
    setShowHint(false);
    setUserAnswers([]);
    setStartTime(Date.now());
    setIsExported(false);
    soundEngine.playChime("click");
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
    soundEngine.playChime("click");
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || !currentQuestion || isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    const isCorrect = selectedOption === currentQuestion.correctIndex;

    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedIdx: selectedOption,
        isCorrect,
      },
    ]);

    if (isCorrect) {
      soundEngine.playChime("success");
      setScore((prev) => prev + 1);
      setStreak((prev) => prev + 1);
      onAwardXp(20 + streak * 5);
    } else {
      soundEngine.playChime("wrong");
      setStreak(0);
    }
  };

  // Google Sheets Export Function
  const handleExportToGoogleSheets = () => {
    if (!activeQuiz) return;

    const timeSpentSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const minutes = Math.floor(timeSpentSec / 60);
    const seconds = timeSpentSec % 60;
    const timeFormatted = `${minutes}m ${seconds}s`;
    const scorePercent = Math.round((score / activeQuiz.questions.length) * 100);

    // Build standard CSV for Google Sheets
    const csvRows: string[] = [];
    csvRows.push("GOOGLE SHEETS QUIZ MASTERY REPORT - STUDISPACE STUDY OS");
    csvRows.push(`Quiz Title,"${activeQuiz.title.replace(/"/g, '""')}"`);
    csvRows.push(`Topic,"${activeQuiz.topic.replace(/"/g, '""')}"`);
    csvRows.push(`Difficulty,"${activeQuiz.difficulty}"`);
    csvRows.push(`Final Score,"${scorePercent}% (${score}/${activeQuiz.questions.length} correct)"`);
    csvRows.push(`Time Spent,"${timeFormatted}"`);
    csvRows.push(`Timestamp,"${new Date().toLocaleString()}"`);
    csvRows.push("");
    csvRows.push("Question #,Question Text,Your Selection,Correct Answer,Status,Key Explanation");

    activeQuiz.questions.forEach((q, idx) => {
      const recorded = userAnswers.find((a) => a.questionId === q.id);
      const userChoiceText = recorded ? q.options[recorded.selectedIdx] || "None" : "None";
      const correctChoiceText = q.options[q.correctIndex] || "";
      const status = recorded?.isCorrect ? "CORRECT" : "INCORRECT";
      const safeQ = q.question.replace(/"/g, '""');
      const safeUserChoice = userChoiceText.replace(/"/g, '""');
      const safeCorrectChoice = correctChoiceText.replace(/"/g, '""');
      const safeExp = (q.explanation || "").replace(/"/g, '""');

      csvRows.push(
        `${idx + 1},"${safeQ}","${safeUserChoice}","${safeCorrectChoice}","${status}","${safeExp}"`
      );
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    const safeTitle = activeQuiz.title.toLowerCase().replace(/[^a-z0-9]/g, "_");
    downloadAnchor.setAttribute("download", `StudiSpace_Quiz_Report_${safeTitle}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);

    setIsExported(true);
    soundEngine.playChime("levelup");
    onAwardXp(25);
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    soundEngine.playChime("click");

    if (currentQIndex + 1 < activeQuiz.questions.length) {
      setCurrentQIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setShowHint(false);
    } else {
      // Complete quiz
      setIsCompleted(true);
      const finalScorePercent = Math.round(
        ((score + (selectedOption === currentQuestion?.correctIndex ? 0 : 0)) /
          activeQuiz.questions.length) *
          100
      );
      onUpdateQuizScore(activeQuiz.id, finalScorePercent);
      soundEngine.playChime("levelup");
      confetti({ particleCount: 100, spread: 80 });
      onAwardXp(100);
    }
  };

  const handleGenerateAiQuiz = async () => {
    if (!aiTopic.trim() && !aiNotes.trim()) return;
    setIsGeneratingAi(true);

    try {
      const res = await fetch("/api/gemini/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          rawNotes: aiNotes.trim(),
          count: aiCount,
          difficulty: aiDifficulty,
        }),
      });

      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        const newQuiz: Quiz = {
          id: `quiz-${Date.now()}`,
          title: data.title || `${aiTopic || "AI Practice"} Sprint`,
          topic: data.topic || aiTopic || "General",
          difficulty: aiDifficulty,
          questions: data.questions.map((q: any, idx: number) => ({
            id: `q-ai-${idx}-${Date.now()}`,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            hint: q.hint,
          })),
          bestScore: undefined,
          timesTaken: 0,
        };

        onAddQuiz(newQuiz);
        setShowAiModal(false);
        handleStartQuiz(newQuiz.id);
        soundEngine.playChime("levelup");
        onAwardXp(50);
      }
    } catch (err) {
      console.error("AI quiz generation error:", err);
      alert("Error generating quiz with Gemini.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#C4B5FD] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Quiz Arena & Speed Sprints
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            Dynamic multiple-choice practice tests with instant feedback & explanations
          </p>
        </div>

        <button
          onClick={() => setShowAiModal(true)}
          id="btn-ai-generate-quiz"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate AI Quiz</span>
        </button>
      </div>

      {/* If No Active Quiz: List of Available Quizzes */}
      {!activeQuizId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between space-y-4 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase bg-[#00F0FF] px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    {quiz.topic}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${
                      quiz.difficulty === "Easy"
                        ? "bg-[#73EC8E]"
                        : quiz.difficulty === "Medium"
                        ? "bg-[#FFE600]"
                        : "bg-[#FF66C4]"
                    }`}
                  >
                    {quiz.difficulty}
                  </span>
                </div>
                <h3 className="font-black text-base text-black">{quiz.title}</h3>
                <p className="text-xs font-bold text-gray-600 mt-1">
                  {quiz.questions.length} Questions •{" "}
                  {quiz.bestScore !== undefined
                    ? `Best Score: ${quiz.bestScore}%`
                    : "Not yet taken"}
                </p>
              </div>

              <button
                onClick={() => handleStartQuiz(quiz.id)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Start Practice Sprint</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active Quiz Question Screen */}
      {activeQuiz && !isCompleted && currentQuestion && (
        <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          {/* Top Status Bar: Question Count, Score, Streak, Exit */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-black flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-black text-xs uppercase bg-[#FFE600] px-2.5 py-1 border border-black">
                Q {currentQIndex + 1} / {activeQuiz.questions.length}
              </span>
              <span className="font-bold text-xs text-gray-700">
                Score: {score} Correct
              </span>
            </div>

            <div className="flex items-center gap-2">
              {streak > 1 && (
                <div className="flex items-center gap-1 bg-[#FF66C4] px-2 py-0.5 border border-black font-black text-xs text-black animate-bounce">
                  <Flame className="w-3.5 h-3.5 fill-black" />
                  {streak}x STREAK!
                </div>
              )}
              <button
                onClick={() => setActiveQuizId(null)}
                className="text-xs font-black px-2 py-1 bg-gray-100 border border-black hover:bg-gray-200"
              >
                Exit Arena
              </button>
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-black text-black leading-snug">
              {currentQuestion.question}
            </h2>
            {currentQuestion.hint && (
              <button
                onClick={() => setShowHint((prev) => !prev)}
                className="text-xs font-black text-gray-700 underline flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showHint ? `Hint: ${currentQuestion.hint}` : "Show Hint"}
              </button>
            )}
          </div>

          {/* Options Grid */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectOption = idx === currentQuestion.correctIndex;

              let optionBg = "bg-[#F4F4F0] hover:bg-[#eaeae4]";
              if (isSelected && !isAnswerSubmitted) {
                optionBg = "bg-[#00F0FF]";
              }
              if (isAnswerSubmitted) {
                if (isCorrectOption) {
                  optionBg = "bg-[#73EC8E]";
                } else if (isSelected && !isCorrectOption) {
                  optionBg = "bg-[#FF66C4]";
                }
              }

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  className={`cursor-pointer p-4 border-2 border-black transition-all flex items-center gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${optionBg} ${
                    isAnswerSubmitted ? "" : "active:translate-x-0.5 active:translate-y-0.5"
                  }`}
                >
                  <div className="w-7 h-7 rounded-none border-2 border-black bg-white flex items-center justify-center font-black text-xs shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="font-bold text-sm text-black">{option}</span>
                </div>
              );
            })}
          </div>

          {/* Explanation Box (Revealed after answer submission) */}
          {isAnswerSubmitted && (
            <div className="p-4 bg-[#F4F4F0] border-2 border-black space-y-2 shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-black">
                <AlertCircle className="w-4 h-4" />
                <span>Explanation & Learning Takeaway:</span>
              </div>
              <p className="text-xs font-bold text-gray-800 leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Action Button: Check Answer or Next Question */}
          <div className="flex justify-end pt-2">
            {!isAnswerSubmitted ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedOption === null}
                className="px-6 py-3 bg-[#FFE600] border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="flex items-center gap-2 px-6 py-3 bg-[#73EC8E] border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>
                  {currentQIndex + 1 < activeQuiz.questions.length
                    ? "Next Question"
                    : "View Results"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quiz Completion Results Screen */}
      {isCompleted && activeQuiz && (
        <div className="bg-white border-2 border-black p-8 sm:p-12 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center space-y-6">
          <div className="w-16 h-16 bg-[#FFE600] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8 text-black fill-black" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-black">
              Quiz Sprint Complete!
            </h2>
            <p className="text-sm font-bold text-gray-700">
              You answered {score} out of {activeQuiz.questions.length} questions correctly.
            </p>
          </div>

          <div className="inline-block p-6 bg-[#F4F4F0] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-5xl font-black text-black">
              {Math.round((score / activeQuiz.questions.length) * 100)}%
            </div>
            <div className="text-xs font-black uppercase text-gray-600 mt-1">
              Score Rating:{" "}
              {score === activeQuiz.questions.length
                ? "🏆 PERFECT ACE (A+)"
                : score / activeQuiz.questions.length >= 0.75
                ? "🔥 GREAT MASTERY (A)"
                : "⚡ KEEP PRACTICING (B)"}
            </div>
          </div>

          {/* Google Sheets Export & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={handleExportToGoogleSheets}
              id="btn-export-google-sheets"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-[#73EC8E] hover:bg-[#5fd87a] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all text-black"
              title="Export formatted CSV report for Google Sheets"
            >
              {isExported ? (
                <>
                  <Check className="w-4 h-4 text-black" />
                  <span>Report Downloaded (Google Sheets CSV)</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-black" />
                  <span>Export Report to Google Sheets</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleStartQuiz(activeQuiz.id)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
            >
              <RotateCcw className="w-4 h-4" />
              Retake Quiz
            </button>
            <button
              onClick={() => setActiveQuizId(null)}
              className="w-full sm:w-auto px-6 py-3.5 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
            >
              Back to Arena
            </button>
          </div>

          <div className="pt-2">
            <a
              href="https://sheets.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-700 hover:text-black hover:underline"
            >
              <span>Tip: Open downloaded report directly in Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* AI Generate Quiz Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-black" />
                <h3 className="font-black text-lg uppercase text-black">
                  AI Practice Quiz Generator
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Topic / Exam Chapter
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Cellular Respiration, Operating Systems Deadlocks"
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Lecture Notes / Key Focus Areas (Optional)
                </label>
                <textarea
                  rows={4}
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Paste lecture excerpts or specific definitions to test..."
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-medium text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Difficulty
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as any)}
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  >
                    <option value="Easy">Easy (Fundamentals)</option>
                    <option value="Medium">Medium (Standard Exam)</option>
                    <option value="Hard">Hard (Tricky Distractors)</option>
                    <option value="Genius">Genius (Competition Level)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Questions: {aiCount}
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full accent-black cursor-pointer mt-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAiQuiz}
                disabled={isGeneratingAi || (!aiTopic.trim() && !aiNotes.trim())}
                className="px-5 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGeneratingAi ? (
                  <>
                    <div className="w-3 h-3 bg-black animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Quiz
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
