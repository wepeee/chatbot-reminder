export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { DashboardCalendarView } from "@/components/dashboard/calendar-view";
import { listDashboardData, listHolidaysForYears } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function DashboardCalendarPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
    }).format(now),
  );

  const [data, holidays] = await Promise.all([
    listDashboardData(user.id),
    listHolidaysForYears([currentYear - 1, currentYear, currentYear + 1]),
  ]);

  const items = [
    ...data.tasks.map((task: { id: string; title: string; due_at: string; status: string; source: string }) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      at: task.due_at,
      status: task.status,
      source: task.source,
    })),
    ...data.events.map((event: { id: string; title: string; start_at: string; source: string }) => ({
      id: event.id,
      kind: "event" as const,
      title: event.title,
      at: event.start_at,
      status: null,
      source: event.source,
    })),
  ];

  return (
    <div className="space-y-6">
      <DashboardCalendarView
        items={items}
        holidays={holidays.map((holiday: { id: string; date: string; local_name: string | null; name: string; type: "national" | "joint_leave" | "observance" }) => ({
          id: holiday.id,
          date: holiday.date,
          name: holiday.local_name ?? holiday.name,
          type: holiday.type,
        }))}
      />
    </div>
  );
}

