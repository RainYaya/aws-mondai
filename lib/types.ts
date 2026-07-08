/**
 * lib/types.ts
 *
 * Shared TypeScript types for the frontend, matching the data pipeline output.
 */

// ─── Rich Content ───────────────────────────────────────────────────────────

export interface RichBlock {
  type: "text" | "image" | "linebreak" | "link";
  text?: string;
  src?: string;
  absoluteSrc?: string;
  href?: string;
  absoluteHref?: string;
  alt?: string;
  className?: string;
}

// ─── Choices ────────────────────────────────────────────────────────────────

export interface Choice {
  no: number;
  inputType: "radio" | "checkbox";
  value: string;
  correct: boolean;
  checked: boolean;
  blocks: RichBlock[];
  text: string;
}

// ─── Study Materials ────────────────────────────────────────────────────────

export interface StudySection {
  title: string;
  targetId: string;
  blocks: RichBlock[];
}

export interface ReferenceUrl {
  title: string;
  url: string;
  absoluteUrl: string;
}

// ─── Translation Overlay ────────────────────────────────────────────────────

export interface TranslatedChoice {
  no: number;
  text: string;
  blocks: RichBlock[];
}

export interface TranslatedStudySection {
  title: string;
  blocks: RichBlock[];
}

export interface TranslationOverlay {
  zh: {
    questionText: string;
    questionBlocks: RichBlock[];
    choices: TranslatedChoice[];
    correctAnswerText: string;
    correctAnswerBlocks: RichBlock[];
    explanationText: string;
    explanationBlocks: RichBlock[];
    studyTextSections: TranslatedStudySection[];
  };
}

// ─── Question ───────────────────────────────────────────────────────────────

export interface Question {
  schemaVersion: string;
  source: {
    site: string;
    url: string;
    title: string;
    capturedAt: string;
  };
  metadata: {
    course: string;
    mode: string;
    progress: string;
    questionId: string;
    questionType: "single" | "multiple";
  };
  content: {
    questionBlocks: RichBlock[];
    questionText: string;
    choices: Choice[];
    correctAnswerBlocks: RichBlock[];
    correctAnswerText: string;
    explanationBlocks: RichBlock[];
    explanationText: string;
    studyTextSections: StudySection[];
    referenceUrls: ReferenceUrl[];
  };
  assets: Array<{
    type: string;
    src: string;
    absoluteSrc: string;
    dataSourceId: string;
    alt: string;
  }>;
  translations?: TranslationOverlay;
}

// ─── Manifest ───────────────────────────────────────────────────────────────

export interface ManifestExam {
  id: string;
  displayName: string;
  originalName: string;
  questionCount: number;
  topics: string[];
}

export interface Manifest {
  exams: ManifestExam[];
  updatedAt: string;
}

// ─── Language Preference ────────────────────────────────────────────────────

export type LanguagePreference = "zh" | "ja" | "bilingual";
