"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  TrendingUp,
  User,
  Info,
  ChevronRight,
  Settings,
  X,
  Waypoints,
  Sun,
  Moon,
  CalendarDays,
} from "lucide-react";

import type { AppScreen } from "@/lib/types";

import { EchoLogoSmall } from "./EchoLogo";

interface MenuItem {
  id: AppScreen;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "thoughts",
    label: "Past thoughts",
    icon: <MessageSquare size={22} />,
    path: "/thoughts",
  },
  { id: "graph", label: "Constellation", icon: <Waypoints size={22} />, path: "/constellation" },
  { id: "trends", label: "Trends", icon: <TrendingUp size={22} />, path: "/trends" },
  {
    id: "weeklyThemes",
    label: "This week's themes",
    icon: <CalendarDays size={22} />,
    path: "/weekly-themes",
  },
  { id: "account", label: "Account", icon: <User size={22} />, path: "/account" },
  { id: "about", label: "About Echo", icon: <Info size={22} />, path: "/about" },
];

interface MenuOverlayProps {
  onNavigate: (screen: AppScreen) => void;
  onClose: () => void;
  mode?: "fullscreen" | "sidebar";
  isAdmin?: boolean;
}

export function MenuOverlay({
  onNavigate,
  onClose,
  mode = "fullscreen",
  isAdmin = false,
}: MenuOverlayProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);


  const handleItemClick = (screen: AppScreen) => {
    onClose();
    onNavigate(screen);
  };

  const menuItems: MenuItem[] = [
    ...MENU_ITEMS,
    ...(isAdmin
      ? [{ id: "admin" as AppScreen, label: "Admin", icon: <Settings size={22} />, path: "/admin" }]
      : []),
  ];

  if (mode === "sidebar") {
    return (
      <>
        {/* Scrim backdrop */}
        <motion.div
          className="fixed inset-0 z-[79] bg-black/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          aria-label="Close menu"
        />

        {/* Sidebar panel */}
        <motion.div
          className="fixed left-0 top-0 z-[80] flex h-full w-[320px] flex-col bg-echo-bg shadow-[4px_0_24px_rgba(44,40,37,0.08)]"
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Sidebar header with close */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2.5">
              <EchoLogoSmall />
              <span className="font-serif text-base font-normal tracking-tight text-echo-text">
                Echo
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-echo-text-soft transition-colors hover:bg-black/5 active:scale-[0.92]"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.id}
                className="flex w-full items-center gap-4 rounded-2xl px-3 py-3.5 text-left font-sans text-[15px] font-normal text-echo-text transition-colors hover:bg-echo-bg-warm active:bg-echo-bg-warm"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.06 * index,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onClick={() => handleItemClick(item.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-echo-card text-echo-accent shadow-[0_1px_4px_rgba(44,40,37,0.06)]">
                  {item.icon}
                </div>
                {item.label}
                <ChevronRight
                  size={18}
                  className="ml-auto text-echo-text-muted"
                />
              </motion.button>
            ))}
          </nav>

          <div className="px-5 pb-6 pt-4">
            <span className="text-xs font-light leading-snug text-echo-text-muted">
              Built at UNIHACK 2026
              <br />
              Your feelings, held with care.
            </span>
          </div>
        </motion.div>
      </>
    );
  }

  /* ── Fullscreen mode (mobile) ── */
  return (
    <motion.div
      className="absolute inset-0 z-80 flex flex-col bg-echo-bg px-6 pb-8 pt-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <EchoLogoSmall />
          <span className="font-serif text-base font-normal tracking-tight text-echo-text">
            Echo
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-echo-text-soft transition-colors active:bg-black/5"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.id}
            className="flex w-full items-center gap-4 rounded-2xl p-4.5 text-left font-sans text-[17px] font-normal text-echo-text transition-colors active:bg-echo-bg-warm"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.35,
              delay: 0.08 * index,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={() => handleItemClick(item.id)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-echo-card text-echo-accent shadow-[0_1px_4px_rgba(44,40,37,0.06)]">
              {item.icon}
            </div>
            {item.label}
            <ChevronRight
              size={20}
              className="ml-auto text-echo-text-muted"
            />
          </motion.button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 pt-4">
        <EchoLogoSmall />
        <span className="flex-1 text-xs font-light leading-snug text-echo-text-muted">
          Echo &middot; Built at UNIHACK 2026
          <br />
          Your feelings, held with care.
        </span>
      </div>
    </motion.div>
  );
}
