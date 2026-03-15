/**
 * All backend API calls — single source of truth.
 *
 * PRIVACY: Raw thought text is sent in the request body over HTTPS.
 * The backend anonymises it immediately. We never persist it here.
 */

import type {
  AuthCredentials,
  AuthResponse,
  GraphData,
  PaginatedThoughts,
  PersonaConfig,
  ResolutionSubmit,
  ThoughtSubmitResult,
} from "./types";
import { API_BASE_URL, CARDS_PER_PAGE } from "./constants";
import { getJwt } from "./storage";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeaders(): HeadersInit {
  const token = getJwt();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let body: string;
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => ({}));
      body = json.detail ?? JSON.stringify(json);
    } else {
      body = await response.text().catch(() => "Unknown error");
    }
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

export async function submitThought(
  rawText: string,
  persona?: PersonaConfig
): Promise<ThoughtSubmitResult> {
  const response = await fetch(`${API_BASE_URL}/thoughts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text: rawText, persona }),
  });
  return handleResponse<ThoughtSubmitResult>(response);
}

export async function getSimilarThoughts(
  messageId: string,
  searchAfter?: string[]
): Promise<PaginatedThoughts> {
  const params = new URLSearchParams({
    message_id: messageId,
    size: String(CARDS_PER_PAGE),
  });
  if (searchAfter) {
    params.set("search_after", JSON.stringify(searchAfter));
  }
  const response = await fetch(
    `${API_BASE_URL}/thoughts/similar?${params.toString()}`,
    { headers: authHeaders() }
  );
  return handleResponse<PaginatedThoughts>(response);
}

/** Get a seed message_id for a theme (for use with getSimilarThoughts). */
export async function getSeedForTheme(
  theme: string
): Promise<{ message_id: string } | null> {
  const response = await fetch(
    `${API_BASE_URL}/thoughts/seed-for-theme?theme=${encodeURIComponent(theme)}`,
    { headers: authHeaders() }
  );
  if (response.status === 404) return null;
  return handleResponse<{ message_id: string }>(response);
}

export async function getThoughtsByTheme(
  theme: string,
  searchAfter?: string[]
): Promise<PaginatedThoughts> {
  const params = new URLSearchParams({
    theme,
    size: String(CARDS_PER_PAGE),
  });
  if (searchAfter) {
    params.set("search_after", JSON.stringify(searchAfter));
  }
  const response = await fetch(
    `${API_BASE_URL}/thoughts/by-theme?${params.toString()}`,
    { headers: authHeaders() }
  );
  return handleResponse<PaginatedThoughts>(response);
}

export async function submitResolution(
  data: ResolutionSubmit
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/resolution`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function getResolution(
  messageId: string
): Promise<{ resolution_text: string } | null> {
  const response = await fetch(`${API_BASE_URL}/resolution/${messageId}`, {
    headers: authHeaders(),
  });
  if (response.status === 404) return null;
  return handleResponse<{ resolution_text: string }>(response);
}

export async function register(
  credentials: AuthCredentials
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
}

export async function login(
  credentials: AuthCredentials
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
}

export async function refreshToken(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<AuthResponse>(response);
}

export async function deleteAccount(): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/account`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function deleteThoughtFromServer(messageId: string): Promise<{ deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/thoughts/${messageId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse<{ deleted: boolean }>(response);
}

export interface ThemeAggregate {
  theme: string;
  count: number;
  resolution_count: number;
  resolution_rate: number;
}

export interface ThemeAggregatesResult {
  items: ThemeAggregate[];
  isDemo: boolean;
}

export async function getThemeAggregates(): Promise<ThemeAggregatesResult> {
  const response = await fetch(`${API_BASE_URL}/thoughts/aggregates`, {
    headers: authHeaders(),
  });
  const isDemo = response.headers.get("x-echo-demo") === "true";
  const items = await handleResponse<ThemeAggregate[]>(response);
  return { items, isDemo };
}

export interface ThemeCountSummary {
  theme: string;
  count: number;
  resolution_count: number;
  resolution_rate: number;
}

export interface ThemeCountResult extends ThemeCountSummary {
  isDemo: boolean;
}

export async function getThemeCount(
  theme: string
): Promise<ThemeCountResult> {
  const response = await fetch(
    `${API_BASE_URL}/thoughts/count?theme=${encodeURIComponent(theme)}`,
    { headers: authHeaders() }
  );
  const isDemo = response.headers.get("x-echo-demo") === "true";
  const summary = await handleResponse<ThemeCountSummary>(response);
  return { ...summary, isDemo };
}

export async function getGraphData(): Promise<GraphData> {
  const response = await fetch(`${API_BASE_URL}/thoughts/graph`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  return handleResponse<GraphData>(response);
}

export async function getAnonymiserMode(): Promise<{ mode: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/anonymiser/mode`, {
    headers: authHeaders(),
  });
  return handleResponse<{ mode: string }>(response);
}

export async function setAnonymiserMode(mode: "ollama" | "nanogpt"): Promise<{ mode: string }> {
  const response = await fetch(`${API_BASE_URL}/admin/anonymiser/mode`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode }),
  });
  return handleResponse<{ mode: string }>(response);
}

export { ApiError };
