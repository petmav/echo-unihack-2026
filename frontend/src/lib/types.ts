export interface ThoughtResponse {
  message_id: string;
  humanised_text: string;
  theme_category: string;
  has_resolution: boolean;
  resolution_text?: string;
}

export interface ThoughtSubmitResult {
  message_id: string;
  theme_category: string;
  match_count: number;
  similar_thoughts: ThoughtResponse[];
  search_after?: string[];
}

export interface PaginatedThoughts {
  thoughts: ThoughtResponse[];
  search_after?: string[];
  total: number;
}

export interface LocalThought {
  message_id: string;
  raw_text: string;
  theme_category: string;
  timestamp: number;
  is_resolved: boolean;
  resolution_text?: string;
  future_letter?: string;
}

export interface FutureLetter {
  message_id: string;
  theme_category: string;
  letter_text: string;
  timestamp: number;
}

export interface ThemePresence {
  theme: string;
  count: number;
  level: PresenceLevel;
}

export type PresenceLevel = 0 | 1 | 2 | 3 | 4;

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  is_admin?: boolean;
}

export interface ResolutionSubmit {
  message_id: string;
  resolution_text: string;
}

export type AppScreen =
  | "onboarding"
  | "auth"
  | "home"
  | "processing"
  | "results"
  | "topic"
  | "thoughts"
  | "trends"
  | "account"
  | "about"
  | "privacy"
  | "admin";
