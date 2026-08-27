import {
  Assignment,
  FlashcardDeck,
  StudyNote,
  Quiz,
  UserStats,
  Badge,
  CourseGrade,
} from "../types";

export const INITIAL_STATS: UserStats = {
  xp: 1420,
  level: 4,
  streakDays: 14,
  totalFocusMinutes: 385,
  pomodorosCompleted: 15,
  cardsReviewedCount: 68,
  quizzesTakenCount: 9,
  unlockedBadgeIds: ["early_bird", "focus_beast", "socratic_scholar"],
};

export const INITIAL_BADGES: Badge[] = [
  {
    id: "early_bird",
    title: "⚡ 5AM Club",
    desc: "Completed a focus session before 8:00 AM",
    icon: "Sunrise",
    color: "#FFE600",
    unlocked: true,
    req: "1 Focus session before 8 AM",
  },
  {
    id: "focus_beast",
    title: "🔥 Focus Beast",
    desc: "Crushed 10 Pomodoro sessions in a single week",
    icon: "Flame",
    color: "#FF66C4",
    unlocked: true,
    req: "10 Pomodoro sprints completed",
  },
  {
    id: "socratic_scholar",
    title: "🧠 Socrates Apprentice",
    desc: "Chatted with Socrates AI across 5 study topics",
    icon: "Brain",
    color: "#00F0FF",
    unlocked: true,
    req: "5 Socratic AI interactions",
  },
  {
    id: "flashcard_master",
    title: "🃏 Recall Titan",
    desc: "Mastered 50 flashcards with >90% accuracy",
    icon: "Layers",
    color: "#73EC8E",
    unlocked: false,
    req: "50 Flashcards in Mastered tier",
  },
  {
    id: "quiz_ace",
    title: "🎯 100% Ace Club",
    desc: "Scored a perfect 100% on any practice quiz",
    icon: "Trophy",
    color: "#FFE600",
    unlocked: false,
    req: "1 Perfect score in Quiz Arena",
  },
  {
    id: "sound_zen",
    title: "🎧 Lo-Fi Monastic",
    desc: "Studied for 60 consecutive minutes with soundscapes",
    icon: "Headphones",
    color: "#C4B5FD",
    unlocked: false,
    req: "60 mins with active soundscapes",
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: "task-1",
    title: "Data Structures: AVL Tree Rotation & Balance Factors",
    subject: "Computer Science",
    dueDate: "2026-03-02",
    priority: "urgent",
    status: "in_progress",
    estimatedPomodoros: 4,
    completedPomodoros: 2,
    weightPercent: 15,
    gradeTarget: "A (95%)",
    notes: "Implement left-right double rotations and verify O(log n) time complexity.",
  },
  {
    id: "task-2",
    title: "Molecular Genetics: Lac Operon Regulatory Pathway",
    subject: "Biology 102",
    dueDate: "2026-03-04",
    priority: "high",
    status: "todo",
    estimatedPomodoros: 3,
    completedPomodoros: 0,
    weightPercent: 20,
    gradeTarget: "A-",
    notes: "Distinguish between negative inducible vs repressible operons with cAMP/CAP activator.",
  },
  {
    id: "task-3",
    title: "Macroeconomics: Solow-Swan Growth Model Synthesis",
    subject: "Economics",
    dueDate: "2026-03-08",
    priority: "medium",
    status: "todo",
    estimatedPomodoros: 2,
    completedPomodoros: 0,
    weightPercent: 10,
    gradeTarget: "A",
    notes: "Derive golden rule steady-state capital stock per effective worker.",
  },
  {
    id: "task-4",
    title: "Organic Chemistry: SN1 vs SN2 Reaction Mechanisms",
    subject: "Chem 201",
    dueDate: "2026-02-28",
    priority: "urgent",
    status: "done",
    estimatedPomodoros: 3,
    completedPomodoros: 3,
    weightPercent: 12,
    gradeTarget: "A+",
    notes: "Polar protic solvents favor SN1 carbocation stability; aprotic favors SN2 inversion.",
  },
];

export const INITIAL_DECKS: FlashcardDeck[] = [
  {
    id: "deck-cs",
    title: "Algorithms & Time Complexity",
    subject: "Computer Science",
    description: "Big-O invariants, Graph Traversals, Dynamic Programming, and Heap Operations.",
    color: "#00F0FF",
    createdAt: "2026-02-20",
    cards: [
      {
        id: "c1",
        question: "What is the worst-case time complexity of QuickSort and how can it be avoided?",
        answer: "O(n²) occurs when the pivot is always the extreme element. Avoided via randomized pivot selection or Median-of-Medians to ensure O(n log n).",
        hint: "Think about already-sorted arrays without randomized pivots.",
        category: "Sorting",
        tags: ["Big-O", "Divide & Conquer"],
        masteryLevel: "mastered",
        reviewCount: 4,
      },
      {
        id: "c2",
        question: "How does Dijkstra's Algorithm differ fundamentally from Bellman-Ford?",
        answer: "Dijkstra is greedy and operates in O((V + E) log V) with non-negative edge weights; Bellman-Ford is dynamic programming in O(V · E) and detects negative weight cycles.",
        hint: "Check constraints regarding negative edge weights.",
        category: "Graphs",
        tags: ["Shortest Path", "Graph Theory"],
        masteryLevel: "learning",
        reviewCount: 2,
      },
      {
        id: "c3",
        question: "What two properties define a problem suitable for Dynamic Programming?",
        answer: "1. Optimal Substructure (optimal solution formed from optimal subproblems)\n2. Overlapping Subproblems (subproblems recur repeatedly rather than generating new ones).",
        hint: "Contrast with Divide & Conquer (like Merge Sort).",
        category: "DP",
        tags: ["Memoization", "Optimization"],
        masteryLevel: "learning",
        reviewCount: 1,
      },
      {
        id: "c4",
        question: "What is the amortized insertion time complexity for a dynamic resizing array?",
        answer: "O(1) amortized time! Although doubling takes O(n), it happens exponentially less frequently, averaging out to constant time per element.",
        hint: "Calculate aggregate cost across n successive pushes.",
        category: "Data Structures",
        tags: ["Amortized Analysis", "Arrays"],
        masteryLevel: "new",
        reviewCount: 0,
      },
    ],
  },
  {
    id: "deck-bio",
    title: "Cellular & Molecular Biology",
    subject: "Biology 102",
    description: "ATP synthase, signal transduction, cell cycle checkpoints, and CRISPR-Cas9.",
    color: "#73EC8E",
    createdAt: "2026-02-18",
    cards: [
      {
        id: "b1",
        question: "How does the proton electrochemical gradient drive ATP synthesis in mitochondria?",
        answer: "Protons in the intermembrane space flow down their gradient back into the mitochondrial matrix through the F0 rotor subunit of ATP synthase, causing mechanical rotation that phosphorylates ADP to ATP in F1.",
        hint: "Chemiosmosis and Peter Mitchell's hypothesis.",
        category: "Respiration",
        tags: ["Oxidative Phosphorylation", "Biochemistry"],
        masteryLevel: "mastered",
        reviewCount: 5,
      },
      {
        id: "b2",
        question: "What is the primary role of the G1/S checkpoint and what protein acts as the master guardian?",
        answer: "It checks for DNA integrity and cell size before committing to genome replication. The p53 tumor suppressor activates p21 (CDK inhibitor) if DNA damage is detected.",
        hint: "Guardian of the Genome.",
        category: "Cell Cycle",
        tags: ["Mitosis", "Checkpoints"],
        masteryLevel: "learning",
        reviewCount: 2,
      },
      {
        id: "b3",
        question: "What is the function of the Guide RNA (gRNA) in CRISPR-Cas9?",
        answer: "The ~20nt sequence of gRNA matches the complementary target DNA sequence adjacent to a Protospacer Adjacent Motif (PAM), guiding the Cas9 endonuclease to introduce a double-strand cut.",
        hint: "Acts as GPS targeting for the molecular scissors.",
        category: "Genetics",
        tags: ["Biotech", "Gene Editing"],
        masteryLevel: "new",
        reviewCount: 0,
      },
    ],
  },
  {
    id: "deck-econ",
    title: "Microeconomic Theory & Game Theory",
    subject: "Economics",
    description: "Nash Equilibria, Elasticity of Demand, Deadweight Loss, and Pigouvian Taxes.",
    color: "#FFE600",
    createdAt: "2026-02-22",
    cards: [
      {
        id: "e1",
        question: "Define a Nash Equilibrium in normal-form game theory.",
        answer: "A state where no player can unilaterally deviate to improve their own payoff, given the strategies chosen by all other players.",
        hint: "No regrets given opponents' moves.",
        category: "Game Theory",
        tags: ["Equilibrium", "Strategic Choice"],
        masteryLevel: "mastered",
        reviewCount: 3,
      },
      {
        id: "e2",
        question: "Why does a price ceiling set below equilibrium cause both shortages and deadweight loss?",
        answer: "At the lower price, quantity demanded exceeds quantity supplied (shortage), and mutually beneficial trades between marginal buyers and sellers are prevented.",
        hint: "Analyze the producer and consumer surplus triangles.",
        category: "Market Intervention",
        tags: ["Surplus", "Deadweight Loss"],
        masteryLevel: "learning",
        reviewCount: 1,
      },
    ],
  },
];

export const INITIAL_NOTES: StudyNote[] = [
  {
    id: "note-1",
    title: "⚡ CS Core: AVL Tree Balancing & Rotation Cheat Sheet",
    subject: "Computer Science",
    color: "#00F0FF",
    updatedAt: "2026-02-24 14:30",
    tags: ["DataStructures", "Trees", "ExamNotes"],
    isPinned: true,
    content: `# AVL Tree Balancing Cheat Sheet

## 1. Balance Factor Invariant
For every node $N$:
$$\\text{BF}(N) = \\text{Height}(\\text{LeftSubtree}) - \\text{Height}(\\text{RightSubtree})$$
- Allowed range: $\\text{BF} \\in \\{-1, 0, +1\\}$
- If $\\text{BF} > 1$ or $\\text{BF} < -1$, tree is **unbalanced** and requires rotation!

## 2. Four Rotation Scenarios
1. **Left-Left (LL)**: Single Right Rotation on root.
2. **Right-Right (RR)**: Single Left Rotation on root.
3. **Left-Right (LR)**: Left rotation on Left child, then Right rotation on root.
4. **Right-Left (RL)**: Right rotation on Right child, then Left rotation on root.

## 3. Time Complexities
- **Search**: $O(\\log n)$ strictly guaranteed
- **Insert**: $O(\\log n)$ with max 2 rotations
- **Delete**: $O(\\log n)$ with up to $O(\\log n)$ cascading rotations
`,
  },
  {
    id: "note-2",
    title: "🧬 Lac Operon Transcription Regulation (E. coli)",
    subject: "Biology 102",
    color: "#73EC8E",
    updatedAt: "2026-02-23 09:15",
    tags: ["Genetics", "Operons", "HighYield"],
    isPinned: true,
    content: `# Lac Operon Regulation Summary

## Key Components
- **lacI**: Encodes the repressor protein (constitutively expressed)
- **Promoter (P)**: Binding site for RNA Polymerase
- **Operator (O)**: Binding site for Lac Repressor
- **Structural Genes**: \`lacZ\` ($\beta$-galactosidase), \`lacY\` (permease), \`lacA\` (transacetylase)

## 4 Regulatory States
1. **+ Glucose, - Lactose**: Repressor bound to Operator. **OFF (No Transcription)**
2. **+ Glucose, + Lactose**: Allolactose binds repressor (releases operator), but low cAMP means no CAP binding. **BASAL / LOW**
3. **- Glucose, - Lactose**: Repressor bound to Operator. **OFF**
4. **- Glucose, + Lactose**: High cAMP binds CAP $\\rightarrow$ active activator + repressor removed $\\rightarrow$ **MAXIMAL TRANSCRIPTION! 🚀**
`,
  },
  {
    id: "note-3",
    title: "📊 Microeconomics: Marginal Cost vs Average Cost Curves",
    subject: "Economics",
    color: "#FFE600",
    updatedAt: "2026-02-21 17:40",
    tags: ["Microeconomics", "Calculus", "Curves"],
    isPinned: false,
    content: `# Cost Curves & Profit Maximization

## 1. Golden Profit Maximization Rule
$$\\text{MR} = \\text{MC}$$
Under perfect competition, $\\text{Price} = \\text{MR} = \\text{AR}$.

## 2. Geometric Curve Properties
- The **Marginal Cost (MC)** curve *always intersects* both **Average Variable Cost (AVC)** and **Average Total Cost (ATC)** at their respective **minimum points**!
- **Shutdown Condition (Short Run)**: If $\\text{Price} < \\text{min}(AVC)$, shut down immediately to lose only fixed costs.
- **Exit Condition (Long Run)**: If $\\text{Price} < \\text{min}(ATC)$, exit the industry entirely.
`,
  },
];

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: "quiz-dsa",
    title: "Data Structures & Big-O Speed Sprint",
    topic: "Computer Science",
    difficulty: "Medium",
    bestScore: 80,
    timesTaken: 2,
    questions: [
      {
        id: "q1",
        question: "What is the time complexity of searching for an element in an unsorted hash table with good hashing?",
        options: ["O(1) average case", "O(log n) always", "O(n) average case", "O(n log n)"],
        correctIndex: 0,
        explanation: "Hash table lookups take O(1) constant time on average assuming a uniform distribution hash function with low collision load factor.",
        hint: "Think about key-to-bucket mapping.",
      },
      {
        id: "q2",
        question: "Which tree rotation fixes a Right-Left (RL) imbalance in an AVL tree?",
        options: [
          "Single Left rotation on root",
          "Single Right rotation on root",
          "Right rotation on right child, then Left rotation on root",
          "Left rotation on left child, then Right rotation on root",
        ],
        correctIndex: 2,
        explanation: "For an RL imbalance, the right child is heavy to the left, so rotate the right child to the right first (making it RR), then rotate the root left.",
        hint: "Align the crooked branch before rotating the root.",
      },
      {
        id: "q3",
        question: "In Dijkstra's algorithm, why must all edge weights be non-negative?",
        options: [
          "Negative weights make the graph disconnected",
          "A greedy choice once locked in could be invalidated by a later negative edge",
          "Computers cannot represent negative floating numbers",
          "It causes infinite memory allocation in priority queues",
        ],
        correctIndex: 1,
        explanation: "Dijkstra assumes that once a vertex is popped from the priority queue, its shortest distance is finalized. Negative edges violate this greedy invariant.",
        hint: "Think about the greedy assumption when pulling the min distance.",
      },
      {
        id: "q4",
        question: "What is the worst-case space complexity of Depth-First Search (DFS) on a tree of height h?",
        options: ["O(1)", "O(h)", "O(n²)", "O(2^h)"],
        correctIndex: 1,
        explanation: "DFS only holds the active branch in its recursion call stack at any moment, which is bounded by the height of the tree O(h).",
        hint: "Look at the maximum call stack depth.",
      },
      {
        id: "q5",
        question: "Which sorting algorithm is guaranteed to be stable and run in O(n log n) worst-case time?",
        options: ["QuickSort", "HeapSort", "MergeSort", "SelectionSort"],
        correctIndex: 2,
        explanation: "MergeSort guarantees O(n log n) worst-case time and preserves the relative order of duplicate elements (stable).",
        hint: "Classic divide and conquer.",
      },
    ],
  },
  {
    id: "quiz-bio",
    title: "Molecular Genetics & Cellular Respiration",
    topic: "Biology",
    difficulty: "Hard",
    bestScore: 100,
    timesTaken: 1,
    questions: [
      {
        id: "qb1",
        question: "Which molecule acts as the terminal electron acceptor in the mitochondrial electron transport chain?",
        options: ["Water (H₂O)", "NAD+", "Molecular Oxygen (O₂)", "Cytochrome c"],
        correctIndex: 2,
        explanation: "Oxygen (O₂) accepts 4 electrons and protons at Complex IV to form two water molecules, maintaining the proton gradient.",
        hint: "It's the very reason aerobic organisms breathe oxygen.",
      },
      {
        id: "qb2",
        question: "Under which cellular condition is the lac operon expressed at maximum transcription levels?",
        options: [
          "High Glucose, High Lactose",
          "High Glucose, Low Lactose",
          "Low Glucose, High Lactose",
          "Low Glucose, Low Lactose",
        ],
        correctIndex: 2,
        explanation: "Low glucose raises cAMP levels (activating the CAP activator protein), and high lactose produces allolactose to lift the repressor.",
        hint: "Needs both activator active and repressor removed.",
      },
      {
        id: "qb3",
        question: "During DNA replication, which enzyme removes RNA primers on the lagging strand in eukaryotes?",
        options: ["DNA Ligase", "RNase H and FEN1", "DNA Topoisomerase I", "Telomerase"],
        correctIndex: 1,
        explanation: "RNase H and Flap Endonuclease 1 (FEN1) remove the RNA primer flaps before DNA Polymerase $\\delta$ fills the gap.",
        hint: "Specialized endonucleases that degrade RNA fragments.",
      },
    ],
  },
];

export const INITIAL_COURSES: CourseGrade[] = [
  {
    id: "course-1",
    courseCode: "CS 201",
    courseName: "Data Structures & Algorithm Analysis",
    term: "Fall 2025",
    credits: 4,
    letterGrade: "A",
    numericGrade: 94,
    category: "Core",
    qualityPoints4: 16.0,
    qualityPoints10: 38.0,
  },
  {
    id: "course-2",
    courseCode: "MATH 240",
    courseName: "Linear Algebra & Matrix Computation",
    term: "Fall 2025",
    credits: 3,
    letterGrade: "A-",
    numericGrade: 88,
    category: "Core",
    qualityPoints4: 11.1,
    qualityPoints10: 25.5,
  },
  {
    id: "course-3",
    courseCode: "BIO 102",
    courseName: "Cellular & Molecular Biology",
    term: "Fall 2025",
    credits: 4,
    letterGrade: "A",
    numericGrade: 93,
    category: "Gen Ed",
    qualityPoints4: 16.0,
    qualityPoints10: 38.0,
  },
  {
    id: "course-4",
    courseCode: "CS 210",
    courseName: "Computer Systems & Assembly Architecture",
    term: "Spring 2026",
    credits: 4,
    letterGrade: "A",
    numericGrade: 96,
    category: "Core",
    qualityPoints4: 16.0,
    qualityPoints10: 38.0,
  },
  {
    id: "course-5",
    courseCode: "ECON 101",
    courseName: "Principles of Microeconomic Analysis",
    term: "Spring 2026",
    credits: 3,
    letterGrade: "B+",
    numericGrade: 84,
    category: "Gen Ed",
    qualityPoints4: 9.9,
    qualityPoints10: 24.0,
  },
  {
    id: "course-6",
    courseCode: "CS 280",
    courseName: "Software Engineering & Full-Stack Lab",
    term: "Spring 2026",
    credits: 2,
    letterGrade: "A+",
    numericGrade: 98,
    category: "Lab",
    qualityPoints4: 8.0,
    qualityPoints10: 20.0,
  },
];
