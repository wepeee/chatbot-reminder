export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { TasksManager } from "@/components/dashboard/tasks-manager";
import { listDashboardData } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function TasksPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }
  const data = await listDashboardData(user.id);

  return <TasksManager initialTasks={data.tasks} />;
}



