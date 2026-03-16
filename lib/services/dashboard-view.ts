import { env } from "@/lib/env";
import { toJakartaBoundaryISO } from "@/lib/agenda/time";
import { getCurrentMonthAiUsage, listDashboardData } from "@/lib/services/data-service";

function decodeDiscordUserIdFromBotToken(token: string) {
  const firstSegment = token.split(".")[0]?.trim();
  if (!firstSegment) {
    return null;
  }

  const normalized = firstSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const decoded = atob(padded).trim();
    return /^\d{16,22}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function resolveDiscordBotDmUrl() {
  const configured = env.NEXT_PUBLIC_DISCORD_BOT_DM_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  const token = env.DISCORD_BOT_TOKEN?.trim();
  if (!token || token === "dev-placeholder") {
    return null;
  }

  const botUserId = decodeDiscordUserIdFromBotToken(token);
  if (!botUserId) {
    return null;
  }

  return `https://discord.com/users/${botUserId}`;
}

export async function getDashboardOverview(userId: string) {
  const data = await listDashboardData(userId);
  const aiUsage = await getCurrentMonthAiUsage(userId).catch(() => ({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    periodStartISO: new Date().toISOString(),
    periodEndISO: new Date().toISOString()
  }));

  const now = new Date();
  const nowMs = now.getTime();
  const todayStart = new Date(toJakartaBoundaryISO(now, 0)).getTime();
  const tomorrowStart = new Date(toJakartaBoundaryISO(now, 1)).getTime();
  const weekEnd = new Date(toJakartaBoundaryISO(now, 7)).getTime();

  const dueTodayTasks = data.tasks.filter((task) => {
    const dueMs = new Date(task.due_at).getTime();
    return dueMs >= todayStart && dueMs < tomorrowStart && task.status === "pending";
  });

  const upcomingDeadlines = data.tasks.filter((task) => {
    const dueMs = new Date(task.due_at).getTime();
    return dueMs >= nowMs && dueMs < weekEnd && task.status === "pending";
  });

  const eventsToday = data.events.filter((event) => {
    const startMs = new Date(event.start_at).getTime();
    return startMs >= todayStart && startMs < tomorrowStart;
  });

  const overdueItems = data.tasks.filter((task) => {
    const dueMs = new Date(task.due_at).getTime();
    return dueMs < nowMs && task.status === "pending";
  });

  const activeRecurringRoutines = data.routines.filter((routine) => !routine.end_date).length;

  const todayAgenda = [
    ...dueTodayTasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      at: task.due_at,
      source: task.source,
      status: task.status
    })),
    ...eventsToday.map((event) => ({
      id: event.id,
      kind: "event" as const,
      title: event.title,
      at: event.start_at,
      source: event.source,
      status: null
    }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const weekItems = [
    ...data.tasks
      .filter((task) => {
        const dueMs = new Date(task.due_at).getTime();
        return dueMs >= todayStart && dueMs < weekEnd;
      })
      .map((task) => ({
        id: task.id,
        kind: "task" as const,
        title: task.title,
        at: task.due_at,
        source: task.source,
        status: task.status
      })),
    ...data.events
      .filter((event) => {
        const startMs = new Date(event.start_at).getTime();
        return startMs >= todayStart && startMs < weekEnd;
      })
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        title: event.title,
        at: event.start_at,
        source: event.source,
        status: null
      }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const monthlyBudget = env.AI_MONTHLY_TOKEN_BUDGET;
  const usedTokens = aiUsage.totalTokens;
  const remainingTokens = Math.max(0, monthlyBudget - usedTokens);
  const usagePercent = monthlyBudget > 0 ? Math.min(100, (usedTokens / monthlyBudget) * 100) : 0;

  return {
    cards: {
      tasksDueToday: dueTodayTasks.length,
      upcomingDeadlines: upcomingDeadlines.length,
      eventsToday: eventsToday.length,
      overdueItems: overdueItems.length,
      activeRecurringRoutines
    },
    aiQuota: {
      model: env.OPENAI_MODEL,
      provider: env.OPENAI_BASE_URL.includes("openrouter.ai") ? "openrouter" : "openai",
      usedTokens,
      budgetTokens: monthlyBudget,
      remainingTokens,
      usagePercent,
      periodStartISO: aiUsage.periodStartISO,
      periodEndISO: aiUsage.periodEndISO
    },
    quickActions: {
      discordBotDmUrl: resolveDiscordBotDmUrl(),
    },
    todayAgenda,
    weekItems,
    data
  };
}


