import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Pin,
  Sparkles,
  Edit3,
  Eye,
  Copy,
  Check,
  Tag,
  Search,
  List,
  CheckSquare,
  FileText,
  HelpCircle,
  Brain,
  Share2,
} from "lucide-react";
import { StudyNote, FlashcardDeck } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";

interface NotesViewProps {
  notes: StudyNote[];
  onAddNote: (note: StudyNote) => void;
  onUpdateNote: (note: StudyNote) => void;
  onDeleteNote: (noteId: string) => void;
  onConvertNoteToDeck?: (deck: FlashcardDeck) => void;
  onAwardXp: (amount: number) => void;
}

type AiNoteAction =
  | "summarize"
  | "key_terms"
  | "action_items"
  | "cheat_sheet"
  | "simplify";

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onConvertNoteToDeck,
  onAwardXp,
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    notes[0] ? notes[0].id : ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResultModal, setAiResultModal] = useState<{
    title: string;
    content: string;
  } | null>(null);

  const activeNote =
    notes.find((n) => n.id === selectedNoteId) || notes[0] || null;

  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleCreateNewNote = () => {
    soundEngine.playChime("click");
    const newNote: StudyNote = {
      id: `note-${Date.now()}`,
      title: "Untitled Study Note",
      subject: "General",
      content: `# New Study Topic\n\n- Key principle 1\n- Formula or theorem\n- Common pitfalls to avoid\n`,
      tags: ["StudyDraft"],
      color: ["#FFE600", "#73EC8E", "#FF66C4", "#00F0FF", "#C4B5FD"][
        Math.floor(Math.random() * 5)
      ],
      updatedAt: new Date().toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      isPinned: false,
    };

    onAddNote(newNote);
    setSelectedNoteId(newNote.id);
    setIsEditing(true);
    onAwardXp(10);
  };

  const handleAiAction = async (action: AiNoteAction) => {
    if (!activeNote) return;
    setIsAiProcessing(true);
    soundEngine.playChime("click");

    try {
      const res = await fetch("/api/gemini/transform-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteTitle: activeNote.title,
          noteContent: activeNote.content,
          action,
        }),
      });

      const data = await res.json();
      const resultText = data.result || "No output.";

      let titleLabel = "AI Synthesis";
      if (action === "summarize") titleLabel = "⚡ Bulleted TL;DR Summary";
      if (action === "key_terms") titleLabel = "🔑 Core Key Terms & Definitions";
      if (action === "action_items") titleLabel = "📋 Actionable Study Checkpoints";
      if (action === "cheat_sheet") titleLabel = "📑 1-Page Exam Cheat Sheet";
      if (action === "simplify") titleLabel = "🍕 ELI5 Simplified Note";

      setAiResultModal({
        title: titleLabel,
        content: resultText,
      });

      soundEngine.playChime("success");
      onAwardXp(25);
    } catch (err) {
      console.error("AI transformation error:", err);
      alert("Error processing note with Gemini AI.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAppendAiToNote = () => {
    if (!activeNote || !aiResultModal) return;
    const updatedContent = `${activeNote.content}\n\n---\n## ${aiResultModal.title}\n\n${aiResultModal.content}`;
    onUpdateNote({
      ...activeNote,
      content: updatedContent,
      updatedAt: "Just now",
    });
    setAiResultModal(null);
    soundEngine.playChime("success");
  };

  const handleCopyNote = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    soundEngine.playChime("click");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#FFE600] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <BookOpen className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Brutalist Study Notebook
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            Markdown notebook with integrated Gemini AI summaries & cheat sheet generators
          </p>
        </div>

        <button
          onClick={handleCreateNewNote}
          id="btn-create-note"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Note (+10 XP)</span>
        </button>
      </div>

      {/* Main 2-Column Split View: Sidebar Notes List + Note Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Note Navigation & Search */}
        <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or tags..."
              className="w-full pl-9 pr-3 py-2 bg-[#F4F4F0] border-2 border-black font-bold text-xs focus:outline-none focus:bg-white"
            />
          </div>

          {/* Notes Scrollable List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredNotes.map((note) => {
              const isSelected = activeNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    soundEngine.playChime("click");
                  }}
                  className={`cursor-pointer p-3 border-2 border-black transition-all ${
                    isSelected
                      ? "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                      : "bg-[#F4F4F0] hover:bg-[#eaeae4] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  }`}
                  style={{
                    backgroundColor: isSelected ? note.color : "#F4F4F0",
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-black text-xs text-black line-clamp-1">
                      {note.title}
                    </h3>
                    {note.isPinned && <Pin className="w-3.5 h-3.5 fill-black shrink-0" />}
                  </div>

                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase bg-white px-1.5 py-0.5 border border-black">
                      {note.subject}
                    </span>
                    {note.tags.slice(0, 2).map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold text-gray-700 bg-white/70 px-1 py-0.5"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] font-medium text-gray-700 mt-2 line-clamp-2">
                    {note.content.replace(/[#*`$\\]/g, "")}
                  </p>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="p-6 text-center text-xs font-bold text-gray-500">
                No notes match your search.
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Cols: Note Editor / Live Preview + AI Toolbar */}
        <div className="lg:col-span-2 space-y-4">
          {activeNote ? (
            <div className="bg-white border-2 border-black p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4">
              {/* Note Metadata Bar: Title, Subject, Tags */}
              <div className="space-y-3 pb-3 border-b-2 border-black">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) =>
                      onUpdateNote({ ...activeNote, title: e.target.value })
                    }
                    className="flex-1 font-black text-xl text-black bg-transparent border-b-2 border-transparent hover:border-black focus:border-black focus:outline-none"
                    placeholder="Note Title..."
                  />

                  {/* Actions: Pin, Copy, Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() =>
                        onUpdateNote({ ...activeNote, isPinned: !activeNote.isPinned })
                      }
                      className={`p-1.5 border-2 border-black ${
                        activeNote.isPinned ? "bg-[#FFE600]" : "bg-white"
                      }`}
                      title={activeNote.isPinned ? "Unpin Note" : "Pin Note"}
                    >
                      <Pin className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleCopyNote}
                      className="p-1.5 bg-white border-2 border-black hover:bg-gray-100"
                      title="Copy note content"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-700" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm("Delete this study note?")) {
                          onDeleteNote(activeNote.id);
                          soundEngine.playChime("click");
                        }
                      }}
                      className="p-1.5 bg-[#FF66C4] border-2 border-black hover:bg-[#ff4eb8]"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <input
                    type="text"
                    value={activeNote.subject}
                    onChange={(e) =>
                      onUpdateNote({ ...activeNote, subject: e.target.value })
                    }
                    placeholder="Subject (e.g. Biology)"
                    className="p-1 px-2 font-bold bg-[#F4F4F0] border border-black text-xs"
                  />

                  <input
                    type="text"
                    value={activeNote.tags.join(", ")}
                    onChange={(e) =>
                      onUpdateNote({
                        ...activeNote,
                        tags: e.target.value.split(",").map((t) => t.trim()),
                      })
                    }
                    placeholder="Tags: ExamPrep, Chapter 2"
                    className="p-1 px-2 font-medium bg-[#F4F4F0] border border-black text-xs flex-1 min-w-[140px]"
                  />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsEditing(true)}
                      className={`px-2.5 py-1 font-black text-xs border border-black ${
                        isEditing ? "bg-black text-white" : "bg-white"
                      }`}
                    >
                      <Edit3 className="w-3 h-3 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className={`px-2.5 py-1 font-black text-xs border border-black ${
                        !isEditing ? "bg-black text-white" : "bg-white"
                      }`}
                    >
                      <Eye className="w-3 h-3 inline mr-1" /> Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Gemini AI Transformation Toolbar */}
              <div className="p-3 bg-[#00F0FF]/25 border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-black">
                  <Sparkles className="w-4 h-4" />
                  <span>Gemini AI Study Actions:</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleAiAction("summarize")}
                    disabled={isAiProcessing}
                    className="px-2 py-1 bg-white border border-black font-black text-[11px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                  >
                    ⚡ Summarize
                  </button>
                  <button
                    onClick={() => handleAiAction("key_terms")}
                    disabled={isAiProcessing}
                    className="px-2 py-1 bg-white border border-black font-black text-[11px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#73EC8E] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                  >
                    🔑 Key Terms
                  </button>
                  <button
                    onClick={() => handleAiAction("cheat_sheet")}
                    disabled={isAiProcessing}
                    className="px-2 py-1 bg-white border border-black font-black text-[11px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF66C4] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                  >
                    📑 Cheat Sheet
                  </button>
                  <button
                    onClick={() => handleAiAction("simplify")}
                    disabled={isAiProcessing}
                    className="px-2 py-1 bg-white border border-black font-black text-[11px] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-[#C4B5FD] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                  >
                    🍕 ELI5
                  </button>
                </div>
              </div>

              {/* Note Content Area (Edit or Preview) */}
              {isEditing ? (
                <textarea
                  rows={14}
                  value={activeNote.content}
                  onChange={(e) =>
                    onUpdateNote({
                      ...activeNote,
                      content: e.target.value,
                      updatedAt: "Just now",
                    })
                  }
                  placeholder="Write your study notes in Markdown (# Heading, - Bullet, **Bold**, etc.)..."
                  className="w-full p-4 bg-[#F4F4F0] border-2 border-black font-mono text-sm leading-relaxed text-black focus:outline-none focus:bg-white resize-y"
                />
              ) : (
                <div className="p-4 bg-[#F4F4F0] border-2 border-black min-h-[320px] text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {activeNote.content}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white border-2 border-black">
              <p className="font-black text-gray-600">No note selected.</p>
              <button
                onClick={handleCreateNewNote}
                className="mt-3 px-4 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase"
              >
                Create your first note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Transformation Result Modal */}
      {aiResultModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-black" />
                <h3 className="font-black text-lg uppercase text-black">
                  {aiResultModal.title}
                </h3>
              </div>
              <button
                onClick={() => setAiResultModal(null)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto p-4 bg-[#F4F4F0] border-2 border-black text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {aiResultModal.content}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                onClick={() => setAiResultModal(null)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase"
              >
                Close
              </button>
              <button
                onClick={handleAppendAiToNote}
                className="px-5 py-2 bg-[#73EC8E] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e]"
              >
                Append to Current Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
