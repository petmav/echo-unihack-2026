"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }, 6000);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcriptSegment + " ";
        } else {
          interimTranscript += transcriptSegment;
        }
      }
      setTranscript(finalTranscriptRef.current + interimTranscript);
      resetInactivityTimeout();
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
        isManuallyStoppedRef.current = true;
        setIsListening(false);
      }
    };

    // When voice input pauses/ends natively
    recognition.onend = () => {
      if (!isManuallyStoppedRef.current) {
        // Auto-restart to simulate continuous listening
        try {
          recognition.start();
        } catch (error) {
          console.error("Failed to restart speech recognition:", error);
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        recognitionRef.current.abort();
      }
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      finalTranscriptRef.current = "";
      isManuallyStoppedRef.current = false;
      try {
        recognitionRef.current.start();
        setIsListening(true);
        resetInactivityTimeout();
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      isManuallyStoppedRef.current = true;
      recognitionRef.current.stop();
      setIsListening(false);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript: () => {
      setTranscript("");
      finalTranscriptRef.current = "";
    },
  };
}
