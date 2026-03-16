"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  source: "discord" | "dashboard";
};

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventsManager({ initialEvents }: { initialEvents: EventItem[] }) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);

  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");

  async function createEvent() {
    if (!title || !startAt) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          location: location || null,
          start_at: new Date(startAt).toISOString(),
          end_at: endAt ? new Date(endAt).toISOString() : null,
          source: "dashboard"
        })
      });

      const json = (await response.json()) as { ok: boolean; data?: EventItem };
      if (json.ok && json.data) {
        setEvents((prev) => [json.data!, ...prev]);
        setTitle("");
        setDescription("");
        setLocation("");
        setStartAt("");
        setEndAt("");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function patchEvent(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as { ok: boolean; data?: EventItem };
    if (json.ok && json.data) {
      setEvents((prev) => prev.map((event) => (event.id === id ? json.data! : event)));
    }
  }

  async function removeEvent(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { ok: boolean };
      if (json.ok) {
        setEvents((prev) => prev.filter((event) => event.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Event</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Kuliah AI" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="event-description">Description</Label>
            <Textarea id="event-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Location</Label>
            <Input id="event-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ruang B-203" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-start">Start at</Label>
            <Input id="event-start" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-end">End at</Label>
            <Input id="event-end" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
          </div>

          <div className="flex items-end">
            <Button className="w-full gap-2 md:w-auto" onClick={createEvent} disabled={isCreating || !title || !startAt}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isCreating ? "Saving..." : "Save event"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const deleting = deletingId === event.id;

                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>{new Date(event.start_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell>
                      <TableCell>{event.end_at ? new Date(event.end_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-"}</TableCell>
                      <TableCell>{event.location ?? "-"}</TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingEvent(event);
                                  setEditTitle(event.title);
                                  setEditDescription(event.description ?? "");
                                  setEditLocation(event.location ?? "");
                                  setEditStartAt(toDateTimeLocalValue(event.start_at));
                                  setEditEndAt(event.end_at ? toDateTimeLocalValue(event.end_at) : "");
                                }}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Event</DialogTitle>
                                <DialogDescription>Update jadwal event/kuliah.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label>Title</Label>
                                  <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Description</Label>
                                  <Textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Location</Label>
                                  <Input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Start at</Label>
                                  <Input type="datetime-local" value={editStartAt} onChange={(event) => setEditStartAt(event.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>End at</Label>
                                  <Input type="datetime-local" value={editEndAt} onChange={(event) => setEditEndAt(event.target.value)} />
                                </div>
                                <Button
                                  className="w-full gap-2"
                                  disabled={isSavingEdit}
                                  onClick={async () => {
                                    if (!editingEvent) return;
                                    setIsSavingEdit(true);
                                    try {
                                      await patchEvent(editingEvent.id, {
                                        title: editTitle,
                                        description: editDescription || null,
                                        location: editLocation || null,
                                        start_at: new Date(editStartAt).toISOString(),
                                        end_at: editEndAt ? new Date(editEndAt).toISOString() : null
                                      });
                                    } finally {
                                      setIsSavingEdit(false);
                                    }
                                  }}
                                >
                                  {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Save changes
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button size="sm" variant="destructive" disabled={deleting} onClick={() => removeEvent(event.id)} className="gap-2">
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




