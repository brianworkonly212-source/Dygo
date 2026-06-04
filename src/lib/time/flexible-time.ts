const PRESENT_WORD_PATTERN = /\b(nay|now|present|current|hiện tại|hien tai)\b/i;
const YEAR_PATTERN = /(?:^|[^\d])(\d{3,4})(?!\d)/g;

export type NormalizedYearRange = {
  startYear: number | null;
  endYear: number | null;
};

export type NormalizedDateRange = {
  startDate: string | null;
  endDate: string | null;
};

export function normalizeFlexibleYearRange(
  startText: string | null | undefined,
  endText: string | null | undefined,
  currentYear = new Date().getFullYear(),
): NormalizedYearRange {
  const start = startText?.trim() ?? "";
  const end = endText?.trim() ?? "";
  const startYears = extractYears(start);
  const endYears = extractYears(end);

  if (startYears.length === 0 && endYears.length === 0) {
    return { startYear: null, endYear: null };
  }

  const startYear = startYears[0] ?? endYears[0] ?? null;
  let endYear: number | null = null;

  if (end && PRESENT_WORD_PATTERN.test(end)) {
    endYear = currentYear;
  } else if (endYears.length) {
    endYear = endYears[endYears.length - 1];
  } else if (!end && startYears.length > 1) {
    endYear = startYears[startYears.length - 1];
  } else if (!end && startYear !== null) {
    endYear = currentYear;
  }

  if (startYear !== null && endYear !== null && startYear > endYear) {
    return { startYear: endYear, endYear: startYear };
  }

  return { startYear, endYear };
}

export function normalizeFlexibleDateRange(
  startText: string | null | undefined,
  endText: string | null | undefined,
  currentDate = new Date(),
): NormalizedDateRange {
  const rawStart = startText?.trim() ?? "";
  const rawEnd = endText?.trim() ?? "";
  const combined = rawEnd ? `${rawStart} - ${rawEnd}` : rawStart;
  const parts = extractDateParts(combined);

  if (!parts.length) {
    const years = normalizeFlexibleYearRange(rawStart, rawEnd, currentDate.getFullYear());
    return {
      startDate: years.startYear ? `${years.startYear}-01-01` : null,
      endDate: years.endYear ? `${years.endYear}-12-31` : null,
    };
  }

  const explicitYear = [...parts].reverse().find((part) => part.year)?.year;
  const inferredParts = parts.map((part, index) => {
    if (part.year) return part;
    const nextWithYear = parts.slice(index + 1).find((nextPart) => nextPart.year);
    const inferredYear = nextWithYear?.year ?? explicitYear ?? currentDate.getFullYear();
    const crossesYearBoundary =
      nextWithYear && part.month > nextWithYear.month && part.year === null;
    return {
      ...part,
      year: crossesYearBoundary ? inferredYear - 1 : inferredYear,
    };
  });

  const isoDates = inferredParts
    .map((part) => toIsoDate(part.year, part.month, part.day))
    .filter((date): date is string => Boolean(date));

  if (!isoDates.length) return { startDate: null, endDate: null };
  if (rawEnd && PRESENT_WORD_PATTERN.test(rawEnd)) {
    return { startDate: isoDates[0], endDate: toIsoDateFromDate(currentDate) };
  }

  return {
    startDate: isoDates[0],
    endDate: isoDates[isoDates.length - 1] ?? isoDates[0],
  };
}

function extractYears(value: string) {
  return Array.from(value.matchAll(YEAR_PATTERN))
    .map((match) => Number(match[1]))
    .filter((year) => Number.isInteger(year));
}

function extractDateParts(value: string) {
  const isoParts = Array.from(value.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)).map(
    (match) => ({
      day: Number(match[3]),
      month: Number(match[2]),
      year: Number(match[1]),
    }),
  );
  const slashParts = Array.from(value.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)).map(
    (match) => ({
      day: Number(match[1]),
      month: Number(match[2]),
      year: match[3] ? Number(match[3]) : null,
    }),
  );

  return [...isoParts, ...slashParts].sort((first, second) => {
    const firstIndex = value.indexOf(`${first.day}`);
    const secondIndex = value.indexOf(`${second.day}`);
    return firstIndex - secondIndex;
  });
}

function toIsoDate(year: number | null, month: number, day: number) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toIsoDateFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
