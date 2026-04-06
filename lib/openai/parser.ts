import { env } from "@/lib/env";
import { getAiProviderName, openai } from "@/lib/openai/client";
import type { ParserNlpSignals } from "@/lib/parser/nlp-preprocess";
import { parsedMessageSchema, type ParsedMessage } from "@/schemas/message";

const parserSystemPrompt = [
  "You are a strict intent-and-time parser for a reminder and task management assistant with per-user data isolation.",
  "Primary goals: accurate CRUD intent extraction, safe date-time interpretation, and concise Indonesian clarification.",
  "Input language can be Indonesian or mixed Indonesian-English.",
  "Never fabricate reminder IDs, schedules, status, user data, or any unsupported fields.",
  "Use now_iso, now_local_date, now_local_time, now_local_weekday, and timezone as the only reference for relative expressions.",
  "Always resolve relative time in the provided user timezone, not server timezone.",
  "Return only fields that match the JSON schema.",
  "If date/time is ambiguous and can cause wrong action, set needs_clarification=true and ask one short Indonesian question.",
  "If explicit time conflicts with parsed output, set needs_clarification=true.",
  "If requested create time is in the past relative to now_iso, set needs_clarification=true and ask for a new time.",
  "Supported intents: create_task, create_event, create_recurring_reminder, get_today_agenda, get_week_agenda, update_item, delete_item.",
  "For reminder_offsets return ISO-8601 durations relative to due/start time. Example: P1D, PT2H.",
  "For agenda intents, never create/update/delete data. Only set agenda intent.",
  "For update_item/delete_item, require clear target_reference or title. If unclear, ask clarification.",
  "If user explicitly mentions date/time tokens (for example tanggal 20 maret, 20/03, weekday names, or jam 23.59), preserve that semantics in due_at/start_at/end_at.",
  "For relative terms like hari ini, besok, lusa, resolve using now_local_date in user timezone.",
  "For due_at/start_at/end_at always output full ISO-8601 datetime with timezone offset, for example 2026-03-20T23:59:00+07:00.",
  "Input contains nlp_signals (intent_hint, intent_confidence, temporal cues, ambiguous_phrases). Use them as strong hints unless user text clearly contradicts them.",
  "If ambiguous_phrases exists and explicit date/time anchors are missing, ask clarification instead of guessing.",
  "In Indonesian, phrase like jam 9 means 09:00 local time (not 21:00) unless user explicitly indicates malam/sore/PM.",
].join(" ");

const fallbackJsonInstruction = [
  "Return ONLY valid JSON object.",
  "No markdown, no explanation, no code fence.",
  "Use these keys exactly:",
  "intent, title, description, date, time, due_at, start_at, end_at, location, recurrence, reminder_offsets, target_reference, updates, needs_clarification, clarification_question.",
  "For missing values, use null.",
  "reminder_offsets must be array (can be empty).",
  "needs_clarification must be boolean.",
].join(" ");

const parserHardFallbackQuestion =
  "Aku belum nangkep format pesannya. Coba tulis lebih spesifik, misalnya: 'tugas basis data tanggal 20 maret jam 23.00'.";

function buildHardFallbackParsed(): ParsedMessage {
  return parsedMessageSchema.parse({
    intent: "create_task",
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
    needs_clarification: true,
    clarification_question: parserHardFallbackQuestion,
  });
}

function parserJsonSchema(timezone: string) {
  return {
    name: "parsed_message",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        intent: {
          type: "string",
          enum: [
            "create_task",
            "create_event",
            "create_recurring_reminder",
            "get_today_agenda",
            "get_week_agenda",
            "update_item",
            "delete_item",
          ],
        },
        title: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        date: { type: ["string", "null"] },
        time: { type: ["string", "null"] },
        due_at: {
          type: ["string", "null"],
          description: `ISO datetime with timezone offset (${timezone})`,
        },
        start_at: {
          type: ["string", "null"],
          description: `ISO datetime with timezone offset (${timezone})`,
        },
        end_at: {
          type: ["string", "null"],
          description: `ISO datetime with timezone offset (${timezone})`,
        },
        location: { type: ["string", "null"] },
        recurrence: {
          type: ["object", "null"],
          additionalProperties: false,
          properties: {
            frequency: {
              type: ["string", "null"],
              enum: ["daily", "weekly", "monthly", "custom", null],
            },
            interval_value: { type: ["number", "null"] },
            by_day: {
              type: ["array", "null"],
              items: { type: "string" },
            },
            by_month_day: {
              type: ["array", "null"],
              items: { type: "number" },
            },
            start_date: { type: ["string", "null"] },
            end_date: { type: ["string", "null"] },
            raw_rule_text: { type: ["string", "null"] },
          },
        },
        reminder_offsets: {
          type: "array",
          items: { type: "string" },
        },
        target_reference: { type: ["string", "null"] },
        updates: {
          type: ["object", "null"],
          additionalProperties: true,
        },
        needs_clarification: { type: "boolean" },
        clarification_question: { type: ["string", "null"] },
      },
      required: [
        "intent",
        "reminder_offsets",
        "needs_clarification",
        "clarification_question",
      ],
    },
    strict: true,
  } as const;
}

function extractFirstJsonObject(raw: string) {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Parser did not return valid JSON object");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function getParserModel() {
  const overrideModel = env.OPENAI_PARSER_MODEL?.trim();
  return overrideModel && overrideModel.length > 0 ? overrideModel : env.OPENAI_MODEL;
}

function buildNowContext(nowISO: string, timezone: string) {
  const nowDate = new Date(nowISO);
  if (Number.isNaN(nowDate.getTime())) {
    return {
      now_iso: nowISO,
      timezone,
      now_local_date: null,
      now_local_time: null,
      now_local_weekday: null,
    };
  }

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(nowDate);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? "";

  const nowLocalDate = `${pick("year")}-${pick("month")}-${pick("day")}`;
  const nowLocalTime = `${pick("hour")}:${pick("minute")}`;
  const nowLocalWeekday = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    weekday: "long",
  }).format(nowDate);

  return {
    now_iso: nowISO,
    timezone,
    now_local_date: nowLocalDate,
    now_local_time: nowLocalTime,
    now_local_weekday: nowLocalWeekday,
  };
}

async function logUsage(input: {
  userId?: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}) {
  if (!input.usage) {
    return;
  }

  try {
    const { logAiUsageEvent } = await import("@/lib/services/data-service");

    await logAiUsageEvent({
      userId: input.userId,
      provider: getAiProviderName(),
      model: input.model,
      requestType: "parser",
      promptTokens: input.usage.prompt_tokens,
      completionTokens: input.usage.completion_tokens,
      totalTokens: input.usage.total_tokens,
    });
  } catch {
    // Ignore usage logging errors so parser flow keeps running.
    // This allows parser to run in non-Next runtime (e.g. CLI benchmark) without server-only modules.
  }
}

export async function parseMessageWithAI(params: {
  text: string;
  timezone: string;
  nowISO?: string;
  userId?: string;
  nlpSignals?: ParserNlpSignals;
}): Promise<ParsedMessage> {
  const nowISO = params.nowISO ?? new Date().toISOString();
  const parserModel = getParserModel();

  const baseUserPayload = {
    ...buildNowContext(nowISO, params.timezone),
    text: params.text,
    nlp_signals: params.nlpSignals ?? null,
  };

  try {
    const completion = await openai.chat.completions.create({
      model: parserModel,
      temperature: 0,
      messages: [
        { role: "system", content: parserSystemPrompt },
        {
          role: "user",
          content: JSON.stringify(baseUserPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: parserJsonSchema(params.timezone),
      },
    });

    await logUsage({
      userId: params.userId,
      model: parserModel,
      usage: completion.usage,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Parser returned empty response");
    }

    const parsed = JSON.parse(raw);
    return parsedMessageSchema.parse(parsed);
  } catch (primaryError) {
    try {
      const fallbackCompletion = await openai.chat.completions.create({
        model: parserModel,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `${parserSystemPrompt} ${fallbackJsonInstruction}`,
          },
          {
            role: "user",
            content: JSON.stringify(baseUserPayload),
          },
        ],
      });

      await logUsage({
        userId: params.userId,
        model: parserModel,
        usage: fallbackCompletion.usage,
      });

      const fallbackRaw = fallbackCompletion.choices[0]?.message?.content;
      if (!fallbackRaw) {
        throw primaryError;
      }

      const parsed = JSON.parse(extractFirstJsonObject(fallbackRaw));
      return parsedMessageSchema.parse(parsed);
    } catch {
      return buildHardFallbackParsed();
    }
  }
}







