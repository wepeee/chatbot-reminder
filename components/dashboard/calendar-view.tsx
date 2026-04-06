"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CalendarItem {
  id: string;
  kind: "task" | "event";
  title: string;
  at: string;
  status: string | null;
  source: string;
}

export interface CalendarHoliday {
  id: string;
  date: string;
  name: string;
  type: "national" | "joint_leave" | "observance";
}

function toJakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function DashboardCalendarView({
  items,
  holidays,
}: {
  items: CalendarItem[];
  holidays: CalendarHoliday[];
}) {
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [mode, setMode] = useState<"month" | "week">("month");

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toJakartaDateKey(today), [today]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, CalendarHoliday[]>();

    for (const holiday of holidays) {
      const key = holiday.date;
      const list = map.get(key) ?? [];
      list.push(holiday);
      map.set(key, list);
    }

    return map;
  }, [holidays]);

  const itemMap = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const item of items) {
      const itemDate = new Date(item.at);
      if (Number.isNaN(itemDate.getTime())) {
        continue;
      }

      const key = toJakartaDateKey(itemDate);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    return map;
  }, [items]);
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [referenceDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [referenceDate]);

  const days = mode === "month" ? monthDays : weekDays;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Calendar ({mode})</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("month")}
          >
            Monthly
          </Button>
          <Button
            variant={mode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("week")}
          >
            Weekly
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReferenceDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReferenceDate(addDays(referenceDate, -7))}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReferenceDate(addDays(referenceDate, 7))}>
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-1 text-sm font-medium">{format(referenceDate, "MMMM yyyy")}</div>
        <p className="mb-4 text-xs text-muted-foreground">
          Hari ini:{" "}
          {today.toLocaleDateString("id-ID", {
            timeZone: "Asia/Jakarta",
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>

        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div key={label} className="px-2 py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayKey = toJakartaDateKey(day);
            const dayItems = itemMap.get(dayKey) ?? [];
            const inCurrentScope = isSameMonth(day, referenceDate) || mode === "week";
            const isToday = dayKey === todayKey;
            const dayHolidays = holidayMap.get(dayKey) ?? [];
            const primaryHoliday = dayHolidays[0] ?? null;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-24 rounded-lg border p-2",
                  inCurrentScope ? "bg-background" : "bg-muted/30",
                  isToday && "border-primary bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary))]",
                  primaryHoliday && "border-red-300/70 bg-red-50/40 dark:bg-red-950/20",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold">{format(day, "d")}</div>
                  {isToday ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Today
                    </span>
                  ) : null}
                </div>

                {primaryHoliday ? (
                  <div className="mb-1 rounded bg-red-100/70 px-1.5 py-1 text-[10px] font-medium leading-tight text-red-700 dark:bg-red-900/40 dark:text-red-200">
                    {primaryHoliday.name}
                    {dayHolidays.length > 1 ? ` (+${dayHolidays.length - 1})` : ""}
                  </div>
                ) : null}

                <div className="space-y-1">
                  {dayItems.slice(0, 2).map((item) => (
                    <Dialog key={item.id}>
                      <DialogTrigger asChild>
                        <button className="w-full rounded bg-secondary px-1.5 py-1 text-left text-[11px] hover:bg-secondary/80">
                          {item.title}
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{item.title}</DialogTitle>
                          <DialogDescription>
                            {item.kind} - {new Date(item.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 text-sm">
                          <p>Status: {item.status ?? "-"}</p>
                          <p>Source: {item.source}</p>
                          <p>TODO: add inline edit panel.</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                  {dayItems.length > 2 ? (
                    <p className="text-[11px] text-muted-foreground">+{dayItems.length - 2} lainnya</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
