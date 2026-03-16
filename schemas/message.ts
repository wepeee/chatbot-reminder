import { z } from "zod";

export const recurrenceSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]).nullable().optional(),
  interval_value: z.number().int().positive().nullable().optional(),
  by_day: z.array(z.string()).nullable().optional(),
  by_month_day: z.array(z.number().int()).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  raw_rule_text: z.string().nullable().optional()
});

export const parsedMessageSchema = z.object({
  intent: z.enum([
    "create_task",
    "create_event",
    "create_recurring_reminder",
    "get_today_agenda",
    "get_week_agenda",
    "update_item",
    "delete_item"
  ]),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  start_at: z.string().datetime({ offset: true }).nullable().optional(),
  end_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().nullable().optional(),
  reminder_offsets: z.array(z.string()).default([]),
  recurrence: recurrenceSchema.nullable().optional(),
  target_reference: z.string().nullable().optional(),
  updates: z.record(z.any()).nullable().optional(),
  needs_clarification: z.boolean().default(false),
  clarification_question: z.string().nullable().optional()
});

export type ParsedMessage = z.infer<typeof parsedMessageSchema>;

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  due_at: z.string().datetime({ offset: true }),
  source: z.enum(["discord", "dashboard"]).default("dashboard"),
  raw_input: z.string().nullable().optional(),
  reminder_offsets: z.array(z.string()).optional()
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  due_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["pending", "completed", "cancelled", "overdue"]).optional()
});

export const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().nullable().optional(),
  source: z.enum(["discord", "dashboard"]).default("dashboard"),
  raw_input: z.string().nullable().optional(),
  reminder_offsets: z.array(z.string()).optional()
});

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  start_at: z.string().datetime({ offset: true }).optional(),
  end_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().nullable().optional()
});

export const parseMessageRequestSchema = z.object({
  text: z.string().min(1),
  timezone: z.string().default("Asia/Jakarta"),
  now_iso: z.string().datetime({ offset: true }).optional()
});
