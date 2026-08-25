import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  Plus,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  Brain,
  HelpCircle,
  Check,
  Tag,
  Shuffle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { FlashcardDeck, Flashcard, MasteryLevel } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";

interface FlashcardsViewProps {
  decks: FlashcardDeck[];
  onUpdateDeck: (deck: FlashcardDeck) => void;
  onAddDeck: (deck: FlashcardDeck) => void;
  onAwardXp: (amount: number) => void;
  initialDeckId?: string;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  decks,
  onUpdateDeck,
  onAddDeck,
  onAwardXp,
  initialDeckId,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    initialDeckId || (decks[0] ? decks[0].id : "")
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // AI Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Manual Add Card Modal
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newTags, setNewTags] = useState("");

  const currentDeck =
    decks.find((d) => d.id === selectedDeckId) || decks[0] || null;

  const currentCard: Flashcard | undefined =
    currentDeck && currentDeck.cards.length > 0
      ? currentDeck.cards[cardIndex % currentDeck.cards.length]
      : undefined;

  const handleFlip = () => {
    soundEngine.playChime("flip");
    setIsFlipped((prev) => !prev);
  };

  const handleNext = () => {
    if (!currentDeck) return;
    soundEngine.playChime("click");
    setIsFlipped(false);
    setShowHint(false);
    setCardIndex((prev) => (prev + 1) % currentDeck.cards.length);
  };

  const handlePrev = () => {
    if (!currentDeck) return;
    soundEngine.playChime("click");
    setIsFlipped(false);
    setShowHint(false);
    setCardIndex((prev) =>
      prev === 0 ? currentDeck.cards.length - 1 : prev - 1
    );
  };

  const handleRateCard = (level: MasteryLevel) => {
    if (!currentDeck || !currentCard) return;

    soundEngine.playChime(level === "mastered" ? "success" : "click");
    onAwardXp(level === "mastered" ? 25 : 10);

    const updatedCards = currentDeck.cards.map((c) => {
      if (c.id === currentCard.id) {
        return {
          ...c,
          masteryLevel: level,
          reviewCount: c.reviewCount + 1,
          lastReviewed: new Date().toISOString().split("T")[0],
        };
      }
      return c;
    });

    onUpdateDeck({
      ...currentDeck,
      cards: updatedCards,
    });

    // Advance to next
    handleNext();
  };

  const handleShuffle = () => {
    if (!currentDeck) return;
    soundEngine.playChime("click");
    const shuffled = [...currentDeck.cards].sort(() => Math.random() - 0.5);
    onUpdateDeck({ ...currentDeck, cards: shuffled });
    setCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleCreateAiDeck = async () => {
    if (!aiTopic.trim() && !aiNotes.trim()) return;
    setIsGeneratingAi(true);

    try {
      const res = await fetch("/api/gemini/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          rawNotes: aiNotes.trim(),
          count: aiCount,
        }),
      });

      const data = await res.json();
      const generatedCards: Array<{
        question: string;
        answer: string;
        hint: string;
        category?: string;
        tags: string[];
      }> = data.flashcards || [];

      if (generatedCards.length > 0) {
        const newDeck: FlashcardDeck = {
          id: `deck-${Date.now()}`,
          title: aiTopic.trim() || "AI Generated Study Deck",
          subject: generatedCards[0]?.category || "General Study",
          description: `Generated via Gemini AI from ${aiTopic || "notes"}`,
          color: ["#FFE600", "#73EC8E", "#FF66C4", "#00F0FF", "#C4B5FD"][
            Math.floor(Math.random() * 5)
          ],
          createdAt: new Date().toISOString().split("T")[0],
          cards: generatedCards.map((c, i) => ({
            id: `c-ai-${Date.now()}-${i}`,
            question: c.question,
            answer: c.answer,
            hint: c.hint || "Review core concept",
            category: c.category || "General",
            tags: c.tags || ["AI-Generated"],
            masteryLevel: "new",
            reviewCount: 0,
          })),
        };

        onAddDeck(newDeck);
        setSelectedDeckId(newDeck.id);
        setCardIndex(0);
        setIsFlipped(false);
        setShowHint(false);
        setShowAiModal(false);
        setAiTopic("");
        setAiNotes("");

        soundEngine.playChime("levelup");
        onAwardXp(50);
        confetti({ particleCount: 70, spread: 60 });
      }
    } catch (err) {
      console.error("Failed to generate AI flashcards:", err);
      alert("Error generating cards. Please try again.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleManualAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDeck || !newQuestion.trim() || !newAnswer.trim()) return;

    const newCardObj: Flashcard = {
      id: `card-${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      hint: newHint.trim() || "Key definition",
      category: newCategory.trim() || currentDeck.subject,
      tags: newTags
        ? newTags.split(",").map((t) => t.trim())
        : [currentDeck.subject],
      masteryLevel: "new",
      reviewCount: 0,
    };

    onUpdateDeck({
      ...currentDeck,
      cards: [...currentDeck.cards, newCardObj],
    });

    setNewQuestion("");
    setNewAnswer("");
    setNewHint("");
    setNewCategory("");
    setNewTags("");
    setShowAddCardModal(false);
    soundEngine.playChime("success");
    onAwardXp(15);
  };

  const masteredCount =
    currentDeck?.cards.filter((c) => c.masteryLevel === "mastered").length || 0;
  const learningCount =
    currentDeck?.cards.filter((c) => c.masteryLevel === "learning").length || 0;
  const newCount =
    currentDeck?.cards.filter((c) => c.masteryLevel === "new").length || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#73EC8E] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Layers className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Active Recall Flashcards
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            Spaced repetition memory training powered by Gemini AI
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAiModal(true)}
            id="btn-ai-generate-flashcards"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>AI Generate Deck</span>
          </button>

          <button
            onClick={() => setShowAddCardModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* Deck Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setSelectedDeckId(d.id);
              setCardIndex(0);
              setIsFlipped(false);
              setShowHint(false);
              soundEngine.playChime("click");
            }}
            className={`p-3 border-2 border-black font-black text-xs whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedDeckId === d.id
                ? "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                : "bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            }`}
            style={{
              backgroundColor: selectedDeckId === d.id ? d.color : "#FFFFFF",
            }}
          >
            <span>{d.title}</span>
            <span className="bg-black text-white px-1.5 py-0.5 text-[10px]">
              {d.cards.length}
            </span>
          </button>
        ))}
      </div>

      {/* Deck Stats Bar */}
      {currentDeck && (
        <div className="bg-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-black text-sm uppercase text-black">{currentDeck.title}</h2>
            <p className="text-xs text-gray-700 font-medium">{currentDeck.description}</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-black">
            <span className="flex items-center gap-1 text-green-700 bg-[#73EC8E]/30 px-2 py-0.5 border border-green-700">
              Mastered: {masteredCount}
            </span>
            <span className="flex items-center gap-1 text-amber-700 bg-[#FFE600]/30 px-2 py-0.5 border border-amber-700">
              Learning: {learningCount}
            </span>
            <span className="flex items-center gap-1 text-blue-700 bg-[#00F0FF]/30 px-2 py-0.5 border border-blue-700">
              New: {newCount}
            </span>
            <button
              onClick={handleShuffle}
              className="p-1.5 bg-gray-100 border border-black hover:bg-gray-200"
              title="Shuffle Deck"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3D Flashcard Interactive Arena */}
      {currentCard ? (
        <div className="space-y-4">
          {/* Card Counter & Tag Header */}
          <div className="flex items-center justify-between text-xs font-black uppercase text-black px-1">
            <span>
              Card {cardIndex + 1} of {currentDeck?.cards.length}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 border border-black text-[10px] uppercase font-black ${
                  currentCard.masteryLevel === "mastered"
                    ? "bg-[#73EC8E]"
                    : currentCard.masteryLevel === "learning"
                    ? "bg-[#FFE600]"
                    : "bg-[#00F0FF]"
                }`}
              >
                {currentCard.masteryLevel.toUpperCase()}
              </span>
              {currentCard.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="bg-white px-1.5 py-0.5 border border-black text-[10px] hidden sm:inline"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Big Flip Card */}
          <div
            onClick={handleFlip}
            className="cursor-pointer min-h-[300px] sm:min-h-[360px] bg-white border-2 border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col justify-between select-none relative"
            style={{
              backgroundColor: isFlipped ? "#F4F4F0" : "#FFFFFF",
            }}
          >
            {/* Side Label */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <span className="font-black text-xs uppercase tracking-widest text-gray-600">
                {isFlipped ? "💡 ANSWER & BREAKDOWN" : "❓ QUESTION (ACTIVE RECALL)"}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-black text-black">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Click to Flip</span>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="my-auto py-4">
              {isFlipped ? (
                <div className="space-y-4">
                  <div className="text-lg sm:text-2xl font-black text-black leading-snug whitespace-pre-wrap">
                    {currentCard.answer}
                  </div>
                  {currentCard.hint && (
                    <div className="p-3 bg-[#FFE600]/40 border-2 border-black text-xs font-bold text-black">
                      🎯 <span className="font-black">Key Takeaway:</span> {currentCard.hint}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xl sm:text-3xl font-black text-black leading-snug">
                  {currentCard.question}
                </div>
              )}
            </div>

            {/* Card Footer: Hint Toggle */}
            <div className="pt-3 border-t-2 border-black flex items-center justify-between">
              <div>
                {!isFlipped && currentCard.hint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint((prev) => !prev);
                    }}
                    className="flex items-center gap-1 text-xs font-black px-2 py-1 bg-[#FFE600] border border-black hover:bg-[#fff04d]"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showHint ? `Hint: ${currentCard.hint}` : "Show Hint"}</span>
                  </button>
                )}
              </div>
              <span className="text-[11px] font-bold text-gray-500">
                Reviewed {currentCard.reviewCount} times
              </span>
            </div>
          </div>

          {/* Navigation and Spaced Repetition Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="flex-1 flex items-center justify-center gap-1 p-3 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
              >
                <ChevronLeft className="w-4 h-4" /> PREV
              </button>
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-1 p-3 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 active:translate-x-0.5 active:translate-y-0.5"
              >
                NEXT <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Spaced Repetition Rating Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRateCard("new")}
                className="p-2.5 bg-[#FF66C4] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ff52bb] active:translate-x-0.5 active:translate-y-0.5"
                title="Review again tomorrow"
              >
                🔴 Again (1d)
              </button>
              <button
                onClick={() => handleRateCard("learning")}
                className="p-2.5 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] active:translate-x-0.5 active:translate-y-0.5"
                title="Good recall, review in 4 days"
              >
                🟠 Good (4d)
              </button>
              <button
                onClick={() => handleRateCard("mastered")}
                className="p-2.5 bg-[#73EC8E] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e] active:translate-x-0.5 active:translate-y-0.5"
                title="Mastered! Review in 10 days"
              >
                🟢 Easy (10d)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-base text-gray-700">
            This deck has no flashcards yet!
          </p>
          <button
            onClick={() => setShowAiModal(true)}
            className="mt-3 px-4 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            Generate Cards with Gemini AI
          </button>
        </div>
      )}

      {/* AI Generate Deck Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-black" />
                <h3 className="font-black text-lg uppercase text-black">
                  AI Flashcard Deck Creator
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
                  Topic / Exam Name
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Organic Chemistry Carbonyl Reactions, AP Macroeconomics"
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Lecture Notes / Raw Syllabus (Optional)
                </label>
                <textarea
                  rows={4}
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Paste textbook excerpts, slides, or study notes here..."
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-medium text-xs resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Number of Cards: {aiCount}
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full accent-black cursor-pointer"
                />
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
                onClick={handleCreateAiDeck}
                disabled={isGeneratingAi || (!aiTopic.trim() && !aiNotes.trim())}
                className="px-5 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fff04d] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGeneratingAi ? (
                  <>
                    <div className="w-3 h-3 bg-black animate-spin" />
                    Generating via Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Flashcards
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleManualAddCard}
            className="bg-white border-2 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <h3 className="font-black text-lg uppercase text-black">
                Add Card to {currentDeck?.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCardModal(false)}
                className="font-black text-base px-2 border border-black hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Question / Prompt
                </label>
                <textarea
                  rows={2}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What is the definition or problem to solve?"
                  required
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-black block mb-1">
                  Answer / Key Insight
                </label>
                <textarea
                  rows={3}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Concise, clear answer..."
                  required
                  className="w-full p-2.5 bg-[#F4F4F0] border-2 border-black font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Hint / Mnemonic
                  </label>
                  <input
                    type="text"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                    placeholder="Short memory trigger"
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-medium text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-black block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="ExamPrep, Chapter1"
                    className="w-full p-2 bg-[#F4F4F0] border-2 border-black font-medium text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setShowAddCardModal(false)}
                className="px-4 py-2 bg-gray-100 border-2 border-black font-black text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#73EC8E] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#62e07e]"
              >
                Save Flashcard
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
