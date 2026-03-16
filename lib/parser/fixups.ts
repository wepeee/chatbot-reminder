import type { ParsedMessage } from "@/schemas/message";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getDatePartsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
  };
}

function getTimezoneOffsetMinutes(timezone: string, referenceDate: Date) {
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(referenceDate)
    .find((part) => part.type === "timeZoneName")
    ?.value;

  if (!tzName) {
    return 0;
  }

  const match = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function buildTimezoneIsoAtAbsoluteDate(input: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  const shiftedUtc = new Date(
    Date.UTC(input.year, input.month - 1, input.day, 0, 0, 0),
  );

  const offsetMinutes = getTimezoneOffsetMinutes(input.timezone, shiftedUtc);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHour = Math.floor(absOffset / 60);
  const offsetMinute = absOffset % 60;

  return `${input.year}-${pad2(input.month)}-${pad2(input.day)}T${pad2(input.hour)}:${pad2(input.minute)}:00${sign}${pad2(offsetHour)}:${pad2(offsetMinute)}`;
}

function inferClockFromText(lower: string) {
  const match = lower.match(
    /\bjam\s*(\d{1,2})(?:[.:](\d{1,2}))?(?:\s*(pagi|siang|sore|malam))?\b/i,
  );

  if (!match) {
    return null;
  }

  const rawHour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const period = (match[3] ?? "").toLowerCase();

  if (
    Number.isNaN(rawHour) ||
    Number.isNaN(minute) ||
    rawHour < 0 ||
    rawHour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
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

  return { hour, minute };
}

function inferExplicitSlashDateIso(input: {
  lower: string;
  timezone: string;
  now: Date;
}) {
  const dateMatch = input.lower.match(
    /\b(?:tanggal|tgl)?\s*(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/i,
  );
  const clock = inferClockFromText(input.lower);

  if (!dateMatch || !clock) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const nowParts = getDatePartsInTimezone(input.now, input.timezone);
  const yearRaw = dateMatch[3];
  const year = yearRaw
    ? yearRaw.length === 2
      ? 2000 + Number(yearRaw)
      : Number(yearRaw)
    : nowParts.year;

  return buildTimezoneIsoAtAbsoluteDate({
    timezone: input.timezone,
    year,
    month,
    day,
    hour: clock.hour,
    minute: clock.minute,
  });
}

function buildTodayTomorrowQuestion(timeLabel: string, timezone: string, now: Date) {
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(now);

  const tomorrowLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  return `Untuk jam ${timeLabel} nanti, maksudnya hari ini (${todayLabel}) atau besok (${tomorrowLabel})?`;
}

function extractReminderTitle(normalizedText: string) {
  const quoted = normalizedText.match(/"(.+?)"/)?.[1]?.trim();
  if (quoted) {
    return `Pengingat: ${quoted}`;
  }

  const tail = normalizedText
    .replace(/^.*\b(?:ingetin|ingatkan|remind|kirim\s+(?:aku\s+)?chat|kirim\s+pesan|ping)\b\s*/i, "")
    .trim();

  return tail.length > 0 ? `Pengingat: ${tail}` : "Pengingat";
}

export function applyParsedFixups(input: {
  parsed: ParsedMessage;
  normalizedText: string;
  timezone: string;
  now?: Date;
}): ParsedMessage {
  const now = input.now ?? new Date();
  const lower = input.normalizedText.toLowerCase();

  const deleteLike = /\b(hapus|delete|cancel|batalkan)\b/.test(lower);
  const reminderLike =
    /\b(ingetin|ingatkan|remind|ping|kirim\s+(?:aku\s+)?chat|kirim\s+pesan)\b/.test(
      lower,
    );
  const recurringLike = /\b(setiap|tiap)\b/.test(lower);
  const eventLike =
    /\b(kuliah|kelas|rapat|meeting|event|acara|praktikum|lab)\b/.test(lower);

  let parsed = input.parsed;

  if (deleteLike && parsed.intent !== "delete_item") {
    const ref = input.normalizedText
      .replace(/^.*\b(?:hapus|delete|cancel|batalkan)\b\s*/i, "")
      .trim();

    parsed = {
      ...parsed,
      intent: "delete_item",
      title: null,
      description: null,
      date: null,
      time: null,
      due_at: null,
      start_at: null,
      end_at: null,
      location: null,
      recurrence: null,
      reminder_offsets: [],
      updates: null,
      target_reference: ref.length > 0 ? ref : parsed.target_reference,
      needs_clarification: ref.length === 0,
      clarification_question:
        ref.length === 0
          ? "Item yang mau dihapus apa? Sebutkan judulnya."
          : null,
    };
  }

  if (parsed.intent === "create_task" && reminderLike) {
    parsed = {
      ...parsed,
      intent: "create_recurring_reminder",
      title: parsed.title ?? extractReminderTitle(input.normalizedText),
      description: parsed.description ?? input.normalizedText,
      start_at: parsed.start_at ?? parsed.due_at ?? null,
      due_at: null,
      target_reference: null,
      updates: null,
    };

    if (/\b(?:abis|habis)\s+(?:dzuhur|zuhur|ashar|asar|maghrib|magrib|isya|subuh)\b/.test(lower)) {
      parsed = {
        ...parsed,
        needs_clarification: true,
        clarification_question:
          "Setelah waktu shalat itu, kamu maunya diingatkan jam berapa?",
      };
    }
  }

  if (
    parsed.intent === "create_task" &&
    recurringLike &&
    eventLike &&
    !reminderLike
  ) {
    const startAt = parsed.start_at ?? parsed.due_at;

    parsed = {
      ...parsed,
      intent: "create_event",
      title: parsed.title ?? input.normalizedText,
      start_at: startAt,
      due_at: null,
      recurrence: {
        frequency: "weekly",
        interval_value: 1,
        by_day: null,
        by_month_day: null,
        start_date: null,
        end_date: null,
        raw_rule_text: input.normalizedText,
      },
    };
  }

  const explicitSlashIso = inferExplicitSlashDateIso({
    lower,
    timezone: input.timezone,
    now,
  });

  if (explicitSlashIso) {
    if (parsed.intent === "create_task") {
      parsed = {
        ...parsed,
        due_at: explicitSlashIso,
        needs_clarification: false,
        clarification_question: null,
      };
    }

    if (parsed.intent === "create_event") {
      parsed = {
        ...parsed,
        start_at: explicitSlashIso,
        needs_clarification: false,
        clarification_question: null,
      };
    }
  }

  const hasRelativeDateAnchor =
    /\bhari\s+ini\b|\bbesok\b|\blusa\b/.test(lower) ||
    /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(lower);
  const clock = inferClockFromText(lower);

  if (
    parsed.intent === "create_recurring_reminder" &&
    /\bnanti\b/.test(lower) &&
    clock &&
    !hasRelativeDateAnchor
  ) {
    const timeLabel = `${pad2(clock.hour)}.${pad2(clock.minute)}`;
    parsed = {
      ...parsed,
      start_at: null,
      due_at: null,
      needs_clarification: true,
      clarification_question: buildTodayTomorrowQuestion(
        timeLabel,
        input.timezone,
        now,
      ),
    };
  }

  return parsed;
}
