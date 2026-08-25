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
} from "lucide-react";
import confetti from "canvas-confetti";
import { soundEngine } from "../utils/audioSynthesizer";
import { Assignment } from "../types";

interface PomodoroViewProps {
  onCompleteSession: (durationMinutes: number) => void;
  assignments: Assignment[];
  initialTaskTitle?: string;
}

type TimerMode = "work" | "short_break" | "long_break";

export const PomodoroView: React.FC<PomodoroViewProps> = ({
  onCompleteSession,
  assignments,
  initialTaskTitle,
}) => {
  const [mode, setMode] = useState<TimerMode>("work");
  const [workDuration, setWorkDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTask, setActiveTask] = useState(
    initialTaskTitle || "Data Structures & Algorithm Review"
  );
  const [sessionCount, setSessionCount] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeAmbient, setActiveAmbient] = useState<string | null>("rain");
  const [showSettings, setShowSettings] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Sync time when mode or durations change
  useEffect(() => {
    let dur = workDuration;
    if (mode === "short_break") dur = shortBreakDuration;
    if (mode === "long_break") dur = longBreakDuration;
    setTimeLeft(dur * 60);
    setIsRunning(false);
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
  }, [isRunning, mode]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    soundEngine.playChime("bell");

    // Confetti pop!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    if (mode === "work") {
      setSessionCount((prev) => prev + 1);
      onCompleteSession(workDuration);
      // Auto switch to break
      if ((sessionCount + 1) % 4 === 0) {
        setMode("long_break");
      } else {
        setMode("short_break");
      }
    } else {
      setMode("work");
    }
  };

  const toggleTimer = () => {
    soundEngine.playChime("click");
    setIsRunning((prev) => !prev);
  };

  const resetTimer = () => {
    soundEngine.playChime("click");
    setIsRunning(false);
    let dur = workDuration;
    if (mode === "short_break") dur = shortBreakDuration;
    if (mode === "long_break") dur = longBreakDuration;
    setTimeLeft(dur * 60);
  };

  const skipTimer = () => {
    soundEngine.playChime("click");
    if (mode === "work") {
      setMode("short_break");
    } else {
      setMode("work");
    }
  };

  const toggleAmbientSound = (soundId: string) => {
    if (activeAmbient === soundId) {
      soundEngine.setAmbient(soundId, false);
      setActiveAmbient(null);
    } else {
      if (activeAmbient) soundEngine.setAmbient(activeAmbient, false);
      soundEngine.setAmbient(soundId, true, 0.4);
      setActiveAmbient(soundId);
    }
  };

  const totalSeconds =
    (mode === "work"
      ? workDuration
      : mode === "short_break"
      ? shortBreakDuration
      : longBreakDuration) * 60;

  const progressPercent = Math.min(
    100,
    Math.round(((totalSeconds - timeLeft) / totalSeconds) * 100)
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
          ? "fixed inset-0 z-50 bg-[#F4F4F0] p-6 sm:p-12 overflow-y-auto flex flex-col justify-center items-center"
          : ""
      }`}
    >
      {/* Top Banner or Fullscreen Exit */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[#FF66C4] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <Flame className="w-5 h-5 text-black fill-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Deep Work Focus Station
            </h1>
            <p className="text-xs font-bold text-gray-700">
              Session #{sessionCount + 1} • High-Performance Pomodoro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className="p-2 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 font-bold text-xs"
            title="Custom Timer Durations"
          >
            <Settings className="w-4 h-4 text-black" />
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

      {/* Settings Modal / Dropdown */}
      {showSettings && (
        <div className="w-full max-w-4xl bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-black uppercase text-black block mb-1">
              Work Duration (mins)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={workDuration}
              onChange={(e) => setWorkDuration(Number(e.target.value) || 25)}
              className="w-full p-2 border-2 border-black font-black bg-[#F4F4F0]"
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
              className="w-full p-2 border-2 border-black font-black bg-[#F4F4F0]"
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
              className="w-full p-2 border-2 border-black font-black bg-[#F4F4F0]"
            />
          </div>
        </div>
      )}

      {/* Main Timer Display Box */}
      <div className="w-full max-w-4xl bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        {/* Terminal Header Strip */}
        <div className="bg-black text-white p-2 px-3 font-mono text-[10px] flex justify-between items-center select-none border-b-2 border-black">
          <span>TIMER_CONTROLLER: 0xPOMODORO_LOOP</span>
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.2 border ${isRunning ? "bg-[#73EC8E] text-black border-black font-black" : "bg-neutral-800 text-gray-400 border-neutral-700"}`}>
              {isRunning ? "RUNNING" : "STANDBY"}
            </span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-black/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-black/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-black/30" />
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-6">
          {/* Mode Selector Tabs */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={() => setMode("work")}
              className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                mode === "work"
                  ? "bg-[#FF66C4] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                  : "bg-[#F4F4F0] hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              }`}
            >
              🔥 Focus Sprint ({workDuration}m)
            </button>
            <button
              onClick={() => setMode("short_break")}
              className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                mode === "short_break"
                  ? "bg-[#73EC8E] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                  : "bg-[#F4F4F0] hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              }`}
            >
              ☕ Short Break ({shortBreakDuration}m)
            </button>
            <button
              onClick={() => setMode("long_break")}
              className={`px-4 sm:px-6 py-2 border-2 border-black font-black text-xs sm:text-sm uppercase transition-all ${
                mode === "long_break"
                  ? "bg-[#00F0FF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                  : "bg-[#F4F4F0] hover:bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
              }`}
            >
              🌴 Long Break ({longBreakDuration}m)
            </button>
          </div>

          {/* Big Giant Digital Timer */}
          <div className="text-center py-6 sm:py-10 bg-[#F4F4F0] border-2 border-black shadow-[inset_3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div className="font-black text-6xl sm:text-8xl md:text-9xl text-black tracking-tight select-none">
              {formattedTime}
            </div>
            <div className="text-xs sm:text-sm font-black uppercase text-gray-700 mt-2 tracking-widest">
              {mode === "work"
                ? "⚡ LOCK IN • NO DISTRACTIONS"
                : "☕ REST & HYDRATE • RECHARGE"}
            </div>
          </div>

          {/* Neo-Brutalist Segmented Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-black uppercase text-black">
              <span>Sprint Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-[#E4E4DF] h-5 border-2 border-black relative overflow-hidden">
              <div
                className="h-full bg-[#FFE600] border-r-2 border-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Controls: Start / Pause / Reset / Skip */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap pt-2">
            <button
              onClick={toggleTimer}
              id="btn-timer-play-pause"
              className={`flex items-center gap-2 px-8 py-4 border-2 border-black font-black text-base sm:text-lg uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-1 active:translate-y-1 active:shadow-none ${
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
                  START SPRINT
                </>
              )}
            </button>

            <button
              onClick={resetTimer}
              id="btn-timer-reset"
              className="flex items-center gap-1.5 px-4 py-4 bg-white border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-1 active:translate-y-1 active:shadow-none"
              title="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
              RESET
            </button>

            <button
              onClick={skipTimer}
              id="btn-timer-skip"
              className="flex items-center gap-1.5 px-4 py-4 bg-[#73EC8E] border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-1 active:translate-y-1 active:shadow-none"
              title="Skip to next session"
            >
              <SkipForward className="w-4 h-4" />
              SKIP
            </button>
          </div>

          {/* Linked Active Task Picker */}
          <div className="p-4 bg-[#F4F4F0] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-black" />
              <span className="font-black text-xs uppercase text-black">
                Current Focus Objective:
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={activeTask}
                onChange={(e) => setActiveTask(e.target.value)}
                placeholder="What are you conquering this sprint?"
                className="flex-1 p-2.5 bg-white border-2 border-black font-bold text-sm text-black focus:outline-none focus:bg-[#FFFDE6]"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) setActiveTask(e.target.value);
                }}
                className="p-2.5 bg-white border-2 border-black font-bold text-xs text-black cursor-pointer"
              >
                <option value="">Choose from Assignments...</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.title}>
                    {a.subject}: {a.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Focus Ambient Sound Quick Controls */}
          <div className="pt-2 border-t-2 border-black">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-black text-xs uppercase text-black flex items-center gap-1.5">
                <Volume2 className="w-4 h-4" />
                Focus Soundscape Layer:
              </span>
              <span className="text-[11px] font-bold text-gray-700">
                {activeAmbient ? `Playing: ${activeAmbient.toUpperCase()}` : "Audio Off"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "rain", label: "🌧️ Heavy Rain" },
                { id: "binaural", label: "🧠 40Hz Alpha Wave" },
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
    </div>
  );
};
