import { loadEnvConfig } from "@next/env";

import { parseDeterministicReminder } from "../lib/parser/deterministic-reminder";
import {
  buildParserNlpSignals,
  enforceNlpAmbiguityGuard,
  resolveMeridiemAmbiguityForIndonesianHour,
  parseDeterministicAgendaIntent,
} from "../lib/parser/nlp-preprocess";
import { normalizeIncomingMessage } from "../lib/parser/normalize";
import { enforceParsedTemporalConsistency } from "../lib/parser/temporal-guard";
import { applyParsedFixups } from "../lib/parser/fixups";
import type { ParsedMessage } from "../schemas/message";

loadEnvConfig(process.cwd());

type SourceMode = "local" | "api";

type Expectation = {
  intent?: ParsedMessage["intent"];
  intentIn?: Array<ParsedMessage["intent"]>;
  needsClarification?: boolean;
  localDate?: string;
  hour?: number;
  minute?: number;
};

type BenchmarkCase = {
  id: string;
  text: string;
  expect: Expectation;
};

const DEFAULT_NOW_ISO = "2026-03-16T03:30:00+07:00";
const DEFAULT_TIMEZONE = "Asia/Jakarta";

const CASES: BenchmarkCase[] = [
  {
    id: "task-explicit-date-time",
    text: "aku ada tugas basis data tanggal 20 maret jam 23.59",
    expect: { intent: "create_task", needsClarification: false, localDate: "2026-03-20", hour: 23, minute: 59 },
  },
  {
    id: "event-weekly-class",
    text: "setiap senin jam 8 pagi kuliah AI",
    expect: { intentIn: ["create_event", "create_recurring_reminder"], needsClarification: false },
  },
  {
    id: "reminder-weekly",
    text: "ingetin aku tiap jumat jam 10 buat siap jumatan",
    expect: { intent: "create_recurring_reminder", needsClarification: false },
  },
  {
    id: "agenda-today",
    text: "hari ini ada apa aja?",
    expect: { intent: "get_today_agenda", needsClarification: false },
  },
  {
    id: "agenda-week",
    text: "minggu ini deadline apa?",
    expect: { intent: "get_week_agenda", needsClarification: false },
  },
  {
    id: "agenda-tomorrow",
    text: "agenda ku besok ada apa aja",
    expect: { intent: "get_today_agenda", needsClarification: false },
  },
  {
    id: "task-relative-besok",
    text: "besok jam 9 ada tugas AI",
    expect: { intent: "create_task", needsClarification: false, localDate: "2026-03-17", hour: 9, minute: 0 },
  },
  {
    id: "task-relative-lusa",
    text: "lusa jam 13.30 ada deadline IMK",
    expect: { intent: "create_task", needsClarification: false, localDate: "2026-03-18", hour: 13, minute: 30 },
  },
  {
    id: "event-explicit-slash-date",
    text: "ada rapat organisasi 18/03 jam 12.00",
    expect: { intentIn: ["create_event", "create_task"], needsClarification: false, localDate: "2026-03-18", hour: 12, minute: 0 },
  },
  {
    id: "update-deadline",
    text: "ubah deadline tugas AI jadi kamis",
    expect: { intent: "update_item" },
  },
  {
    id: "delete-item",
    text: "hapus tugas basis data",
    expect: { intent: "delete_item" },
  },
  {
    id: "ambiguous-nanti",
    text: "nanti ingetin aku belajar",
    expect: { intentIn: ["create_recurring_reminder", "create_task"], needsClarification: true },
  },
  {
    id: "ambiguous-malam",
    text: "malam ingetin aku review materi",
    expect: { intent: "create_recurring_reminder", needsClarification: true },
  },
  {
    id: "ambiguous-prayer-time",
    text: "ingetin abis dzuhur buat cek tugas",
    expect: { intent: "create_recurring_reminder", needsClarification: true },
  },
  {
    id: "ambiguous-weekday-depan",
    text: "jumat depan jam 9 ingetin aku konsultasi",
    expect: { intent: "create_recurring_reminder", needsClarification: true },
  },
  {
    id: "mixed-language-task",
    text: "please remind me to submit IMK assignment besok jam 10",
    expect: { intentIn: ["create_task", "create_recurring_reminder"], needsClarification: false, localDate: "2026-03-17", hour: 10, minute: 0 },
  },
  {
    id: "question-week-deadline",
    text: "deadline 7 hari ke depan apa aja?",
    expect: { intent: "get_week_agenda", needsClarification: false },
  },
  {
    id: "event-with-location",
    text: "kamis jam 15.00 ada meeting capstone di ruang 302",
    expect: { intentIn: ["create_event", "create_task"], needsClarification: false },
  },
  {
    id: "task-short",
    text: "tugas ppb senin jam 7",
    expect: { intent: "create_task" },
  },
  {
    id: "reminder-with-quote",
    text: "coba nanti kirim chat ke aku \"ping\" jam 02.10",
    expect: { intent: "create_recurring_reminder", needsClarification: true },
  },
  {
    id: "agenda-english",
    text: "what do i have today?",
    expect: { intent: "get_today_agenda", needsClarification: false },
  },
  {
    id: "agenda-next-week",
    text: "next week schedule apa aja",
    expect: { intent: "get_week_agenda", needsClarification: false },
  },
  {
    id: "delete-event",
    text: "delete event rapat organisasi x",
    expect: { intent: "delete_item" },
  },
  {
    id: "reschedule-event",
    text: "reschedule kelas ai jadi selasa jam 10",
    expect: { intent: "update_item" },
  },
  {
    id: "just-time-no-date",
    text: "ingatkan aku jam 8",
    expect: { intent: "create_recurring_reminder", needsClarification: true },
  },
];

function parseArg(prefix: string) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function getArgBoolean(name: string, defaultValue: boolean) {
  if (process.argv.includes(`--${name}`)) return true;
  if (process.argv.includes(`--no-${name}`)) return false;
  return defaultValue;
}

function getMainIso(parsed: ParsedMessage): string | null {
  if (parsed.intent === "create_task") return parsed.due_at ?? null;
  if (parsed.intent === "create_event") return parsed.start_at ?? null;
  if (parsed.intent === "create_recurring_reminder") return parsed.start_at ?? parsed.due_at ?? null;
  return null;
}

function getLocalParts(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

async function parseViaLocal(input: {
  text: string;
  timezone: string;
  nowISO: string;
  useAI: boolean;
}): Promise<{ parsed: ParsedMessage | null; skippedReason?: string }> {
  const normalizedText = normalizeIncomingMessage(input.text);
  const nlpSignals = buildParserNlpSignals(normalizedText);
  const now = new Date(input.nowISO);

  const deterministicParsed =
    parseDeterministicAgendaIntent(normalizedText) ??
    parseDeterministicReminder(normalizedText, input.timezone);

  let parsedFromAI = deterministicParsed;
  if (!parsedFromAI && input.useAI) {
    const { parseMessageWithAI } = await import("../lib/openai/parser");
    parsedFromAI = await parseMessageWithAI({
      text: normalizedText,
      timezone: input.timezone,
      nowISO: input.nowISO,
      nlpSignals,
    });
  }

  if (!parsedFromAI) {
    return { parsed: null, skippedReason: "requires-ai" };
  }

  const parsedWithTemporalGuard = enforceParsedTemporalConsistency({
    parsed: parsedFromAI,
    normalizedText,
    timezone: input.timezone,
    now,
  });

  const parsedWithNlpGuard = enforceNlpAmbiguityGuard({
    parsed: parsedWithTemporalGuard,
    nlpSignals,
  });

  const parsedAfterMeridiem = resolveMeridiemAmbiguityForIndonesianHour({
    parsed: parsedWithNlpGuard,
    normalizedText,
    timezone: input.timezone,
    now,
  });

  const parsed = applyParsedFixups({
    parsed: parsedAfterMeridiem,
    normalizedText,
    timezone: input.timezone,
    now,
  });

  return { parsed };
}

async function parseViaApi(input: {
  text: string;
  timezone: string;
  nowISO: string;
  baseUrl: string;
}): Promise<{ parsed: ParsedMessage | null; skippedReason?: string; status?: number }> {
  const response = await fetch(`${input.baseUrl}/api/parse-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: input.text,
      timezone: input.timezone,
      now_iso: input.nowISO,
    }),
  });

  const json = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: ParsedMessage; error?: string }
    | null;

  if (!response.ok || !json?.ok || !json.data) {
    return { parsed: null, skippedReason: `api-error:${json?.error ?? "unknown"}`, status: response.status };
  }

  return { parsed: json.data };
}

function evaluateExpectation(parsed: ParsedMessage, expectation: Expectation, timezone: string) {
  const errors: string[] = [];

  if (expectation.intent && parsed.intent !== expectation.intent) {
    errors.push(`intent expected=${expectation.intent} got=${parsed.intent}`);
  }

  if (expectation.intentIn && !expectation.intentIn.includes(parsed.intent)) {
    errors.push(`intent expected one-of=[${expectation.intentIn.join(",")}] got=${parsed.intent}`);
  }

  if (
    typeof expectation.needsClarification === "boolean" &&
    parsed.needs_clarification !== expectation.needsClarification
  ) {
    errors.push(
      `needs_clarification expected=${expectation.needsClarification} got=${parsed.needs_clarification}`,
    );
  }

  const expectsTemporal =
    typeof expectation.localDate === "string" ||
    typeof expectation.hour === "number" ||
    typeof expectation.minute === "number";

  if (expectsTemporal) {
    const mainIso = getMainIso(parsed);
    if (!mainIso) {
      errors.push("temporal expected but due_at/start_at missing");
    } else {
      const local = getLocalParts(mainIso, timezone);
      if (!local) {
        errors.push(`invalid datetime=${mainIso}`);
      } else {
        if (expectation.localDate && local.date !== expectation.localDate) {
          errors.push(`localDate expected=${expectation.localDate} got=${local.date}`);
        }
        if (typeof expectation.hour === "number" && local.hour !== expectation.hour) {
          errors.push(`hour expected=${expectation.hour} got=${local.hour}`);
        }
        if (typeof expectation.minute === "number" && local.minute !== expectation.minute) {
          errors.push(`minute expected=${expectation.minute} got=${local.minute}`);
        }
      }
    }
  }

  return { pass: errors.length === 0, errors };
}

async function main() {
  const source = (parseArg("--source=") ?? "local") as SourceMode;
  const timezone = parseArg("--timezone=") ?? DEFAULT_TIMEZONE;
  const nowISO = parseArg("--now=") ?? DEFAULT_NOW_ISO;
  const baseUrl = (parseArg("--base-url=") ?? "http://localhost:3000").replace(/\/+$/, "");
  const useAI = getArgBoolean("ai", Boolean(process.env.OPENAI_API_KEY));

  if (source !== "local" && source !== "api") {
    throw new Error(`invalid --source=${source} (use local|api)`);
  }

  console.log("[benchmark:nlp] starting");
  console.log(`[benchmark:nlp] source=${source}`);
  console.log(`[benchmark:nlp] timezone=${timezone}`);
  console.log(`[benchmark:nlp] now_iso=${nowISO}`);
  console.log(`[benchmark:nlp] use_ai=${useAI}`);
  if (source === "api") {
    console.log(`[benchmark:nlp] base_url=${baseUrl}`);
  }
  console.log(`[benchmark:nlp] total_cases=${CASES.length}`);

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const [index, testCase] of CASES.entries()) {
    let parseResult: { parsed: ParsedMessage | null; skippedReason?: string; status?: number };

    if (source === "api") {
      parseResult = await parseViaApi({
        text: testCase.text,
        timezone,
        nowISO,
        baseUrl,
      });
    } else {
      parseResult = await parseViaLocal({
        text: testCase.text,
        timezone,
        nowISO,
        useAI,
      });
    }

    if (!parseResult.parsed) {
      skipCount += 1;
      console.log(`\n[${index + 1}/${CASES.length}] SKIP ${testCase.id}`);
      console.log(`  text: ${testCase.text}`);
      console.log(`  reason: ${parseResult.skippedReason ?? "unknown"}`);
      continue;
    }

    const review = evaluateExpectation(parseResult.parsed, testCase.expect, timezone);

    if (review.pass) {
      passCount += 1;
      console.log(`\n[${index + 1}/${CASES.length}] PASS ${testCase.id}`);
      console.log(`  text: ${testCase.text}`);
      console.log(`  parsed: intent=${parseResult.parsed.intent} needs_clarification=${parseResult.parsed.needs_clarification}`);
    } else {
      failCount += 1;
      console.log(`\n[${index + 1}/${CASES.length}] FAIL ${testCase.id}`);
      console.log(`  text: ${testCase.text}`);
      console.log(`  parsed: ${JSON.stringify(parseResult.parsed, null, 2)}`);
      for (const err of review.errors) {
        console.log(`  - ${err}`);
      }
    }
  }

  const executed = passCount + failCount;
  const score = executed > 0 ? ((passCount / executed) * 100).toFixed(1) : "0.0";

  console.log("\n[benchmark:nlp] summary");
  console.log(`  pass=${passCount}`);
  console.log(`  fail=${failCount}`);
  console.log(`  skip=${skipCount}`);
  console.log(`  score=${score}% (excluding skipped)`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[benchmark:nlp] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});












