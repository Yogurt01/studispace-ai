import React, { useState } from "react";
import {
  CheckSquare,
  Plus,
  Calendar,
  AlertTriangle,
  Play,
  Trash2,
  CheckCircle2,
  Clock,
  Calculator,
  Filter,
  ArrowRight,
  CalendarPlus,
} from "lucide-react";
import { Assignment, Priority, AssignmentStatus } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";

interface AssignmentsViewProps {
  assignments: Assignment[];
  onAddAssignment: (assignment: Assignment) => void;
  onUpdateAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (id: string) => void;
  onStartPomodoroWithTask: (taskTitle: string, assignmentId?: string) => void;
  onAwardXp: (amount: number) => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onStartPomodoroWithTask,
  onAwardXp,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Form State
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("high");
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(3);
  const [weightPercent, setWeightPercent] = useState<number>(15);
  const [gradeTarget, setGradeTarget] = useState("A");
  const [notes, setNotes] = useState("");

  const subjects = Array.from(new Set(assignments.map((a) => a.subject)));

  const filteredAssignments = assignments.filter((a) => {
    if (filterSubject !== "all" && a.subject !== filterSubject) return false;
    return true;
  });

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !dueDate) return;

    const newAssignment: Assignment = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      subject: subject.trim(),
      dueDate,
      priority,
      status: "todo",
      estimatedPomodoros,
      completedPomodoros: 0,
      weightPercent,
      gradeTarget,
      notes: notes.trim(),
    };

    onAddAssignment(newAssignment);
    setShowAddModal(false);
    setTitle("");
    setSubject("");
    setDueDate("");
    setNotes("");
    soundEngine.playChime("success");
    onAwardXp(15);
  };

  const [syncedEventId, setSyncedEventId] = useState<string | null>(null);

  const handleSyncToGoogleCalendar = (item: Assignment) => {
    let startDate = new Date();
    const parsed = Date.parse(item.dueDate);
    if (!isNaN(parsed)) {
      startDate = new Date(parsed);
    } else {
      startDate.setDate(startDate.getDate() + 1);
    }
    startDate.setHours(9, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + (item.estimatedPomodoros || 2) * 25 * 60 * 1000 + 30 * 60 * 1000);

    const formatGCalDate = (d: Date) => {
      return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    };

    const datesParam = `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
    const title = `[StudiSpace Study Sprint] ${item.title} (${item.subject})`;
    const details = `📚 Subject: ${item.subject}\n⚡ Priority: ${item.priority.toUpperCase()}\n🎯 Target Grade: ${item.gradeTarget || "A"}\n⏱️ Estimated Focus: ${item.estimatedPomodoros} Pomodoro Sprints\n📝 Notes: ${item.notes || "Prepared in StudiSpace Study OS"}\n\n🔗 StudiSpace App: https://ais-dev-4iae4eyzvb3yjyetfu24q3-55980572059.asia-east1.run.app`;
    const location = "StudiSpace Study Hub / Virtual Desk";

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${datesParam}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

    window.open(gcalUrl, "_blank", "noopener,noreferrer");
    setSyncedEventId(item.id);
    soundEngine.playChime("success");
    setTimeout(() => setSyncedEventId(null), 3000);
  };

  const handleAdvanceStatus = (assignment: Assignment) => {
    soundEngine.playChime("click");
    let nextStatus: AssignmentStatus = "in_progress";
    if (assignment.status === "todo") nextStatus = "in_progress";
    else if (assignment.status === "in_progress") {
      nextStatus = "done";
      soundEngine.playChime("success");
      onAwardXp(50);
    } else nextStatus = "todo";

    onUpdateAssignment({
      ...assignment,
      status: nextStatus,
    });
  };

  const columns: Array<{ id: AssignmentStatus; label: string; color: string }> = [
    { id: "todo", label: "📌 TO-DO / UPCOMING", color: "#FFE600" },
    { id: "in_progress", label: "⚡ IN PROGRESS (LOCKED IN)", color: "#00F0FF" },
    { id: "done", label: "🎉 SUBMITTED / DONE", color: "#73EC8E" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#FFA94D] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <CheckSquare className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Assignment & Exam Timeline
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            Track weights, sprint allocations, and exam deadlines with brutalist clarity
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subject Filter */}
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="p-2.5 bg-white border-2 border-black font-bold text-xs cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <option value="all">All Subjects ({assignments.length})</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            id="btn-add-assignment"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colAssignments = filteredAssignments.filter(
            (a) => a.status === col.id
          );

          return (
            <div
              key={col.id}
              className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col min-h-[500px]"
            >
              {/* Column Title Bar */}
              <div
                className="p-2.5 border-2 border-black font-black text-xs uppercase text-black flex items-center justify-between mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                style={{ backgroundColor: col.color }}
              >
                <span>{col.label}</span>
                <span className="bg-black text-white px-1.5 py-0.5 text-[10px]">
                  {colAssignments.length}
                </span>
              </div>

              {/* Tasks Container */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colAssignments.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 bg-[#F4F4F0] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 hover:bg-[#eaeae4] transition-all"
                  >
                    {/* Priority & Subject */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 border border-black ${
                          task.priority === "urgent"
                            ? "bg-[#FF66C4]"
                            : task.priority === "high"
                            ? "bg-[#FFA94D]"
                            : "bg-[#FFE600]"
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-[10px] font-bold bg-white px-1.5 py-0.5 border border-black text-gray-800">
                        {task.subject}
                      </span>
                    </div>

                    <h3 className="font-black text-xs text-black leading-snug">
                      {task.title}
                    </h3>

                    {task.notes && (
                      <p className="text-[11px] font-medium text-gray-700 line-clamp-2">
                        {task.notes}
                      </p>
                    )}

                    {/* Metadata: Due Date & Pomodoros */}
                    <div className="pt-2 border-t border-black/20 flex items-center justify-between text-[11px] font-bold text-gray-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{task.dueDate}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {task.completedPomodoros}/{task.estimatedPomodoros} Sprints
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: Launch in Focus Timer & Advance Status */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          if (task.status === "todo") {
                            onUpdateAssignment({ ...task, status: "in_progress" });
                          }
                          onStartPomodoroWithTask(task.title, task.id);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FFE600] border border-black font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d]"
                        title="Start Focus Timer on this task"
                      >
                        <Play className="w-3 h-3 fill-black" /> Focus
                      </button>

                      <button
                        onClick={() => handleSyncToGoogleCalendar(task)}
                        className={`p-1.5 border border-black font-black text-[10px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                          syncedEventId === task.id
                            ? "bg-[#73EC8E] text-black"
                            : "bg-white hover:bg-[#00F0FF] text-black"
                        }`}
                        title="Sync to Google Calendar"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleAdvanceStatus(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white border border-black font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100"
                        title="Advance status"
                      >
                        {task.status === "todo"
                          ? "Start ⚡"
                          : task.status === "in_progress"
                          ? "Done 🎉"
                          : "Reset ↺"}
                      </button>

                      <button
                        onClick={() => onDeleteAssignment(task.id)}
                        className="p-1.5 bg-white border border-black hover:bg-[#FF66C4]"
                        title="Delete task"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {colAssignments.length === 0 && (
                  <div className="p-8 text-center text-xs font-bold text-gray-400 border-2 border-dashed border-gray-300">
                    No tasks in this column.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAssignment}
            className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <h3 className="font-black text-lg uppercase text-black">
                New Study Objective / Deadline
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
              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Assignment / Exam Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Problem Set 4: Dynamic Programming"
                  required
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Subject / Course
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Computer Science"
                    required
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="chill">Chill</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Est. Sprints
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={estimatedPomodoros}
                    onChange={(e) =>
                      setEstimatedPomodoros(Number(e.target.value) || 1)
                    }
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Course Weight %
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={weightPercent}
                    onChange={(e) =>
                      setWeightPercent(Number(e.target.value) || 10)
                    }
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Key Guidelines / Strategy Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key theorems to apply, rubric checkpoints..."
                  className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-medium text-xs"
                />
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
                Create Objective
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
