import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  Target,
  Sparkles,
  Settings,
  Zap,
  Coffee,
  CheckCircle,
  Trophy,
  ArrowRight,
  Sliders,
  Award,
} from "lucide-react";
import confetti from "canvas-confetti";
import { soundEngine } from "../utils/audioSynthesizer";
import { Assignment, PomodoroPreset } from "../types";

interface PomodoroViewProps {
  onCompleteSession: (durationMinutes: number) => void;
  assignments: Assignment[];
  initialTaskTitle?: string;
  initialAssignmentId?: string;
  onUpdateAssignmentProgress?: (assignmentId: string) => void;
  onNavigateToDashboard?: () => void;
}

type TimerMode = "work" | "short_break" | "long_break";

export const PomodoroView: React.FC<PomodoroViewProps> = ({
  onCompleteSession,
  assignments,
  initialTaskTitle,
  initialAssignmentId,
  onUpdateAssignmentProgress,
  onNavigateToDashboard,
}) => {
  // Preset & Configuration States
  const [selectedPreset, setSelectedPreset] = useState<PomodoroPreset>("standard");
  const [totalSprints, setTotalSprints] = useState(5);
  const [workDuration, setWorkDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);

  // Runtime Timer States
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentSprintIndex, setCurrentSprintIndex] = useState(1);
  const [completedSprintsCount, setCompletedSprintsCount] = useState(0);
  const [mode, setMode] = useState<TimerMode>("work");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  // Task Linkage
  const [activeTask, setActiveTask] = useState(
    initialTaskTitle || "Data Structures & Algorithm Review"
  );
  const [linkedAssignmentId, setLinkedAssignmentId] = useState<string | undefined>(
    initialAssignmentId
  );

  // Ambient & Audio
  const [activeAmbient, setActiveAmbient] = useState<string | null>("rain");
  const [ambientVolume, setAmbientVolume] = useState<number>(0.4);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSessionCompleteModal, setShowSessionCompleteModal] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Handle Preset Switching
  const handleSelectPreset = (preset: PomodoroPreset) => {
    setSelectedPreset(preset);
    if (preset === "quick") {
      setTotalSprints(3);
      setWorkDuration(25);
      setShortBreakDuration(5);
      setLongBreakDuration(15);
      setLongBreakInterval(4);
    } else if (preset === "standard") {
      setTotalSprints(5);
      setWorkDuration(25);
      setShortBreakDuration(5);
      setLongBreakDuration(15);
      setLongBreakInterval(4);
    } else if (preset === "marathon") {
      setTotalSprints(10);
      setWorkDuration(50);
      setShortBreakDuration(10);
      setLongBreakDuration(20);
      setLongBreakInterval(4);
    }
  };

  // Sync initial task if props change
  useEffect(() => {
    if (initialTaskTitle) {
      setActiveTask(initialTaskTitle);
    }
    if (initialAssignmentId) {
      setLinkedAssignmentId(initialAssignmentId);
    }
  }, [initialTaskTitle, initialAssignmentId]);

  // Sync time when mode or durations change
  useEffect(() => {
    let dur = workDuration;
    if (mode === "short_break") dur = shortBreakDuration;
    if (mode === "long_break") dur = longBreakDuration;
    setTimeLeft(dur * 60);
  }, [mode, workDuration, shortBreakDuration, longBreakDuration]);

  // Interval timer tick
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, currentSprintIndex, totalSprints]);

  const handleStartSession = () => {
    setIsSessionActive(true);
    setCurrentSprintIndex(1);
    setCompletedSprintsCount(0);
    setMode("work");
    setTimeLeft(workDuration * 60);
    setIsRunning(true);
    soundEngine.playChime("click");
    if (activeAmbient) {
      soundEngine.setAmbient(activeAmbient, true, ambientVolume);
    }
  };

  const handleTimerComplete = () => {
    setIsRunning(false);

    if (mode === "work") {
      // Completed a sprint
      soundEngine.playChime("success");
      const nextCompleted = completedSprintsCount + 1;
      setCompletedSprintsCount(nextCompleted);
      onCompleteSession(workDuration);

      if (linkedAssignmentId && onUpdateAssignmentProgress) {
        onUpdateAssignmentProgress(linkedAssignmentId);
      }

      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
      });

      // Check if full session is finished
      if (nextCompleted >= totalSprints) {
        soundEngine.playChime("levelup");
        setShowSessionCompleteModal(true);
        setIsSessionActive(false);
        return;
      }

      // Check if next is long break or short break
      if (nextCompleted % longBreakInterval === 0) {
        setMode("long_break");
      } else {
        setMode("short_break");
      }
    } else {
      // Completed a break -> move to next sprint
      soundEngine.playChime("bell");
      setCurrentSprintIndex((prev) => prev + 1);
      setMode("work");
    }
  };

  const toggleTimer = () => {
    soundEngine.playChime("click");
    setIsRunning((prev) => !prev);
  };

  const resetCurrentTimer = () => {
    soundEngine.playChime("click");
    setIsRunning(false);
    let dur = workDuration;
    if (mode === "short_break") dur = shortBreakDuration;
    if (mode === "long_break") dur = longBreakDuration;
    setTimeLeft(dur * 60);
  };

  const skipCurrentStage = () => {
    soundEngine.playChime("click");
    if (mode === "work") {
      const nextCompleted = completedSprintsCount + 1;
      setCompletedSprintsCount(nextCompleted);
      if (nextCompleted >= totalSprints) {
        setShowSessionCompleteModal(true);
        setIsSessionActive(false);
        return;
      }
      if (nextCompleted % longBreakInterval === 0) {
        setMode("long_break");
      } else {
        setMode("short_break");
      }
    } else {
      setCurrentSprintIndex((prev) => prev + 1);
      setMode("work");
    }
  };

  const toggleAmbientSound = (soundId: string) => {
    if (activeAmbient === soundId) {
      soundEngine.setAmbient(soundId, false);
      setActiveAmbient(null);
    } else {
      if (activeAmbient) soundEngine.setAmbient(activeAmbient, false);
      soundEngine.setAmbient(soundId, true, ambientVolume);
      setActiveAmbient(soundId);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setAmbientVolume(newVol);
    if (activeAmbient) {
      soundEngine.setAmbient(activeAmbient, true, newVol);
    }
  };

  const totalSecondsForMode =
    (mode === "work"
      ? workDuration
      : mode === "short_break"
      ? shortBreakDuration
      : longBreakDuration) * 60;

  const progressPercent = Math.min(
    100,
    Math.round(((totalSecondsForMode - timeLeft) / totalSecondsForMode) * 100)
  );

  const overallSessionPercent = Math.min(
    100,
    Math.round((completedSprintsCount / totalSprints) * 100)
  );

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  return (
    <div
      className={`space-y-6 transition-all ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-[#F4F4F0] p-6 sm:p-10 overflow-y-auto flex flex-col justify-center items-center"
          : "max-w-5xl mx-auto pb-12"
      }`}
    >
      {/* Header Banner */}
      <div className="w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-[#FF66C4] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <Flame className="w-5 h-5 text-black fill-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Pomodoro Desk & Deep Work Station
            </h1>
            <p className="text-xs font-bold text-gray-700">
              Structured Sprint Cycles • Ambient Soundscapes • Objective Tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            id="btn-open-pomodoro-config"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
            title="Configure Session"
          >
            <Sliders className="w-4 h-4 text-black" />
            <span className="hidden sm:inline">Sprint Config</span>
          </button>

          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-2 bg-[#FFE600] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] font-bold text-xs"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-black" />
            ) : (
              <Maximize2 className="w-4 h-4 text-black" />
            )}
          </button>
        </div>
      </div>

      {/* PRE-SESSION CONFIGURATION & PRESET SELECTOR (when not running or can configure) */}
      {!isSessionActive ? (
        <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div>
              <h2 className="text-lg font-black uppercase text-black">
                Select Study Session Template
              </h2>
              <p className="text-xs font-bold text-gray-700">
                Choose a structured sprint protocol or customize your intervals
              </p>
            </div>
            <div className="bg-[#FFE600] font-black text-xs px-2.5 py-1 border border-black uppercase">
              Ready to Lock In
            </div>
          </div>

          {/* Presets Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quick Focus */}
            <div
              onClick={() => handleSelectPreset("quick")}
              className={`p-4 border-2 border-black cursor-pointer transition-all ${
                selectedPreset === "quick"
                  ? "bg-[#00F0FF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                  : "bg-[#F4F4F0] hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-sm uppercase text-black">⚡ Quick Focus</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-white border border-black">
                  3 Sprints
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800">
                25m sprint / 5m short break. Best for quick homework reviews and reading.
              </p>
              <div className="mt-3 text-[11px] font-black text-black">
                Total Focus: 75 mins
              </div>
            </div>

            {/* Standard Study */}
            <div
              onClick={() => handleSelectPreset("standard")}
              className={`p-4 border-2 border-black cursor-pointer transition-all ${
                selectedPreset === "standard"
                  ? "bg-[#FFE600] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                  : "bg-[#F4F4F0] hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-sm uppercase text-black">🔥 Standard Study</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-white border border-black">
                  5 Sprints
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800">
                25m sprint / 5m break, 15m long break after 4th sprint. Gold standard.
              </p>
              <div className="mt-3 text-[11px] font-black text-black">
                Total Focus: 125 mins
              </div>
            </div>

            {/* Deep Work Marathon */}
            <div
              onClick={() => handleSelectPreset("marathon")}
              className={`p-4 border-2 border-black cursor-pointer transition-all ${
                selectedPreset === "marathon"
                  ? "bg-[#73EC8E] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                  : "bg-[#F4F4F0] hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-sm uppercase text-black">🧠 Deep Work Marathon</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-white border border-black">
                  10 Sprints
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800">
                50m sprint / 10m break, 20m long break. For high-intensity exam prep.
              </p>
              <div className="mt-3 text-[11px] font-black text-black">
                Total Focus: 500 mins
              </div>
            </div>
          </div>

          {/* Objective & Assignment Binding */}
          <div className="p-4 bg-[#F4F4F0] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-black" />
              <span className="font-black text-xs uppercase text-black">
                Target Study Goal / Assignment:
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={activeTask}
                onChange={(e) => setActiveTask(e.target.value)}
                placeholder="What assignment or topic are you mastering?"
                className="flex-1 p-2.5 bg-white border-2 border-black font-bold text-xs text-black"
              />
              <select
                value={linkedAssignmentId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  setLinkedAssignmentId(id || undefined);
                  const found = assignments.find((a) => a.id === id);
                  if (found) setActiveTask(`${found.subject}: ${found.title}`);
                }}
                className="p-2.5 bg-white border-2 border-black font-bold text-xs text-black cursor-pointer"
              >
                <option value="">Link to Kanban Assignment...</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.subject}: {a.title} ({a.completedPomodoros}/{a.estimatedPomodoros} done)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Session CTA Button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleStartSession}
              id="btn-start-learning-session"
              className="flex items-center gap-2 px-10 py-4 bg-[#FFE600] border-2 border-black font-black text-lg uppercase shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              <Play className="w-6 h-6 fill-black" />
              <span>Start Learning Session ({totalSprints} Sprints)</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ACTIVE LIVE TIMER CONTROLLER */}
      {isSessionActive && (
        <div className="w-full bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {/* Stage Status Header Bar */}
          <div className="bg-black text-white p-3 px-4 font-mono text-xs flex justify-between items-center select-none border-b-2 border-black flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] text-black font-black px-2 py-0.5 text-[11px] uppercase">
                {mode === "work" ? `SPRINT ${currentSprintIndex} OF ${totalSprints}` : mode.toUpperCase().replace("_", " ")}
              </span>
              <span className="font-bold text-gray-300">
                {activeTask}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 border text-[10px] ${isRunning ? "bg-[#73EC8E] text-black font-black" : "bg-neutral-800 text-gray-400"}`}>
                {isRunning ? "RUNNING" : "PAUSED"}
              </span>
              <button
                onClick={() => setIsSessionActive(false)}
                className="text-[11px] font-black underline hover:text-[#FF66C4]"
              >
                End Session
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-6">
            {/* Mode Indicator Badges */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
              <button
                onClick={() => setMode("work")}
                className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                  mode === "work"
                    ? "bg-[#FF66C4] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-[#F4F4F0] hover:bg-gray-200"
                }`}
              >
                🔥 Focus Sprint ({workDuration}m)
              </button>
              <button
                onClick={() => setMode("short_break")}
                className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                  mode === "short_break"
                    ? "bg-[#73EC8E] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-[#F4F4F0] hover:bg-gray-200"
                }`}
              >
                ☕ Short Break ({shortBreakDuration}m)
              </button>
              <button
                onClick={() => setMode("long_break")}
                className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                  mode === "long_break"
                    ? "bg-[#00F0FF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-[#F4F4F0] hover:bg-gray-200"
                }`}
              >
                🌴 Long Break ({longBreakDuration}m)
              </button>
            </div>

            {/* Giant Digital Timer Canvas */}
            <div className="text-center py-6 sm:py-10 bg-[#F4F4F0] border-2 border-black shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="font-black text-6xl sm:text-8xl md:text-9xl text-black tracking-tight select-none">
                {formattedTime}
              </div>
              <div className="text-xs sm:text-sm font-black uppercase text-gray-700 mt-2 tracking-widest">
                {mode === "work"
                  ? `⚡ SPRINT ${currentSprintIndex} • ZERO DISTRACTIONS`
                  : "☕ REST & RECHARGE"}
              </div>
            </div>

            {/* Dual Progress Bars: Sprint Progress & Total Session Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Sprint Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-black uppercase text-black">
                  <span>Current Interval</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#E4E4DF] h-4 border-2 border-black overflow-hidden">
                  <div
                    className="h-full bg-[#FFE600] border-r border-black transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Overall Session Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-black uppercase text-black">
                  <span>Session Sprints</span>
                  <span>
                    {completedSprintsCount} of {totalSprints} completed ({overallSessionPercent}%)
                  </span>
                </div>
                <div className="w-full bg-[#E4E4DF] h-4 border-2 border-black overflow-hidden">
                  <div
                    className="h-full bg-[#73EC8E] border-r border-black transition-all duration-300"
                    style={{ width: `${overallSessionPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap pt-2">
              <button
                onClick={toggleTimer}
                id="btn-timer-toggle-play"
                className={`flex items-center gap-2 px-8 py-4 border-2 border-black font-black text-base sm:text-lg uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none ${
                  isRunning
                    ? "bg-[#FFA94D] text-black"
                    : "bg-[#FFE600] text-black hover:bg-[#ffea1f]"
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-black" />
                    PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-black" />
                    RESUME SPRINT
                  </>
                )}
              </button>

              <button
                onClick={resetCurrentTimer}
                id="btn-timer-reset-stage"
                className="flex items-center gap-1.5 px-4 py-4 bg-white border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-1 active:translate-y-1 active:shadow-none"
                title="Reset current interval"
              >
                <RotateCcw className="w-4 h-4" />
                RESET
              </button>

              <button
                onClick={skipCurrentStage}
                id="btn-timer-skip-stage"
                className="flex items-center gap-1.5 px-4 py-4 bg-[#73EC8E] border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-1 active:translate-y-1 active:shadow-none"
                title="Skip to next stage"
              >
                <SkipForward className="w-4 h-4" />
                SKIP
              </button>
            </div>

            {/* Ambient Soundscapes Layer */}
            <div className="pt-4 border-t-2 border-black space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-black text-xs uppercase text-black flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" />
                  Focus Soundscapes:
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-700">Volume:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={ambientVolume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-24 accent-black cursor-pointer"
                  />
                  <span className="text-[11px] font-mono font-bold text-black">
                    {Math.round(ambientVolume * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "rain", label: "🌧️ Heavy Rain" },
                  { id: "binaural", label: "🧠 40Hz Alpha" },
                  { id: "vinyl", label: "📻 Lo-Fi Vinyl" },
                  { id: "cafe", label: "☕ Cozy Cafe" },
                ].map((sound) => (
                  <button
                    key={sound.id}
                    onClick={() => toggleAmbientSound(sound.id)}
                    className={`p-2 border-2 border-black font-black text-xs transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                      activeAmbient === sound.id
                        ? "bg-[#00F0FF] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                  >
                    {sound.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPRINT CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <h3 className="font-black text-base uppercase text-black">
                Custom Pomodoro Interval Settings
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Total Sprints
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={totalSprints}
                  onChange={(e) => setTotalSprints(Number(e.target.value) || 1)}
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-black text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Sprint Length (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={workDuration}
                  onChange={(e) => setWorkDuration(Number(e.target.value) || 25)}
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-black text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Short Break (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={shortBreakDuration}
                  onChange={(e) => setShortBreakDuration(Number(e.target.value) || 5)}
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-black text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Long Break (mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={longBreakDuration}
                  onChange={(e) => setLongBreakDuration(Number(e.target.value) || 15)}
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-black text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-black">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  soundEngine.playChime("click");
                }}
                className="px-5 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d]"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION COMPLETE CELEBRATION MODAL */}
      {showSessionCompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-5 text-center">
            <div className="inline-flex p-3 bg-[#FFE600] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Trophy className="w-8 h-8 text-black" />
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase text-black">
                Session Complete! 🎉
              </h2>
              <p className="text-xs font-bold text-gray-700 mt-1">
                You successfully crushed all {totalSprints} Pomodoro sprints!
              </p>
            </div>

            <div className="p-4 bg-[#73EC8E] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-1">
              <div className="text-xs font-black uppercase text-black">
                Total Focus Time Recorded:
              </div>
              <div className="text-3xl font-black text-black">
                {totalSprints * workDuration} Minutes
              </div>
              <div className="text-[11px] font-bold text-black">
                +{totalSprints * 30} XP Awarded to your Profile
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSessionCompleteModal(false);
                  if (onNavigateToDashboard) onNavigateToDashboard();
                }}
                className="flex-1 py-3 bg-white border-2 border-black font-black text-xs uppercase hover:bg-gray-100"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSessionCompleteModal(false);
                  handleStartSession();
                }}
                className="flex-1 py-3 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d]"
              >
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
