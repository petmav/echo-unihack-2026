"use client";

import { useState } from "react";

import { ChevronLeft, Shield, Trash2 } from "lucide-react";

interface AccountPanelProps {
  email: string;
  onBack: () => void;
  onDeleteAccount: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  notificationsEnabled: boolean;
}

export function AccountPanel({
  email,
  onBack,
  onDeleteAccount,
  onToggleNotifications,
  notificationsEnabled,
}: AccountPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="echo-scroll-area flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 px-5 pb-4 pt-4 backdrop-blur-2xl" style={{ background: "var(--echo-header-blur)" }}>
        <button
          onClick={onBack}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-echo-text transition-colors active:bg-black/5"
          aria-label="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-serif text-xl font-normal tracking-tight text-echo-text">
          Account
        </h2>
      </div>

      <div className="mx-auto w-full max-w-xl px-4">
        {/* Account info card */}
        <div className="overflow-hidden rounded-2xl bg-echo-card shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
          <div className="flex items-center justify-between border-b border-border px-4.5 py-4 text-sm text-echo-text">
            <span className="font-normal">Email</span>
            <span className="text-[13.5px] font-light text-echo-text-soft">
              {email}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border px-4.5 py-4 text-sm text-echo-text">
            <span className="font-normal">Delayed prompts</span>
            <button
              onClick={() => onToggleNotifications(!notificationsEnabled)}
              className={`relative h-[26px] w-[44px] rounded-full border-none transition-colors ${
                notificationsEnabled ? "bg-echo-accent" : "bg-echo-toggle-off"
              }`}
              role="switch"
              aria-checked={notificationsEnabled}
              aria-label="Toggle delayed prompts"
            >
              <div
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-[left] ${
                  notificationsEnabled ? "left-[21px]" : "left-[3px]"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between px-4.5 py-4 text-sm text-echo-text">
            <span className="font-normal">Password</span>
            <span className="cursor-pointer text-[13.5px] font-normal text-echo-accent">
              Change
            </span>
          </div>
        </div>

        {/* Privacy banner */}
        <div className="my-5 flex items-center gap-2.5 rounded-xl bg-echo-highlight p-3 text-echo-text-soft">
          <Shield size={18} className="shrink-0" />
          <p className="text-[11.5px] font-light leading-snug">
            Echo stores only your email. Your thoughts live exclusively on this
            device.
          </p>
        </div>

        {/* Delete account */}
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-echo-card py-[15px] font-sans text-sm font-medium text-echo-red shadow-[0_1px_12px_rgba(44,40,37,0.05)] active:opacity-70"
          >
            <Trash2 size={18} />
            Delete account
          </button>
        ) : (
          <div className="rounded-2xl bg-echo-card p-4 shadow-[0_1px_12px_rgba(44,40,37,0.05)]">
            <p className="mb-3 text-center text-sm font-normal text-echo-text">
              This will permanently delete your account and clear all local
              data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl bg-echo-bg-warm py-3 text-sm font-medium text-echo-text"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteAccount}
                className="flex-1 rounded-xl bg-echo-red py-3 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
