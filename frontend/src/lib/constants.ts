export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const MAX_THOUGHT_LENGTH = 280;
export const MAX_RESOLUTION_LENGTH = 500;

export const CARDS_PER_PAGE = 15;

export const JWT_KEY = "echo_jwt";
export const JWT_EXPIRY_DAYS = 7;

// 3 phrases × 1200ms cycle = 3600ms = exactly 1 full phrase rotation
export const PROCESSING_MIN_DURATION_MS = 3600;
export const COUNT_ANIMATION_DURATION_MS = 1800;
export const CARD_STAGGER_DELAY_MS = 80;

export const RESOLUTION_PROMPT_WEEKS = 3;

/**
 * Minimum days between delayed opt-in prompts to prevent notification
 * fatigue. No more than one prompt per week is shown to the user.
 */
export const PROMPT_COOLDOWN_DAYS = 7;

export const PROCESSING_PHRASES = [
  "finding your people...",
  "you're not alone in this...",
  "others have been here too...",
] as const;

export const BREATHING_DURATION_S = 7;

export const MAX_FUTURE_LETTER_LENGTH = 400;

/**
 * Presence level thresholds: map aggregate weekly theme count to a
 * visual intensity level (0–4). Higher levels deepen the hue and
 * strengthen ripple visibility on the breathing animation.
 */
export const PRESENCE_THRESHOLDS = [
  { min: 0, level: 0 as const },
  { min: 10, level: 1 as const },
  { min: 50, level: 2 as const },
  { min: 200, level: 3 as const },
  { min: 500, level: 4 as const },
];

/**
 * Elastic similarity score bands for match strength labels.
 * Cosine similarity is normalized to 0–1 in Elasticsearch.
 */
export const MATCH_STRENGTH_BANDS = [
  { min: 0.9, label: "very close" as const },
  { min: 0.75, label: "close" as const },
  { min: 0.5, label: "same space" as const },
] as const;

export function getMatchStrengthLabel(score: number | undefined): string | null {
  if (score == null || score < MATCH_STRENGTH_BANDS[2].min) return null;
  for (const band of MATCH_STRENGTH_BANDS) {
    if (score >= band.min) return band.label;
  }
  return null;
}

/**
 * Risk-related theme categories that trigger the safety resource
 * banner. Entirely client-side — no logging of this event.
 */
export const RISK_THEMES: ReadonlySet<string> = new Set([
  "self_harm",
  "suicidal_ideation",
  "crisis",
  "substance_abuse",
  "eating_disorder",
  "abuse",
  "domestic_violence",
]);

/**
 * Client-side keyword patterns for inferring risk themes when the
 * backend is unavailable. Each entry maps a set of patterns to a
 * risk theme category. Patterns are tested case-insensitively
 * against the raw thought text.
 *
 * These are intentionally broad — false positives show a helpful
 * resource, false negatives are caught by the server-side classifier.
 */
export const RISK_KEYWORD_PATTERNS: {
  theme: string;
  patterns: RegExp[];
}[] = [
  {
    theme: "self_harm",
    patterns: [
      /\bhurt(ing)?\s*(my)?self\b/i,
      /\bcut(ting)?\s*(my)?self\b/i,
      /\bself[- ]?harm/i,
      /\bdon'?t\s+want\s+to\s+be\s+here\b/i,
      /\bwant\s+to\s+disappear\b/i,
      /\bwant\s+(it|everything)\s+to\s+(stop|end)\b/i,
    ],
  },
  {
    theme: "suicidal_ideation",
    patterns: [
      /\bsuicid/i,
      /\bkill(ing)?\s*(my)?self\b/i,
      /\bend\s+(my|it\s+all|this)\s*(life)?\b/i,
      /\bdon'?t\s+want\s+to\s+(live|exist|wake\s+up)\b/i,
      /\bbetter\s+off\s+(dead|without\s+me)\b/i,
      /\bno\s+(point|reason)\s+(in\s+)?(living|going\s+on)\b/i,
    ],
  },
  {
    theme: "crisis",
    patterns: [
      /\bin\s+crisis\b/i,
      /\bcan'?t\s+(go|keep)\s+on\b/i,
      /\bbreaking\s+point\b/i,
      /\bhelp\s+me\b/i,
      /\bno\s+way\s+out\b/i,
    ],
  },
  {
    theme: "substance_abuse",
    patterns: [
      /\baddiction\b/i,
      /\baddicted\b/i,
      /\bcan'?t\s+stop\s+drinking\b/i,
      /\bsubstance\s+abuse\b/i,
      /\boverdos/i,
      /\brelaps/i,
    ],
  },
  {
    theme: "eating_disorder",
    patterns: [
      /\beating\s+disorder\b/i,
      /\banorexi/i,
      /\bbulimi/i,
      /\bpurg(e|ing)\b/i,
      /\bstarving\s+(my)?self\b/i,
      /\bbinge\s+(eat|drink)/i,
    ],
  },
  {
    theme: "abuse",
    patterns: [
      /\b(being|gets?|got)\s+(hit|beaten|abused)\b/i,
      /\bhits?\s+me\b/i,
      /\bphysical(ly)?\s+abuse/i,
      /\bsexual(ly)?\s+abuse/i,
      /\bsexual\s+assault/i,
    ],
  },
  {
    theme: "domestic_violence",
    patterns: [
      /\bdomestic\s+violence\b/i,
      /\bpartner\s+(hits|hurts|abuses|threatens)\b/i,
      /\bafraid\s+of\s+(my\s+)?(partner|husband|wife|boyfriend|girlfriend)\b/i,
    ],
  },
];

/**
 * Infer a theme category from raw text using client-side keyword
 * matching. Returns the first matching risk theme, or the provided
 * fallback theme if no risk patterns match.
 */
export function inferThemeFromText(
  rawText: string,
  fallbackTheme: string = "self_worth"
): string {
  for (const { theme, patterns } of RISK_KEYWORD_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(rawText)) {
        return theme;
      }
    }
  }
  return fallbackTheme;
}

/**
 * Pre-seeded Future You letter for demo mode. Injected into
 * localStorage when the backend is unavailable and the user's
 * thought matches the "self_worth" theme.
 */
export const DEMO_FUTURE_LETTER = {
  message_id: "demo-seed-letter",
  theme_category: "self_worth",
  letter_text:
    "Hey — I know you're comparing yourself again. Remember last time? " +
    "It passed. You started writing down what you actually did well, and " +
    "the comparison lost its power. You're not behind. You're on your own path.",
  timestamp: Date.now() - 21 * 24 * 60 * 60 * 1000,
} as const;

export const SAFETY_RESOURCES = {
  heading: "You're not alone — and help is available",
  body: "If you or someone you know is in immediate danger, please reach out.",
  contacts: [
    { label: "Lifeline (AU)", value: "13 11 14", type: "phone" as const },
    { label: "Crisis Text Line", value: "Text HOME to 741741", type: "text" as const },
    { label: "Beyond Blue (AU)", value: "1300 22 4636", type: "phone" as const },
    { label: "International Association for Suicide Prevention", value: "https://www.iasp.info/resources/Crisis_Centres/", type: "url" as const },
  ],
} as const;

/**
 * Human-readable labels for theme categories. Used for "topics surrounding
 * the page" and any UI that shows theme names. Kept in sync with backend
 * theme categories.
 */
export const THEME_DISPLAY_LABELS: Record<string, string> = {
  work_stress: "work stress",
  anxiety: "anxiety",
  general_anxiety: "anxiety",
  loneliness: "loneliness",
  relationship_conflict: "relationship conflict",
  self_worth: "self worth",
  grief: "grief",
  family_pressure: "family pressure",
  burnout: "burnout",
  fear_of_failure: "fear of failure",
  social_anxiety: "social anxiety",
  comparison: "comparison",
  professional_worth: "professional worth",
  relationship_loss: "relationship loss",
  other: "other",
};

/** Topics for surrounding bubbles: theme key (API) + display label. Non-risk only. */
export const SURROUNDING_TOPICS: { themeKey: string; label: string }[] = [
  { themeKey: "work_stress", label: "work stress" },
  { themeKey: "anxiety", label: "anxiety" },
  { themeKey: "loneliness", label: "loneliness" },
  { themeKey: "relationship_conflict", label: "relationship conflict" },
  { themeKey: "self_worth", label: "self worth" },
  { themeKey: "grief", label: "grief" },
  { themeKey: "family_pressure", label: "family pressure" },
  { themeKey: "burnout", label: "burnout" },
  { themeKey: "fear_of_failure", label: "fear of failure" },
  { themeKey: "social_anxiety", label: "social anxiety" },
  { themeKey: "comparison", label: "comparison" },
];
