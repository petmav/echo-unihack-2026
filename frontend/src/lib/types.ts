export interface ThoughtResponse {
  message_id: string;
  humanised_text: string;
  theme_category: string;
  has_resolution: boolean;
  resolution_text?: string;
  /** Elastic similarity score (0-1). Used for match strength labels. */
  similarity_score?: number;
}

export interface ThoughtSubmitResult {
  message_id: string;
  anonymised_text: string;
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
  anonymised_text?: string;
  theme_category: string;
  timestamp: number;
  is_resolved: boolean;
  resolution_timestamp?: number;
  resolution_text?: string;
  future_letter?: string;
  /** Number of people who felt something like this (from search at submit time). */
  match_count?: number;
}

export interface FutureLetter {
  message_id: string;
  theme_category: string;
  letter_text: string;
  timestamp: number;
}

export interface SavedAnchor {
  message_id: string;
  theme_category: string;
  humanised_text: string;
  resolution_text: string;
  saved_at: number;
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

export interface GraphNode {
  message_id: string;
  humanised_text: string;
  theme_category: string;
  timestamp_week: string;
  has_resolution: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
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
  | "graph"
  | "account"
  | "about"
  | "privacy"
  | "admin";

export interface PersonaConfig {
  color: string;
  face: number;
  accessory: number;
}
