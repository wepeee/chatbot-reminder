export const dynamic = "force-dynamic";

import { MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { ChatOnboardingModal } from "@/components/dashboard/chat-onboarding-modal";
import { OverviewCard } from "@/components/dashboard/overview-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatJakartaDateTime } from "@/lib/agenda/time";
import { getDashboardOverview } from "@/lib/services/dashboard-view";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatNumber(num: number) {
  return new Intl.NumberFormat("id-ID").format(num);
}

export default async function DashboardOverviewPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const overview = await getDashboardOverview(user.id);

  return (
    <div className="space-y-6">
      <ChatOnboardingModal discordBotDmUrl={overview.quickActions.discordBotDmUrl} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <OverviewCard title="Tasks Due Today" value={overview.cards.tasksDueToday} description="Tugas dengan deadline hari ini" />
        <OverviewCard title="Upcoming Deadlines" value={overview.cards.upcomingDeadlines} description="7 hari ke depan" />
        <OverviewCard title="Events Today" value={overview.cards.eventsToday} description="Agenda kelas/meeting hari ini" />
        <OverviewCard title="Overdue Items" value={overview.cards.overdueItems} description="Task belum selesai dan lewat deadline" />
        <OverviewCard title="Recurring Routines" value={overview.cards.activeRecurringRoutines} description="Rule rutin aktif" />
      </section>

      {overview.quickActions.discordBotDmUrl ? (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2">
              <a href={overview.quickActions.discordBotDmUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                Chat ke Bot Discord
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today Agenda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.todayAgenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada agenda hari ini.</p>
            ) : (
              overview.todayAgenda.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatJakartaDateTime(item.at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{item.source}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.weekItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada item minggu ini.</p>
            ) : (
              overview.weekItems.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatJakartaDateTime(item.at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{item.kind}</span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>AI Quota (Monthly)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              Provider: <span className="font-medium text-foreground">{overview.aiQuota.provider}</span> | Model:{" "}
              <span className="font-medium text-foreground">{overview.aiQuota.model}</span>
            </p>
            <p className="text-muted-foreground">
              Sisa: <span className="font-semibold text-foreground">{formatNumber(overview.aiQuota.remainingTokens)}</span> tokens
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${overview.aiQuota.usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Terpakai {formatNumber(overview.aiQuota.usedTokens)} / {formatNumber(overview.aiQuota.budgetTokens)} tokens bulan ini
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
