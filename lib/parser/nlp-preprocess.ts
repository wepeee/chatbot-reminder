import { parsedMessageSchema, type ParsedMessage } from "@/schemas/message";

type ParserIntent = ParsedMessage["intent"];
type IntentConfidence = "low" | "medium" | "high";

const WEEKDAY_PATTERN = /\b(senin|selasa|rabu|kamis|jum(?:at|'at)|sabtu|minggu|ahad)\b/gi;

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeWeekday(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("jum")) return "jumat";
  if (lower === "ahad") return "minggu";
  return lower;
}

function detectLanguageHint(lower: string): "id" | "en" | "mixed" {
  const idHits = (lower.match(/\b(aku|saya|hari|besok|jam|tugas|kuliah|jadwal|ingetin|ingatkan|minggu)\b/g) ?? []).length;
  const enHits = (lower.match(/\b(i|my|today|tomorrow|week|task|event|remind|schedule|update|delete)\b/g) ?? []).length;

  if (idHits > 0 && enHits > 0) return "mixed";
  if (enHits > 0) return "en";
  return "id";
}

function buildEmptyParsed(intent: ParserIntent): ParsedMessage {
  return parsedMessageSchema.parse({
    intent,
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
    target_reference: null,
    updates: null,
    needs_clarification: false,
    clarification_question: null,
  });
}

export interface ParserNlpSignals {
  language_hint: "id" | "en" | "mixed";
  is_question: boolean;
  intent_hint: ParserIntent | null;
  intent_confidence: IntentConfidence;
  temporal: {
    has_explicit_date: boolean;
    has_explicit_time: boolean;
    mentions_today: boolean;
    mentions_tomorrow: boolean;
    mentions_lusa: boolean;
    mentions_this_week: boolean;
    mentions_next_week: boolean;
    weekday_hints: string[];
    ambiguous_phrases: string[];
  };
  action_cues: {
    agenda_lookup: boolean;
    create_like: boolean;
    update_like: boolean;
    delete_like: boolean;
    reminder_like: boolean;
    recurring_like: boolean;
    task_like: boolean;
    event_like: boolean;
  };
}

export function buildParserNlpSignals(normalizedText: string): ParserNlpSignals {
  const lower = normalizedText.toLowerCase();

  const mentionsToday = /\bhari\s+ini\b|\btoday\b/.test(lower);
  const mentionsTomorrow = /\bbesok\b|\btomorrow\b/.test(lower);
  const mentionsLusa = /\blusa\b|\bday\s+after\s+tomorrow\b/.test(lower);
  const mentionsThisWeek = /\bminggu\s+ini\b|\bthis\s+week\b|\b7\s*hari\b/.test(lower);
  const mentionsNextWeek = /\bminggu\s+depan\b|\bnext\s+week\b/.test(lower);

  const hasExplicitDate =
    /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(lower) ||
    /\b(?:tanggal|tgl)?\s*\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|agt|agst|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\b/.test(lower);

  const hasExplicitTime = /\bjam\s*\d{1,2}(?:[.:]\d{1,2})?\b|\b\d{1,2}[:.]\d{2}\b/.test(lower);

  const weekdayHints = uniq(
    Array.from(lower.matchAll(WEEKDAY_PATTERN)).map((match) => normalizeWeekday(match[1] ?? "")),
  );

  const ambiguousPhrases: string[] = [];
  if (/\bnanti\b/.test(lower)) ambiguousPhrases.push("nanti");
  if (/\b(pagi|siang|sore|malam)\b/.test(lower) && !hasExplicitTime) {
    ambiguousPhrases.push("periode_hari_tanpa_jam");
  }
  if (/\b(?:abis|habis)\s+(?:dzuhur|zuhur|ashar|asar|maghrib|magrib|isya|subuh)\b/.test(lower)) {
    ambiguousPhrases.push("setelah_waktu_shalat");
  }
  if (/\b(?:senin|selasa|rabu|kamis|jum(?:at|'at)|sabtu|minggu)\s+depan\b/.test(lower)) {
    ambiguousPhrases.push("weekday_depan");
  }

  const hasAgendaNoun = /\b(agenda|jadwal|deadline|tugas|event|acara|kuliah)\b/.test(lower);
  const hasAgendaLookupVerb = /\b(ada\s+apa|apa\s+aja|apa\s+saja|cek|lihat|list|tampilkan|show|ringkas|summary|rekap)\b/.test(lower);
  const isQuestion = /\?|\b(ada\s+apa|apa\s+aja|apa\s+saja|what)\b/.test(lower);

  const agendaLookup =
    (hasAgendaNoun && hasAgendaLookupVerb) ||
    ((mentionsToday || mentionsTomorrow || mentionsThisWeek) && isQuestion) ||
    /\bdeadline\b/.test(lower);

  const createLike = /\b(buat|tambah|catat|jadwalkan|schedule|aku\s+ada|ada\s+tugas|ada\s+kelas)\b/.test(lower);
  const updateLike = /\b(ubah|ganti|reschedule|majuin|mundurin|update)\b/.test(lower);
  const deleteLike = /\b(hapus|delete|cancel|batalkan)\b/.test(lower);
  const reminderLike = /\b(ingetin|ingatkan|remind|ping|kirim\s+(?:aku\s+)?chat|kirim\s+pesan)\b/.test(lower);
  const recurringLike = /\b(setiap|tiap|harian|mingguan|bulanan|daily|weekly|monthly)\b/.test(lower);
  const taskLike = /\b(tugas|deadline|pr|assignment)\b/.test(lower);
  const eventLike = /\b(kuliah|kelas|rapat|meeting|event|acara|praktikum|lab)\b/.test(lower);

  let intentHint: ParserIntent | null = null;
  let intentConfidence: IntentConfidence = "low";

  if (agendaLookup && isQuestion) {
    intentHint = mentionsThisWeek || mentionsNextWeek ? "get_week_agenda" : "get_today_agenda";
    intentConfidence = "high";
  } else if (updateLike) {
    intentHint = "update_item";
    intentConfidence = "medium";
  } else if (deleteLike) {
    intentHint = "delete_item";
    intentConfidence = "medium";
  } else if (reminderLike && recurringLike) {
    intentHint = "create_recurring_reminder";
    intentConfidence = "high";
  } else if (reminderLike) {
    intentHint = "create_recurring_reminder";
    intentConfidence = "medium";
  } else if (taskLike && createLike) {
    intentHint = "create_task";
    intentConfidence = "medium";
  } else if (eventLike && createLike) {
    intentHint = "create_event";
    intentConfidence = "medium";
  }

  return {
    language_hint: detectLanguageHint(lower),
    is_question: isQuestion,
    intent_hint: intentHint,
    intent_confidence: intentConfidence,
    temporal: {
      has_explicit_date: hasExplicitDate,
      has_explicit_time: hasExplicitTime,
      mentions_today: mentionsToday,
      mentions_tomorrow: mentionsTomorrow,
      mentions_lusa: mentionsLusa,
      mentions_this_week: mentionsThisWeek,
      mentions_next_week: mentionsNextWeek,
      weekday_hints: weekdayHints,
      ambiguous_phrases: ambiguousPhrases,
    },
    action_cues: {
      agenda_lookup: agendaLookup,
      create_like: createLike,
      update_like: updateLike,
      delete_like: deleteLike,
      reminder_like: reminderLike,
      recurring_like: recurringLike,
      task_like: taskLike,
      event_like: eventLike,
    },
  };
}

export function parseDeterministicAgendaIntent(normalizedText: string): ParsedMessage | null {
  const signals = buildParserNlpSignals(normalizedText);

  if (!signals.action_cues.agenda_lookup || !signals.is_question) {
    return null;
  }

  if (
    signals.intent_hint === "get_today_agenda" &&
    signals.intent_confidence === "high"
  ) {
    return buildEmptyParsed("get_today_agenda");
  }

  if (
    signals.intent_hint === "get_week_agenda" &&
    signals.intent_confidence === "high"
  ) {
    return buildEmptyParsed("get_week_agenda");
  }

  return null;
}

export function enforceNlpAmbiguityGuard(input: {
  parsed: ParsedMessage;
  nlpSignals: ParserNlpSignals;
}): ParsedMessage {
  if (input.parsed.needs_clarification) {
    return input.parsed;
  }

  if (
    input.parsed.intent !== "create_task" &&
    input.parsed.intent !== "create_event" &&
    input.parsed.intent !== "create_recurring_reminder"
  ) {
    return input.parsed;
  }

  const { temporal } = input.nlpSignals;
  if (temporal.ambiguous_phrases.length === 0) {
    return input.parsed;
  }

  const hasDateAnchor =
    temporal.has_explicit_date ||
    temporal.mentions_today ||
    temporal.mentions_tomorrow ||
    temporal.mentions_lusa ||
    temporal.weekday_hints.length > 0;
  const hasTimeAnchor = temporal.has_explicit_time;

  let clarificationQuestion: string | null = null;

  if (temporal.ambiguous_phrases.includes("weekday_depan") || !hasDateAnchor) {
    clarificationQuestion = "Biar tepat, maksud tanggal/harinya kapan ya?";
  } else if (!hasTimeAnchor) {
    clarificationQuestion = "Biar tepat, maksud jam berapa (WIB)?";
  }

  if (!clarificationQuestion) {
    return input.parsed;
  }

  return {
    ...input.parsed,
    needs_clarification: true,
    clarification_question: clarificationQuestion,
  };
}


function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseDayOffset(lower: string) {
  if (/\blusa\b/.test(lower)) return 2;
  if (/\bbesok\b/.test(lower)) return 1;
  return 0;
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

function buildTimezoneIsoAtDayOffset(input: {
  now: Date;
  timezone: string;
  dayOffset: number;
  hour: number;
  minute: number;
}) {
  const base = getDatePartsInTimezone(input.now, input.timezone);
  const shiftedUtc = new Date(
    Date.UTC(base.year, base.month - 1, base.day + input.dayOffset, 0, 0, 0),
  );

  const year = shiftedUtc.getUTCFullYear();
  const month = shiftedUtc.getUTCMonth() + 1;
  const day = shiftedUtc.getUTCDate();

  const offsetMinutes = getTimezoneOffsetMinutes(input.timezone, shiftedUtc);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHour = Math.floor(absOffset / 60);
  const offsetMinute = absOffset % 60;

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(input.hour)}:${pad2(input.minute)}:00${sign}${pad2(offsetHour)}:${pad2(offsetMinute)}`;
}

export function resolveMeridiemAmbiguityForIndonesianHour(input: {
  parsed: ParsedMessage;
  normalizedText: string;
  timezone: string;
  now?: Date;
}): ParsedMessage {
  const parsed = input.parsed;
  if (!parsed.needs_clarification) {
    return parsed;
  }

  const question = parsed.clarification_question?.toLowerCase() ?? "";
  if (!/09:00|21:00|am|pm/.test(question)) {
    return parsed;
  }

  const lower = input.normalizedText.toLowerCase();
  const match = lower.match(/\bjam\s*(\d{1,2})(?:[.:](\d{1,2}))?(?:\s*(pagi|siang|sore|malam))?\b/i);
  if (!match) {
    return parsed;
  }

  const hourNum = Number(match[1]);
  const minuteNum = Number(match[2] ?? "0");
  const period = (match[3] ?? "").toLowerCase();

  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum) || hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
    return parsed;
  }

  let hour = hourNum;
  if (period === "pagi" && hour === 12) hour = 0;
  if (period === "siang" && hour >= 1 && hour <= 10) hour += 12;
  if (period === "sore" && hour >= 1 && hour <= 11) hour += 12;
  if (period === "malam") {
    if (hour === 12) hour = 0;
    else if (hour >= 1 && hour <= 11) hour += 12;
  }

  const dayOffset = parseDayOffset(lower);
  const now = input.now ?? new Date();
  const iso = buildTimezoneIsoAtDayOffset({
    now,
    timezone: input.timezone,
    dayOffset,
    hour,
    minute: minuteNum,
  });

  if (parsed.intent === "create_task") {
    return {
      ...parsed,
      time: `${pad2(hour)}.${pad2(minuteNum)}`,
      due_at: iso,
      needs_clarification: false,
      clarification_question: null,
    };
  }

  if (parsed.intent === "create_event") {
    return {
      ...parsed,
      time: `${pad2(hour)}.${pad2(minuteNum)}`,
      start_at: iso,
      needs_clarification: false,
      clarification_question: null,
    };
  }

  if (parsed.intent === "create_recurring_reminder") {
    return {
      ...parsed,
      time: `${pad2(hour)}.${pad2(minuteNum)}`,
      start_at: parsed.start_at ?? iso,
      due_at: parsed.due_at ?? null,
      needs_clarification: false,
      clarification_question: null,
    };
  }

  return parsed;
}
