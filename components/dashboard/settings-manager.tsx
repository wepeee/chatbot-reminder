"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsUser = {
  id: string;
  full_name: string;
  timezone: string;
};

type SettingsConfigStatus = {
  openai_configured: boolean;
  messaging_provider: "discord";
  messaging_configured: boolean;
  database_configured: boolean;
  internal_api_base_url_configured: boolean;
  internal_api_token_configured: boolean;
  reminder_runner_token_configured: boolean;
  reminder_poll_interval_ms: number;
  webhook_fallback_configured: boolean;
};

type HolidaySummary = {
  total_count: number;
  range_start: string | null;
  range_end: string | null;
  next_holiday: {
    id: string;
    date: string;
    name: string;
    local_name: string | null;
    type: "national" | "joint_leave" | "observance";
    source: string;
    created_at: string;
    updated_at: string;
  } | null;
};

function boolToStatus(value: boolean) {
  return value ? "sent" : "failed";
}

export function SettingsManager({
  initialUser,
  configStatus,
  initialHolidaySummary,
}: {
  initialUser: SettingsUser;
  configStatus: SettingsConfigStatus;
  initialHolidaySummary: HolidaySummary;
}) {
  const [user, setUser] = useState<SettingsUser>(initialUser);
  const [fullName, setFullName] = useState(initialUser.full_name);
  const [timezone, setTimezone] = useState(initialUser.timezone);
  const [holidaySummary, setHolidaySummary] = useState<HolidaySummary>(initialHolidaySummary);
  const [syncInfo, setSyncInfo] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();

  async function saveSettings() {
    startTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          timezone,
        }),
      });

      const json = (await response.json()) as { ok: boolean; data?: SettingsUser; error?: string };
      if (json.ok && json.data) {
        setUser(json.data);
      }
    });
  }

  async function syncHolidays() {
    startSyncTransition(async () => {
      setSyncInfo("");

      const response = await fetch("/api/holidays/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = (await response.json()) as {
        ok: boolean;
        data?: {
          years: number[];
          summary: HolidaySummary;
          sync: {
            success_count: number;
            failed_count: number;
          };
        };
        error?: string;
      };

      if (!json.ok || !json.data) {
        setSyncInfo(json.error ?? "Sync failed");
        return;
      }

      setHolidaySummary(json.data.summary);
      setSyncInfo(
        `Synced tahun ${json.data.years.join(", ")} (${json.data.sync.success_count} sukses, ${json.data.sync.failed_count} gagal)`,
      );
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </div>
          <Button onClick={saveSettings} disabled={isPending} className="gap-2">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save settings"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">Current user ID: {user.id}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indonesia Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total synced</p>
              <p className="text-lg font-semibold">{holidaySummary.total_count}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Range start</p>
              <p className="text-sm font-medium">{holidaySummary.range_start ?? "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Range end</p>
              <p className="text-sm font-medium">{holidaySummary.range_end ?? "-"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Next holiday</p>
            {holidaySummary.next_holiday ? (
              <p className="text-sm font-medium">
                {holidaySummary.next_holiday.date} - {holidaySummary.next_holiday.name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada data hari libur tersinkron.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={syncHolidays} disabled={isSyncing} className="gap-2">
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync Hari Libur Indonesia"
              )}
            </Button>
            {syncInfo ? <p className="text-xs text-muted-foreground">{syncInfo}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>OpenAI API</span>
            <StatusBadge status={boolToStatus(configStatus.openai_configured)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Messaging ({configStatus.messaging_provider})</span>
            <StatusBadge status={boolToStatus(configStatus.messaging_configured)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Database (Prisma)</span>
            <StatusBadge status={boolToStatus(configStatus.database_configured)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>Webhook fallback (optional)</span>
            <StatusBadge status={boolToStatus(configStatus.webhook_fallback_configured)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hybrid Deployment Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>INTERNAL_API_BASE_URL set</span>
            <StatusBadge status={boolToStatus(configStatus.internal_api_base_url_configured)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>API_INTERNAL_AUTH_TOKEN set</span>
            <StatusBadge status={boolToStatus(configStatus.internal_api_token_configured)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span>REMINDER_RUN_AUTH_TOKEN set</span>
            <StatusBadge status={boolToStatus(configStatus.reminder_runner_token_configured)} />
          </div>

          <div className="rounded-lg border p-3">
            <p className="font-medium">Worker poll interval</p>
            <p className="text-muted-foreground">{configStatus.reminder_poll_interval_ms} ms</p>
          </div>

          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p>Recommended setup:</p>
            <p>1) Web/API di Vercel</p>
            <p>2) Discord gateway worker di laptop 24/7 (PM2)</p>
            <p>
              3) Worker call <code>/api/internal/health</code>, <code>/api/chat/process</code>, <code>/api/reminders/run-due</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
