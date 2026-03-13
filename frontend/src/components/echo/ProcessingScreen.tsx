"use client";

import { useState, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";

import { PROCESSING_PHRASES } from "@/lib/constants";

import { EchoLogo } from "./EchoLogo";

const PHRASE_CYCLE_MS = 1200;

export function ProcessingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PROCESSING_PHRASES.length);
    }, PHRASE_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <EchoLogo size={140} animate />

      <div className="mt-9 h-6 text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={phraseIndex}
            className="inline-block text-[15px] font-light tracking-wide text-echo-text-soft"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {PROCESSING_PHRASES[phraseIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
