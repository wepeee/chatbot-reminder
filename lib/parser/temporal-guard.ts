import type { ParsedMessage } from "@/schemas/message";

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1,
  januari: 1,
  feb: 2,
  februari: 2,
  mar: 3,
  maret: 3,
  apr: 4,
  april: 4,
  mei: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  agu: 8,
  agt: 8,
  agst: 8,
  agustus: 8,
  sep: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
};

const WEEKDAY_PATTERNS: Array<{
  canonical: "senin" | "selasa" | "rabu" | "kamis" | "jumat" | "sabtu" | "minggu";
  pattern: RegExp;
}> = [
  { canonical: "senin", pattern: /\bsenin\b/i },
  { canonical: "selasa", pattern: /\bselasa\b/i },
  { canonical: "rabu", pattern: /\brabu\b/i },
  { canonical: "kamis", pattern: /\bkamis\b/i },
  { canonical: "jumat", pattern: /\bjum(?:at|'at)\b/i },
  { canonical: "sabtu", pattern: /\bsabtu\b/i },
  { canonical: "minggu", pattern: /\bhari\s+minggu\b|\bahad\b/i },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getTemporalISO(parsed: ParsedMessage) {
  if (parsed.intent === "create_task") {
    return parsed.due_at ?? null;
  }
  if (parsed.intent === "create_event") {
    return parsed.start_at ?? null;
  }
  if (parsed.intent === "create_recurring_reminder") {
    return parsed.start_at ?? parsed.due_at ?? null;
  }
  return null;
}

function getDatePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

function getCanonicalWeekday(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
  })
    .format(date)
    .toLowerCase();

  if (weekday.includes("senin")) return "senin";
  if (weekday.includes("selasa")) return "selasa";
  if (weekday.includes("rabu")) return "rabu";
  if (weekday.includes("kamis")) return "kamis";
  if (weekday.includes("jum")) return "jumat";
  if (weekday.includes("sabtu")) return "sabtu";
  return "minggu";
}

function formatDateTimeLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function extractAbsoluteDateHint(text: string) {
  const lower = text.toLowerCase();

  let best:
    | {
        day: number;
        month: number;
        year: number | null;
        text: string;
        index: number;
      }
    | null = null;

  const monthMatch =
    /(?:\btanggal\b|\btgl\b)?\s*(\d{1,2})\s*(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|agst|september|sep|oktober|okt|november|nov|desember|des)\s*(\d{4})?/gi;
  for (const match of lower.matchAll(monthMatch)) {
    const monthName = match[2];
    const month = MONTH_NAME_TO_NUMBER[monthName];
    if (!month) continue;
    const day = Number(match[1]);
    const yearRaw = match[3];
    const year = yearRaw ? Number(yearRaw) : null;
    const index = match.index ?? 0;

    if (!best || index < best.index) {
      best = {
        day,
        month,
        year,
        text: match[0].trim(),
        index,
      };
    }
  }

  const numericMatch = /(?:\btanggal\b|\btgl\b)?\s*(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/gi;
  for (const match of lower.matchAll(numericMatch)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;

    const yearRaw = match[3];
    let year: number | null = null;
    if (yearRaw) {
      year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    }

    const index = match.index ?? 0;
    if (!best || index < best.index) {
      best = {
        day,
        month,
        year,
        text: match[0].trim(),
        index,
      };
    }
  }

  return best;
}

function getRelativeDayOffsetHint(text: string) {
  const lower = text.toLowerCase();
  if (/\bhari ini\b/i.test(lower)) return { label: "hari ini", dayOffset: 0 };
  if (/\bbesok\b/i.test(lower)) return { label: "besok", dayOffset: 1 };
  if (/\blusa\b/i.test(lower)) return { label: "lusa", dayOffset: 2 };
  return null;
}

function getWeekdayHints(text: string) {
  const lowered = text.toLowerCase();
  if (/\bminggu\s+(ini|depan|lalu)\b/i.test(lowered)) {
    return WEEKDAY_PATTERNS.filter((item) => item.canonical !== "minggu")
      .filter((item) => item.pattern.test(lowered))
      .map((item) => item.canonical);
  }

  return WEEKDAY_PATTERNS.filter((item) => item.pattern.test(lowered)).map(
    (item) => item.canonical,
  );
}

function parseExpectedClockHourMinute(text: string) {
  const match = text
    .toLowerCase()
    .match(/\bjam\s*(\d{1,2})(?:[.:](\d{1,2}))?(?:\s*(pagi|siang|sore|malam))?\b/i);

  if (!match) return null;

  const rawHour = Number(match[1]);
  if (Number.isNaN(rawHour) || rawHour < 0 || rawHour > 23) {
    return null;
  }

  const hasMinute = typeof match[2] === "string";
  const minute = hasMinute ? Number(match[2]) : 0;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) {
    return null;
  }

  const period = match[3]?.toLowerCase() as
    | "pagi"
    | "siang"
    | "sore"
    | "malam"
    | undefined;

  let hour = rawHour;
  if (period === "pagi") {
    if (hour === 12) hour = 0;
  } else if (period === "siang") {
    if (hour >= 1 && hour <= 10) hour += 12;
  } else if (period === "sore") {
    if (hour >= 1 && hour <= 11) hour += 12;
  } else if (period === "malam") {
    if (hour === 12) {
      hour = 0;
    } else if (hour >= 1 && hour <= 11) {
      hour += 12;
    }
  }

  return { hour, minute };
}

function withClarification(parsed: ParsedMessage, question: string): ParsedMessage {
  return {
    ...parsed,
    needs_clarification: true,
    clarification_question: question,
  };
}

export function enforceParsedTemporalConsistency(input: {
  parsed: ParsedMessage;
  normalizedText: string;
  timezone: string;
  now?: Date;
}) {
  if (input.parsed.needs_clarification) {
    return input.parsed;
  }

  const temporalISO = getTemporalISO(input.parsed);
  if (!temporalISO) {
    return input.parsed;
  }

  const referenceDate = new Date(temporalISO);
  if (Number.isNaN(referenceDate.getTime())) {
    return withClarification(
      input.parsed,
      "Waktu yang terbaca belum valid. Tolong kirim lagi tanggal dan jamnya dengan format lebih jelas.",
    );
  }

  const dateParts = getDatePartsInTimezone(referenceDate, input.timezone);
  const now = input.now ?? new Date();

  const absoluteHint = extractAbsoluteDateHint(input.normalizedText);
  if (absoluteHint) {
    const sameDayMonth =
      dateParts.day === absoluteHint.day && dateParts.month === absoluteHint.month;
    const sameYear = absoluteHint.year === null || dateParts.year === absoluteHint.year;
    if (!sameDayMonth || !sameYear) {
      const captured = `${pad2(dateParts.day)}/${pad2(dateParts.month)}/${dateParts.year}`;
      return withClarification(
        input.parsed,
        `Aku baca kamu tulis tanggal "${absoluteHint.text}", tapi sistem nangkep ${captured}. Maksudmu tanggal ${absoluteHint.text} ya?`,
      );
    }
  }

  const relativeHint = getRelativeDayOffsetHint(input.normalizedText);
  if (relativeHint) {
    const expected = new Date(
      now.getTime() + relativeHint.dayOffset * 24 * 60 * 60 * 1000,
    );
    const expectedParts = getDatePartsInTimezone(expected, input.timezone);
    const same =
      expectedParts.year === dateParts.year &&
      expectedParts.month === dateParts.month &&
      expectedParts.day === dateParts.day;
    if (!same) {
      const captured = formatDateTimeLabel(referenceDate, input.timezone);
      return withClarification(
        input.parsed,
        `Kamu menyebut "${relativeHint.label}", tapi yang kebaca justru ${captured}. Maksud waktunya ${relativeHint.label} ya?`,
      );
    }
  }

  const weekdayHints = getWeekdayHints(input.normalizedText);
  if (weekdayHints.length > 0) {
    const parsedWeekday = getCanonicalWeekday(referenceDate, input.timezone);
    if (!weekdayHints.includes(parsedWeekday)) {
      const captured = formatDateTimeLabel(referenceDate, input.timezone);
      return withClarification(
        input.parsed,
        `Kamu menyebut hari ${weekdayHints.join("/")}, tapi jadwal terbaca di ${captured}. Boleh konfirmasi harinya lagi?`,
      );
    }
  }

  const expectedClock = parseExpectedClockHourMinute(input.normalizedText);
  if (expectedClock) {
    if (
      expectedClock.hour !== dateParts.hour ||
      expectedClock.minute !== dateParts.minute
    ) {
      const captured = `${pad2(dateParts.hour)}.${pad2(dateParts.minute)}`;
      return withClarification(
        input.parsed,
        `Kamu menulis jam ${pad2(expectedClock.hour)}.${pad2(expectedClock.minute)}, tapi sistem menangkap jam ${captured}. Maksudmu jam ${pad2(expectedClock.hour)}.${pad2(expectedClock.minute)} ya?`,
      );
    }
  }

  return input.parsed;
}



