/**
 * scripts/adapt-quiz-results.ts
 *
 * Adaptor for quiz_results_v2.json format (compact flat structure)
 * into the standard RawQuestion format.
 *
 * This format has:
 *   { number, question, options[{letter, text}], correctAnswer, explanation, category }
 *
 * Usage:
 *   tsx scripts/adapt-quiz-results.ts <input.json> [exam-id]
 *
 * Example:
 *   tsx scripts/adapt-quiz-results.ts data/raw/quiz_results_v2.json dea-c01
 */

import fs from "node:fs/promises";
import path from "node:path";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "manifest.json");

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizResultItem {
  number: number;
  question: string;
  options: { letter: string; text: string }[];
  result: string;
  correct: boolean;
  correctAnswer: string; // e.g. "D"
  explanation: string;
  category: string;
}

interface RichBlock {
  type: "text" | "image" | "linebreak" | "link";
  text?: string;
}

interface Choice {
  no: number;
  inputType: "radio" | "checkbox";
  value: string;
  correct: boolean;
  checked: boolean;
  blocks: RichBlock[];
  text: string;
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
  };
  content: {
    questionBlocks: RichBlock[];
    questionText: string;
    choices: Choice[];
    correctAnswerBlocks: RichBlock[];
    correctAnswerText: string;
    explanationBlocks: RichBlock[];
    explanationText: string;
    studyTextSections: { title: string; targetId: string; blocks: RichBlock[] }[];
    referenceUrls: { title: string; url: string; absoluteUrl: string }[];
  };
  assets: { type: string; src: string; absoluteSrc: string; dataSourceId: string; alt: string }[];
}

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

interface ProcessedQuestion extends RawQuestion {
  translations?: TranslationOverlay;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLetterValue(no: number, letter: string): string {
  // For consistency with English-source data format: "1-A", "1-B", etc.
  return `${no}-${letter}`;
}

function extractInnerText(category: string, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = category.match(new RegExp(`${escaped}\\s*[:\\s]+(.+)`, "i"));
  return match ? match[1].trim() : "";
}

// ─── Convert single item ─────────────────────────────────────────────────────

function convertItem(item: QuizResultItem, index: number): RawQuestion {
  const { number, question, options, correctAnswer, explanation, category } = item;

  const correctLetter = correctAnswer.trim().toUpperCase();
  const choiceArray: Choice[] = options.map((opt, i) => ({
    no: i + 1,
    inputType: "radio",
    value: toLetterValue(number, opt.letter),
    correct: opt.letter.toUpperCase() === correctLetter,
    checked: false,
    blocks: [{ type: "text", text: opt.text }],
    text: opt.text,
  }));

  // Pick the correct option's text for correctAnswerText
  const correctOption = options.find((o) => o.letter.toUpperCase() === correctLetter);
  const correctAnswerText = correctOption?.text || "";

  // Parse category into domain/topic
  const categoryParts = category.split("—").map((s) => s.trim());
  const domain = extractInnerText(category, "Category");
  const topic = extractInnerText(category, "Topics");

  return {
    schemaVersion: "1.1",
    source: {
      site: "quiz-results-v2",
      url: "",
      title: "",
      capturedAt: new Date().toISOString(),
    },
    metadata: {
      course: "AWS Data Engineer Associate (DEA-C01)", // guessed from "Aws De" prefix
      mode: "quiz",
      progress: "",
      questionId: String(number),
      questionType: "single",
    },
    content: {
      questionBlocks: [{ type: "text", text: question }],
      questionText: question,
      choices: choiceArray,
      correctAnswerBlocks: [{ type: "text", text: correctAnswerText }],
      correctAnswerText,
      explanationBlocks: explanation ? [{ type: "text", text: explanation }] : [],
      explanationText: explanation || "",
      studyTextSections: [],
      referenceUrls: [],
    },
    assets: [],
  };
}

// ─── Build translation overlay (empty zh — frontend falls back to English) ──

function buildEmptyOverlay(q: RawQuestion): TranslationOverlay {
  const c = q.content;
  return {
    zh: {
      questionText: c.questionText,
      questionBlocks: c.questionBlocks.map((b) => ({ ...b })),
      choices: c.choices.map((ch) => ({
        no: ch.no,
        text: ch.text,
        blocks: ch.blocks.map((b) => ({ ...b })),
      })),
      correctAnswerText: c.correctAnswerText,
      correctAnswerBlocks: c.correctAnswerBlocks.map((b) => ({ ...b })),
      explanationText: c.explanationText,
      explanationBlocks: c.explanationBlocks.map((b) => ({ ...b })),
      studyTextSections: [],
    },
  };
}

// ─── Extract topics ──────────────────────────────────────────────────────────

function extractTopics(items: QuizResultItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const topic = extractInnerText(item.category, "Topics");
    if (topic) {
      topic.split(",").forEach((t) => set.add(t.trim()));
    }
  }
  return Array.from(set).sort();
}

// ─── Manifest helpers ────────────────────────────────────────────────────────

async function updateManifest(examId: string, displayName: string, originalName: string, questionCount: number, topics: string[]): Promise<void> {
  let manifest: { exams: any[] } = { exams: [] };
  try { manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf-8")); } catch {}

  const idx = manifest.exams.findIndex((e: any) => e.id === examId);
  const entry = { id: examId, displayName, originalName, questionCount, topics };
  if (idx >= 0) manifest.exams[idx] = { ...manifest.exams[idx], ...entry };
  else manifest.exams.push(entry);
  manifest.exams.sort((a: any, b: any) => a.id.localeCompare(b.id));

  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`[adapt] Manifest updated: ${examId} (${questionCount} questions)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: tsx scripts/adapt-quiz-results.ts <input.json> [exam-id]");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const examId = args[1]?.toLowerCase() || "dea-c01";

  // ── Read ───────────────────────────────────────────────────────────────
  const raw = await fs.readFile(inputPath, "utf-8");
  const items: QuizResultItem[] = JSON.parse(raw);
  console.log(`[adapt] Read ${items.length} question(s)`);

  // ── Convert ─────────────────────────────────────────────────────────────
  const rawQuestions: RawQuestion[] = items.map((item, i) => convertItem(item, i));

  // Log coverage
  const withExplain = rawQuestions.filter((q) => q.content.explanationText).length;
  const withChoices = rawQuestions.filter((q) => q.content.choices.length > 0).length;
  console.log(`[adapt] Converted: ${rawQuestions.length} questions`);
  console.log(`[adapt]   - With explanation: ${withExplain}/${rawQuestions.length}`);
  console.log(`[adapt]   - With choices: ${withChoices}/${rawQuestions.length}`);

  // Verify each question has a correct answer marked
  const withCorrect = rawQuestions.filter((q) => q.content.choices.some((c) => c.correct));
  if (withCorrect.length < rawQuestions.length) {
    console.warn(`[adapt] ⚠️  ${rawQuestions.length - withCorrect.length} question(s) missing a correct answer`);
  }

  // ── Build processed with overlay ────────────────────────────────────────
  const processed: ProcessedQuestion[] = rawQuestions.map((q) => ({
    ...q,
    translations: buildEmptyOverlay(q),
  }));

  // ── Write ───────────────────────────────────────────────────────────────
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  const outputPath = path.join(PROCESSED_DIR, `${examId}.json`);
  await fs.writeFile(outputPath, JSON.stringify(processed, null, 2), "utf-8");
  console.log(`[adapt] Wrote ${outputPath} (${processed.length} questions)`);

  // ── Update manifest ─────────────────────────────────────────────────────
  const topics = extractTopics(items);
  await updateManifest(examId, examId.toUpperCase(), items[0]?.category || examId, processed.length, topics);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n✅ Done!`);
  console.log(`   Exam:  ${examId}`);
  console.log(`   Questions: ${processed.length}`);
  console.log(`   Topics: ${topics.length}`);
  console.log(`   Output: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`\n📝 Note: This data has no Chinese translation.`);
  console.log(`   To add Chinese, run:`);
  console.log(`   pnpm merge ${path.relative(process.cwd(), inputPath)} ${examId}`);
  console.log(`   (Will translate via LLM and overwrite this file)`);
}

main().catch((err) => {
  console.error("[adapt] Fatal:", err);
  process.exit(1);
});
