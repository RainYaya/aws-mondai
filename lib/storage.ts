/**
 * lib/storage.ts
 *
 * localStorage helpers for quiz sessions, mistakes, bookmarks, and completed status.
 * All functions gracefully handle localStorage being unavailable (SSR, private browsing).
 * No React dependency — safe to import anywhere.
 */

import type { QuizSession } from "./quiz-engine";

// ─── Key factories ───────────────────────────────────────────────────────────

const SESSION_KEY = (examId: string) => `quiz-session/${examId}`;
const MISTAKES_KEY = (examId: string) => `mistakes/${examId}`;
const BOOKMARKS_KEY = (examId: string) => `bookmarks/${examId}`;
const COMPLETED_KEY = (examId: string) => `completed/${examId}`;

// ─── Safe localStorage access ────────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently fail, quiz continues in memory
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

// ─── Session persistence ─────────────────────────────────────────────────────

export function saveSession(examId: string, session: QuizSession): void {
  safeSet(SESSION_KEY(examId), session);
}

export function loadSession(examId: string): QuizSession | null {
  return safeGet<QuizSession | null>(SESSION_KEY(examId), null);
}

export function clearSession(examId: string): void {
  safeRemove(SESSION_KEY(examId));
}

export function hasUnfinishedSession(examId: string): boolean {
  const session = loadSession(examId);
  if (!session) return false;
  return session.completedAt === null;
}

// ─── Mistakes ────────────────────────────────────────────────────────────────

export function getMistakes(examId: string): string[] {
  return safeGet<string[]>(MISTAKES_KEY(examId), []);
}

export function addMistake(examId: string, questionId: string): void {
  const mistakes = getMistakes(examId);
  if (!mistakes.includes(questionId)) {
    mistakes.push(questionId);
    safeSet(MISTAKES_KEY(examId), mistakes);
  }
}

export function removeMistake(examId: string, questionId: string): void {
  const mistakes = getMistakes(examId).filter((id) => id !== questionId);
  safeSet(MISTAKES_KEY(examId), mistakes);
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export function getBookmarks(examId: string): string[] {
  return safeGet<string[]>(BOOKMARKS_KEY(examId), []);
}

export function isBookmarked(examId: string, questionId: string): boolean {
  return getBookmarks(examId).includes(questionId);
}

/**
 * Toggle bookmark state for a question. Returns the new state (true = bookmarked).
 */
export function toggleBookmark(examId: string, questionId: string): boolean {
  const bookmarks = getBookmarks(examId);
  const idx = bookmarks.indexOf(questionId);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    safeSet(BOOKMARKS_KEY(examId), bookmarks);
    return false;
  } else {
    bookmarks.push(questionId);
    safeSet(BOOKMARKS_KEY(examId), bookmarks);
    return true;
  }
}

// ─── Completed status (quiz history) ─────────────────────────────────────────

export function getCompleted(examId: string): string[] {
  return safeGet<string[]>(COMPLETED_KEY(examId), []);
}

export function markCompleted(examId: string, questionId: string): void {
  const completed = getCompleted(examId);
  if (!completed.includes(questionId)) {
    completed.push(questionId);
    safeSet(COMPLETED_KEY(examId), completed);
  }
}

/**
 * Get a map of questionId → result for all completed questions in this exam.
 * Used by browse mode to show quiz history indicators.
 */
export function getCompletedStatus(
  examId: string,
): Record<string, "correct" | "incorrect"> {
  // Derive status from the most recent completed session's answers
  const session = loadSession(examId);
  if (!session || !session.completedAt) return {};

  const status: Record<string, "correct" | "incorrect"> = {};
  for (const [qid, answer] of Object.entries(session.answers)) {
    status[qid] = answer.correct ? "correct" : "incorrect";
  }
  return status;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Clean up expired quiz sessions for the given exams.
 * Default max age: 7 days.
 */
export function cleanupStaleSessions(
  examIds: string[],
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
): void {
  const now = Date.now();
  for (const examId of examIds) {
    const session = loadSession(examId);
    if (session && now - session.lastActiveAt > maxAgeMs) {
      clearSession(examId);
    }
  }
}
