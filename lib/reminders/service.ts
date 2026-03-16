import {
  buildDiscordReminderText,
  sendDiscordDirectMessage,
  sendDiscordReminder,
} from "@/lib/discord/service";
import { env } from "@/lib/env";
import {
  createReminders,
  getDiscordUserIdByAppUserId,
  getDueReminders,
  logOutboundRawMessage,
  markReminderStatus,
} from "@/lib/services/data-service";
import { computeReminderTimes } from "@/lib/reminders/duration";

const DEFAULT_OFFSETS = ["P1D", "PT2H"];

export function buildTaskReminderTemplate(taskTitle: string, dueAtISO: string) {
  return `Tugas: ${taskTitle}\nDeadline: ${new Date(dueAtISO).toLocaleString(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
    },
  )}`;
}

export function buildEventReminderTemplate(
  eventTitle: string,
  startAtISO: string,
) {
  return `Event: ${eventTitle}\nMulai: ${new Date(startAtISO).toLocaleString(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
    },
  )}`;
}

export async function scheduleTaskReminders(input: {
  userId: string;
  taskId: string;
  taskTitle: string;
  dueAt: string;
  offsets?: string[];
}) {
  const offsets =
    input.offsets && input.offsets.length > 0 ? input.offsets : DEFAULT_OFFSETS;
  const remindAtList = computeReminderTimes(input.dueAt, offsets);

  return createReminders({
    userId: input.userId,
    entityType: "task",
    entityId: input.taskId,
    remindAtList,
    reminderType: "one_time",
    template: buildTaskReminderTemplate(input.taskTitle, input.dueAt),
    channel: "discord",
  });
}

export async function scheduleEventReminders(input: {
  userId: string;
  eventId: string;
  eventTitle: string;
  startAt: string;
  offsets?: string[];
}) {
  const offsets =
    input.offsets && input.offsets.length > 0 ? input.offsets : ["PT2H"];
  const remindAtList = computeReminderTimes(input.startAt, offsets);

  return createReminders({
    userId: input.userId,
    entityType: "event",
    entityId: input.eventId,
    remindAtList,
    reminderType: "one_time",
    template: buildEventReminderTemplate(input.eventTitle, input.startAt),
    channel: "discord",
  });
}

export async function scheduleCustomRecurringReminder(input: {
  userId: string;
  title: string;
  remindAtISO: string;
  message: string;
}) {
  const messageText = input.message.trim();

  return createReminders({
    userId: input.userId,
    entityType: "custom",
    entityId: null,
    remindAtList: [input.remindAtISO],
    reminderType: "recurring",
    template: messageText.length > 0 ? messageText : input.title,
    channel: "discord",
  });
}

function getReminderDisplayTitle(
  entityType: "task" | "event" | "custom" | "reminder",
) {
  if (entityType === "task") return "Deadline Tugas";
  if (entityType === "event") return "Agenda Event";
  return "Pengingat";
}

function isReminderStale(remindAtISO: string, now: Date, maxLagMinutes: number) {
  const remindAt = new Date(remindAtISO);
  if (Number.isNaN(remindAt.getTime())) {
    return false;
  }

  const lagMs = now.getTime() - remindAt.getTime();
  return lagMs > maxLagMinutes * 60 * 1000;
}

export async function runDueReminderDispatch(
  nowISO = new Date().toISOString(),
) {
  const dueReminders = await getDueReminders(nowISO, 100);
  const now = new Date(nowISO);

  const result = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped_stale: 0,
  };

  for (const reminder of dueReminders) {
    result.processed += 1;

    if (
      isReminderStale(
        reminder.remind_at,
        now,
        env.REMINDER_MAX_LAG_MINUTES,
      )
    ) {
      await markReminderStatus(reminder.id, "cancelled");
      await logOutboundRawMessage({
        userId: reminder.user_id,
        text: `Reminder skipped (stale): ${reminder.message_template}`,
        payload: {
          reminder_id: reminder.id,
          remind_at: reminder.remind_at,
          reason: `Exceeded max lag of ${env.REMINDER_MAX_LAG_MINUTES} minutes`,
        },
        channel: "discord",
        status: "failed",
      });
      result.skipped_stale += 1;
      continue;
    }

    try {
      const title = getReminderDisplayTitle(reminder.entity_type);
      const text = buildDiscordReminderText({
        title,
        body: reminder.message_template,
        whenISO: reminder.remind_at,
      });

      const discordUserId = await getDiscordUserIdByAppUserId(reminder.user_id);
      if (discordUserId) {
        await sendDiscordDirectMessage({
          discordUserId,
          text,
        });
      } else {
        await sendDiscordReminder({
          title,
          body: reminder.message_template,
          whenISO: reminder.remind_at,
        });
      }

      await markReminderStatus(reminder.id, "sent");
      await logOutboundRawMessage({
        userId: reminder.user_id,
        text: `Reminder sent: ${reminder.message_template}`,
        payload: { reminder_id: reminder.id, remind_at: reminder.remind_at },
        channel: "discord",
        status: "processed",
      });

      result.sent += 1;
    } catch (error) {
      await markReminderStatus(reminder.id, "failed");
      await logOutboundRawMessage({
        userId: reminder.user_id,
        text: `Reminder failed: ${reminder.message_template}`,
        payload: {
          reminder_id: reminder.id,
          remind_at: reminder.remind_at,
          channel: "discord",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        channel: "discord",
        status: "failed",
      });
      result.failed += 1;
    }
  }

  return result;
}
