export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { EventsManager } from "@/components/dashboard/events-manager";
import { listDashboardData } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function EventsPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }
  const data = await listDashboardData(user.id);

  return <EventsManager initialEvents={data.events} />;
}



