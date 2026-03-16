export type TaskStatus = "pending" | "completed" | "cancelled" | "overdue";
export type ItemSource = "whatsapp" | "discord" | "dashboard";
export type EntityType = "task" | "event" | "reminder" | "custom";
export type ReminderType = "one_time" | "recurring";
export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";
export type MessageDirection = "inbound" | "outbound";
export type ProcessingStatus =
  | "received"
  | "parsed"
  | "needs_clarification"
  | "processed"
  | "failed";

export type SupportedIntent =
  | "create_task"
  | "create_event"
  | "create_recurring_reminder"
  | "get_today_agenda"
  | "get_week_agenda"
  | "update_item"
  | "delete_item";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: TaskStatus;
  source: ItemSource;
  raw_input: string | null;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  source: ItemSource;
  raw_input: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceRule {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string | null;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  interval_value: number;
  by_day: string[] | null;
  by_month_day: number[] | null;
  start_date: string;
  end_date: string | null;
  raw_rule_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string | null;
  reminder_type: ReminderType;
  remind_at: string;
  status: ReminderStatus;
  channel: "whatsapp" | "discord";
  message_template: string;
  created_at: string;
  updated_at: string;
}

export interface RawMessage {
  id: string;
  user_id: string | null;
  direction: MessageDirection;
  channel: "whatsapp" | "discord";
  message_text: string | null;
  payload_json: Record<string, unknown>;
  parsed_json: Record<string, unknown> | null;
  processing_status: ProcessingStatus;
  created_at: string;
}

