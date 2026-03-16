import { formatJakartaDateTime, toJakartaBoundaryISO } from "@/lib/agenda/time";
import { fetchTodayAndWeekData } from "@/lib/services/data-service";

export interface AgendaItem {
  id: string;
  type: "task" | "event";
  title: string;
  at: string;
  status?: string;
}

type AgendaRangeData = Awaited<ReturnType<typeof fetchTodayAndWeekData>>;
type AgendaTask = AgendaRangeData["tasks"][number];
type AgendaEvent = AgendaRangeData["events"][number];

export async function getAgendaByDayOffset(userId: string, dayOffset: number) {
  const startISO = toJakartaBoundaryISO(new Date(), dayOffset);
  const endISO = toJakartaBoundaryISO(new Date(), dayOffset + 1);

  const { tasks, events } = await fetchTodayAndWeekData({ userId, startISO, endISO });

  const items: AgendaItem[] = [
    ...tasks.map((task: AgendaTask) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      at: task.due_at,
      status: task.status,
    })),
    ...events.map((event: AgendaEvent) => ({
      id: event.id,
      type: "event" as const,
      title: event.title,
      at: event.start_at,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return { startISO, endISO, items, tasks, events };
}

export async function getTodayAgenda(userId: string) {
  return getAgendaByDayOffset(userId, 0);
}

export async function getTomorrowAgenda(userId: string) {
  return getAgendaByDayOffset(userId, 1);
}

export async function getWeekAgenda(userId: string) {
  const startISO = toJakartaBoundaryISO(new Date(), 0);
  const endISO = toJakartaBoundaryISO(new Date(), 7);

  const { tasks, events } = await fetchTodayAndWeekData({ userId, startISO, endISO });

  const items: AgendaItem[] = [
    ...tasks.map((task: AgendaTask) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      at: task.due_at,
      status: task.status,
    })),
    ...events.map((event: AgendaEvent) => ({
      id: event.id,
      type: "event" as const,
      title: event.title,
      at: event.start_at,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return { startISO, endISO, items, tasks, events };
}

export function formatAgendaMessage(input: {
  type: "today" | "tomorrow" | "week";
  items: AgendaItem[];
}) {
  const heading =
    input.type === "today"
      ? "Agenda hari ini:"
      : input.type === "tomorrow"
        ? "Agenda besok:"
        : "Agenda 7 hari ke depan:";

  if (input.items.length === 0) {
    return `${heading}\nBelum ada jadwal.`;
  }

  const lines = input.items.map((item, index) => {
    const icon = item.type === "task" ? "[Task]" : "[Event]";
    const status = item.status ? ` (${item.status})` : "";
    return `${index + 1}. ${icon} ${item.title} - ${formatJakartaDateTime(item.at)}${status}`;
  });

  return `${heading}\n${lines.join("\n")}`;
}
