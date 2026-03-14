import { RISK_THEMES, THEME_DISPLAY_LABELS } from "./constants";

export interface QuietWin {
  theme: string;
  themeLabel: string;
  gapDays: number;
  previousMentions: number;
}

export interface QuietWinThought {
  theme_category: string;
  timestamp: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_QUIET_WIN_GAP_DAYS = 14;
const MIN_PREVIOUS_MENTIONS = 2;

export function findQuietWin(
  thoughts: QuietWinThought[],
  themeCategory: string,
  nowValue: number = Date.now()
): QuietWin | null {
  if (RISK_THEMES.has(themeCategory)) {
    return null;
  }

  const matchingThoughts = thoughts
    .filter((thought) => thought.theme_category === themeCategory)
    .sort((left, right) => right.timestamp - left.timestamp);

  if (matchingThoughts.length < MIN_PREVIOUS_MENTIONS) {
    return null;
  }

  const lastMention = matchingThoughts[0];
  const gapDays = Math.floor((nowValue - lastMention.timestamp) / DAY_MS);

  if (gapDays < MIN_QUIET_WIN_GAP_DAYS) {
    return null;
  }

  return {
    theme: themeCategory,
    themeLabel:
      THEME_DISPLAY_LABELS[themeCategory] ?? themeCategory.replace(/_/g, " "),
    gapDays,
    previousMentions: matchingThoughts.length,
  };
}
