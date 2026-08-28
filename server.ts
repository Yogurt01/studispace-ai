import express from "express";
import path from "path";
import { existsSync } from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { resolveConversationUserId } from "./server/socrates/identity";
import { FirestoreConversationRepository, InMemoryConversationRepository } from "./server/socrates/persistence";
import { isSocratesMode } from "./server/socrates/prompts";
import { createProviderRouter } from "./server/socrates/providers";
import { createDeveloperMode } from "./server/socrates/developerMode";
import {
  AiModelId,
  isAiModelId,
  isModelProviderId,
  LEGACY_PROVIDER_MODEL,
  ModelAccessError,
  ProviderError,
} from "./server/socrates/providers/types";
import { SocratesService } from "./server/socrates/service";

dotenv.config();

/** True only for an explicit development run; see the serving branch in startServer. */
const isDevelopment = process.env.NODE_ENV === "development";

function getRuntimeConfig() {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
  // Same rule as the serving branch: anything that is not explicitly development
  // is a real deployment, and a real deployment without a key cannot answer.
  if (!isDevelopment && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required unless NODE_ENV=development");
  }
  return { port };
}

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
  const { port } = getRuntimeConfig();

  app.use(express.json({ limit: "10mb" }));

  // Firebase web configuration is intentionally public; keep server secrets out of this response.
  app.get("/runtime-config.js", (_req, res) => {
    const config = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("VITE_FIREBASE_")));
    res.type("application/javascript").send(`globalThis.__STUDISPACE_RUNTIME_CONFIG__=${JSON.stringify(config)};`);
  });

  // Health check
  app.get(["/health", "/api/health"], (_req, res) => res.json({ status: "ok" }));

  const providerRouter = createProviderRouter();
  let conversationRepository: FirestoreConversationRepository | InMemoryConversationRepository;
  try { conversationRepository = new FirestoreConversationRepository(); }
  catch { conversationRepository = new InMemoryConversationRepository(); console.warn("Firestore credentials unavailable; conversation state is temporary in this local process."); }
  const socratesService = new SocratesService(conversationRepository, providerRouter);

  const developerMode = createDeveloperMode();
  if (!developerMode.configured) {
    console.warn("DEVELOPER_MODE_PASSWORD is not set; developer-only models are unreachable on this server.");
  }
  /** Developer Mode is proven by a signed token header, never by the request body. */
  const hasDeveloperAccess = (req: express.Request) => developerMode.verify(req.get("x-developer-token"));

  // Which models this server offers, with availability and lock state. Never
  // exposes keys, URLs or the developer password.
  // `/api/ai/providers` predates model-level selection and is kept as an alias.
  app.get(["/api/ai/models", "/api/ai/providers"], async (req, res) => {
    try {
      const developer = hasDeveloperAccess(req);
      const models = await providerRouter.describeAll({ developer });
      res.json({
        models,
        // Legacy key for clients written against the provider-shaped response.
        providers: models,
        defaultModel: providerRouter.defaultId,
        defaultProvider: providerRouter.defaultId,
        developerMode: { configured: developerMode.configured, unlocked: developer },
      });
    } catch (err) {
      console.error("Model availability error:", err);
      res.status(500).json({ error: "Could not read model availability" });
    }
  });

  // Exchanges the Developer Mode password for a short-lived signed token.
  // The password is compared server-side and never logged, echoed, or returned.
  app.post("/api/developer/unlock", (req, res) => {
    const result = developerMode.unlock(req.body?.password);
    if (result.status === "unlocked") return res.json({ ok: true, token: result.token, expiresAt: result.expiresAt });
    if (result.status === "unconfigured") return res.status(503).json({ error: "Developer Mode is not configured on this server." });
    if (result.status === "throttled") return res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return res.status(401).json({ error: "Incorrect developer password." });
  });

  // Socratic chat (LangGraph orchestration + Firestore conversation state).
  // `/api/gemini/chat` predates the provider abstraction and is kept as an alias
  // so existing clients keep working; the runtime is chosen by `provider`.
  app.post(["/api/socrates/chat", "/api/gemini/chat"], async (req, res) => {
    try {
      const { message, mode = "socratic", threadId, context, provider, model } = req.body;
      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (typeof threadId !== "string" || !threadId.trim()) return res.status(400).json({ error: "threadId is required" });
      if (!isSocratesMode(mode)) return res.status(400).json({ error: "Invalid tutoring mode" });
      if (context !== undefined && typeof context !== "string") return res.status(400).json({ error: "Context must be text" });
      if (model !== undefined && !isAiModelId(model)) return res.status(400).json({ error: "Unknown model" });
      if (provider !== undefined && !isModelProviderId(provider)) return res.status(400).json({ error: "Unknown model provider" });
      // `model` is authoritative; a legacy `provider` names a runtime, which maps
      // to the model that runtime serves. Both routes end at the same tier check.
      const requestedModel: AiModelId | undefined = model ?? (provider ? LEGACY_PROVIDER_MODEL[provider] : undefined);
      // Identity is taken from the verified ID token, never from the request body.
      const userId = await resolveConversationUserId(req.get("authorization"), threadId);
      res.json(
        await socratesService.respond({
          threadId,
          userId,
          message: message.trim(),
          mode,
          context,
          model: requestedModel,
          developer: hasDeveloperAccess(req),
        })
      );
    } catch (err: any) {
      console.error("Socrates chat error:", err);
      if (err?.message === "CONVERSATION_FORBIDDEN") return res.status(403).json({ error: "Conversation is not available to this user" });
      // The server, not the UI, is what keeps a locked model locked.
      if (err instanceof ModelAccessError) {
        return res.status(403).json({ error: `${err.message} Unlock Developer Mode to use it.`, model: err.modelId, code: "developer_mode_required" });
      }
      if (err?.code === "auth/argument-error" || err?.code?.startsWith?.("auth/")) return res.status(401).json({ error: "Invalid or expired sign-in token" });
      // Provider errors carry a message written for students; stack traces stay in the server log.
      if (err instanceof ProviderError) {
        const status = err.reason === "offline" || err.reason === "model_missing" || err.reason === "not_configured" ? 503 : err.reason === "timeout" ? 504 : 502;
        return res.status(status).json({ error: err.message, provider: err.providerId, reason: err.reason });
      }
      res.status(500).json({ error: "Failed to generate AI response" });
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

  // AI Transcript & Course Parser Endpoint
  app.post("/api/gemini/parse-transcript", async (req, res) => {
    try {
      const { transcriptText = "", base64Data, mimeType } = req.body;
      if (!transcriptText && !base64Data) {
        return res.status(400).json({ error: "Transcript text or document is required" });
      }

      const ai = getGeminiClient();

      if (!ai) {
        // High quality fallback parsed data if API key not present
        const sampleParsed = [
          {
            courseCode: "CS 301",
            courseName: "Algorithms & Complexities",
            term: "Spring 2026",
            credits: 4,
            letterGrade: "A",
            numericGrade: 95,
            category: "Core",
          },
          {
            courseCode: "MATH 302",
            courseName: "Probability & Statistics for Engineers",
            term: "Spring 2026",
            credits: 3,
            letterGrade: "A-",
            numericGrade: 89,
            category: "Core",
          },
          {
            courseCode: "PHYS 150",
            courseName: "University Physics II (Electromagnetism)",
            term: "Spring 2026",
            credits: 4,
            letterGrade: "B+",
            numericGrade: 86,
            category: "Gen Ed",
          },
        ];
        return res.json({ courses: sampleParsed, simulated: true });
      }

      const systemInstruction = `You are an expert academic registrar AI that parses student transcripts, grade reports, and syllabi into structured course data. Extract all courses with high precision. Standardize letter grades into standard US scale (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F). If numeric grade (0-100) is present, extract it or estimate reasonable number based on letter grade. Categorize each into Core, Major Elective, Gen Ed, Lab, or Honors.`;

      let contents: any[] = [];
      if (base64Data && mimeType) {
        contents = [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: "Extract all course grades, course codes, course names, terms/semesters, credit hours, and grades from this academic transcript or grade report.",
              },
            ],
          },
        ];
      } else {
        contents = [
          {
            role: "user",
            parts: [
              {
                text: `Extract all courses, codes, names, terms/semesters, credits, and letter grades from this transcript text:\n\n${transcriptText}`,
              },
            ],
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              courses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    courseCode: { type: Type.STRING },
                    courseName: { type: Type.STRING },
                    term: { type: Type.STRING },
                    credits: { type: Type.NUMBER },
                    letterGrade: { type: Type.STRING },
                    numericGrade: { type: Type.NUMBER },
                    category: {
                      type: Type.STRING,
                      enum: ["Core", "Major Elective", "Gen Ed", "Lab", "Honors"],
                    },
                  },
                  required: ["courseCode", "courseName", "term", "credits", "letterGrade", "category"],
                },
              },
            },
            required: ["courses"],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"courses":[]}');
      res.json(parsed);
    } catch (err: any) {
      console.error("Transcript parse error:", err);
      res.status(500).json({ error: "Failed to parse transcript", details: err?.message });
    }
  });

  // How the frontend is served.
  //
  // This opts *in* to the development server rather than out of it. The earlier
  // rule was `NODE_ENV !== "production"`, which meant any host that did not set
  // NODE_ENV — a container image, a buildpack, a managed runtime — silently got
  // a Vite dev server on the public internet. That is how production ended up
  // answering every page with Vite's "Blocked request. This host is not
  // allowed." Its host check was the only thing standing between the internet
  // and a dev server that serves raw sources and arbitrary files over /@fs, so
  // allowlisting the production host there would have published the source tree
  // instead of fixing anything. Anything that is not explicitly development
  // serves the built assets.
  if (isDevelopment) {
    console.log("Serving the Vite development server (NODE_ENV=development).");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    const indexPath = path.join(distPath, "index.html");
    // Fail loudly rather than serving 404s for every page: a missing build is an
    // operator error, and it must not look like an application bug at 3am.
    if (!existsSync(indexPath)) {
      throw new Error(
        `No production build found at ${indexPath}. Run "npm run build" before starting, ` +
          `or set NODE_ENV=development to use the Vite dev server.`
      );
    }
    console.log(`Serving the production build from ${distPath}.`);
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(indexPath);
    });
  }

  const server = app.listen(port, "0.0.0.0", () => {
    // Bind on every interface, but always advertise a hostname that Firebase Auth
    // accepts. Google sign-in fails with auth/unauthorized-domain on any host that
    // is not in the project's Authorized Domains list, and printing 0.0.0.0 (or a
    // LAN IP) is what leads people to open the app on one of those hosts.
    console.log(`⚡ StudiSpace server running on http://localhost:${port}`);
    console.log(`   Open the app on localhost or 127.0.0.1 — other hostnames are not`);
    console.log(`   authorized for Firebase Google sign-in.`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("Fatal server boot error:", err);
});
