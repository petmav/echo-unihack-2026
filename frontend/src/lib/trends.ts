export type TrendRange = "weekly" | "monthly" | "yearly";

export interface TrendThought {
  theme_category: string;
  timestamp: number;
  is_resolved: boolean;
}

export interface ResolutionTimelineThought {
  message_id: string;
  theme_category: string;
  timestamp: number;
  is_resolved: boolean;
  resolution_timestamp?: number;
}

export interface TrendBucket {
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  resolvedCount: number;
  counts: Record<string, number>;
}

export interface TrendThemeSummary {
  theme: string;
  count: number;
  share: number;
  delta: number;
}

export interface TrendSnapshot {
  range: TrendRange;
  periodLabel: string;
  subtitle: string;
  buckets: TrendBucket[];
  totalCount: number;
  resolvedCount: number;
  resolutionRate: number;
  topThemes: TrendThemeSummary[];
  dominantTheme: TrendThemeSummary | null;
  risingTheme: TrendThemeSummary | null;
}

export interface ResolutionTimelineItem {
  messageId: string;
  theme: string;
  submittedAt: number;
  resolvedAt: number;
  elapsedMs: number;
}

export interface ResolutionTimelineSummary {
  items: ResolutionTimelineItem[];
  trackedResolvedCount: number;
  legacyResolvedCount: number;
  averageResolutionMs: number | null;
}

interface BucketDefinition {
  key: string;
  label: string;
  shortLabel: string;
  start: number;
  end: number;
}

interface WindowDefinition {
  range: TrendRange;
  periodLabel: string;
  subtitle: string;
  currentStart: number;
  currentEnd: number;
  previousStart: number;
  previousEnd: number;
  buckets: BucketDefinition[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}

function formatDateRange(start: Date, endExclusive: Date): string {
  const inclusiveEnd = addDays(endExclusive, -1);
  const startMonth = MONTH_LABELS[start.getMonth()];
  const endMonth = MONTH_LABELS[inclusiveEnd.getMonth()];

  if (start.getFullYear() !== inclusiveEnd.getFullYear()) {
    return `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${inclusiveEnd.getDate()}, ${inclusiveEnd.getFullYear()}`;
  }

  if (start.getMonth() !== inclusiveEnd.getMonth()) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${inclusiveEnd.getDate()}, ${start.getFullYear()}`;
  }

  return `${startMonth} ${start.getDate()} - ${inclusiveEnd.getDate()}, ${start.getFullYear()}`;
}

function getWindowDefinition(range: TrendRange, nowValue: number = Date.now()): WindowDefinition {
  const now = new Date(nowValue);

  if (range === "weekly") {
    const currentStartDate = startOfWeek(now);
    const currentEndDate = addDays(currentStartDate, 7);
    const previousStartDate = addDays(currentStartDate, -7);
    const previousEndDate = currentStartDate;

    const buckets: BucketDefinition[] = Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(currentStartDate, index);
      const bucketEnd = addDays(bucketStart, 1);
      const weekdayLabel = WEEKDAY_LABELS[bucketStart.getDay()];

      return {
        key: bucketStart.toISOString(),
        label: `${weekdayLabel} ${bucketStart.getDate()}`,
        shortLabel: weekdayLabel,
        start: bucketStart.getTime(),
        end: bucketEnd.getTime(),
      };
    });

    return {
      range,
      periodLabel: "This week",
      subtitle: formatDateRange(currentStartDate, currentEndDate),
      currentStart: currentStartDate.getTime(),
      currentEnd: currentEndDate.getTime(),
      previousStart: previousStartDate.getTime(),
      previousEnd: previousEndDate.getTime(),
      buckets,
    };
  }

  if (range === "monthly") {
    const currentStartDate = startOfMonth(now);
    const currentEndDate = addMonths(currentStartDate, 1);
    const previousStartDate = addMonths(currentStartDate, -1);
    const previousEndDate = currentStartDate;
    const buckets: BucketDefinition[] = [];

    let bucketStart = currentStartDate;
    let bucketIndex = 0;
    while (bucketStart.getTime() < currentEndDate.getTime()) {
      const nextCandidate = addDays(bucketStart, 7);
      const bucketEnd =
        nextCandidate.getTime() > currentEndDate.getTime() ? currentEndDate : nextCandidate;
      const inclusiveEnd = addDays(bucketEnd, -1);

      buckets.push({
        key: `${currentStartDate.getFullYear()}-${currentStartDate.getMonth()}-${bucketIndex}`,
        label: `${MONTH_LABELS[bucketStart.getMonth()]} ${bucketStart.getDate()}-${inclusiveEnd.getDate()}`,
        shortLabel: `${bucketStart.getDate()}-${inclusiveEnd.getDate()}`,
        start: bucketStart.getTime(),
        end: bucketEnd.getTime(),
      });

      bucketStart = bucketEnd;
      bucketIndex += 1;
    }

    return {
      range,
      periodLabel: "This month",
      subtitle: formatDateRange(currentStartDate, currentEndDate),
      currentStart: currentStartDate.getTime(),
      currentEnd: currentEndDate.getTime(),
      previousStart: previousStartDate.getTime(),
      previousEnd: previousEndDate.getTime(),
      buckets,
    };
  }

  const currentStartDate = startOfYear(now);
  const currentEndDate = addYears(currentStartDate, 1);
  const previousStartDate = addYears(currentStartDate, -1);
  const previousEndDate = currentStartDate;

  const buckets: BucketDefinition[] = Array.from({ length: 12 }, (_, index) => {
    const bucketStart = new Date(currentStartDate.getFullYear(), index, 1);
    const bucketEnd = new Date(currentStartDate.getFullYear(), index + 1, 1);

    return {
      key: `${currentStartDate.getFullYear()}-${index}`,
      label: MONTH_LABELS[index],
      shortLabel: MONTH_LABELS[index],
      start: bucketStart.getTime(),
      end: bucketEnd.getTime(),
    };
  });

  return {
    range,
    periodLabel: "This year",
    subtitle: String(currentStartDate.getFullYear()),
    currentStart: currentStartDate.getTime(),
    currentEnd: currentEndDate.getTime(),
    previousStart: previousStartDate.getTime(),
    previousEnd: previousEndDate.getTime(),
    buckets,
  };
}

function countThemesInWindow(
  thoughts: TrendThought[],
  start: number,
  end: number
): { counts: Record<string, number>; total: number; resolvedCount: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  let resolvedCount = 0;

  for (const thought of thoughts) {
    if (thought.timestamp < start || thought.timestamp >= end) {
      continue;
    }

    total += 1;
    if (thought.is_resolved) {
      resolvedCount += 1;
    }
    counts[thought.theme_category] = (counts[thought.theme_category] ?? 0) + 1;
  }

  return { counts, total, resolvedCount };
}

function buildBucket(definition: BucketDefinition, thoughts: TrendThought[]): TrendBucket {
  const counts: Record<string, number> = {};
  let total = 0;
  let resolvedCount = 0;

  for (const thought of thoughts) {
    if (thought.timestamp < definition.start || thought.timestamp >= definition.end) {
      continue;
    }

    total += 1;
    if (thought.is_resolved) {
      resolvedCount += 1;
    }
    counts[thought.theme_category] = (counts[thought.theme_category] ?? 0) + 1;
  }

  return {
    key: definition.key,
    label: definition.label,
    shortLabel: definition.shortLabel,
    total,
    resolvedCount,
    counts,
  };
}

function buildThemeSummaries(
  currentCounts: Record<string, number>,
  previousCounts: Record<string, number>,
  totalCount: number
): TrendThemeSummary[] {
  return Object.entries(currentCounts)
    .map(([theme, count]) => ({
      theme,
      count,
      share: totalCount > 0 ? count / totalCount : 0,
      delta: count - (previousCounts[theme] ?? 0),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.theme.localeCompare(right.theme);
    });
}

export function buildTrendSnapshot(
  thoughts: TrendThought[],
  range: TrendRange,
  nowValue?: number
): TrendSnapshot {
  const definition = getWindowDefinition(range, nowValue);
  const buckets = definition.buckets.map((bucket) => buildBucket(bucket, thoughts));
  const current = countThemesInWindow(thoughts, definition.currentStart, definition.currentEnd);
  const previous = countThemesInWindow(thoughts, definition.previousStart, definition.previousEnd);
  const topThemes = buildThemeSummaries(current.counts, previous.counts, current.total);

  const risingTheme =
    topThemes.length > 0
      ? [...topThemes].sort((left, right) => {
          if (right.delta !== left.delta) {
            return right.delta - left.delta;
          }
          return right.count - left.count;
        })[0]
      : null;

  return {
    range,
    periodLabel: definition.periodLabel,
    subtitle: definition.subtitle,
    buckets,
    totalCount: current.total,
    resolvedCount: current.resolvedCount,
    resolutionRate: current.total > 0 ? Math.round((current.resolvedCount / current.total) * 100) : 0,
    topThemes,
    dominantTheme: topThemes[0] ?? null,
    risingTheme,
  };
}

export function buildResolutionTimeline(
  thoughts: ResolutionTimelineThought[],
  limit: number = 4
): ResolutionTimelineSummary {
  const trackedItems = thoughts
    .filter(
      (thought) =>
        thought.is_resolved && typeof thought.resolution_timestamp === "number"
    )
    .map((thought) => {
      const resolvedAt = thought.resolution_timestamp as number;

      return {
        messageId: thought.message_id,
        theme: thought.theme_category,
        submittedAt: thought.timestamp,
        resolvedAt,
        elapsedMs: Math.max(0, resolvedAt - thought.timestamp),
      };
    })
    .sort((left, right) => right.resolvedAt - left.resolvedAt);

  const legacyResolvedCount = thoughts.filter(
    (thought) =>
      thought.is_resolved && typeof thought.resolution_timestamp !== "number"
  ).length;

  const totalElapsedMs = trackedItems.reduce(
    (sum, item) => sum + item.elapsedMs,
    0
  );

  return {
    items: trackedItems.slice(0, limit),
    trackedResolvedCount: trackedItems.length,
    legacyResolvedCount,
    averageResolutionMs:
      trackedItems.length > 0 ? totalElapsedMs / trackedItems.length : null,
  };
}
