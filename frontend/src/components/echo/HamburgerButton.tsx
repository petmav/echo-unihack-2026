"use client";

interface HamburgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function HamburgerButton({ isOpen, onClick }: HamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 flex-col items-center justify-center gap-[4.5px] rounded-full border-none bg-transparent text-echo-text transition-all hover:bg-black/5 active:scale-[0.92]"
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      <span
        className="block h-[1.5px] w-[17px] rounded-sm bg-echo-text transition-all duration-300"
        style={
          isOpen
            ? { transform: "rotate(45deg) translate(4px, 4px)" }
            : {}
        }
      />
      <span
        className="block h-[1.5px] w-[17px] rounded-sm bg-echo-text transition-all duration-300"
        style={
          isOpen
            ? { opacity: 0, transform: "scaleX(0)" }
            : {}
        }
      />
      <span
        className="block h-[1.5px] w-[17px] rounded-sm bg-echo-text transition-all duration-300"
        style={
          isOpen
            ? { transform: "rotate(-45deg) translate(4px, -4px)" }
            : {}
        }
      />
    </button>
  );
}
