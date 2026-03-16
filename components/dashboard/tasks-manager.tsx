"use client";

import { useMemo, useState } from "react";
import { isToday } from "date-fns";
import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
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

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: "pending" | "completed" | "cancelled" | "overdue";
  source: "discord" | "dashboard";
};

type TaskFilter = "all" | "pending" | "completed" | "overdue" | "due_today" | "due_week";

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (num: number) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function TasksManager({ initialTasks }: { initialTasks: TaskItem[] }) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [filter, setFilter] = useState<TaskFilter>("all");

  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [activeRowAction, setActiveRowAction] = useState<{ id: string; kind: "complete" | "delete" } | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueAt, setNewDueAt] = useState("");

  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");

  const filteredTasks = useMemo(() => {
    const now = new Date();

    if (filter === "all") return tasks;
    if (filter === "pending") return tasks.filter((task) => task.status === "pending");
    if (filter === "completed") return tasks.filter((task) => task.status === "completed");
    if (filter === "overdue") return tasks.filter((task) => new Date(task.due_at).getTime() < now.getTime() && task.status === "pending");
    if (filter === "due_today") return tasks.filter((task) => isToday(new Date(task.due_at)));
    if (filter === "due_week") {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      return tasks.filter((task) => {
        const due = new Date(task.due_at).getTime();
        return due >= now.getTime() && due <= now.getTime() + weekMs;
      });
    }

    return tasks;
  }, [tasks, filter]);

  async function createTask() {
    if (!newTitle || !newDueAt) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || null,
          due_at: new Date(newDueAt).toISOString(),
          source: "dashboard"
        })
      });

      const json = (await response.json()) as { ok: boolean; data?: TaskItem };
      if (json.ok && json.data) {
        setTasks((prev) => [json.data!, ...prev]);
        setNewTitle("");
        setNewDescription("");
        setNewDueAt("");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function patchTask(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as { ok: boolean; data?: TaskItem };
    if (json.ok && json.data) {
      setTasks((prev) => prev.map((task) => (task.id === id ? json.data! : task)));
    }
  }

  async function completeTask(id: string) {
    setActiveRowAction({ id, kind: "complete" });
    try {
      await patchTask(id, { status: "completed" });
    } finally {
      setActiveRowAction(null);
    }
  }

  async function removeTask(id: string) {
    setActiveRowAction({ id, kind: "delete" });
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { ok: boolean };
      if (json.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== id));
      }
    } finally {
      setActiveRowAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Contoh: Tugas Basis Data" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Opsional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Due at</Label>
            <Input id="task-due" type="datetime-local" value={newDueAt} onChange={(event) => setNewDueAt(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button disabled={isCreating || !newTitle || !newDueAt} onClick={createTask} className="w-full gap-2 md:w-auto">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isCreating ? "Saving..." : "Save task"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tasks</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "completed", "overdue", "due_today", "due_week"] as TaskFilter[]).map((value) => (
              <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                {value}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks found for this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const completing = activeRowAction?.id === task.id && activeRowAction.kind === "complete";
                  const deleting = activeRowAction?.id === task.id && activeRowAction.kind === "delete";

                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{new Date(task.due_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>{task.source}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={completing || deleting} onClick={() => completeTask(task.id)} className="gap-2">
                            {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Complete
                          </Button>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingTask(task);
                                  setEditTitle(task.title);
                                  setEditDescription(task.description ?? "");
                                  setEditDueAt(toDateTimeLocalValue(task.due_at));
                                }}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Task</DialogTitle>
                                <DialogDescription>Reschedule atau update detail tugas.</DialogDescription>
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
                                  <Label>Due at</Label>
                                  <Input type="datetime-local" value={editDueAt} onChange={(event) => setEditDueAt(event.target.value)} />
                                </div>
                                <Button
                                  className="w-full gap-2"
                                  disabled={isSavingEdit}
                                  onClick={async () => {
                                    if (!editingTask) return;
                                    setIsSavingEdit(true);
                                    try {
                                      await patchTask(editingTask.id, {
                                        title: editTitle,
                                        description: editDescription || null,
                                        due_at: new Date(editDueAt).toISOString()
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

                          <Button size="sm" variant="destructive" disabled={completing || deleting} onClick={() => removeTask(task.id)} className="gap-2">
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




