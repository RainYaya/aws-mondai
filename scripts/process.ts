/**
 * scripts/process.ts
 *
 * Main data pipeline for AWS Mondai.
 *
 * End-to-end flow:
 *   data/raw/*.json  ──[merge+dedupe]──>  group by exam  ──[translate]──>
 *   data/processed/{examId}.json  +  data/processed/manifest.json
 *
 * Usage:
 *   npm run process
 *
 * Environment variables:
 *   OPENAI_API_KEY  - API key for translation (required if raw texts exist)
 *   OPENAI_BASE_URL - API base URL (default: https://api.openai.com/v1)
 *   LLM_MODEL       - Model to use (default: gpt-4o-mini)
 *
 * Optional config files in data/raw/:
 *   courses.json    - Override display names and ordering for exams
 *   prompt.txt      - Custom system prompt for translation
 */

import fs from "node:fs/promises";
import path from "node:path";
import { loadCache, saveCache, translateAll } from "./translate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A rich content block from ping-t.com */
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

/** A single answer choice in a question */
interface Choice {
  no: number;
  inputType: "radio" | "checkbox";
  value: string;
  correct: boolean;
  checked: boolean;
  blocks: RichBlock[];
  text: string;
}

/** A study material section */
interface StudySection {
  title: string;
  targetId: string;
  blocks: RichBlock[];
}

/** A reference URL */
interface ReferenceUrl {
  title: string;
  url: string;
  absoluteUrl: string;
}

/** Raw question as scraped from ping-t.com */
interface RawQuestion {
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
}

/** Translated overlay for choices */
interface TranslatedChoice {
  no: number;
  text: string;
  blocks: RichBlock[];
}

/** Translated overlay for study sections */
interface TranslatedStudySection {
  title: string;
  blocks: RichBlock[];
}

/** Translation overlay added to each processed question */
interface TranslationOverlay {
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

/** Processed question with translation overlay */
interface ProcessedQuestion extends RawQuestion {
  translations?: TranslationOverlay;
}

/** Manifest exam entry */
interface ManifestExam {
  id: string;
  displayName: string;
  originalName: string;
  questionCount: number;
  topics: string[];
}

/** Course config override from data/raw/courses.json */
interface CourseConfig {
  [examId: string]: {
    displayName?: string;
    order?: number;
  };
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const RAW_DIR = path.join(process.cwd(), "data", "raw");
const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");
const MANIFEST_PATH = path.join(PROCESSED_DIR, "manifest.json");
const COURSES_PATH = path.join(RAW_DIR, "courses.json");
const PROMPT_PATH = path.join(RAW_DIR, "prompt.txt");

// Exam code regex: extracts "CLF-C02" from "AWS クラウドプラクティショナー(CLF-C02)"
// Matches patterns like: CLF-C02, SAA-C03, DOP-C02, etc.
const EXAM_CODE_REGEX = /\(([A-Z0-9]+-[A-Z0-9]+)\)/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. Scan & Load
// ---------------------------------------------------------------------------

interface QuestionSource {
  file: string;
  questions: RawQuestion[];
}

async function scanRawFiles(): Promise<QuestionSource[]> {
  const entries = await fs.readdir(RAW_DIR, { withFileTypes: true });
  const jsonFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json") && e.name !== "courses.json")
    .map((e) => e.name);

  if (jsonFiles.length === 0) {
    console.warn("[process] No JSON files found in data/raw/");
    return [];
  }

  const sources: QuestionSource[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(RAW_DIR, file);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      sources.push({ file, questions: parsed as RawQuestion[] });
    } else {
      // Single object -> wrap in array
      sources.push({ file, questions: [parsed as RawQuestion] });
    }

    console.log(`[process] Loaded ${file}: ${sources[sources.length - 1].questions.length} questions`);
  }

  return sources;
}

// ---------------------------------------------------------------------------
// 2. Merge & Deduplicate
// ---------------------------------------------------------------------------

function mergeAndDedupe(sources: QuestionSource[]): RawQuestion[] {
  const seen = new Set<string>();
  const merged: RawQuestion[] = [];

  for (const source of sources) {
    for (const question of source.questions) {
      const id = question.metadata?.questionId;
      if (!id) {
        console.warn(`[process] Skipping question without questionId in ${source.file}`);
        continue;
      }
      if (seen.has(id)) {
        console.log(`[process] Duplicate question ${id} skipped (first occurrence kept)`);
        continue;
      }
      seen.add(id);
      merged.push(question);
    }
  }

  console.log(`[process] Merged ${sources.length} file(s) -> ${merged.length} unique questions`);
  return merged;
}

// ---------------------------------------------------------------------------
// 3. Group by Exam
// ---------------------------------------------------------------------------

interface ExamGroup {
  examId: string;
  displayName: string;
  questions: RawQuestion[];
}

function extractExamCode(courseName: string): string | null {
  const match = courseName.match(EXAM_CODE_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function groupByExam(questions: RawQuestion[]): ExamGroup[] {
  const groups = new Map<string, ExamGroup>();

  for (const q of questions) {
    const course = q.metadata?.course || "";
    const code = extractExamCode(course);
    if (!code) {
      console.warn(`[process] Could not extract exam code from course: "${course}" — question ${q.metadata?.questionId} will be placed in "unknown" group`);
    }
    const examId = code || "unknown";

    if (!groups.has(examId)) {
      groups.set(examId, {
        examId,
        displayName: course,
        questions: [],
      });
    }
    groups.get(examId)!.questions.push(q);
  }

  const result = Array.from(groups.values());
  for (const g of result) {
    console.log(`[process] Group "${g.examId}": ${g.questions.length} questions`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 4. Load optional configs
// ---------------------------------------------------------------------------

async function loadCourseConfig(): Promise<CourseConfig> {
  try {
    const raw = await fs.readFile(COURSES_PATH, "utf-8");
    return JSON.parse(raw) as CourseConfig;
  } catch {
    return {};
  }
}

async function loadCustomPrompt(): Promise<string | undefined> {
  try {
    return await fs.readFile(PROMPT_PATH, "utf-8");
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// 5. Extract texts for translation
// ---------------------------------------------------------------------------

interface TextMapping {
  /** Index in the flat texts array passed to translateAll */
  flatIndex: number;
  /** Path to place the translation back in the overlay */
  path: string;
  questionIndex: number;
  /** Optional: choice no for choice-level mapping */
  choiceNo?: number;
  /** Optional: study section index */
  sectionIndex?: number;
  /** Optional: block index within parent */
  blockIndex?: number;
  /** Whether this is a block-level text or a top-level text */
  isBlock: boolean;
  /** The original Japanese text */
  text: string;
}

/**
 * Extract all translatable text strings from a group of questions,
 * deduplicate them, and return both the unique texts array and
 * the mapping info to reconstruct the overlay.
 */
function prepareTextsForTranslation(
  questions: RawQuestion[],
): { uniqueTexts: string[]; mappings: TextMapping[] } {
  const textSet = new Map<string, TextMapping>(); // text -> mapping (keeps first occurrence)
  const mappings: TextMapping[] = [];

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const c = q.content;

    // --- questionBlocks ---
    for (let bi = 0; bi < c.questionBlocks.length; bi++) {
      const block = c.questionBlocks[bi];
      if (block.type === "text" && block.text) {
        mappings.push({
          flatIndex: -1, // assigned later
          path: "questionBlocks",
          questionIndex: qi,
          blockIndex: bi,
          isBlock: true,
          text: block.text,
        });
        if (!textSet.has(block.text)) {
          textSet.set(block.text, mappings[mappings.length - 1]);
        }
      }
    }

    // --- questionText ---
    if (c.questionText) {
      mappings.push({
        flatIndex: -1,
        path: "questionText",
        questionIndex: qi,
        isBlock: false,
        text: c.questionText,
      });
      if (!textSet.has(c.questionText)) {
        textSet.set(c.questionText, mappings[mappings.length - 1]);
      }
    }

    // --- choices ---
    for (let ci = 0; ci < c.choices.length; ci++) {
      const choice = c.choices[ci];
      if (choice.text) {
        mappings.push({
          flatIndex: -1,
          path: "choices",
          questionIndex: qi,
          choiceNo: choice.no,
          isBlock: false,
          text: choice.text,
        });
        if (!textSet.has(choice.text)) {
          textSet.set(choice.text, mappings[mappings.length - 1]);
        }
      }
      for (let bi = 0; bi < choice.blocks.length; bi++) {
        const block = choice.blocks[bi];
        if (block.type === "text" && block.text) {
          mappings.push({
            flatIndex: -1,
            path: "choiceBlocks",
            questionIndex: qi,
            choiceNo: choice.no,
            blockIndex: bi,
            isBlock: true,
            text: block.text,
          });
          if (!textSet.has(block.text)) {
            textSet.set(block.text, mappings[mappings.length - 1]);
          }
        }
      }
    }

    // --- correctAnswerText ---
    if (c.correctAnswerText) {
      mappings.push({
        flatIndex: -1,
        path: "correctAnswerText",
        questionIndex: qi,
        isBlock: false,
        text: c.correctAnswerText,
      });
      if (!textSet.has(c.correctAnswerText)) {
        textSet.set(c.correctAnswerText, mappings[mappings.length - 1]);
      }
    }

    // --- correctAnswerBlocks ---
    for (let bi = 0; bi < c.correctAnswerBlocks.length; bi++) {
      const block = c.correctAnswerBlocks[bi];
      if (block.type === "text" && block.text) {
        mappings.push({
          flatIndex: -1,
          path: "correctAnswerBlocks",
          questionIndex: qi,
          blockIndex: bi,
          isBlock: true,
          text: block.text,
        });
        if (!textSet.has(block.text)) {
          textSet.set(block.text, mappings[mappings.length - 1]);
        }
      }
    }

    // --- explanationText ---
    if (c.explanationText) {
      mappings.push({
        flatIndex: -1,
        path: "explanationText",
        questionIndex: qi,
        isBlock: false,
        text: c.explanationText,
      });
      if (!textSet.has(c.explanationText)) {
        textSet.set(c.explanationText, mappings[mappings.length - 1]);
      }
    }

    // --- explanationBlocks ---
    for (let bi = 0; bi < c.explanationBlocks.length; bi++) {
      const block = c.explanationBlocks[bi];
      if (block.type === "text" && block.text) {
        mappings.push({
          flatIndex: -1,
          path: "explanationBlocks",
          questionIndex: qi,
          blockIndex: bi,
          isBlock: true,
          text: block.text,
        });
        if (!textSet.has(block.text)) {
          textSet.set(block.text, mappings[mappings.length - 1]);
        }
      }
    }

    // --- studyTextSections ---
    for (let si = 0; si < c.studyTextSections.length; si++) {
      const section = c.studyTextSections[si];
      if (section.title) {
        mappings.push({
          flatIndex: -1,
          path: "studyTitles",
          questionIndex: qi,
          sectionIndex: si,
          isBlock: false,
          text: section.title,
        });
        if (!textSet.has(section.title)) {
          textSet.set(section.title, mappings[mappings.length - 1]);
        }
      }
      for (let bi = 0; bi < section.blocks.length; bi++) {
        const block = section.blocks[bi];
        if (block.type === "text" && block.text) {
          mappings.push({
            flatIndex: -1,
            path: "studyBlocks",
            questionIndex: qi,
            sectionIndex: si,
            blockIndex: bi,
            isBlock: true,
            text: block.text,
          });
          if (!textSet.has(block.text)) {
            textSet.set(block.text, mappings[mappings.length - 1]);
          }
        }
      }
    }
  }

  // Build unique texts array from the textSet (preserving first-seen order)
  const uniqueTexts: string[] = [];
  const textToFlatIndex = new Map<string, number>();

  for (const mapping of mappings) {
    if (!textToFlatIndex.has(mapping.text)) {
      textToFlatIndex.set(mapping.text, uniqueTexts.length);
      uniqueTexts.push(mapping.text);
    }
    mapping.flatIndex = textToFlatIndex.get(mapping.text)!;
  }

  console.log(
    `[process] Extracted ${mappings.length} text occurrences, ${uniqueTexts.length} unique texts for translation`,
  );

  return { uniqueTexts, mappings };
}

// ---------------------------------------------------------------------------
// 6. Build translation overlay
// ---------------------------------------------------------------------------

function buildTranslationOverlay(
  questions: RawQuestion[],
  mappings: TextMapping[],
  translations: string[],
): TranslationOverlay[] {
  const overlays: TranslationOverlay[] = questions.map((q) => {
    // Clone the content structure for the zh overlay.
    // Non-text blocks (image, linebreak, link) are preserved as-is.
    // Text blocks start with empty strings — only texts in |mappings|
    // (i.e. those that were translated) get filled in. Downstream code
    // can treat empty string as "use the original in content.*".
    const c = q.content;

    const cloneBlocks = (blocks: RichBlock[]): RichBlock[] =>
      blocks.map((b) =>
        b.type === "text" ? { type: "text" as const, text: "" } : { ...b },
      );

    return {
      zh: {
        questionText: "",
        questionBlocks: cloneBlocks(c.questionBlocks),
        choices: c.choices.map((ch) => ({
          no: ch.no,
          text: "",
          blocks: cloneBlocks(ch.blocks),
        })),
        correctAnswerText: "",
        correctAnswerBlocks: cloneBlocks(c.correctAnswerBlocks),
        explanationText: "",
        explanationBlocks: cloneBlocks(c.explanationBlocks),
        studyTextSections: c.studyTextSections.map((s) => ({
          title: "",
          blocks: cloneBlocks(s.blocks),
        })),
      },
    };
  });

  // Now overlay in the translated text values
  for (const mapping of mappings) {
    const tText = translations[mapping.flatIndex];
    if (tText === undefined || tText === null) continue;

    const overlay = overlays[mapping.questionIndex];

    switch (mapping.path) {
      case "questionText":
        overlay.zh.questionText = tText;
        break;

      case "questionBlocks":
        if (mapping.blockIndex !== undefined) {
          overlay.zh.questionBlocks[mapping.blockIndex] = {
            ...overlay.zh.questionBlocks[mapping.blockIndex],
            type: "text",
            text: tText,
          };
        }
        break;

      case "choices":
        if (mapping.choiceNo !== undefined) {
          const tc = overlay.zh.choices.find((c) => c.no === mapping.choiceNo);
          if (tc) tc.text = tText;
        }
        break;

      case "choiceBlocks":
        if (mapping.choiceNo !== undefined && mapping.blockIndex !== undefined) {
          const tc = overlay.zh.choices.find((c) => c.no === mapping.choiceNo);
          if (tc) {
            tc.blocks[mapping.blockIndex] = {
              ...tc.blocks[mapping.blockIndex],
              type: "text",
              text: tText,
            };
          }
        }
        break;

      case "correctAnswerText":
        overlay.zh.correctAnswerText = tText;
        break;

      case "correctAnswerBlocks":
        if (mapping.blockIndex !== undefined) {
          overlay.zh.correctAnswerBlocks[mapping.blockIndex] = {
            ...overlay.zh.correctAnswerBlocks[mapping.blockIndex],
            type: "text",
            text: tText,
          };
        }
        break;

      case "explanationText":
        overlay.zh.explanationText = tText;
        break;

      case "explanationBlocks":
        if (mapping.blockIndex !== undefined) {
          overlay.zh.explanationBlocks[mapping.blockIndex] = {
            ...overlay.zh.explanationBlocks[mapping.blockIndex],
            type: "text",
            text: tText,
          };
        }
        break;

      case "studyTitles":
        if (mapping.sectionIndex !== undefined) {
          const ts = overlay.zh.studyTextSections[mapping.sectionIndex];
          if (ts) ts.title = tText;
        }
        break;

      case "studyBlocks":
        if (mapping.sectionIndex !== undefined && mapping.blockIndex !== undefined) {
          const ts = overlay.zh.studyTextSections[mapping.sectionIndex];
          if (ts) {
            ts.blocks[mapping.blockIndex] = {
              ...ts.blocks[mapping.blockIndex],
              type: "text",
              text: tText,
            };
          }
        }
        break;
    }
  }

  return overlays;
}

// ---------------------------------------------------------------------------
// 7. Extract topics
// ---------------------------------------------------------------------------

function extractTopics(questions: RawQuestion[]): string[] {
  const topicSet = new Set<string>();
  for (const q of questions) {
    for (const section of q.content.studyTextSections) {
      if (section.title) {
        topicSet.add(section.title);
      }
    }
  }
  return Array.from(topicSet).sort();
}

// ---------------------------------------------------------------------------
// 8. Assemble & write processed outputs
// ---------------------------------------------------------------------------

function assembleProcessedQuestions(
  questions: RawQuestion[],
  overlays: TranslationOverlay[],
): ProcessedQuestion[] {
  if (overlays.length === 0) {
    // No translations — return questions without the optional translations key
    return questions as ProcessedQuestion[];
  }
  return questions.map((q, i) => ({
    ...q,
    translations: overlays[i],
  }));
}

async function writeProcessedFile(
  examId: string,
  questions: ProcessedQuestion[],
  courseConfig: CourseConfig,
): Promise<ManifestExam> {
  await fs.mkdir(PROCESSED_DIR, { recursive: true });

  const filePath = path.join(PROCESSED_DIR, `${examId}.json`);
  await fs.writeFile(filePath, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`[process] Wrote ${filePath} (${questions.length} questions)`);

  const topics = extractTopics(questions);

  const displayName =
    courseConfig[examId]?.displayName ||
    questions[0]?.metadata?.course ||
    examId;

  return {
    id: examId,
    displayName,
    originalName: questions[0]?.metadata?.course || examId,
    questionCount: questions.length,
    topics,
  };
}

async function writeManifest(exams: ManifestExam[], courseConfig: CourseConfig): Promise<void> {
  await fs.mkdir(PROCESSED_DIR, { recursive: true });

  // Sort by course config order, then by ID
  exams.sort((a, b) => {
    const orderA = courseConfig[a.id]?.order ?? 999;
    const orderB = courseConfig[b.id]?.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });

  const manifest = {
    exams,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`[process] Wrote ${MANIFEST_PATH}`);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("AWS Mondai Data Pipeline");
  console.log("=".repeat(60));

  // --- Load configs ---
  const courseConfig = await loadCourseConfig();
  const customPrompt = await loadCustomPrompt();

  if (Object.keys(courseConfig).length > 0) {
    console.log(`[process] Loaded course config with ${Object.keys(courseConfig).length} exam(s)`);
  }

  // --- Step 1: Scan raw files ---
  console.log("\n--- Step 1: Scanning raw files ---");
  const sources = await scanRawFiles();
  if (sources.length === 0) {
    console.log("[process] Nothing to process. Exiting.");
    return;
  }

  // --- Step 2: Merge & deduplicate ---
  console.log("\n--- Step 2: Merging & deduplicating ---");
  const allQuestions = mergeAndDedupe(sources);
  if (allQuestions.length === 0) {
    console.log("[process] No valid questions found. Exiting.");
    return;
  }

  // --- Step 3: Group by exam ---
  console.log("\n--- Step 3: Grouping by exam ---");
  const groups = groupByExam(allQuestions);

  // --- Step 4: Load translation cache ---
  console.log("\n--- Step 4: Loading translation cache ---");
  await loadCache();
  console.log("[process] Translation cache loaded.");

  // --- Step 5: Process each exam group ---
  console.log("\n--- Step 5: Translating & writing output ---");

  const manifestExams: ManifestExam[] = [];

  for (const group of groups) {
    console.log(`\n  Processing exam: ${group.examId} (${group.displayName})`);
    console.log(`  Questions: ${group.questions.length}`);

    // Prepare texts for translation
    const { uniqueTexts, mappings } = prepareTextsForTranslation(group.questions);

    if (uniqueTexts.length > 0 && process.env.OPENAI_API_KEY) {
      console.log(`  Translating ${uniqueTexts.length} unique text(s)...`);
      const translations = await translateAll(uniqueTexts, customPrompt);
      console.log(`  Translation complete.`);

      // Build overlay structure
      const overlays = buildTranslationOverlay(group.questions, mappings, translations);

      // Assemble and write
      const processed = assembleProcessedQuestions(group.questions, overlays);
      const manifest = await writeProcessedFile(group.examId, processed, courseConfig);
      manifestExams.push(manifest);
    } else {
      if (uniqueTexts.length > 0 && !process.env.OPENAI_API_KEY) {
        console.warn("  [SKIP] No OPENAI_API_KEY set — writing without translations.");
      }
      // Write questions without translation overlay
      const processed = assembleProcessedQuestions(group.questions, []);
      const manifest = await writeProcessedFile(group.examId, processed, courseConfig);
      manifestExams.push(manifest);
    }
  }

  // --- Step 6: Write manifest ---
  console.log("\n--- Step 6: Writing manifest ---");
  await writeManifest(manifestExams, courseConfig);

  // --- Done ---
  console.log("\n" + "=".repeat(60));
  console.log("Pipeline complete!");
  console.log(`  Processed ${groups.length} exam(s)`);
  console.log(`  Total questions: ${allQuestions.length}`);
  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("\n[process] Fatal error:", err);
  process.exit(1);
});
