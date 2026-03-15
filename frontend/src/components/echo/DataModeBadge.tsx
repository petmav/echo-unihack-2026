"use client";

interface DataModeBadgeProps {
  mode: "live" | "demo";
  liveLabel: string;
  demoLabel: string;
  testId?: string;
}

export function DataModeBadge({
  mode,
  liveLabel,
  demoLabel,
  testId,
}: DataModeBadgeProps) {
  const isLive = mode === "live";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-widest ${
        isLive
          ? "bg-[#E5F3EA] text-[#50745D]"
          : "bg-[#F6E9DF] text-[#936349]"
      }`}
      data-testid={testId}
    >
      {isLive ? liveLabel : demoLabel}
    </span>
  );
}
