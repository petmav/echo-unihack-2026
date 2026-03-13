export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const MAX_THOUGHT_LENGTH = 280;
export const MAX_RESOLUTION_LENGTH = 500;

export const CARDS_PER_PAGE = 15;

export const JWT_KEY = "echo_jwt";
export const JWT_EXPIRY_DAYS = 7;

export const PROCESSING_MIN_DURATION_MS = 2800;
export const COUNT_ANIMATION_DURATION_MS = 1800;
export const CARD_STAGGER_DELAY_MS = 80;

export const RESOLUTION_PROMPT_WEEKS = 3;

export const PROCESSING_PHRASES = [
  "finding your people...",
  "you're not alone in this...",
  "others have been here too...",
] as const;

export const BREATHING_DURATION_S = 7;
