/**
 * scripts/adapt-english.ts
 *
 * Adaptor for English-source AWS exam JSON files that already contain
 * Chinese translations (textZh / blocksZh / questionTextZh fields).
 *
 * Converts them into the standard ProcessedQuestion format with a
 * translations.zh overlay, so the frontend can display them identically
 * to LLM-translated data — without calling any API.
 *
 * Usage:
 *   tsx scripts/adapt-english.ts <input.json> [output-exam-id]
 *
 * Example:
 *   tsx scripts/adapt-english.ts data/raw/saa-exam.json saa-c03
 *
 * If output-exam-id is omitted, it is auto-extracted from metadata.course.
 * The output file is written to data/processed/{examId}.json
 * and manifest.json is updated.
 */

import fs from "node:fs/promises";
import path from "node:path";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "manifest.json");
const EXAM_CODE_REGEX = /\(([A-Z0-9]+-[A-Z0-9]+)\)/;

// ─── Types (matching the English-source format) ──────────────────────────────

interface RichBlock {
  type: "text" | "image" | "linebreak" | "link";
  text?: string;
  src?: string;
  absoluteSrc?: string;
  href?: string;
  absoluteHref?: string;
  alt?: string;
  className?: string;
}

interface RawChoice {
  no: number;
  inputType: "radio" | "checkbox";
  value: string;
  correct: boolean;
  checked: boolean;
  blocks: RichBlock[];
  text: string;
  // English-source extensions:
  textZh?: string;
  blocksZh?: RichBlock[];
}

interface RawQuestion {
  schemaVersion: string;
  source: { site: string; url: string; title: string; capturedAt: string };
  metadata: {
    course: string;
    mode: string;
    progress: string;
    questionId: string;
    questionType: "single" | "multiple";
    domain?: string;
    topic?: string;
  };
  content: {
    questionBlocks: RichBlock[];
    questionText: string;
    choices: RawChoice[];
    correctAnswerBlocks: RichBlock[];
    correctAnswerText: string;
    explanationBlocks: RichBlock[];
    explanationText: string;
    studyTextSections: {
      title: string;
      targetId: string;
      blocks: RichBlock[];
    }[];
    referenceUrls: { title: string; url: string; absoluteUrl: string }[];
    // English-source extensions:
    questionTextZh?: string;
    questionBlocksZh?: RichBlock[];
    topicReference?: string;
    reviewSummary?: Record<string, unknown>;
  };
  assets: { type: string; src: string; absoluteSrc: string; dataSourceId: string; alt: string }[];
}

// ─── Processed format types ──────────────────────────────────────────────────

interface TranslatedChoice {
  no: number;
  text: string;
  blocks: RichBlock[];
}

interface TranslationOverlay {
  zh: {
    questionText: string;
    questionBlocks: RichBlock[];
    choices: TranslatedChoice[];
    correctAnswerText: string;
    correctAnswerBlocks: RichBlock[];
    explanationText: string;
    explanationBlocks: RichBlock[];
    studyTextSections: { title: string; blocks: RichBlock[] }[];
  };
}

interface ProcessedQuestion extends Omit<RawQuestion, "content"> {
  content: RawQuestion["content"] & {
    reviewSummary?: Record<string, unknown>;
    topicReference?: string;
  };
  translations?: TranslationOverlay;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractExamCode(courseName: string): string | null {
  const match = courseName.match(EXAM_CODE_REGEX);
  return match ? match[1].toLowerCase() : null;
}

/** Safely clone a RichBlock, preserving all fields. */
function cloneBlock(b: RichBlock): RichBlock {
  return { ...b };
}

/**
 * Build a translations.zh overlay from the English-source data.
 * Falls back gracefully when Zh fields are missing.
 */
function buildTranslationOverlay(q: RawQuestion): TranslationOverlay {
  const c = q.content;

  // ── questionText ──────────────────────────────────────────────────────
  const questionText = c.questionTextZh || c.questionText || "";

  // ── questionBlocks ────────────────────────────────────────────────────
  const questionBlocks: RichBlock[] = c.questionBlocksZh
    ? c.questionBlocksZh.map(cloneBlock)
    : c.questionBlocks
        .map((b) =>
          b.type === "text" && c.questionTextZh
            ? { type: "text" as const, text: c.questionTextZh }
            : cloneBlock(b),
        )
        .filter((b) => b.type !== "linebreak" || true); // keep linebreaks

  // ── choices ───────────────────────────────────────────────────────────
  const choices: TranslatedChoice[] = c.choices.map((ch) => ({
    no: ch.no,
    text: ch.textZh || ch.text || "",
    blocks: ch.blocksZh
      ? ch.blocksZh.map(cloneBlock)
      : ch.blocks
          .map((b) =>
            b.type === "text" && ch.textZh
              ? { type: "text" as const, text: ch.textZh }
              : cloneBlock(b),
          )
          .filter((b) => b.type !== "linebreak" || true),
  }));

  // ── correctAnswerText ─────────────────────────────────────────────────
  // Derive from the correct choice's textZh; fallback to original
  const correctChoice = c.choices.find((ch) => ch.correct);
  const correctAnswerText = correctChoice?.textZh || c.correctAnswerText || "";

  // ── correctAnswerBlocks ────────────────────────────────────────────────
  const correctAnswerBlocks: RichBlock[] = correctChoice?.blocksZh
    ? correctChoice.blocksZh.map(cloneBlock)
    : correctChoice
      ? correctChoice.blocks
          .map((b) =>
            b.type === "text" && correctChoice.textZh
              ? { type: "text" as const, text: correctChoice.textZh }
              : b.type === "text"
                ? { type: "text" as const, text: correctChoice.text }
                : cloneBlock(b),
          )
          .filter((b) => b.type !== "linebreak" || true)
      : [];

  // ── explanationText ──────────────────────────────────────────────────
  // In the English-source data, explanationText is already in Chinese.
  const explanationText = c.explanationText || "";

  // ── explanationBlocks ─────────────────────────────────────────────────
  // Build a simple text block from the explanation text if no blocks exist.
  const explanationBlocks: RichBlock[] =
    c.explanationBlocks.length > 0
      ? c.explanationBlocks.map(cloneBlock)
      : explanationText
        ? [{ type: "text", text: explanationText }]
        : [];

  // ── studyTextSections ─────────────────────────────────────────────────
  // Copy sections as-is (titles are English, blocks may contain mixed content).
  // If the data had study section translations, we'd map them here.
  const studyTextSections = c.studyTextSections.map((s) => ({
    title: s.title,
    blocks: s.blocks.map(cloneBlock),
  }));

  return {
    zh: {
      questionText,
      questionBlocks,
      choices,
      correctAnswerText,
      correctAnswerBlocks,
      explanationText,
      explanationBlocks,
      studyTextSections,
    },
  };
}

/** Extract topics from study text sections. */
function extractTopics(q: RawQuestion): string[] {
  const topics = new Set<string>();
  for (const section of q.content.studyTextSections) {
    if (section.title) topics.add(section.title);
  }
  // Also check topicReference if present
  if (q.content.topicReference) {
    topics.add(q.content.topicReference);
  }
  return Array.from(topics).sort();
}

// ─── Manifest helpers ────────────────────────────────────────────────────────

async function loadManifest(): Promise<{ exams: any[] } | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function updateManifest(examId: string, displayName: string, originalName: string, questionCount: number, topics: string[]): Promise<void> {
  const manifest = await loadManifest() || { exams: [] };
  const idx = manifest.exams.findIndex((e: any) => e.id === examId);

  const entry = { id: examId, displayName, originalName, questionCount, topics };

  if (idx >= 0) {
    // Merge: keep existing order, update fields
    manifest.exams[idx] = { ...manifest.exams[idx], ...entry };
  } else {
    manifest.exams.push(entry);
  }

  manifest.exams.sort((a: any, b: any) => a.id.localeCompare(b.id));
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`[adapt] Manifest updated: ${examId} (${questionCount} questions)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: tsx scripts/adapt-english.ts <input.json> [output-exam-id]");
    console.error("       tsx scripts/adapt-english.ts data/raw/saa-exam.json saa-c03");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const explicitExamId = args[1]?.toLowerCase();

  // ── Read input ────────────────────────────────────────────────────────
  const raw = await fs.readFile(inputPath, "utf-8");
  const questions: RawQuestion[] = JSON.parse(raw);
  console.log(`[adapt] Read ${questions.length} question(s) from ${path.basename(inputPath)}`);

  if (questions.length === 0) {
    console.log("[adapt] No questions found. Exiting.");
    return;
  }

  // ── Determine exam ID ─────────────────────────────────────────────────
  const courseName = questions[0]?.metadata?.course || "";
  const examId = explicitExamId || extractExamCode(courseName) || "unknown";

  console.log(`[adapt] Exam: ${examId} (${courseName})`);

  // ── Build processed questions ─────────────────────────────────────────
  const displayName = examId.toUpperCase();
  let allTopics = new Set<string>();

  const processed: ProcessedQuestion[] = questions.map((q, i) => {
    const overlay = buildTranslationOverlay(q);
    const topics = extractTopics(q);
    topics.forEach((t) => allTopics.add(t));

    // Preserve all original fields, add translations overlay
    // and carry through any extra fields (reviewSummary, topicReference)
    const result: ProcessedQuestion = {
      ...q,
      content: {
        ...q.content,
        // Preserve extra fields
        ...(q.content.reviewSummary ? { reviewSummary: q.content.reviewSummary } : {}),
        ...(q.content.topicReference ? { topicReference: q.content.topicReference } : {}),
      },
    };

    // Attach translation overlay
    result.translations = overlay;

    // Verify integrity
    const hasQuestion = !!overlay.zh.questionText;
    const hasChoices = overlay.zh.choices.length > 0;
    const hasCorrect = !!overlay.zh.correctAnswerText;
    const hasExplanation = !!overlay.zh.explanationText;

    if (!hasQuestion || !hasChoices || !hasCorrect || !hasExplanation) {
      console.warn(
        `  ⚠️  Question ${i + 1} (id: ${q.metadata.questionId}): ` +
        `${hasQuestion ? "✓" : "✗"}text ${hasChoices ? "✓" : "✗"}choices ` +
        `${hasCorrect ? "✓" : "✗"}correct ${hasExplanation ? "✓" : "✗"}explanation`,
      );
    }

    return result;
  });

  // Log translation coverage summary
  const zhCount = processed.filter((q) => q.translations?.zh?.questionText).length;
  console.log(`[adapt] Translation coverage: ${zhCount}/${processed.length} questions have Chinese text`);

  // ── Write output ──────────────────────────────────────────────────────
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  const outputPath = path.join(PROCESSED_DIR, `${examId}.json`);
  await fs.writeFile(outputPath, JSON.stringify(processed, null, 2), "utf-8");
  console.log(`[adapt] Wrote ${outputPath} (${processed.length} questions)`);

  // ── Update manifest ───────────────────────────────────────────────────
  await updateManifest(examId, displayName, courseName, processed.length, Array.from(allTopics));

  // ── Summary ───────────────────────────────────────────────────────────
  const missingZh = processed.filter((q) => !q.translations?.zh?.questionText).length;
  if (missingZh > 0) {
    console.warn(`\n⚠️  ${missingZh} question(s) have no Chinese translation. ` +
      `The frontend will fall back to English for those.`);
  }

  console.log(`\n✅ Done! Processed ${processed.length} questions for ${examId}.`);
  console.log(`   Output: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`   Next: run "pnpm dev" or "pnpm build" to see the new exam in the app.`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("[adapt] Fatal error:", err);
  process.exit(1);
});
