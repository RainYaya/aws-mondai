"use client";

/**
 * components/question-detail-content.tsx
 *
 * Thin client wrapper around QuestionDisplay that injects the
 * current language preference from LanguageContext.
 *
 * This component exists because QuestionDisplay needs to re-render
 * when the user switches languages, which requires it to be under
 * the LanguageProvider context. The page itself is an SSG server
 * component, so this wrapper creates the required client boundary.
 */

import { useLanguage } from "@/lib/language-context";
import type { Question } from "@/lib/types";
import { QuestionDisplay } from "./question-display";

interface Props {
  question: Question;
}

export function QuestionDetailContent({ question }: Props) {
  const { lang } = useLanguage();

  return <QuestionDisplay question={question} lang={lang} />;
}
