/**
 * localStorage helpers for Echo.
 *
 * PRIVACY INVARIANT: Raw thought text ONLY ever lives in this file.
 * No other module should read, write, or transmit raw thought text
 * except through these helpers — and only to/from localStorage.
 */

import type { LocalThought, FutureLetter, PresenceLevel } from "./types";
import { JWT_KEY, RESOLUTION_PROMPT_WEEKS, PRESENCE_THRESHOLDS } from "./constants";

const THOUGHTS_KEY = "echo_thoughts";
const ONBOARDING_KEY = "echo_onboarding_done";
const FUTURE_LETTERS_KEY = "echo_future_letters";

function readThoughts(): LocalThought[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THOUGHTS_KEY);
    return raw ? (JSON.parse(raw) as LocalThought[]) : [];
  } catch {
    return [];
  }
}

function writeThoughts(thoughts: LocalThought[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THOUGHTS_KEY, JSON.stringify(thoughts));
}

export function saveThought(
  messageId: string,
  rawText: string,
  themeCategory: string
): void {
  const thoughts = readThoughts();
  thoughts.unshift({
    message_id: messageId,
    raw_text: rawText,
    theme_category: themeCategory,
    timestamp: Date.now(),
    is_resolved: false,
  });
  writeThoughts(thoughts);
}

export function getThoughtHistory(): LocalThought[] {
  return readThoughts();
}

export function resolveThought(
  messageId: string,
  resolutionText: string
): void {
  const thoughts = readThoughts();
  const index = thoughts.findIndex((t) => t.message_id === messageId);
  if (index === -1) return;
  thoughts[index].is_resolved = true;
  thoughts[index].resolution_text = resolutionText;
  writeThoughts(thoughts);
}

export function deleteThought(messageId: string): void {
  const thoughts = readThoughts().filter((t) => t.message_id !== messageId);
  writeThoughts(thoughts);
}

export function getUnresolvedOlderThan(weeks: number): LocalThought[] {
  const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
  return readThoughts().filter(
    (t) => !t.is_resolved && t.timestamp < cutoff
  );
}

export function getPromptCandidates(): LocalThought[] {
  return getUnresolvedOlderThan(RESOLUTION_PROMPT_WEEKS);
}

export function getThemeCounts(): Record<string, number> {
  const thoughts = readThoughts();
  const counts: Record<string, number> = {};
  for (const t of thoughts) {
    counts[t.theme_category] = (counts[t.theme_category] ?? 0) + 1;
  }
  return counts;
}

export function getResolutionRate(): number {
  const thoughts = readThoughts();
  if (thoughts.length === 0) return 0;
  const resolved = thoughts.filter((t) => t.is_resolved).length;
  return resolved / thoughts.length;
}

export function getTotalThoughts(): number {
  return readThoughts().length;
}

export function getResolvedCount(): number {
  return readThoughts().filter((t) => t.is_resolved).length;
}

export function saveJwt(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JWT_KEY, token);
}

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JWT_KEY);
}

export function clearJwt(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JWT_KEY);
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(THOUGHTS_KEY);
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
  localStorage.removeItem(FUTURE_LETTERS_KEY);
}

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_KEY, "true");
}

/* ── Future You letters ── */

function readFutureLetters(): FutureLetter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FUTURE_LETTERS_KEY);
    return raw ? (JSON.parse(raw) as FutureLetter[]) : [];
  } catch {
    return [];
  }
}

function writeFutureLetters(letters: FutureLetter[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FUTURE_LETTERS_KEY, JSON.stringify(letters));
}

export function saveFutureLetter(
  messageId: string,
  themeCategory: string,
  letterText: string
): void {
  const letters = readFutureLetters();
  letters.unshift({
    message_id: messageId,
    theme_category: themeCategory,
    letter_text: letterText,
    timestamp: Date.now(),
  });
  writeFutureLetters(letters);
}

export function getFutureLettersForTheme(
  themeCategory: string
): FutureLetter[] {
  return readFutureLetters().filter(
    (letter) => letter.theme_category === themeCategory
  );
}

export function getAllFutureLetters(): FutureLetter[] {
  return readFutureLetters();
}

/* ── Presence level ── */

export function presenceLevelFromCount(count: number): PresenceLevel {
  let level: PresenceLevel = 0;
  for (const threshold of PRESENCE_THRESHOLDS) {
    if (count >= threshold.min) {
      level = threshold.level;
    }
  }
  return level;
}

export function getMostRecentTheme(): string | null {
  const thoughts = readThoughts();
  return thoughts.length > 0 ? thoughts[0].theme_category : null;
}
