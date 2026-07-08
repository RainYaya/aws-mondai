/**
 * scripts/translate.ts
 *
 * Translation module for AWS Mondai data pipeline.
 *
 * Provides:
 * - SHA-256 based translation cache (data/translations/cache.json)
 * - OpenAI-compatible batch translation via LLM API
 * - Customizable system prompt via data/raw/prompt.txt
 *
 * Environment variables:
 *   OPENAI_API_KEY  - API key (required)
 *   OPENAI_BASE_URL - API base URL (default: https://api.openai.com/v1)
 *   LLM_MODEL       - Model name (default: gpt-4o-mini)
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PATH = path.join(process.cwd(), "data", "translations", "cache.json");
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_SYSTEM_PROMPT =
  "You are a professional Japanese-to-Simplified-Chinese translator " +
  "specializing in AWS certification exam content. " +
  "Translate the following Japanese texts to Simplified Chinese. " +
  "Keep technical terms (AWS service names, feature names) in their original English form. " +
  "Return your response as a JSON array of strings, one per input text in order. " +
  "No explanations, no markdown, no extra text — only the array.";

const MAX_BATCH_SIZE = 30; // texts per API call
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface TranslationCache {
  [sha256: string]: string;
}

let cache: TranslationCache = {};

export async function loadCache(): Promise<void> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
}

export async function saveCache(): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Core: batch translation
// ---------------------------------------------------------------------------

/**
 * Translate an array of Japanese text strings to Simplified Chinese.
 *
 * - Checks cache first; only uncached texts hit the API.
 * - Sends texts in batches of MAX_BATCH_SIZE.
 * - Returns translations in the same order as the input array.
 */
export async function translateAll(
  texts: string[],
  systemPromptOverride?: string,
): Promise<string[]> {
  // --- resolve texts to their SHA-256 hashes ---
  const items: { index: number; hash: string; text: string }[] = texts.map(
    (text, index) => ({
      index,
      hash: crypto.createHash("sha256").update(text, "utf-8").digest("hex"),
      text,
    }),
  );

  const results: string[] = new Array(texts.length);
  const uncached: typeof items = [];

  for (const item of items) {
    if (cache[item.hash] !== undefined) {
      results[item.index] = cache[item.hash];
    } else {
      uncached.push(item);
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  // --- batch uncached texts ---
  const systemPrompt = systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  for (let i = 0; i < uncached.length; i += MAX_BATCH_SIZE) {
    const batch = uncached.slice(i, i + MAX_BATCH_SIZE);
    const translations = await translateBatch(batch, systemPrompt);

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const translation = translations[j];
      cache[item.hash] = translation;
      results[item.index] = translation;
    }

    // Persist cache after each batch so partial progress is preserved
    await saveCache();
  }

  return results;
}

// ---------------------------------------------------------------------------
// Single API call for one batch
// ---------------------------------------------------------------------------

interface BatchItem {
  index: number;
  hash: string;
  text: string;
}

async function translateBatch(
  items: BatchItem[],
  systemPrompt: string,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required for translation",
    );
  }

  const baseUrl = process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  // Build a numbered list for the LLM
  const indexedLines = items
    .map((item, i) => `[${i}] ${item.text}`)
    .join("\n---\n");

  const messages = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "user" as const,
      content: `Translate the following ${items.length} Japanese text(s) to Simplified Chinese:\n\n${indexedLines}`,
    },
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `LLM API error (${response.status}): ${body.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const raw = data.choices[0]?.message?.content;
      if (!raw) {
        throw new Error("LLM returned empty response");
      }

      return parseBatchResponse(raw, items.length);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[translate] Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}. Retrying in ${RETRY_DELAY_MS}ms...`,
        );
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError ?? new Error("Translation failed after all retries");
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseBatchResponse(raw: string, expectedCount: number): string[] {
  const trimmed = raw.trim();

  // Strategy 1: Try to extract a JSON array (handles markdown-wrapped too)
  try {
    // Remove markdown code fences if present
    const cleaned = trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    // Find the first [ ... ] that spans the text
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length === expectedCount) {
        return parsed.map((s) => String(s));
      }
    }
  } catch {
    // Fall through
  }

  // Strategy 2: Try numbered-line parsing: [0] text, [1] text, etc.
  const results: string[] = [];
  const lines = trimmed.split("\n");

  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.*)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      results[idx] = match[2].trim();
    }
  }

  if (results.length === expectedCount && results.every((r) => r !== undefined)) {
    return results;
  }

  // Strategy 3: Try splitting by newlines if each line looks like a translation
  const nonEmptyLines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("[") && !l.startsWith("```"));
  if (nonEmptyLines.length === expectedCount) {
    return nonEmptyLines;
  }

  throw new Error(
    `Failed to parse LLM response into ${expectedCount} translations. ` +
      `Raw response (first 300 chars): ${trimmed.slice(0, 300)}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Standalone CLI usage
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await loadCache();

  // Read texts from stdin (one per line) or from args
  const texts = process.argv.slice(2);
  if (texts.length === 0) {
    console.error("Usage: tsx scripts/translate.ts <text1> <text2> ...");
    console.error("   or: cat texts.txt | tsx scripts/translate.ts");
    process.exit(1);
  }

  const results = await translateAll(texts);
  for (const t of results) {
    console.log(t);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Translation failed:", err);
    process.exit(1);
  });
}
