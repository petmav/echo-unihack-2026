"use client";

import { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";

import { EchoLogo } from "./EchoLogo";

interface OnboardingStep {
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: "You're not alone",
    description:
      "Echo finds others who have felt exactly what you're feeling right now — anonymously, privately, without judgement.",
  },
  {
    title: "Your words\nstay yours",
    description:
      "Your thoughts never leave your device. We only ever see the emotion, never the details.",
  },
  {
    title: "Sometimes it\nhelps to know",
    description:
      "When others find their way through, they share what helped — in their own words, for people just like you.",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingScreen({
  onComplete,
  onSkip,
}: OnboardingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-7 py-10 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <EchoLogo size={90} animate={stepIndex === 0} />

          <h1 className="mt-6 whitespace-pre-line font-serif text-[30px] font-normal leading-tight tracking-tight text-echo-text">
            {STEPS[stepIndex].title}
          </h1>

          <p className="mx-auto mt-4.5 max-w-[290px] text-[15px] font-light leading-relaxed text-echo-text-soft">
            {STEPS[stepIndex].description}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="mt-10 flex gap-[7px]">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-[7px] rounded-full transition-all duration-300 ${
              i === stepIndex
                ? "w-[22px] bg-echo-accent opacity-100"
                : "w-[7px] bg-echo-text-muted opacity-25"
            }`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-9 flex gap-3.5">
        {!isLastStep ? (
          <>
            <button
              onClick={onSkip}
              className="rounded-[26px] px-5 py-3.5 font-sans text-[15px] font-normal text-echo-text-soft"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="rounded-[26px] bg-echo-accent px-8 py-3.5 font-sans text-[15px] font-medium tracking-wide text-white active:scale-[0.96]"
            >
              Next
            </button>
          </>
        ) : (
          <button
            onClick={handleNext}
            className="rounded-[26px] bg-echo-accent px-8 py-3.5 font-sans text-[15px] font-medium tracking-wide text-white active:scale-[0.96]"
          >
            Get started
          </button>
        )}
      </div>
    </div>
  );
}
