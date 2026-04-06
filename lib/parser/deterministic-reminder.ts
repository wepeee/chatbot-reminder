import type { ParsedMessage } from "@/schemas/message";

const JAKARTA_OFFSET_HOURS = 7;
const HOUR_MS = 60 * 60 * 1000;

const MONTH_MAP: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12
};

function formatDateLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone
  }).format(date);
}

function getJakartaShifted(date = new Date()) {
  return new Date(date.getTime() + JAKARTA_OFFSET_HOURS * HOUR_MS);
}

function getJakartaTodayYmd(date = new Date()) {
  const shifted = getJakartaShifted(date);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function addDaysYmd(input: { year: number; month: number; day: number }, days: number) {
  const utc = new Date(Date.UTC(input.year, input.month - 1, input.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function toJakartaIso(ymd: { year: number; month: number; day: number }, hour: string, minute: string) {
  const month = String(ymd.month).padStart(2, "0");
  const day = String(ymd.day).padStart(2, "0");
  return `${ymd.year}-${month}-${day}T${hour}:${minute}:00+07:00`;
}

function parseReminderClock(lower: string) {
  const match = lower.match(/\bjam\s*(\d{1,2})(?:[.:](\d{1,2}))?(?:\s*(pagi|siang|sore|malam))?\b/i);
  if (!match) {
    return null;
  }

  const rawHour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] ?? "0", 10);
  const period = (match[3] ?? "").toLowerCase();

  if (Number.isNaN(rawHour) || Number.isNaN(minute) || rawHour < 0 || rawHour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  let hour = rawHour;
  if (period === "pagi" && hour === 12) hour = 0;
  if (period === "siang" && hour >= 1 && hour <= 10) hour += 12;
  if (period === "sore" && hour >= 1 && hour <= 11) hour += 12;
  if (period === "malam") {
    if (hour === 12) hour = 0;
    else if (hour >= 1 && hour <= 11) hour += 12;
  }

  return {
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

function resolveReminderDateYmd(lower: string, now = new Date()) {
  const today = getJakartaTodayYmd(now);

  if (/\bhari ini\b/i.test(lower)) {
    return today;
  }

  if (/\bbesok\b/i.test(lower)) {
    return addDaysYmd(today, 1);
  }

  if (/\blusa\b/i.test(lower)) {
    return addDaysYmd(today, 2);
  }

  const slashDate = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slashDate) {
    const day = Number.parseInt(slashDate[1], 10);
    const month = Number.parseInt(slashDate[2], 10);
    const yearRaw = slashDate[3];
    const year = yearRaw ? (yearRaw.length === 2 ? 2000 + Number.parseInt(yearRaw, 10) : Number.parseInt(yearRaw, 10)) : today.year;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { year, month, day };
    }
  }

  const monthDate = lower.match(
    /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(\d{4}))?\b/i
  );
  if (monthDate) {
    const day = Number.parseInt(monthDate[1], 10);
    const monthName = monthDate[2].toLowerCase();
    const month = MONTH_MAP[monthName];
    const year = monthDate[3] ? Number.parseInt(monthDate[3], 10) : today.year;
    if (day >= 1 && day <= 31 && month) {
      return { year, month, day };
    }
  }

  return null;
}

export function parseDeterministicReminder(normalizedText: string, timezone: string): ParsedMessage | null {
  const lower = normalizedText.toLowerCase();
  const hasReminderVerb = /(?:ingetin|ingatkan|remind|kirim aku chat|kirim chat|kirim pesan|ping)/i.test(lower);
  const clock = parseReminderClock(lower);

  if (!hasReminderVerb || !clock) {
    return null;
  }

  const hour = clock.hour;
  const minute = clock.minute;
  const ymd = resolveReminderDateYmd(lower);
  const quoted = normalizedText.match(/"(.+?)"/)?.[1]?.trim() ?? null;
  const title = quoted ? `Pengingat: ${quoted}` : "Pengingat Chat";
  const description = quoted ?? normalizedText;

  if (!ymd) {
    const now = new Date();
    const todayLabel = formatDateLabel(now, timezone);
    const tomorrowLabel = formatDateLabel(new Date(now.getTime() + 24 * HOUR_MS), timezone);

    return {
      intent: "create_recurring_reminder",
      title,
      description,
      date: null,
      time: `${hour}.${minute}`,
      due_at: null,
      start_at: null,
      end_at: null,
      location: null,
      recurrence: null,
      reminder_offsets: [],
      target_reference: null,
      updates: null,
      needs_clarification: true,
      clarification_question: `Untuk jam ${hour}.${minute} nanti, maksudnya hari ini (${todayLabel}) atau besok (${tomorrowLabel})?`
    };
  }

  return {
    intent: "create_recurring_reminder",
    title,
    description,
    date: null,
    time: `${hour}.${minute}`,
    due_at: null,
    start_at: toJakartaIso(ymd, hour, minute),
    end_at: null,
    location: null,
    recurrence: null,
    reminder_offsets: [],
    target_reference: null,
    updates: null,
    needs_clarification: false,
    clarification_question: null
  };
}
