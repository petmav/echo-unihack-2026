"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Cpu, Cloud, RefreshCw } from "lucide-react";
import { getAnonymiserMode, setAnonymiserMode, ApiError } from "@/lib/api";

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [mode, setMode] = useState<"ollama" | "nanogpt" | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAnonymiserMode();
      setMode(result.mode as "ollama" | "nanogpt");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Admin access required.");
      } else {
        setError("Could not load anonymiser status.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMode();
  }, [fetchMode]);

  const handleSwitch = useCallback(
    async (target: "ollama" | "nanogpt") => {
      if (switching || target === mode) return;
      setSwitching(true);
      setError(null);
      try {
        const result = await setAnonymiserMode(target);
        setMode(result.mode as "ollama" | "nanogpt");
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setError("Admin access required.");
        } else {
          setError("Failed to switch mode. Please try again.");
        }
      } finally {
        setSwitching(false);
      }
    },
    [mode, switching]
  );

  return (
    <div className="flex h-full flex-col bg-echo-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5 active:scale-[0.92]"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-serif text-lg font-normal text-echo-text">Admin</h2>
          <p className="text-[11px] font-light text-echo-text-muted tracking-wide">
            Pipeline configuration
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Anonymiser section */}
        <div className="mt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[2px] text-echo-text-muted">
            Anonymiser backend
          </p>

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-echo-bg-warm px-4 py-4">
              <RefreshCw size={14} className="animate-spin text-echo-text-muted" />
              <span className="text-[13px] text-echo-text-muted">Loading…</span>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Ollama option */}
              <button
                onClick={() => handleSwitch("ollama")}
                disabled={switching || mode === "ollama"}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.98] ${
                  mode === "ollama"
                    ? "bg-echo-accent/10 ring-1 ring-echo-accent/30"
                    : "bg-white shadow-[0_1px_4px_rgba(44,40,37,0.07)] hover:bg-echo-bg-warm"
                } ${switching ? "opacity-60" : ""}`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    mode === "ollama" ? "bg-echo-accent text-white" : "bg-echo-bg-warm text-echo-accent"
                  }`}
                >
                  <Cpu size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-echo-text">
                    Local · Ollama
                  </p>
                  <p className="text-[11px] text-echo-text-muted">qwen3.5:0.8b · on-device</p>
                </div>
                {mode === "ollama" && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </button>

              {/* NanoGPT option */}
              <button
                onClick={() => handleSwitch("nanogpt")}
                disabled={switching || mode === "nanogpt"}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.98] ${
                  mode === "nanogpt"
                    ? "bg-echo-accent/10 ring-1 ring-echo-accent/30"
                    : "bg-white shadow-[0_1px_4px_rgba(44,40,37,0.07)] hover:bg-echo-bg-warm"
                } ${switching ? "opacity-60" : ""}`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    mode === "nanogpt" ? "bg-echo-accent text-white" : "bg-echo-bg-warm text-echo-accent"
                  }`}
                >
                  <Cloud size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-echo-text">
                    Cloud · NanoGPT
                  </p>
                  <p className="text-[11px] text-echo-text-muted">gpt-oss-120b · api</p>
                </div>
                {mode === "nanogpt" && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </button>
            </div>
          )}

          {switching && (
            <p className="mt-2 text-center text-[12px] text-echo-text-muted">
              Switching…
            </p>
          )}
        </div>

        <div className="mt-8 rounded-2xl bg-echo-bg-warm px-4 py-3">
          <p className="text-[11px] leading-relaxed text-echo-text-muted">
            Switching to NanoGPT sends anonymised text to an external API. Only change
            this when the privacy trade-off is acceptable for the current deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
