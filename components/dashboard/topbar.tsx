"use client";

import { Bell, CalendarClock, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { ThemeToggleButton } from "@/components/dashboard/theme-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dispatchDashboardNavStart } from "@/lib/dashboard/nav-progress";
import { CHAT_ONBOARDING_SESSION_KEY } from "@/lib/dashboard/storage-keys";

function getJakartaHour(date = new Date()) {
  const hourText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta"
  }).format(date);

  return Number.parseInt(hourText, 10);
}

function getDayGreeting(date = new Date()) {
  const hour = getJakartaHour(date);

  if (hour >= 5 && hour < 11) {
    return "pagi";
  }

  if (hour >= 11 && hour < 15) {
    return "siang";
  }

  if (hour >= 15 && hour < 19) {
    return "sore";
  }

  return "malam";
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getFirstName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

interface DashboardTopbarProps {
  userName: string;
  avatarUrl?: string | null;
}

export function DashboardTopbar({ userName, avatarUrl = null }: DashboardTopbarProps) {
  const now = new Date();
  const greeting = getDayGreeting(now);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHAT_ONBOARDING_SESSION_KEY);
    }

    dispatchDashboardNavStart();
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card/70 px-4 backdrop-blur lg:px-8">
      <div>
        <h1 className="text-lg font-semibold">Selamat {greeting}, {getFirstName(userName)}</h1>
        <p className="text-xs text-muted-foreground">{now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex">
          <CalendarClock className="h-3.5 w-3.5" />
          Asia/Jakarta
        </Badge>
        <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
          <Bell className="h-3.5 w-3.5" />
          Messaging Active
        </Badge>

        <ThemeToggleButton />

        <div className="hidden items-center gap-2 rounded-full border bg-background/90 px-2 py-1 md:flex">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
            {avatarUrl ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl})` }} aria-hidden />
            ) : (
              <span>{getInitials(userName)}</span>
            )}
          </div>
          <span className="max-w-[140px] truncate text-sm font-medium">{userName}</span>
        </div>

        <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
