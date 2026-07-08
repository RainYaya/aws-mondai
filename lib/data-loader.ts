/**
 * lib/data-loader.ts
 *
 * Shared data-loading helpers for SSG pages.
 * Reads processed JSON files directly from data/processed/ at build time.
 */

import fs from "node:fs";
import path from "node:path";
import type { Manifest, ManifestExam, Question } from "./types";

/**
 * Load the manifest file that lists all available exams.
 * Returns null if the file doesn't exist (e.g., pipeline not run yet).
 */
export function loadManifest(): Manifest | null {
  try {
    const filePath = path.join(process.cwd(), "data", "processed", "manifest.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Load all questions for a given exam.
 * Returns null if the exam file doesn't exist.
 */
export function loadExamQuestions(examId: string): Question[] | null {
  try {
    const filePath = path.join(process.cwd(), "data", "processed", `${examId}.json`);
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Question[];
  } catch {
    return null;
  }
}

/**
 * Find a single exam's metadata from the manifest.
 */
export function findExamMeta(
  examId: string,
  manifest: Manifest,
): ManifestExam | undefined {
  return manifest.exams.find((e) => e.id === examId);
}
