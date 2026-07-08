"use client";

/**
 * lib/quiz-context.tsx
 *
 * React Context + useReducer wrapping the quiz engine and storage layer.
 * Provides quiz state management scoped to a single exam.
 *
 * The session stores only questionIds; the full Question[] pool is loaded
 * separately and used for lookup at render time. This keeps localStorage
 * payloads small and clean.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Question } from "./types";
import type { QuizSession, Answer } from "./quiz-engine";
import {
  createSession,
  recordAnswer,
  getProgress,
  getResults,
  isSessionComplete,
  isSessionExpired,
  navigateTo,
  completeSession,
  getCorrectValues,
} from "./quiz-engine";
import {
  saveSession,
  loadSession,
  clearSession as clearStoredSession,
  addMistake,
  removeMistake,
  getMistakes,
  markCompleted,
  cleanupStaleSessions,
} from "./storage";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface QuizState {
  session: QuizSession | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
}

const initialState: QuizState = {
  session: null,
  questions: [],
  loading: true,
  error: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type QuizAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; questions: Question[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_SESSION"; session: QuizSession }
  | { type: "UPDATE_SESSION"; session: QuizSession }
  | { type: "CLEAR_SESSION" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, questions: action.questions };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SET_SESSION":
      return { ...state, session: action.session };
    case "UPDATE_SESSION":
      return { ...state, session: action.session };
    case "CLEAR_SESSION":
      return { ...state, session: null };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

export interface QuizContextValue {
  session: QuizSession | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  startSession: (config: {
    count: number | "all";
    mode: "original" | "random" | "mistakes";
  }) => string | null;
  submitAnswer: (selectedValues: string[]) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishSession: () => void;
  clearSession: () => void;

  currentQuestion: Question | null;
  currentAnswer: Answer | null;
  progress: {
    current: number;
    total: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
  };
  isComplete: boolean;
}

const QuizContext = createContext<QuizContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function QuizProvider({
  examId,
  children,
}: {
  examId: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const initialized = useRef(false);

  // Load questions + check for existing session on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      dispatch({ type: "LOAD_START" });

      try {
        const res = await fetch(`/data/${examId}.json`);
        if (!res.ok) throw new Error(`Failed to load exam data: ${res.status}`);
        const questions: Question[] = await res.json();
        dispatch({ type: "LOAD_SUCCESS", questions });

        // Clean up stale sessions
        cleanupStaleSessions([examId]);

        // Check for existing unfinished session
        const stored = loadSession(examId);
        if (stored && stored.completedAt === null && !isSessionExpired(stored)) {
          dispatch({ type: "SET_SESSION", session: stored });
        }
      } catch (err) {
        dispatch({
          type: "LOAD_ERROR",
          error: err instanceof Error ? err.message : "Failed to load exam data",
        });
      }

      setHydrated(true);
    }

    init();
  }, [examId]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const startSession = useCallback(
    (config: { count: number | "all"; mode: "original" | "random" | "mistakes" }): string | null => {
      let poolIds: string[];

      if (config.mode === "mistakes") {
        poolIds = getMistakes(examId);
        if (poolIds.length === 0) return null;
      } else {
        poolIds = state.questions.map((q) => q.metadata.questionId);
      }

      const session = createSession(poolIds, config.count, config.mode, examId);
      saveSession(examId, session);
      dispatch({ type: "SET_SESSION", session });
      return session.sessionId;
    },
    [examId, state.questions],
  );

  const submitAnswer = useCallback(
    (selectedValues: string[]) => {
      if (!state.session) return;
      const session = { ...state.session };
      const qid = session.config.questionIds[session.currentIndex];
      const question = state.questions.find(
        (q) => q.metadata.questionId === qid,
      );
      if (!question) return;

      const correctValues = getCorrectValues(question.content.choices);

      recordAnswer(session, qid, selectedValues, correctValues);

      // Update localStorage tracking
      const newAnswer = session.answers[qid];
      markCompleted(examId, qid);
      if (newAnswer.correct) {
        removeMistake(examId, qid);
      } else {
        addMistake(examId, qid);
      }

      saveSession(examId, session);
      dispatch({ type: "UPDATE_SESSION", session });
    },
    [examId, state.session, state.questions],
  );

  const goToQuestion = useCallback(
    (index: number) => {
      if (!state.session) return;
      const session = { ...state.session };
      navigateTo(session, index);
      saveSession(examId, session);
      dispatch({ type: "UPDATE_SESSION", session });
    },
    [examId, state.session],
  );

  const nextQuestion = useCallback(() => {
    if (!state.session) return;
    goToQuestion(state.session.currentIndex + 1);
  }, [state.session, goToQuestion]);

  const prevQuestion = useCallback(() => {
    if (!state.session) return;
    goToQuestion(state.session.currentIndex - 1);
  }, [state.session, goToQuestion]);

  const finishSession = useCallback(() => {
    if (!state.session) return;
    const session = { ...state.session };
    completeSession(session);
    saveSession(examId, session);
    dispatch({ type: "UPDATE_SESSION", session });
  }, [examId, state.session]);

  const clearSessionFn = useCallback(() => {
    clearStoredSession(examId);
    dispatch({ type: "CLEAR_SESSION" });
  }, [examId]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const currentQuestion = (() => {
    if (!state.session) return null;
    const qid = state.session.config.questionIds[state.session.currentIndex];
    return state.questions.find((q) => q.metadata.questionId === qid) ?? null;
  })();

  const currentAnswer = (() => {
    if (!state.session) return null;
    const qid = state.session.config.questionIds[state.session.currentIndex];
    return state.session.answers[qid] ?? null;
  })();

  const progress = state.session
    ? getProgress(state.session)
    : { current: 0, total: 0, correctCount: 0, incorrectCount: 0, unansweredCount: 0 };

  const isComplete = state.session ? isSessionComplete(state.session) : false;

  return (
    <QuizContext.Provider
      value={{
        session: state.session,
        questions: state.questions,
        loading: state.loading,
        error: state.error,
        hydrated,
        startSession,
        submitAnswer,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        finishSession,
        clearSession: clearSessionFn,
        currentQuestion,
        currentAnswer,
        progress,
        isComplete,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuiz(): QuizContextValue {
  const ctx = useContext(QuizContext);
  if (!ctx) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return ctx;
}
