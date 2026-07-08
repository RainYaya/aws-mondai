/**
 * lib/quiz-engine.ts
 *
 * Quiz logic functions — no React or browser dependency.
 * Core functions operate with in-place mutation (copy in caller if needed).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizConfig {
  examId: string;
  questionIds: string[];
  mode: "original" | "random" | "mistakes";
  totalCount: number;
}

export interface Answer {
  questionId: string;
  selectedValues: string[]; // choice values selected by user (e.g. ["1"] or ["1","3"])
  correct: boolean;
}

export interface QuizSession {
  sessionId: string;
  config: QuizConfig;
  answers: Record<string, Answer>; // questionId → Answer
  currentIndex: number;
  startedAt: number; // Date.now()
  lastActiveAt: number;
  completedAt: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle (in-place, returns the same array reference).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Create a new quiz session from a pool of question IDs.
 */
export function createSession(
  questionIds: string[],
  count: number | "all",
  mode: "original" | "random" | "mistakes",
  examId?: string,
): QuizSession {
  if (questionIds.length === 0) {
    throw new Error("Cannot create a quiz session with an empty question pool.");
  }

  const selected = [...questionIds];

  if (mode === "random") {
    shuffle(selected);
  }

  const totalCount = count === "all" ? selected.length : Math.min(count, selected.length);
  const sliced = selected.slice(0, totalCount);

  const now = Date.now();

  return {
    sessionId: generateSessionId(),
    config: {
      examId: examId ?? "",
      questionIds: sliced,
      mode,
      totalCount: sliced.length,
    },
    answers: {},
    currentIndex: 0,
    startedAt: now,
    lastActiveAt: now,
    completedAt: null,
  };
}

/**
 * Check if the selected values match the correct values.
 * For single-choice: selectedValues[0] === correctValues[0].
 * For multiple-choice: strict set equality.
 */
export function checkAnswer(
  selectedValues: string[],
  correctValues: string[],
): boolean {
  if (selectedValues.length === 0) return false;
  if (correctValues.length === 0) return false;

  const sortedSelected = [...selectedValues].sort();
  const sortedCorrect = [...correctValues].sort();

  if (sortedSelected.length !== sortedCorrect.length) return false;
  return sortedSelected.every((v, i) => v === sortedCorrect[i]);
}

/**
 * Record an answer in the session (mutates in place, returns session).
 * Overwrites existing answer for the same questionId (allows changing answers).
 */
export function recordAnswer(
  session: QuizSession,
  questionId: string,
  selectedValues: string[],
  correctValues: string[],
): QuizSession {
  const correct = checkAnswer(selectedValues, correctValues);
  session.answers[questionId] = { questionId, selectedValues, correct };
  session.lastActiveAt = Date.now();
  return session;
}

/**
 * Get progress summary for the current session.
 */
export function getProgress(session: QuizSession): {
  current: number;
  total: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
} {
  const total = session.config.totalCount;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const qid of session.config.questionIds) {
    const answer = session.answers[qid];
    if (answer) {
      if (answer.correct) correctCount++;
      else incorrectCount++;
    }
  }

  return {
    current: session.currentIndex + 1,
    total,
    correctCount,
    incorrectCount,
    unansweredCount: total - correctCount - incorrectCount,
  };
}

/**
 * Get the full results array for a completed session.
 */
export function getResults(session: QuizSession): Array<{
  questionId: string;
  selectedValues: string[];
  correct: boolean;
}> {
  return session.config.questionIds.map((qid) => {
    const answer = session.answers[qid];
    return {
      questionId: qid,
      selectedValues: answer?.selectedValues ?? [],
      correct: answer?.correct ?? false,
    };
  });
}

/**
 * Check whether all questions have been answered.
 */
export function isSessionComplete(session: QuizSession): boolean {
  return session.config.questionIds.every((qid) => qid in session.answers);
}

/**
 * Check whether a session has expired (default: 7 days since last activity).
 */
export function isSessionExpired(
  session: QuizSession,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): boolean {
  return Date.now() - session.lastActiveAt > maxAgeMs;
}

/**
 * Navigate to a specific question index (clamped to valid range).
 */
export function navigateTo(session: QuizSession, index: number): QuizSession {
  session.currentIndex = Math.max(0, Math.min(index, session.config.totalCount - 1));
  session.lastActiveAt = Date.now();
  return session;
}

/**
 * Navigate forward or backward by a delta.
 */
export function navigateBy(session: QuizSession, delta: number): QuizSession {
  return navigateTo(session, session.currentIndex + delta);
}

/**
 * Mark the session as completed.
 */
export function completeSession(session: QuizSession): QuizSession {
  session.completedAt = Date.now();
  session.lastActiveAt = Date.now();
  return session;
}

/**
 * Get the set of correct choice values for a question.
 */
export function getCorrectValues(
  choiceValues: Array<{ value: string; correct: boolean }>,
): string[] {
  return choiceValues.filter((c) => c.correct).map((c) => c.value);
}
