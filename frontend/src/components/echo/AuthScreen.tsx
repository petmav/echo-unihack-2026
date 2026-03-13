"use client";

import { useState } from "react";

import { Shield } from "lucide-react";

import { EchoLogo } from "./EchoLogo";

type AuthMode = "login" | "signup";

interface AuthScreenProps {
  onAuth: (email: string, password: string, mode: AuthMode) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function AuthScreen({ onAuth, isLoading, error }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    onAuth(email, password, mode);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-7 py-10">
      <EchoLogo size={72} animate={false} />

      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm">
        <div className="mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full rounded-[14px] border border-[#E0D8D0] bg-white px-4.5 py-[15px] font-sans text-[15px] font-light text-echo-text outline-none transition-colors placeholder:text-echo-text-muted focus:border-echo-accent"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="w-full rounded-[14px] border border-[#E0D8D0] bg-white px-4.5 py-[15px] font-sans text-[15px] font-light text-echo-text outline-none transition-colors placeholder:text-echo-text-muted focus:border-echo-accent"
          />
        </div>

        {error && (
          <p className="mb-3 text-center text-sm text-echo-red">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full rounded-[14px] bg-echo-accent py-[15px] font-sans text-[15px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading
            ? "..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <p className="mt-5 text-center text-[13.5px] text-echo-text-muted">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-echo-accent underline underline-offset-[3px]"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-echo-accent underline underline-offset-[3px]"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <div className="mt-7 rounded-[14px] bg-echo-highlight p-3.5 text-center">
          <div className="mb-1.5 flex justify-center">
            <Shield size={14} className="text-echo-text-soft" />
          </div>
          <p className="text-xs font-light leading-relaxed text-echo-text-soft">
            No names. No profiles. Just an email.
            <br />
            Your thoughts never leave your device.
          </p>
        </div>
      </form>
    </div>
  );
}
