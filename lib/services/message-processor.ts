import {
  getTodayAgenda,
  getTomorrowAgenda,
  getWeekAgenda,
  formatAgendaMessage,
} from "@/lib/agenda/service";
import { parseMessageWithAI } from "@/lib/openai/parser";
import { normalizeIncomingMessage } from "@/lib/parser/normalize";
import { parseDeterministicReminder } from "@/lib/parser/deterministic-reminder";
import {
  buildParserNlpSignals,
  enforceNlpAmbiguityGuard,
  resolveMeridiemAmbiguityForIndonesianHour,
  parseDeterministicAgendaIntent,
} from "@/lib/parser/nlp-preprocess";
import { enforceParsedTemporalConsistency } from "@/lib/parser/temporal-guard";
import { applyParsedFixups } from "@/lib/parser/fixups";
import {
  createEvent,
  createRecurrenceRule,
  createTask,
  deleteEvent,
  deleteTask,
  findEventByTitle,
  findTaskByTitle,
  getLatestInboundPendingClarification,
  ensureUserByDiscord,
  logInboundRawMessage,
  logOutboundRawMessage,
  updateEvent,
  updateRawMessageProcessing,
  updateTask,
} from "@/lib/services/data-service";
import {
  scheduleCustomRecurringReminder,
  scheduleEventReminders,
  scheduleTaskReminders,
} from "@/lib/reminders/service";
import { parsedMessageSchema, type ParsedMessage } from "@/schemas/message";

type MessageChannel = "discord";

interface IncomingChatTextInput {
  channel: MessageChannel;
  from: string;
  text: string;
  rawPayload: Record<string, unknown>;
  sendText: (params: { to: string; text: string }) => Promise<unknown>;
}

function formatDateLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

function refineParsedForReminderPhrase(
  parsed: ParsedMessage,
  normalizedText: string,
  timezone: string,
): ParsedMessage {
  const lower = normalizedText.toLowerCase();
  const hasReminderVerb =
    /(?:ingetin|ingatkan|remind|kirim aku chat|kirim chat|kirim pesan|ping)/i.test(
      lower,
    );
  const clockMatch = lower.match(/\bjam\s*(\d{1,2})[.:](\d{2})\b/i);

  if (!hasReminderVerb || !clockMatch) {
    return parsed;
  }

  if (
    parsed.intent === "create_recurring_reminder" &&
    (parsed.start_at || parsed.due_at || parsed.needs_clarification)
  ) {
    return parsed;
  }

  const hour = clockMatch[1].padStart(2, "0");
  const minute = clockMatch[2];
  const timeLabel = `${hour}.${minute}`;

  const now = new Date();
  const todayLabel = formatDateLabel(now, timezone);
  const tomorrowLabel = formatDateLabel(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    timezone,
  );

  return {
    ...parsed,
    intent: "create_recurring_reminder",
    start_at: null,
    due_at: null,
    needs_clarification: true,
    clarification_question: `Untuk jam ${timeLabel} nanti, maksudnya hari ini (${todayLabel}) atau besok (${tomorrowLabel})?`,
  };
}

function getDiscordDisplayName(payload: Record<string, unknown>) {
  const username = payload.author_username;
  if (typeof username === "string" && username.trim().length > 0) {
    return username.trim();
  }

  const globalName = payload.author_global_name;
  if (typeof globalName === "string" && globalName.trim().length > 0) {
    return globalName.trim();
  }

  return null;
}

async function sendAndLog(params: {
  userId: string;
  channel: MessageChannel;
  to: string;
  text: string;
  sendText: (params: { to: string; text: string }) => Promise<unknown>;
  parsed?: ParsedMessage | null;
  status?: "parsed" | "needs_clarification" | "processed" | "failed";
}) {
  await params.sendText({ to: params.to, text: params.text });
  await logOutboundRawMessage({
    userId: params.userId,
    text: params.text,
    parsed: params.parsed ?? null,
    status: params.status ?? "processed",
    channel: params.channel,
  });
}

function missingFieldQuestion(parsed: ParsedMessage) {
  if (parsed.intent === "create_task" && !parsed.due_at) {
    return "Deadline tugasnya kapan? Tolong kirim tanggal dan jam yang jelas.";
  }
  if (parsed.intent === "create_event" && !parsed.start_at) {
    return "Eventnya mulai kapan? Tolong kirim tanggal dan jam yang jelas.";
  }
  if (
    parsed.intent === "create_recurring_reminder" &&
    !parsed.start_at &&
    !parsed.due_at
  ) {
    return "Pengingat rutinnya mulai kapan? Tolong kirim tanggal dan jam awal.";
  }
  if (
    (parsed.intent === "create_task" || parsed.intent === "create_event") &&
    !parsed.title
  ) {
    return "Judul item belum jelas. Tolong kirim judul tugas/eventnya.";
  }

  return "Mohon perjelas detail jadwalnya ya.";
}

function buildConfirmationText(
  parsed: ParsedMessage,
  refTitle: string,
  refTimeISO?: string | null,
) {
  const timeInfo = refTimeISO
    ? `\nWaktu: ${new Date(refTimeISO).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`
    : "";

  switch (parsed.intent) {
    case "create_task":
      return `Siap, tugas dicatat: ${refTitle}${timeInfo}`;
    case "create_event":
      return `Siap, event dicatat: ${refTitle}${timeInfo}`;
    case "create_recurring_reminder":
      return `Siap, pengingat rutin dibuat: ${refTitle}${timeInfo}`;
    case "update_item":
      return `Siap, item berhasil diupdate: ${refTitle}`;
    case "delete_item":
      return `Siap, item berhasil dihapus: ${refTitle}`;
    default:
      return "Perintah berhasil diproses.";
  }
}

function toParsedMessage(value: unknown): ParsedMessage | null {
  const result = parsedMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseClock(input: string) {
  const match = input.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
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

function parseDayChoiceReply(normalizedText: string) {
  const lower = normalizedText.toLowerCase();

  if (/\bbesok\b/.test(lower)) {
    return 1;
  }
  if (/\bhari\s+ini\b/.test(lower) || /\bsekarang\b/.test(lower)) {
    return 0;
  }

  return null;
}

function getPendingReminderClock(parsed: ParsedMessage) {
  if (typeof parsed.time === "string") {
    const fromTime = parseClock(parsed.time);
    if (fromTime) {
      return fromTime;
    }
  }

  if (typeof parsed.clarification_question === "string") {
    const fromQuestion = parseClock(parsed.clarification_question);
    if (fromQuestion) {
      return fromQuestion;
    }
  }

  return null;
}

function resolvePendingReminderClarification(input: {
  pending: ParsedMessage;
  normalizedText: string;
  timezone: string;
  now: Date;
}) {
  if (input.pending.intent !== "create_recurring_reminder") {
    return null;
  }
  if (!input.pending.needs_clarification) {
    return null;
  }
  if (input.pending.start_at || input.pending.due_at) {
    return null;
  }

  const dayOffset = parseDayChoiceReply(input.normalizedText);
  if (dayOffset === null) {
    return null;
  }

  const clock = getPendingReminderClock(input.pending);
  if (!clock) {
    return null;
  }

  const startAt = buildTimezoneIsoAtDayOffset({
    now: input.now,
    timezone: input.timezone,
    dayOffset,
    hour: clock.hour,
    minute: clock.minute,
  });

  return parsedMessageSchema.parse({
    ...input.pending,
    start_at: startAt,
    due_at: null,
    needs_clarification: false,
    clarification_question: null,
  });
}
export async function receiveIncomingChatMessage(input: IncomingChatTextInput) {
  const user = await ensureUserByDiscord({
    discordUserId: input.from,
    fullName: getDiscordDisplayName(input.rawPayload),
  });

  const normalizedText = normalizeIncomingMessage(input.text);
  const nlpSignals = buildParserNlpSignals(normalizedText);
  const now = new Date();
  const nowISO = now.toISOString();

  const pendingClarification = await getLatestInboundPendingClarification(
    user.id,
  );
  const pendingParsed = pendingClarification
    ? toParsedMessage(pendingClarification.parsed_json)
    : null;

  const resolvedFromPending = pendingParsed
    ? resolvePendingReminderClarification({
        pending: pendingParsed,
        normalizedText,
        timezone: user.timezone,
        now,
      })
    : null;

  const inboundRawMessageId = await logInboundRawMessage({
    userId: user.id,
    text: input.text,
    payload: input.rawPayload,
    channel: input.channel,
  });

  const deterministicParsed = resolvedFromPending
    ? null
    : parseDeterministicAgendaIntent(normalizedText) ??
      parseDeterministicReminder(normalizedText, user.timezone);

  const parsedFromAI =
    resolvedFromPending ??
    deterministicParsed ??
    (await parseMessageWithAI({
      text: normalizedText,
      timezone: user.timezone,
      userId: user.id,
      nowISO,
      nlpSignals,
    }));

  const refinedParsed = refineParsedForReminderPhrase(
    parsedFromAI,
    normalizedText,
    user.timezone,
  );

  const parsedWithTemporalGuard = enforceParsedTemporalConsistency({
    parsed: refinedParsed,
    normalizedText,
    timezone: user.timezone,
    now,
  });

  const parsedWithNlpGuard = enforceNlpAmbiguityGuard({
    parsed: parsedWithTemporalGuard,
    nlpSignals,
  });

  const parsedAfterMeridiem = resolveMeridiemAmbiguityForIndonesianHour({
    parsed: parsedWithNlpGuard,
    normalizedText,
    timezone: user.timezone,
    now,
  });

  const parsed = applyParsedFixups({
    parsed: parsedAfterMeridiem,
    normalizedText,
    timezone: user.timezone,
    now,
  });

  await updateRawMessageProcessing({
    id: inboundRawMessageId,
    parsed,
    status: "parsed",
  });

  if (resolvedFromPending && pendingClarification) {
    await updateRawMessageProcessing({
      id: pendingClarification.id,
      parsed: resolvedFromPending,
      status: "processed",
    });
  }

  if (parsed.needs_clarification) {
    const clarification =
      parsed.clarification_question ??
      "Bisa diperjelas waktunya supaya aku bisa catat dengan tepat?";

    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text: clarification,
      sendText: input.sendText,
      parsed,
      status: "needs_clarification",
    });

    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "needs_clarification",
    });

    return {
      status: "needs_clarification" as const,
      parsed,
    };
  }

  if (
    (parsed.intent === "create_task" ||
      parsed.intent === "create_event" ||
      parsed.intent === "create_recurring_reminder") &&
    (!parsed.title ||
      (parsed.intent === "create_task" && !parsed.due_at) ||
      (parsed.intent === "create_event" && !parsed.start_at))
  ) {
    const question = missingFieldQuestion(parsed);

    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text: question,
      sendText: input.sendText,
      parsed,
      status: "needs_clarification",
    });

    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "needs_clarification",
    });

    return {
      status: "needs_clarification" as const,
      parsed,
    };
  }

  if (parsed.intent === "get_today_agenda" || parsed.intent === "get_week_agenda") {
    const lower = normalizedText.toLowerCase();
    const asksTomorrow = /\bbesok\b/.test(lower);

    const agenda = asksTomorrow
      ? await getTomorrowAgenda(user.id)
      : parsed.intent === "get_today_agenda"
        ? await getTodayAgenda(user.id)
        : await getWeekAgenda(user.id);

    const type = asksTomorrow
      ? "tomorrow"
      : parsed.intent === "get_today_agenda"
        ? "today"
        : "week";

    const text = formatAgendaMessage({ type, items: agenda.items });

    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text,
      sendText: input.sendText,
      parsed,
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "processed",
    });

    return {
      status: "processed" as const,
      parsed,
      action: asksTomorrow
        ? ("agenda_tomorrow" as const)
        : parsed.intent === "get_today_agenda"
          ? ("agenda_today" as const)
          : ("agenda_week" as const),
    };
  }

  if (parsed.intent === "create_task") {
    const task = await createTask({
      userId: user.id,
      title: parsed.title!,
      description: parsed.description ?? null,
      dueAt: parsed.due_at!,
      source: "discord",
      rawInput: input.text,
    });

    await scheduleTaskReminders({
      userId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      dueAt: task.due_at,
      offsets: parsed.reminder_offsets,
    });

    const text = buildConfirmationText(parsed, task.title, task.due_at);
    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text,
      sendText: input.sendText,
      parsed,
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "processed",
    });

    return {
      status: "processed" as const,
      parsed,
      action: "create_task" as const,
      entity: task,
    };
  }

  if (parsed.intent === "create_event") {
    const event = await createEvent({
      userId: user.id,
      title: parsed.title!,
      description: parsed.description ?? null,
      startAt: parsed.start_at!,
      endAt: parsed.end_at ?? null,
      location: parsed.location ?? null,
      source: "discord",
      rawInput: input.text,
    });

    await scheduleEventReminders({
      userId: user.id,
      eventId: event.id,
      eventTitle: event.title,
      startAt: event.start_at,
      offsets: parsed.reminder_offsets,
    });

    const text = buildConfirmationText(parsed, event.title, event.start_at);
    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text,
      sendText: input.sendText,
      parsed,
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "processed",
    });

    return {
      status: "processed" as const,
      parsed,
      action: "create_event" as const,
      entity: event,
    };
  }

  if (parsed.intent === "create_recurring_reminder") {
    const startAt = parsed.start_at ?? parsed.due_at;
    if (!startAt || !parsed.title) {
      const question = missingFieldQuestion(parsed);
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text: question,
        sendText: input.sendText,
        parsed,
        status: "needs_clarification",
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "needs_clarification",
      });
      return { status: "needs_clarification" as const, parsed };
    }

    const reminder = await scheduleCustomRecurringReminder({
      userId: user.id,
      title: parsed.title,
      remindAtISO: startAt,
      message: parsed.description ?? parsed.title,
    });

    if (parsed.recurrence?.frequency) {
      await createRecurrenceRule({
        userId: user.id,
        entityType: "reminder",
        entityId: reminder[0]?.id ?? null,
        frequency: parsed.recurrence.frequency,
        intervalValue: parsed.recurrence.interval_value ?? 1,
        byDay: parsed.recurrence.by_day ?? null,
        byMonthDay: parsed.recurrence.by_month_day ?? null,
        startDate: parsed.recurrence.start_date ?? startAt.slice(0, 10),
        endDate: parsed.recurrence.end_date ?? null,
        rawRuleText: parsed.recurrence.raw_rule_text ?? input.text,
      });
    }

    const text = buildConfirmationText(parsed, parsed.title, startAt);
    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text,
      sendText: input.sendText,
      parsed,
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "processed",
    });

    return {
      status: "processed" as const,
      parsed,
      action: "create_recurring_reminder" as const,
    };
  }

  if (parsed.intent === "update_item") {
    const ref = parsed.target_reference ?? parsed.title;
    if (!ref || !parsed.updates || Object.keys(parsed.updates).length === 0) {
      const question =
        "Item yang mau diubah belum jelas. Sebutkan judul item dan perubahan yang diinginkan.";
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text: question,
        sendText: input.sendText,
        parsed,
        status: "needs_clarification",
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "needs_clarification",
      });
      return { status: "needs_clarification" as const, parsed };
    }

    const task = await findTaskByTitle(user.id, ref);
    if (task) {
      const patch: Record<string, unknown> = {};
      if (typeof parsed.updates.title === "string")
        patch.title = parsed.updates.title;
      if (
        typeof parsed.updates.description === "string" ||
        parsed.updates.description === null
      )
        patch.description = parsed.updates.description;
      if (typeof parsed.updates.due_at === "string")
        patch.due_at = parsed.updates.due_at;
      if (typeof parsed.updates.status === "string")
        patch.status = parsed.updates.status;

      const updated = await updateTask({
        userId: user.id,
        taskId: task.id,
        patch,
      });
      const text = buildConfirmationText(parsed, updated.title);
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text,
        sendText: input.sendText,
        parsed,
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "processed",
      });
      return {
        status: "processed" as const,
        parsed,
        action: "update_task" as const,
        entity: updated,
      };
    }

    const event = await findEventByTitle(user.id, ref);
    if (event) {
      const patch: Record<string, unknown> = {};
      if (typeof parsed.updates.title === "string")
        patch.title = parsed.updates.title;
      if (
        typeof parsed.updates.description === "string" ||
        parsed.updates.description === null
      )
        patch.description = parsed.updates.description;
      if (typeof parsed.updates.start_at === "string")
        patch.start_at = parsed.updates.start_at;
      if (
        typeof parsed.updates.end_at === "string" ||
        parsed.updates.end_at === null
      )
        patch.end_at = parsed.updates.end_at;
      if (
        typeof parsed.updates.location === "string" ||
        parsed.updates.location === null
      )
        patch.location = parsed.updates.location;

      const updated = await updateEvent({
        userId: user.id,
        eventId: event.id,
        patch,
      });
      const text = buildConfirmationText(parsed, updated.title);
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text,
        sendText: input.sendText,
        parsed,
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "processed",
      });
      return {
        status: "processed" as const,
        parsed,
        action: "update_event" as const,
        entity: updated,
      };
    }

    const notFound =
      "Aku belum menemukan item yang dimaksud. Coba sebutkan judul persisnya ya.";
    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text: notFound,
      sendText: input.sendText,
      parsed,
      status: "needs_clarification",
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "needs_clarification",
    });
    return { status: "needs_clarification" as const, parsed };
  }

  if (parsed.intent === "delete_item") {
    const ref = parsed.target_reference ?? parsed.title;
    if (!ref) {
      const question =
        "Item yang mau dihapus belum jelas. Sebutkan judul itemnya.";
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text: question,
        sendText: input.sendText,
        parsed,
        status: "needs_clarification",
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "needs_clarification",
      });
      return { status: "needs_clarification" as const, parsed };
    }

    const task = await findTaskByTitle(user.id, ref);
    if (task) {
      await deleteTask({ userId: user.id, taskId: task.id });
      const text = buildConfirmationText(parsed, task.title);
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text,
        sendText: input.sendText,
        parsed,
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "processed",
      });
      return {
        status: "processed" as const,
        parsed,
        action: "delete_task" as const,
      };
    }

    const event = await findEventByTitle(user.id, ref);
    if (event) {
      await deleteEvent({ userId: user.id, eventId: event.id });
      const text = buildConfirmationText(parsed, event.title);
      await sendAndLog({
        userId: user.id,
        channel: input.channel,
        to: input.from,
        text,
        sendText: input.sendText,
        parsed,
      });
      await updateRawMessageProcessing({
        id: inboundRawMessageId,
        parsed,
        status: "processed",
      });
      return {
        status: "processed" as const,
        parsed,
        action: "delete_event" as const,
      };
    }

    const notFound =
      "Aku belum menemukan item yang dimaksud. Coba sebutkan judul persisnya ya.";
    await sendAndLog({
      userId: user.id,
      channel: input.channel,
      to: input.from,
      text: notFound,
      sendText: input.sendText,
      parsed,
      status: "needs_clarification",
    });
    await updateRawMessageProcessing({
      id: inboundRawMessageId,
      parsed,
      status: "needs_clarification",
    });
    return { status: "needs_clarification" as const, parsed };
  }

  await sendAndLog({
    userId: user.id,
    channel: input.channel,
    to: input.from,
    text: "Intent belum didukung untuk aksi ini.",
    sendText: input.sendText,
    parsed,
    status: "failed",
  });
  await updateRawMessageProcessing({
    id: inboundRawMessageId,
    parsed,
    status: "failed",
  });

  return { status: "failed" as const, parsed };
}


























