"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type RoutineItem = {
  id: string;
  frequency: string;
  interval_value: number;
  by_day: string[] | null;
  start_date: string;
  end_date: string | null;
  raw_rule_text: string | null;
};

type ReminderItem = {
  id: string;
  remind_at: string;
  status: string;
  reminder_type: string;
  message_template: string;
};

export function RoutinesManager({
  initialRoutines,
  initialReminders
}: {
  initialRoutines: RoutineItem[];
  initialReminders: ReminderItem[];
}) {
  const [routines, setRoutines] = useState(initialRoutines);
  const [reminders, setReminders] = useState(initialReminders);
  const [isCreating, setIsCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [byDay, setByDay] = useState("MO");
  const [startDate, setStartDate] = useState("");
  const [time, setTime] = useState("08:00");

  async function createRoutine() {
    if (!title || !message || !startDate) return;

    const remindAt = new Date(`${startDate}T${time}`).toISOString();

    setIsCreating(true);
    try {
      const response = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          remind_at: remindAt,
          frequency,
          interval_value: 1,
          by_day: frequency === "weekly" ? byDay.split(",").map((value) => value.trim()) : null,
          start_date: startDate,
          raw_rule_text: `${frequency} ${byDay}`
        })
      });

      const json = (await response.json()) as {
        ok: boolean;
        data?: { rule: RoutineItem; reminder: ReminderItem | null };
      };

      if (json.ok && json.data) {
        setRoutines((prev) => [json.data!.rule, ...prev]);
        if (json.data.reminder) {
          setReminders((prev) => [json.data!.reminder!, ...prev]);
        }

        setTitle("");
        setMessage("");
        setFrequency("weekly");
        setByDay("MO");
        setStartDate("");
        setTime("08:00");
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Recurring Reminder</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="routine-title">Title</Label>
            <Input id="routine-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Siap Jumatan" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="routine-message">Message</Label>
            <Textarea id="routine-message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-frequency">Frequency</Label>
            <select
              id="routine-frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="custom">custom</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-byday">By day (weekly)</Label>
            <Input id="routine-byday" value={byDay} onChange={(event) => setByDay(event.target.value)} placeholder="MO,FR" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-start-date">Start date</Label>
            <Input id="routine-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-time">Time</Label>
            <Input id="routine-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Button onClick={createRoutine} disabled={isCreating || !title || !message || !startDate} className="gap-2">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isCreating ? "Saving..." : "Save recurring reminder"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {routines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recurring rules yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Frequency</TableHead>
                  <TableHead>By Day</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Raw Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routines.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.frequency}</TableCell>
                    <TableCell>{rule.by_day?.join(", ") ?? "-"}</TableCell>
                    <TableCell>{rule.start_date}</TableCell>
                    <TableCell>{rule.end_date ?? "-"}</TableCell>
                    <TableCell>{rule.raw_rule_text ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Remind at</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell>{new Date(reminder.remind_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell>
                    <TableCell>{reminder.reminder_type}</TableCell>
                    <TableCell>
                      <StatusBadge status={reminder.status} />
                    </TableCell>
                    <TableCell>{reminder.message_template}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
