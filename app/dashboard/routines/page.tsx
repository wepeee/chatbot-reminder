export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { RoutinesManager } from "@/components/dashboard/routines-manager";
import { listDashboardData } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function RoutinesPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }
  const data = await listDashboardData(user.id);

  return <RoutinesManager initialRoutines={data.routines} initialReminders={data.reminders} />;
}



