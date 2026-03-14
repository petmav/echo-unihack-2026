/**
 * localStorage helpers for Echo.
 *
 * PRIVACY INVARIANT: Raw thought text ONLY ever lives in this file.
 * No other module should read, write, or transmit raw thought text
 * except through these helpers — and only to/from localStorage.
 *
 * Raw thoughts and future letters are stored encrypted (AES-GCM via crypto.ts).
 * Encrypted blobs are tagged with { v: 1, d: "<iv>:<ciphertext>" }.
 * If the encryption key is not yet initialised (e.g. SSR or demo mode),
 * reads return [] and writes fall back to plaintext so the app stays functional.
 * On first authenticated read of legacy plaintext data, we re-encrypt in place.
 */

import type { LocalThought, FutureLetter, PresenceLevel } from "./types";
import { JWT_KEY, RESOLUTION_PROMPT_WEEKS, PRESENCE_THRESHOLDS, PROMPT_COOLDOWN_DAYS } from "./constants";
import { getKey, encrypt, decrypt } from "./crypto";

const THOUGHTS_KEY = "echo_thoughts";
const ONBOARDING_KEY = "echo_onboarding_done";
const FUTURE_LETTERS_KEY = "echo_future_letters";
const NOTIFICATION_OPT_IN_KEY = "echo_notification_opt_in";
const LAST_PROMPT_DATE_KEY = "echo_last_prompt_date";
const ADMIN_STATUS_KEY = "echo_is_admin";

/** Shape stored for encrypted blobs */
interface EncryptedBlob {
  v: 1;
  d: string; // <iv>:<ciphertext> produced by encrypt()
}

function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)["v"] === 1 &&
    typeof (value as Record<string, unknown>)["d"] === "string"
  );
}

/* ── Thoughts ── */

async function readThoughts(): Promise<LocalThought[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THOUGHTS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (isEncryptedBlob(parsed)) {
      // Encrypted path — key must be available
      const key = getKey();
      if (!key) return []; // logged-out or pre-auth — cannot decrypt
      const plaintext = await decrypt(parsed.d);
      return JSON.parse(plaintext) as LocalThought[];
    }

    // Legacy plaintext path — migrate to encrypted storage if key is ready
    const thoughts = parsed as LocalThought[];
    if (getKey()) {
      // Re-encrypt silently — best-effort, don't block the read
      writeThoughts(thoughts).catch(() => {
        /* migration failure is non-fatal */
      });
    }
    return thoughts;
  } catch {
    return [];
  }
}

async function writeThoughts(thoughts: LocalThought[]): Promise<void> {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(thoughts);
  if (getKey()) {
    const blob: EncryptedBlob = { v: 1, d: await encrypt(json) };
    localStorage.setItem(THOUGHTS_KEY, JSON.stringify(blob));
  } else {
    // Key not ready (demo/SSR) — store plaintext so app stays functional
    localStorage.setItem(THOUGHTS_KEY, json);
  }
}

export async function saveThought(
  messageId: string,
  rawText: string,
  themeCategory: string,
  matchCount?: number
): Promise<void> {
  const thoughts = await readThoughts();
  thoughts.unshift({
    message_id: messageId,
    raw_text: rawText,
    theme_category: themeCategory,
    timestamp: Date.now(),
    is_resolved: false,
    match_count: matchCount,
  });
  await writeThoughts(thoughts);
}

export async function getThoughtHistory(): Promise<LocalThought[]> {
  return readThoughts();
}

export async function resolveThought(
  messageId: string,
  resolutionText: string
): Promise<void> {
  const thoughts = await readThoughts();
  const index = thoughts.findIndex((t) => t.message_id === messageId);
  if (index === -1) return;
  thoughts[index].is_resolved = true;
  thoughts[index].resolution_text = resolutionText;
  await writeThoughts(thoughts);
}

export async function deleteThought(messageId: string): Promise<void> {
  const thoughts = (await readThoughts()).filter(
    (t) => t.message_id !== messageId
  );
  await writeThoughts(thoughts);
}

export async function getUnresolvedOlderThan(
  weeks: number
): Promise<LocalThought[]> {
  const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
  return (await readThoughts()).filter(
    (t) => !t.is_resolved && t.timestamp < cutoff
  );
}

export async function getPromptCandidates(): Promise<LocalThought[]> {
  return getUnresolvedOlderThan(RESOLUTION_PROMPT_WEEKS);
}

export async function getThemeCounts(): Promise<Record<string, number>> {
  const thoughts = await readThoughts();
  const counts: Record<string, number> = {};
  for (const t of thoughts) {
    counts[t.theme_category] = (counts[t.theme_category] ?? 0) + 1;
  }
  return counts;
}

export async function getResolutionRate(): Promise<number> {
  const thoughts = await readThoughts();
  if (thoughts.length === 0) return 0;
  const resolved = thoughts.filter((t) => t.is_resolved).length;
  return resolved / thoughts.length;
}

export async function getTotalThoughts(): Promise<number> {
  return (await readThoughts()).length;
}

export async function getResolvedCount(): Promise<number> {
  return (await readThoughts()).filter((t) => t.is_resolved).length;
}

export async function getMostRecentTheme(): Promise<string | null> {
  const thoughts = await readThoughts();
  return thoughts.length > 0 ? thoughts[0].theme_category : null;
}

/* ── Notification opt-in (sync — stores a simple boolean flag) ── */

export function getNotificationOptIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATION_OPT_IN_KEY) === "true";
}

export function setNotificationOptIn(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_OPT_IN_KEY, enabled ? "true" : "false");
}

/* ── Delayed prompt helpers ── */

/**
 * Record the timestamp of the most-recent delayed prompt display so
 * we can enforce the PROMPT_COOLDOWN_DAYS cooldown.
 */
export function setLastPromptDate(timestamp: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_PROMPT_DATE_KEY, String(timestamp));
}

function getLastPromptDate(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(LAST_PROMPT_DATE_KEY);
  return raw ? Number(raw) : 0;
}

/**
 * Return the first unresolved thought older than RESOLUTION_PROMPT_WEEKS
 * weeks, or null if none exists or the prompt cooldown has not elapsed.
 *
 * This is intentionally synchronous — it reads from the already-hydrated
 * in-memory state represented by localStorage — but because readThoughts()
 * is async we expose a separate async variant used at startup, and a
 * lightweight sync helper that operates on a pre-loaded snapshot when
 * called on the home screen after hydration.
 *
 * Note: page.tsx calls this after the thought history has been loaded into
 * React state, but to avoid a race we provide a standalone async version.
 */
export async function getNextPromptCandidate(): Promise<LocalThought | null> {
  const lastPrompt = getLastPromptDate();
  const cooldownMs = PROMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  if (lastPrompt > 0 && Date.now() - lastPrompt < cooldownMs) {
    return null;
  }

  const candidates = await getPromptCandidates();
  return candidates.length > 0 ? candidates[0] : null;
}

/* ── JWT / Onboarding (no sensitive text — remain sync) ── */

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
  localStorage.removeItem(NOTIFICATION_OPT_IN_KEY);
  localStorage.removeItem(LAST_PROMPT_DATE_KEY);
  localStorage.removeItem(ADMIN_STATUS_KEY);
}

/* ── Admin status (sync — simple boolean flag) ── */

export function saveAdminStatus(isAdmin: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_STATUS_KEY, isAdmin ? "true" : "false");
}

export function getAdminStatus(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_STATUS_KEY) === "true";
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

async function readFutureLetters(): Promise<FutureLetter[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FUTURE_LETTERS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (isEncryptedBlob(parsed)) {
      const key = getKey();
      if (!key) return [];
      const plaintext = await decrypt(parsed.d);
      return JSON.parse(plaintext) as FutureLetter[];
    }

    // Legacy plaintext path — migrate if key is ready
    const letters = parsed as FutureLetter[];
    if (getKey()) {
      writeFutureLetters(letters).catch(() => {
        /* migration failure is non-fatal */
      });
    }
    return letters;
  } catch {
    return [];
  }
}

async function writeFutureLetters(letters: FutureLetter[]): Promise<void> {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(letters);
  if (getKey()) {
    const blob: EncryptedBlob = { v: 1, d: await encrypt(json) };
    localStorage.setItem(FUTURE_LETTERS_KEY, JSON.stringify(blob));
  } else {
    localStorage.setItem(FUTURE_LETTERS_KEY, json);
  }
}

export async function saveFutureLetter(
  messageId: string,
  themeCategory: string,
  letterText: string
): Promise<void> {
  const letters = await readFutureLetters();
  letters.unshift({
    message_id: messageId,
    theme_category: themeCategory,
    letter_text: letterText,
    timestamp: Date.now(),
  });
  await writeFutureLetters(letters);
}

export async function getFutureLettersForTheme(
  themeCategory: string
): Promise<FutureLetter[]> {
  return (await readFutureLetters()).filter(
    (letter) => letter.theme_category === themeCategory
  );
}

export async function getAllFutureLetters(): Promise<FutureLetter[]> {
  return readFutureLetters();
}

/* ── Presence level (pure computation — remains sync) ── */

export function presenceLevelFromCount(count: number): PresenceLevel {
  let level: PresenceLevel = 0;
  for (const threshold of PRESENCE_THRESHOLDS) {
    if (count >= threshold.min) {
      level = threshold.level;
    }
  }
  return level;
}
