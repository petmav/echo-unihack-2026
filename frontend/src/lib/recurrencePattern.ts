import { RISK_THEMES, THEME_DISPLAY_LABELS } from "./constants";

export interface RecurrencePattern {
  theme: string;
  themeLabel: string;
  mentionsInWindow: number;
  windowDays: number;
  lastMentionDaysAgo: number;
}

export interface RecurrencePatternThought {
  theme_category: string;
  timestamp: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECURRENCE_WINDOW_DAYS = 14;
const MIN_RECENT_PRIOR_MENTIONS = 2;

export function findRecurrencePattern(
  thoughts: RecurrencePatternThought[],
  themeCategory: string,
  nowValue: number = Date.now()
): RecurrencePattern | null {
  if (RISK_THEMES.has(themeCategory)) {
    return null;
  }

  const cutoff = nowValue - RECURRENCE_WINDOW_DAYS * DAY_MS;
  const recentMatches = thoughts
    .filter(
      (thought) =>
        thought.theme_category === themeCategory && thought.timestamp >= cutoff
    )
    .sort((left, right) => right.timestamp - left.timestamp);

  if (recentMatches.length < MIN_RECENT_PRIOR_MENTIONS) {
    return null;
  }

  const lastMention = recentMatches[0];
  const lastMentionDaysAgo = Math.floor((nowValue - lastMention.timestamp) / DAY_MS);

  return {
    theme: themeCategory,
    themeLabel:
      THEME_DISPLAY_LABELS[themeCategory] ?? themeCategory.replace(/_/g, " "),
    mentionsInWindow: recentMatches.length + 1,
    windowDays: RECURRENCE_WINDOW_DAYS,
    lastMentionDaysAgo,
  };
}
