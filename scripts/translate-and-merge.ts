/**
 * scripts/translate-and-merge.ts
 *
 * Translates a small JSON file (English) via LLM, then merges it into
 * an existing processed exam dataset, deduplicating by content hash.
 *
 * Usage:
 *   tsx --env-file=.env scripts/translate-and-merge.ts <raw-file> <exam-id>
 *
 * Example:
 *   tsx --env-file=.env scripts/translate-and-merge.ts data/raw/SAA-C03-题库\ \(5\).json saa-c03
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const PROCESSED_DIR = path.join(process.cwd(), "data", "processed");

// ─── Types ───────────────────────────────────────────────────────────────────

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
  blocks?: RichBlock[];
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
    questionBlocks?: RichBlock[];
    questionText: string;
    choices: RawChoice[];
    correctAnswerBlocks?: RichBlock[];
    correctAnswerText: string;
    explanationBlocks?: RichBlock[];
    explanationText: string;
    studyTextSections?: { title: string; targetId: string; blocks: RichBlock[] }[];
    referenceUrls?: { title: string; url: string; absoluteUrl: string }[];
  };
  assets?: { type: string; src: string; absoluteSrc: string; dataSourceId: string; alt: string }[];
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
  _contentHash?: string; // for dedup
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function contentHash(q: RawQuestion): string {
  const text = q.content.questionText || "";
  const choiceTexts = q.content.choices.map((c) => c.text).join("|");
  return crypto.createHash("sha256").update(text + "||" + choiceTexts, "utf-8").digest("hex").slice(0, 16);
}

function textHash(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

function cloneBlock(b: RichBlock): RichBlock {
  return { ...b };
}

// ─── Build overlay (from scratch, no textZh) ────────────────────────────────

function buildOverlay(q: RawQuestion, translations: Record<string, string>): TranslationOverlay {
  const c = q.content;

  const questionText = translations[textHash(c.questionText)] || c.questionText;

  // questionBlocks: translate text blocks where possible
  const questionBlocks: RichBlock[] = (c.questionBlocks || []).map((b) =>
    b.type === "text" && b.text
      ? { type: "text" as const, text: translations[textHash(b.text)] || b.text }
      : cloneBlock(b),
  );
  // If no questionBlocks, create from questionText
  if (questionBlocks.length === 0 && c.questionText) {
    questionBlocks.push({ type: "text" as const, text: translations[textHash(c.questionText)] || c.questionText });
  }

  // choices
  const choices: TranslatedChoice[] = c.choices.map((ch) => {
    const translatedText = translations[textHash(ch.text)] || ch.text;
    const blocks = (ch.blocks || []).map((b) =>
      b.type === "text" && b.text
        ? { type: "text" as const, text: translations[textHash(b.text)] || b.text }
        : cloneBlock(b),
    );
    // If no choice blocks, create one from the choice text
    if (blocks.length === 0) {
      blocks.push({ type: "text" as const, text: translatedText });
    }
    return { no: ch.no, text: translatedText, blocks };
  });

  // correct answer
  const correctChoice = c.choices.find((ch) => ch.correct);
  const correctAnswerText = (correctChoice && translations[textHash(correctChoice.text)]) || c.correctAnswerText || "";
  const correctAnswerBlocks: RichBlock[] = correctChoice
    ? (correctChoice.blocks || []).map((b) =>
        b.type === "text" && b.text
          ? { type: "text" as const, text: translations[textHash(b.text)] || b.text }
          : cloneBlock(b),
      )
    : [];
  if (correctAnswerBlocks.length === 0 && correctAnswerText) {
    correctAnswerBlocks.push({ type: "text" as const, text: correctAnswerText });
  }

  // explanation
  const explanationText = translations[textHash(c.explanationText)] || c.explanationText || "";
  const explanationBlocks: RichBlock[] = (c.explanationBlocks || []).map((b) =>
    b.type === "text" && b.text
      ? { type: "text" as const, text: translations[textHash(b.text)] || b.text }
      : cloneBlock(b),
  );
  if (explanationBlocks.length === 0 && explanationText) {
    explanationBlocks.push({ type: "text" as const, text: explanationText });
  }

  // study text sections
  const studyTextSections = (c.studyTextSections || []).map((s) => ({
    title: translations[textHash(s.title)] || s.title,
    blocks: s.blocks.map((b) =>
      b.type === "text" && b.text
        ? { type: "text" as const, text: translations[textHash(b.text)] || b.text }
        : cloneBlock(b),
    ),
  }));

  return { zh: { questionText, questionBlocks, choices, correctAnswerText, correctAnswerBlocks, explanationText, explanationBlocks, studyTextSections } };
}

// ─── LLM Translation ─────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT =
  "You are a professional English-to-Simplified-Chinese translator " +
  "specializing in AWS certification exam content. " +
  "Translate the following English texts to Simplified Chinese. " +
  "Keep technical terms (AWS service names, feature names) in their original English form. " +
  "Output ONLY translations, one per line, matching the input order. " +
  "No explanations, no markdown, no extra text.";

async function translateRawQuestions(questions: RawQuestion[]): Promise<Record<string, string>> {
  // Collect all translatable texts
  const textSet = new Set<string>();
  for (const q of questions) {
    const c = q.content;
    if (c.questionText) textSet.add(c.questionText);
    for (const ch of c.choices) {
      if (ch.text) textSet.add(ch.text);
    }
    if (c.correctAnswerText) textSet.add(c.correctAnswerText);
    if (c.explanationText) textSet.add(c.explanationText);
    for (const s of c.studyTextSections || []) {
      if (s.title) textSet.add(s.title);
      for (const b of s.blocks) {
        if (b.type === "text" && b.text) textSet.add(b.text);
      }
    }
    for (const b of c.questionBlocks || []) {
      if (b.type === "text" && b.text) textSet.add(b.text);
    }
    for (const ch of c.choices) {
      for (const b of ch.blocks || []) {
        if (b.type === "text" && b.text) textSet.add(b.text);
      }
    }
    for (const b of c.explanationBlocks || []) {
      if (b.type === "text" && b.text) textSet.add(b.text);
    }
  }

  const texts = Array.from(textSet);
  console.log(`[merge] Found ${texts.length} unique text(s) to translate`);

  // Load translation cache
  const cachePath = path.join(process.cwd(), "data", "translations", "cache.json");
  let cache: Record<string, string> = {};
  try {
    cache = JSON.parse(await fs.readFile(cachePath, "utf-8"));
    console.log(`[merge] Loaded ${Object.keys(cache).length} cached translations`);
  } catch { /* no cache yet */ }

  // Check cache
  const uncached: { hash: string; text: string }[] = [];
  for (const text of texts) {
    const hash = textHash(text);
    if (cache[hash] === undefined) {
      uncached.push({ hash, text });
    }
  }

  if (uncached.length > 0) {
    console.log(`[merge] Translating ${uncached.length} uncached text(s) via LLM...`);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY required");

    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.LLM_MODEL || "gpt-4o-mini";
    const BATCH_SIZE = 30;

    for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
      const batch = uncached.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const total = Math.ceil(uncached.length / BATCH_SIZE);
      console.log(`  [translate] Batch ${batchNum}/${total} (${batch.length} texts)...`);

      const userContent = batch.map((b, idx) => `[${idx}] ${b.text}`).join("\n---\n");
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: DEFAULT_SYSTEM_PROMPT },
            { role: "user", content: `Translate these ${batch.length} English texts to Chinese:\n\n${userContent}` },
          ],
          temperature: 0.1,
        }),
      });
      if (!response.ok) throw new Error(`LLM API error: ${await response.text()}`);

      const data = (await response.json()) as any;
      const raw = data.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty LLM response");

      // Parse response
      const lines = raw.split("\n").filter((l: string) => l.trim()).filter((l: string) => !l.startsWith("```"));
      const parsed: string[] = [];
      for (const line of lines) {
        const match = line.match(/^\[(\d+)\]\s*(.*)/);
        if (match) parsed[parseInt(match[1])] = match[2].trim();
        else parsed.push(line.trim());
      }

      for (let j = 0; j < batch.length; j++) {
        cache[batch[j].hash] = parsed[j] || batch[j].text;
      }

      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
      console.log(`  [translate] ✅ Batch done — cache has ${Object.keys(cache).length} entries`);
    }
    console.log(`[merge] All translations complete`);
  } else {
    console.log(`[merge] All texts already cached — no API calls needed`);
  }

  return cache;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: tsx --env-file=.env scripts/translate-and-merge.ts <raw-file> [exam-id]");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const explicitExamId = args[1];

  // ── 1. Read new questions ──────────────────────────────────────────────
  const raw = await fs.readFile(inputPath, "utf-8");
  const newQuestions: RawQuestion[] = JSON.parse(raw);
  console.log(`[merge] Read ${newQuestions.length} new question(s) from ${path.basename(inputPath)}`);
  if (newQuestions.length === 0) { console.log("[merge] Nothing to do."); return; }

  // Determine exam ID
  const courseName = newQuestions[0]?.metadata?.course || "";
  const examId = explicitExamId || courseName.match(/\(([A-Z0-9]+-[A-Z0-9]+)\)/)?.[1]?.toLowerCase() || "unknown";
  console.log(`[merge] Target exam: ${examId}`);

  // ── 2. Compute content hashes for dedup ────────────────────────────────
  for (const q of newQuestions) {
    (q as any)._contentHash = contentHash(q);
  }

  // ── 3. Load existing processed data ────────────────────────────────────
  const processedPath = path.join(PROCESSED_DIR, `${examId}.json`);
  let existing: ProcessedQuestion[] = [];
  try {
    existing = JSON.parse(await fs.readFile(processedPath, "utf-8"));
    console.log(`[merge] Loaded ${existing.length} existing questions from ${examId}.json`);
  } catch {
    console.log(`[merge] No existing file for ${examId} — creating new`);
  }

  // ── 4. Dedup against existing content ──────────────────────────────────
  const existingHashes = new Set(existing.map((q) => (q as any)._contentHash || contentHash(q)));
  const trulyNew = newQuestions.filter((q) => !existingHashes.has((q as any)._contentHash));

  console.log(`[merge] ${trulyNew.length}/${newQuestions.length} questions are new (${newQuestions.length - trulyNew.length} duplicates skipped)`);

  if (trulyNew.length === 0) {
    console.log("[merge] Nothing new to add. Updating manifest...");
    const manifestPath = path.join(PROCESSED_DIR, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    const entry = manifest.exams.find((e: any) => e.id === examId);
    if (entry) {
      entry.questionCount = existing.length;
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    }
    console.log("[merge] Done.");
    return;
  }

  // ── 5. Translate ───────────────────────────────────────────────────────
  const translations = await translateRawQuestions(trulyNew);

  // ── 6. Build overlay ───────────────────────────────────────────────────
  const newProcessed: ProcessedQuestion[] = trulyNew.map((q) => {
    const overlay = buildOverlay(q, translations);
    const p: ProcessedQuestion = { ...q, translations: overlay, _contentHash: (q as any)._contentHash };
    return p;
  });

  // ── 7. Merge and write ─────────────────────────────────────────────────
  const merged = [...existing, ...newProcessed];
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.writeFile(processedPath, JSON.stringify(merged, null, 2), "utf-8");
  console.log(`[merge] Wrote ${merged.length} questions to ${examId}.json`);

  // ── 8. Update manifest ─────────────────────────────────────────────────
  const manifestPath = path.join(PROCESSED_DIR, "manifest.json");
  let manifest = { exams: [] as any[] };
  try { manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")); } catch {}
  const entry = manifest.exams.find((e: any) => e.id === examId);
  if (entry) {
    entry.questionCount = merged.length;
  } else {
    manifest.exams.push({ id: examId, displayName: examId.toUpperCase(), originalName: courseName, questionCount: merged.length, topics: [] });
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\n✅ Done!`);
  console.log(`   Existing: ${existing.length} → Merged: ${merged.length}`);
  console.log(`   Newly translated: ${newProcessed.length}`);
  console.log(`   Skipped (duplicate): ${newQuestions.length - trulyNew.length}`);
}

main().catch((err) => { console.error("[merge] Fatal:", err); process.exit(1); });
