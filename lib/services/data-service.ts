import {
  Prisma,
  type entity_type,
  type item_source,
  type message_channel,
  type message_direction,
  type processing_status,
  type recurrence_frequency,
  type reminder_status,
  type reminder_type,
  type task_status,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ParsedMessage } from "@/schemas/message";

export interface AppUser {
  id: string;
  full_name: string;
  discord_user_id: string | null;
  timezone: string;
}

type ProcessingStatusValue =
  | "parsed"
  | "needs_clarification"
  | "processed"
  | "failed";

type AppItemSource = item_source;
type AppMessageChannel = message_channel;

type TaskRecord = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: task_status;
  source: "discord" | "dashboard";
  raw_input: string | null;
  created_at: string;
  updated_at: string;
};

type EventRecord = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  source: "discord" | "dashboard";
  raw_input: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderRecord = {
  id: string;
  user_id: string;
  entity_type: entity_type;
  entity_id: string | null;
  reminder_type: reminder_type;
  remind_at: string;
  status: reminder_status;
  channel: AppMessageChannel;
  message_template: string;
  created_at: string;
  updated_at: string;
};

type RecurrenceRecord = {
  id: string;
  user_id: string;
  entity_type: entity_type;
  entity_id: string | null;
  frequency: recurrence_frequency;
  interval_value: number;
  by_day: string[] | null;
  by_month_day: number[] | null;
  start_date: string;
  end_date: string | null;
  raw_rule_text: string | null;
  created_at: string;
  updated_at: string;
};

type RawMessageRecord = {
  id: string;
  user_id: string | null;
  direction: message_direction;
  channel: AppMessageChannel;
  message_text: string | null;
  payload_json: Record<string, unknown>;
  parsed_json: Record<string, unknown> | null;
  processing_status: processing_status;
  created_at: string;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toDateOnly(value: Date | null | undefined) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function serializeTask(row: {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: Date;
  status: task_status;
  source: AppItemSource;
  raw_input: string | null;
  created_at: Date;
  updated_at: Date;
}): TaskRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    due_at: row.due_at.toISOString(),
    status: row.status,
    source: row.source === "dashboard" ? "dashboard" : "discord",
    raw_input: row.raw_input,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function serializeEvent(row: {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: Date;
  end_at: Date | null;
  location: string | null;
  source: AppItemSource;
  raw_input: string | null;
  created_at: Date;
  updated_at: Date;
}): EventRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    start_at: row.start_at.toISOString(),
    end_at: toIso(row.end_at),
    location: row.location,
    source: row.source === "dashboard" ? "dashboard" : "discord",
    raw_input: row.raw_input,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function serializeReminder(row: {
  id: string;
  user_id: string;
  entity_type: entity_type;
  entity_id: string | null;
  reminder_type: reminder_type;
  remind_at: Date;
  status: reminder_status;
  channel: AppMessageChannel;
  message_template: string;
  created_at: Date;
  updated_at: Date;
}): ReminderRecord {
  return {
    ...row,
    remind_at: row.remind_at.toISOString(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function serializeRecurrenceRule(row: {
  id: string;
  user_id: string;
  entity_type: entity_type;
  entity_id: string | null;
  frequency: recurrence_frequency;
  interval_value: number;
  by_day: string[];
  by_month_day: number[];
  start_date: Date;
  end_date: Date | null;
  raw_rule_text: string | null;
  created_at: Date;
  updated_at: Date;
}): RecurrenceRecord {
  return {
    ...row,
    by_day: row.by_day.length > 0 ? row.by_day : null,
    by_month_day: row.by_month_day.length > 0 ? row.by_month_day : null,
    start_date: row.start_date.toISOString().slice(0, 10),
    end_date: toDateOnly(row.end_date),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function serializeRawMessage(row: {
  id: string;
  user_id: string | null;
  direction: message_direction;
  channel: AppMessageChannel;
  message_text: string | null;
  payload_json: unknown;
  parsed_json: unknown;
  processing_status: processing_status;
  created_at: Date;
}): RawMessageRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    direction: row.direction,
    channel: row.channel,
    message_text: row.message_text,
    payload_json: (row.payload_json ?? {}) as Record<string, unknown>,
    parsed_json: (row.parsed_json ?? null) as Record<string, unknown> | null,
    processing_status: row.processing_status,
    created_at: row.created_at.toISOString(),
  };
}

export async function getUserById(userId: string): Promise<AppUser> {
  const data = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      full_name: true,
      discord_user_id: true,
      timezone: true,
    },
  });

  if (!data) {
    throw new Error("Authenticated user not found in database.");
  }

  return data;
}

export async function getDiscordUserIdByAppUserId(userId: string): Promise<string | null> {
  const data = await prisma.user.findUnique({
    where: { id: userId },
    select: { discord_user_id: true }
  });

  return data?.discord_user_id ?? null;
}
export async function getUserByDiscordId(
  discordUserId: string,
): Promise<AppUser | null> {
  const data = await prisma.user.findUnique({
    where: { discord_user_id: discordUserId },
    select: {
      id: true,
      full_name: true,
      discord_user_id: true,
      timezone: true,
    },
  });

  return data;
}

export async function ensureUserByDiscord(input: {
  discordUserId: string;
  fullName?: string | null;
  timezone?: string;
}) {
  const normalizedName = input.fullName?.trim() || null;

  const data = await prisma.user.upsert({
    where: { discord_user_id: input.discordUserId },
    update: {
      ...(normalizedName ? { full_name: normalizedName } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    },
    create: {
      full_name: normalizedName ?? "Discord User",
      discord_user_id: input.discordUserId,
      timezone: input.timezone ?? "Asia/Jakarta",
    },
    select: {
      id: true,
      full_name: true,
      discord_user_id: true,
      timezone: true,
    },
  });

  return data;
}

export async function logInboundRawMessage(input: {
  userId: string;
  text: string;
  payload: Record<string, unknown>;
  channel?: AppMessageChannel;
}) {
  const data = await prisma.rawMessage.create({
    data: {
      user_id: input.userId,
      direction: "inbound",
      channel: (input.channel ?? "discord") as never,
      message_text: input.text,
      payload_json: input.payload as Prisma.InputJsonValue,
      processing_status: "received",
    },
    select: { id: true },
  });

  return data.id;
}

export async function logOutboundRawMessage(input: {
  userId: string;
  text: string;
  payload?: Record<string, unknown>;
  parsed?: ParsedMessage | null;
  status?: "parsed" | "needs_clarification" | "processed" | "failed";
  channel?: AppMessageChannel;
}) {
  await prisma.rawMessage.create({
    data: {
      user_id: input.userId,
      direction: "outbound",
      channel: (input.channel ?? "discord") as never,
      message_text: input.text,
      payload_json: (input.payload ?? {}) as Prisma.InputJsonValue,
      parsed_json: input.parsed
        ? (input.parsed as Prisma.InputJsonValue)
        : Prisma.DbNull,
      processing_status: input.status ?? "processed",
    },
  });
}

export async function updateRawMessageProcessing(input: {
  id: string;
  parsed: ParsedMessage;
  status: ProcessingStatusValue;
}) {
  await prisma.rawMessage.update({
    where: { id: input.id },
    data: {
      parsed_json: input.parsed
        ? (input.parsed as Prisma.InputJsonValue)
        : Prisma.DbNull,
      processing_status: input.status,
    },
  });
}

export async function getLatestInboundPendingClarification(userId: string) {
  const data = await prisma.rawMessage.findFirst({
    where: {
      user_id: userId,
      direction: "inbound",
      processing_status: "needs_clarification",
      parsed_json: {
        not: Prisma.DbNull,
      },
    },
    orderBy: { created_at: "desc" },
  });

  return data ? serializeRawMessage(data) : null;
}
export async function createTask(input: {
  userId: string;
  title: string;
  description?: string | null;
  dueAt: string;
  source: "discord" | "dashboard";
  rawInput?: string | null;
}) {
  const data = await prisma.task.create({
    data: {
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      due_at: new Date(input.dueAt),
      source: input.source as never,
      raw_input: input.rawInput ?? null,
    },
  });

  return serializeTask(data);
}

export async function updateTask(input: {
  userId: string;
  taskId: string;
  patch: Record<string, unknown>;
}) {
  const data: {
    title?: string;
    description?: string | null;
    due_at?: Date;
    status?: task_status;
  } = {};

  if (typeof input.patch.title === "string") data.title = input.patch.title;
  if (
    input.patch.description === null ||
    typeof input.patch.description === "string"
  )
    data.description = input.patch.description;
  if (typeof input.patch.due_at === "string")
    data.due_at = new Date(input.patch.due_at);
  if (
    input.patch.status === "pending" ||
    input.patch.status === "completed" ||
    input.patch.status === "cancelled" ||
    input.patch.status === "overdue"
  ) {
    data.status = input.patch.status;
  }

  const updateResult = await prisma.task.updateMany({
    where: { id: input.taskId, user_id: input.userId },
    data,
  });

  if (updateResult.count === 0) {
    throw new Error("Task not found.");
  }

  const updated = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!updated) {
    throw new Error("Task not found after update.");
  }

  return serializeTask(updated);
}

export async function deleteTask(input: { userId: string; taskId: string }) {
  const deleted = await prisma.task.deleteMany({
    where: { id: input.taskId, user_id: input.userId },
  });

  if (deleted.count === 0) {
    throw new Error("Task not found.");
  }
}
export async function createEvent(input: {
  userId: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  source: "discord" | "dashboard";
  rawInput?: string | null;
}) {
  const data = await prisma.event.create({
    data: {
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      start_at: new Date(input.startAt),
      end_at: input.endAt ? new Date(input.endAt) : null,
      location: input.location ?? null,
      source: input.source as never,
      raw_input: input.rawInput ?? null,
    },
  });

  return serializeEvent(data);
}

export async function updateEvent(input: {
  userId: string;
  eventId: string;
  patch: Record<string, unknown>;
}) {
  const data: {
    title?: string;
    description?: string | null;
    start_at?: Date;
    end_at?: Date | null;
    location?: string | null;
  } = {};

  if (typeof input.patch.title === "string") data.title = input.patch.title;
  if (
    input.patch.description === null ||
    typeof input.patch.description === "string"
  )
    data.description = input.patch.description;
  if (typeof input.patch.start_at === "string")
    data.start_at = new Date(input.patch.start_at);
  if (input.patch.end_at === null || typeof input.patch.end_at === "string")
    data.end_at = input.patch.end_at ? new Date(input.patch.end_at) : null;
  if (input.patch.location === null || typeof input.patch.location === "string")
    data.location = input.patch.location;

  const updateResult = await prisma.event.updateMany({
    where: { id: input.eventId, user_id: input.userId },
    data,
  });

  if (updateResult.count === 0) {
    throw new Error("Event not found.");
  }

  const updated = await prisma.event.findUnique({
    where: { id: input.eventId },
  });
  if (!updated) {
    throw new Error("Event not found after update.");
  }

  return serializeEvent(updated);
}

export async function deleteEvent(input: { userId: string; eventId: string }) {
  const deleted = await prisma.event.deleteMany({
    where: { id: input.eventId, user_id: input.userId },
  });

  if (deleted.count === 0) {
    throw new Error("Event not found.");
  }
}
export async function createRecurrenceRule(input: {
  userId: string;
  entityType: "task" | "event" | "reminder";
  entityId: string | null;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  intervalValue?: number;
  byDay?: string[] | null;
  byMonthDay?: number[] | null;
  startDate: string;
  endDate?: string | null;
  rawRuleText?: string | null;
}) {
  const data = await prisma.recurrenceRule.create({
    data: {
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      frequency: input.frequency,
      interval_value: input.intervalValue ?? 1,
      by_day: input.byDay ?? [],
      by_month_day: input.byMonthDay ?? [],
      start_date: new Date(`${input.startDate}T00:00:00.000Z`),
      end_date: input.endDate
        ? new Date(`${input.endDate}T00:00:00.000Z`)
        : null,
      raw_rule_text: input.rawRuleText ?? null,
    },
  });

  return serializeRecurrenceRule(data);
}

export async function createReminders(input: {
  userId: string;
  entityType: "task" | "event" | "custom";
  entityId: string | null;
  remindAtList: string[];
  reminderType?: "one_time" | "recurring";
  template: string;
  channel?: AppMessageChannel;
}) {
  if (input.remindAtList.length === 0) {
    return [] as ReminderRecord[];
  }

  const inserted = await Promise.all(
    input.remindAtList.map((remindAt) =>
      prisma.reminder.create({
        data: {
          user_id: input.userId,
          entity_type: input.entityType,
          entity_id: input.entityId,
          reminder_type: input.reminderType ?? "one_time",
          remind_at: new Date(remindAt),
          status: "pending",
          channel: (input.channel ?? "discord") as never,
          message_template: input.template,
        },
      }),
    ),
  );

  return inserted.map(serializeReminder);
}

export async function getDueReminders(
  nowISO: string,
  limit = 50,
  userId?: string,
) {
  const data = await prisma.reminder.findMany({
    where: {
      ...(userId ? { user_id: userId } : {}),
      status: "pending",
      remind_at: {
        lte: new Date(nowISO),
      },
    },
    orderBy: { remind_at: "asc" },
    take: limit,
  });

  return data.map(serializeReminder);
}
export async function markReminderStatus(
  reminderId: string,
  status: "sent" | "failed" | "cancelled",
) {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { status },
  });
}

export async function fetchTodayAndWeekData(input: {
  userId: string;
  startISO: string;
  endISO: string;
}) {
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({
      where: {
        user_id: input.userId,
        due_at: {
          gte: new Date(input.startISO),
          lte: new Date(input.endISO),
        },
      },
      orderBy: { due_at: "asc" },
    }),
    prisma.event.findMany({
      where: {
        user_id: input.userId,
        start_at: {
          gte: new Date(input.startISO),
          lte: new Date(input.endISO),
        },
      },
      orderBy: { start_at: "asc" },
    }),
  ]);

  return {
    tasks: tasks.map(serializeTask),
    events: events.map(serializeEvent),
  };
}

export async function listDashboardData(userId: string) {
  const now = new Date();

  const [tasks, events, reminders, routines, rawMessages] = await Promise.all([
    prisma.task.findMany({
      where: { user_id: userId },
      orderBy: { due_at: "asc" },
      take: 200,
    }),
    prisma.event.findMany({
      where: { user_id: userId },
      orderBy: { start_at: "asc" },
      take: 200,
    }),
    prisma.reminder.findMany({
      where: {
        user_id: userId,
        remind_at: {
          gte: now,
        },
      },
      orderBy: { remind_at: "asc" },
      take: 100,
    }),
    prisma.recurrenceRule.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
    }),
    prisma.rawMessage.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
    }),
  ]);

  return {
    tasks: tasks.map(serializeTask),
    events: events.map(serializeEvent),
    reminders: reminders.map(serializeReminder),
    routines: routines.map(serializeRecurrenceRule),
    rawMessages: rawMessages.map(serializeRawMessage),
  };
}

export async function findTaskByTitle(userId: string, titleLike: string) {
  const data = await prisma.task.findFirst({
    where: {
      user_id: userId,
      title: {
        contains: titleLike,
        mode: "insensitive",
      },
    },
    orderBy: { updated_at: "desc" },
  });

  return data ? serializeTask(data) : null;
}

export async function findEventByTitle(userId: string, titleLike: string) {
  const data = await prisma.event.findFirst({
    where: {
      user_id: userId,
      title: {
        contains: titleLike,
        mode: "insensitive",
      },
    },
    orderBy: { updated_at: "desc" },
  });

  return data ? serializeEvent(data) : null;
}

export async function updateUser(input: {
  userId: string;
  fullName?: string;
  timezone?: string;
}) {
  if (input.fullName === undefined && input.timezone === undefined) {
    return getUserById(input.userId);
  }

  const data = await prisma.user.update({
    where: { id: input.userId },
    data: {
      full_name: input.fullName,
      timezone: input.timezone,
    },
    select: {
      id: true,
      full_name: true,
      discord_user_id: true,
      timezone: true,
    },
  });

  return data;
}
const JAKARTA_OFFSET_HOURS = 7;
const HOUR_MS = 60 * 60 * 1000;

function getJakartaMonthRange(baseDate = new Date()) {
  const shifted = new Date(baseDate.getTime() + JAKARTA_OFFSET_HOURS * HOUR_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();

  const startUtcMillis =
    Date.UTC(year, month, 1, 0, 0, 0, 0) - JAKARTA_OFFSET_HOURS * HOUR_MS;
  const endUtcMillis =
    Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - JAKARTA_OFFSET_HOURS * HOUR_MS;

  return {
    startAt: new Date(startUtcMillis),
    endAt: new Date(endUtcMillis),
  };
}

export async function logAiUsageEvent(input: {
  userId?: string | null;
  provider: string;
  model: string;
  requestType?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}) {
  await prisma.$executeRaw`
    insert into public.ai_usage_events (
      user_id,
      provider,
      model,
      request_type,
      prompt_tokens,
      completion_tokens,
      total_tokens
    )
    values (
      ${input.userId ?? null}::uuid,
      ${input.provider},
      ${input.model},
      ${input.requestType ?? "parser"},
      ${input.promptTokens ?? 0},
      ${input.completionTokens ?? 0},
      ${input.totalTokens ?? 0}
    )
  `;
}

export async function getCurrentMonthAiUsage(userId?: string) {
  const { startAt, endAt } = getJakartaMonthRange();

  const rows = userId
    ? await prisma.$queryRaw<
        Array<{
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }>
      >`
        select
          coalesce(sum(prompt_tokens), 0)::int as prompt_tokens,
          coalesce(sum(completion_tokens), 0)::int as completion_tokens,
          coalesce(sum(total_tokens), 0)::int as total_tokens
        from public.ai_usage_events
        where created_at >= ${startAt}
          and created_at < ${endAt}
          and (user_id = ${userId}::uuid or user_id is null)
      `
    : await prisma.$queryRaw<
        Array<{
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }>
      >`
        select
          coalesce(sum(prompt_tokens), 0)::int as prompt_tokens,
          coalesce(sum(completion_tokens), 0)::int as completion_tokens,
          coalesce(sum(total_tokens), 0)::int as total_tokens
        from public.ai_usage_events
        where created_at >= ${startAt}
          and created_at < ${endAt}
      `;

  const row = rows[0] ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  return {
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    periodStartISO: startAt.toISOString(),
    periodEndISO: endAt.toISOString(),
  };
}
type HolidayTypeValue = "national" | "joint_leave" | "observance";

export type HolidayRecord = {
  id: string;
  date: string;
  name: string;
  local_name: string | null;
  type: HolidayTypeValue;
  source: string;
  created_at: string;
  updated_at: string;
};

function getJakartaDateOnlyISO(base = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function toHolidayTypeValue(value: string): HolidayTypeValue {
  if (value === "national" || value === "joint_leave" || value === "observance") {
    return value;
  }

  return "observance";
}

function isMissingHolidaysRelationError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2010") {
    return false;
  }

  const metaMessage =
    typeof error.meta === "object" &&
    error.meta !== null &&
    "message" in error.meta
      ? String((error.meta as { message?: unknown }).message ?? "")
      : "";

  return (
    metaMessage.includes('relation "public.holidays" does not exist') ||
    metaMessage.includes("42P01") ||
    error.message.includes('relation "public.holidays" does not exist')
  );
}

function serializeHoliday(row: {
  id: string;
  date: Date;
  name: string;
  local_name: string | null;
  type: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}): HolidayRecord {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    name: row.name,
    local_name: row.local_name,
    type: toHolidayTypeValue(row.type),
    source: row.source,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listHolidaysInRange(input: {
  startDateISO: string;
  endDateISO: string;
}) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        date: Date;
        name: string;
        local_name: string | null;
        type: string;
        source: string;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      select
        id::text as id,
        date,
        name,
        local_name,
        type::text as type,
        source,
        created_at,
        updated_at
      from public.holidays
      where date >= ${new Date(`${input.startDateISO}T00:00:00.000Z`)}
        and date <= ${new Date(`${input.endDateISO}T00:00:00.000Z`)}
      order by date asc, name asc
    `;

    return rows.map(serializeHoliday);
  } catch (error) {
    if (isMissingHolidaysRelationError(error)) {
      return [] as HolidayRecord[];
    }

    throw error;
  }
}

export async function listHolidaysForYears(years: number[]) {
  const normalizedYears = Array.from(
    new Set(years.filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)),
  ).sort((a, b) => a - b);

  if (normalizedYears.length === 0) {
    return [] as HolidayRecord[];
  }

  const minYear = normalizedYears[0];
  const maxYear = normalizedYears[normalizedYears.length - 1];

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        date: Date;
        name: string;
        local_name: string | null;
        type: string;
        source: string;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      select
        id::text as id,
        date,
        name,
        local_name,
        type::text as type,
        source,
        created_at,
        updated_at
      from public.holidays
      where date >= ${new Date(Date.UTC(minYear, 0, 1))}
        and date < ${new Date(Date.UTC(maxYear + 1, 0, 1))}
      order by date asc, name asc
    `;

    const yearSet = new Set(normalizedYears);
    return rows
      .filter((row) => yearSet.has(row.date.getUTCFullYear()))
      .map(serializeHoliday);
  } catch (error) {
    if (isMissingHolidaysRelationError(error)) {
      return [] as HolidayRecord[];
    }

    throw error;
  }
}

export async function replaceHolidaysForYear(input: {
  year: number;
  source: string;
  items: Array<{
    date: string;
    name: string;
    local_name?: string | null;
    type: HolidayTypeValue;
  }>;
}) {
  const start = new Date(Date.UTC(input.year, 0, 1));
  const end = new Date(Date.UTC(input.year + 1, 0, 1));

  const normalizedItems = input.items.map((item) => ({
    date: new Date(`${item.date}T00:00:00.000Z`),
    name: item.name,
    local_name: item.local_name ?? null,
    type: item.type,
    source: input.source,
  }));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedCount = await tx.$executeRaw`
        delete from public.holidays
        where source = ${input.source}
          and date >= ${start}
          and date < ${end}
      `;

      if (normalizedItems.length === 0) {
        return { deletedCount, insertedCount: 0 };
      }

      let insertedCount = 0;

      for (const item of normalizedItems) {
        await tx.$executeRaw`
          insert into public.holidays (date, name, local_name, type, source)
          values (${item.date}, ${item.name}, ${item.local_name}, ${item.type}::holiday_type, ${item.source})
          on conflict (date, name)
          do update set
            local_name = excluded.local_name,
            type = excluded.type,
            source = excluded.source,
            updated_at = now()
        `;

        insertedCount += 1;
      }

      return { deletedCount, insertedCount };
    });

    return result;
  } catch (error) {
    if (isMissingHolidaysRelationError(error)) {
      throw new Error("Table public.holidays belum ada. Jalankan sql/schema.sql di database Supabase dulu.");
    }

    throw error;
  }
}

export async function getHolidaySyncSummary() {
  const todayISO = getJakartaDateOnlyISO();

  try {
    const [
      totalRows,
      firstRows,
      lastRows,
      nextRows,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ total_count: number }>>`
        select count(*)::int as total_count from public.holidays
      `,
      prisma.$queryRaw<
        Array<{
          id: string;
          date: Date;
          name: string;
          local_name: string | null;
          type: string;
          source: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        select id::text as id, date, name, local_name, type::text as type, source, created_at, updated_at
        from public.holidays
        order by date asc, name asc
        limit 1
      `,
      prisma.$queryRaw<
        Array<{
          id: string;
          date: Date;
          name: string;
          local_name: string | null;
          type: string;
          source: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        select id::text as id, date, name, local_name, type::text as type, source, created_at, updated_at
        from public.holidays
        order by date desc, name asc
        limit 1
      `,
      prisma.$queryRaw<
        Array<{
          id: string;
          date: Date;
          name: string;
          local_name: string | null;
          type: string;
          source: string;
          created_at: Date;
          updated_at: Date;
        }>
      >`
        select id::text as id, date, name, local_name, type::text as type, source, created_at, updated_at
        from public.holidays
        where date >= ${new Date(`${todayISO}T00:00:00.000Z`)}
        order by date asc, name asc
        limit 1
      `,
    ]);

    return {
      total_count: totalRows[0]?.total_count ?? 0,
      range_start: firstRows[0] ? firstRows[0].date.toISOString().slice(0, 10) : null,
      range_end: lastRows[0] ? lastRows[0].date.toISOString().slice(0, 10) : null,
      next_holiday: nextRows[0] ? serializeHoliday(nextRows[0]) : null,
    };
  } catch (error) {
    if (isMissingHolidaysRelationError(error)) {
      return {
        total_count: 0,
        range_start: null,
        range_end: null,
        next_holiday: null,
      };
    }

    throw error;
  }
}
