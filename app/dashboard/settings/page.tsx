export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { SettingsManager } from "@/components/dashboard/settings-manager";
import { getAppConfigStatus } from "@/lib/services/config-status";
import { getHolidaySyncSummary } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";

export default async function SettingsPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const holidaySummary = await getHolidaySyncSummary().catch(() => ({
    total_count: 0,
    range_start: null,
    range_end: null,
    next_holiday: null,
  }));

  return (
    <SettingsManager
      initialUser={user}
      configStatus={getAppConfigStatus()}
      initialHolidaySummary={holidaySummary}
    />
  );
}
