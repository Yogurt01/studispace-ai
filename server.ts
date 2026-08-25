import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // AI Socratic Chat Endpoint
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history = [], mode = "socratic" } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const ai = getGeminiClient();

      let systemInstruction = `You are Socrates AI, an energetic, ultra-smart, Gen-Z friendly study mentor inside the StudiSpace app. 
Your aesthetic is witty, direct, encouraging, high-clarity, and intellectually rigorous.
Use formatting (bullet points, bold highlights, concise blocks, markdown) that looks crisp in a Neo-Brutalist UI.`;

      if (mode === "socratic") {
        systemInstruction += `
MODE: SOCRATIC QUESTIONING.
Never give the raw direct answer immediately if the user is asking how to solve something. Instead:
1. Validate their question with a fun, punchy remark.
2. Break down the core intuition or underlying principle.
3. Ask 1-2 sharp guiding questions or hint at the next logical step so the student discovers the answer themselves.
4. If they answer correctly or are stuck after trying, celebrate their breakthrough and explain the full insight concisely.`;
      } else if (mode === "eli5") {
        systemInstruction += `
MODE: ELI5 (Explain Like I'm 5 / High School Gen-Z).
Explain the concept using brilliant real-world analogies, hilarious metaphors (gaming, pop-culture, food, daily life), and zero jargon. Keep it crystal clear and unforgettable.`;
      } else if (mode === "exam_grill") {
        systemInstruction += `
MODE: EXAM PREP GRILLER.
Act like a sharp, supportive professor or quizmaster. Test the user's comprehension immediately with a challenging scenario-based question, offer multiple choice or short prompt, and evaluate their critical thinking.`;
      } else if (mode === "mnemonic") {
        systemInstruction += `
MODE: MNEMONIC & MEMORY HACK MASTER.
Generate crazy, memorable mnemonics, visual rhymes, chunking tricks, or absurd mental associations to lock the concept permanently in memory.`;
      } else if (mode === "roast_essay") {
        systemInstruction += `
MODE: THESIS & ESSAY ROASTER / POLISHER.
Constructively critique the student's argument or text. Point out weak evidence, fluff, logical fallacies, and offer 3 upgraded powerhouse versions of their sentences.`;
      }

      if (!ai) {
        // Fallback intelligent offline simulation
        let reply = "";
        if (mode === "socratic") {
          reply = `💡 **Let's break this down together!**\n\nTo tackle **"${message}"**, think about the foundational rule first: What is the primary cause or formula that governs this behavior?\n\n👉 **Guiding Question**: If you change the main variable by 50%, what happens to the output? Take a guess, and let's test your hypothesis!`;
        } else if (mode === "eli5") {
          reply = `🍕 **Here is the 10-second breakdown of "${message}":**\n\nImagine you are playing a co-op game with your squad. Each component has one job. When one player fails their cooldown, the entire chain halts. That's essentially what happens here!\n\n✨ **Key takeaway**: Simplicity beats complexity every single time.`;
        } else if (mode === "mnemonic") {
          reply = `🧠 **Memory Hack for "${message}":**\n\nUse the acronym **S.P.A.C.E.**:\n- **S** - Structure first\n- **P** - Principles aligned\n- **A** - Actionable logic\n- **C** - Check edge cases\n- **E** - Execute cleanly!\n\nRepeat it 3 times out loud right now! 🔥`;
        } else {
          reply = `⚡ **Insight on "${message}":**\n\n1. **Core Concept**: Focus on the highest-leverage mechanic.\n2. **Common Trap**: Most students confuse the symptom with the root cause.\n3. **Pro Tip**: Always verify with a concrete minimal test case!`;
        }
        return res.json({ reply, mode, simulated: true });
      }

      // Build conversation contents
      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      for (const h of history.slice(-8)) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text || h.content || "" }],
        });
      }

      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const reply = response.text || "No response generated.";
      res.json({ reply, mode });
    } catch (err: any) {
      console.error("Gemini chat error:", err);
      res.status(500).json({
        error: "Failed to generate AI response",
        details: err?.message || String(err),
      });
    }
  });

  // AI Flashcards Generator Endpoint
  app.post("/api/gemini/generate-flashcards", async (req, res) => {
    try {
      const { topic, rawNotes = "", count = 6 } = req.body;
      if (!topic && !rawNotes) {
        return res.status(400).json({ error: "Topic or notes required" });
      }

      const ai = getGeminiClient();

      if (!ai) {
        // Fallback default generated cards
        const sampleCards = [
          {
            question: `What is the core principle of ${topic || "this topic"}?`,
            answer: `The fundamental law governing its behavior and primary interactions under standard conditions.`,
            hint: `Think about foundational axioms or primary definitions.`,
            category: topic || "General",
            tags: ["High-Yield", "Concept"],
          },
          {
            question: `How does ${topic || "this concept"} differ from its closest alternative?`,
            answer: `It differs in efficiency, scope of application, and underlying mechanism.`,
            hint: `Consider constraints and specific trade-offs.`,
            category: topic || "Comparison",
            tags: ["Comparison", "Exam-Ready"],
          },
          {
            question: `What is the most common pitfall when solving problems in ${topic || "this subject"}?`,
            answer: `Confusing inverse relationships or failing to account for boundary edge-cases.`,
            hint: `Look at the units and extreme limits.`,
            category: topic || "Problem Solving",
            tags: ["Pitfall", "Pro-Tip"],
          },
          {
            question: `Provide a real-world application of ${topic || "this concept"}.`,
            answer: `Used widely in optimized algorithmic models, physical engineering, and daily decision systems.`,
            hint: `Where do you experience this in modern tech?`,
            category: topic || "Application",
            tags: ["Real-World", "Practical"],
          },
        ];
        return res.json({ flashcards: sampleCards, simulated: true });
      }

      const prompt = `Create exactly ${Math.min(Math.max(count, 3), 10)} high-yield active-recall study flashcards about:
TOPIC: ${topic || "General Study Topic"}
STUDY NOTES/CONTEXT: ${rawNotes || "Extract the most critical definitions, equations, key comparisons, and edge-cases."}

Ensure questions are crisp and test active recall (not trivial true/false). Answers must be clear, concise, and easy to memorize. Include a helpful hint and 1-2 relevant tags.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an expert exam curriculum designer. Return strictly valid JSON adhering to the schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    category: { type: Type.STRING },
                    tags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["question", "answer", "hint", "category", "tags"],
                },
              },
            },
            required: ["flashcards"],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"flashcards": []}');
      res.json(parsed);
    } catch (err: any) {
      console.error("Flashcard generator error:", err);
      res.status(500).json({ error: "Failed to generate flashcards", details: err?.message });
    }
  });

  // AI Quiz Generator Endpoint
  app.post("/api/gemini/generate-quiz", async (req, res) => {
    try {
      const { topic, rawNotes = "", count = 5, difficulty = "Medium" } = req.body;
      if (!topic && !rawNotes) {
        return res.status(400).json({ error: "Topic or notes required" });
      }

      const ai = getGeminiClient();

      if (!ai) {
        const fallbackQuiz = {
          title: `${topic || "Mastery"} Speed Quiz`,
          topic: topic || "General Mastery",
          difficulty,
          questions: [
            {
              question: `Which statement best describes the primary mechanism of ${topic || "this concept"}?`,
              options: [
                `It executes sequentially with linear computational overhead.`,
                `It leverages dynamic equilibrium to minimize state disruption.`,
                `It completely bypasses external dependencies without state mutation.`,
                `It requires constant manual re-calibration under variable load.`,
              ],
              correctIndex: 1,
              explanation: `Dynamic equilibrium allows the system to balance opposing processes efficiently without catastrophic resets.`,
              hint: `Focus on how natural systems maintain balance under stress.`,
            },
            {
              question: `When analyzing edge cases in ${topic || "this domain"}, what is the most critical metric?`,
              options: [
                `Total raw execution duration alone.`,
                `Boundary limit convergence and safety margins.`,
                `Aesthetic syntactic brevity.`,
                `Number of lines of commentary.`,
              ],
              correctIndex: 1,
              explanation: `Boundary limit convergence guarantees the solution remains stable across extreme test values.`,
              hint: `Think about what prevents crashes at the extreme limits.`,
            },
            {
              question: `What is the primary trade-off when optimizing for high throughput here?`,
              options: [
                `Memory overhead and increased complexity.`,
                `Lower network latency universally.`,
                `Zero hardware requirement.`,
                `Instant instantaneous compilation.`,
              ],
              correctIndex: 0,
              explanation: `Higher throughput almost always trades off increased memory footprint or caching overhead.`,
              hint: `There is no free lunch in computer science or physics.`,
            },
          ],
        };
        return res.json(fallbackQuiz);
      }

      const prompt = `Generate a high-yield practice quiz with exactly ${Math.min(
        Math.max(count, 3),
        10
      )} multiple-choice questions.
TOPIC: ${topic}
DIFFICULTY: ${difficulty}
CONTEXT NOTES: ${rawNotes || "Cover fundamental concepts, realistic problem scenarios, and tricky edge-case distractors."}

Make all 4 options believable and plausible (no joke options). Provide a solid conceptual explanation for the correct answer.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are a master university quiz creator. Return strictly valid JSON according to the schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              topic: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    hint: { type: Type.STRING },
                  },
                  required: [
                    "question",
                    "options",
                    "correctIndex",
                    "explanation",
                    "hint",
                  ],
                },
              },
            },
            required: ["title", "topic", "difficulty", "questions"],
          },
        },
      });

      const parsed = JSON.parse(
        response.text || '{"title":"Practice Quiz","questions":[]}'
      );
      res.json(parsed);
    } catch (err: any) {
      console.error("Quiz generator error:", err);
      res.status(500).json({ error: "Failed to generate quiz", details: err?.message });
    }
  });

  // AI Note Transformer / Summarizer Endpoint
  app.post("/api/gemini/transform-note", async (req, res) => {
    try {
      const { noteTitle, noteContent, action = "summarize" } = req.body;
      if (!noteContent) {
        return res.status(400).json({ error: "Note content is required" });
      }

      const ai = getGeminiClient();

      let instruction = "You are an expert academic tutor.";
      let userPrompt = "";

      switch (action) {
        case "summarize":
          userPrompt = `Summarize these study notes titled "${noteTitle || "Untitled"}" into punchy, high-impact bullet points with bold keywords and a 1-sentence TL;DR summary:\n\n${noteContent}`;
          break;
        case "key_terms":
          userPrompt = `Extract the top 5-8 essential key terms and their crystal-clear definitions from this text:\n\n${noteContent}`;
          break;
        case "action_items":
          userPrompt = `Convert these notes into an actionable checklist of study tasks, practice problems to solve, and review checkpoints:\n\n${noteContent}`;
          break;
        case "cheat_sheet":
          userPrompt = `Create a high-density 1-page Neo-Brutalist style exam cheat sheet from these notes, organizing formulas, rules, and common pitfalls into clear markdown tables and blocks:\n\n${noteContent}`;
          break;
        case "simplify":
          userPrompt = `Rewrite the following dense study material in simple, conversational Gen-Z terms without losing any scientific/academic accuracy:\n\n${noteContent}`;
          break;
        default:
          userPrompt = `Enhance and organize these study notes clearly:\n\n${noteContent}`;
      }

      if (!ai) {
        const simulatedResult = `### ⚡ Study Synthesis: ${noteTitle || "Note Insights"}\n\n**TL;DR**: Master the core definitions and test them through rapid active recall.\n\n- 🎯 **Key takeaway 1**: Deconstruct complex ideas into primary atomic units.\n- 💡 **Key takeaway 2**: Consistent 25-minute Pomodoro sprints increase retention by up to 40%.\n- ⚠️ **Watch out for**: Avoid passive re-reading; test yourself on quizzes instead!\n\n*(Connect Gemini API Key in AI Studio Secrets for live custom AI synthesis)*`;
        return res.json({ result: simulatedResult, action, simulated: true });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: userPrompt,
        config: {
          systemInstruction: instruction,
          temperature: 0.6,
        },
      });

      res.json({ result: response.text || "No transformation produced.", action });
    } catch (err: any) {
      console.error("Note transform error:", err);
      res.status(500).json({ error: "Failed to transform note", details: err?.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ StudiSpace server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server boot error:", err);
});
