import { NextResponse } from "next/server";

import { scheduleTaskReminders } from "@/lib/reminders/service";
import { createTask } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { createTaskSchema } from "@/schemas/message";
import { toErrorMessage } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = createTaskSchema.parse(await request.json());
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const task = await createTask({
      userId: user.id,
      title: body.title,
      description: body.description ?? null,
      dueAt: body.due_at,
      source: body.source,
      rawInput: body.raw_input ?? null,
    });

    await scheduleTaskReminders({
      userId: user.id,
      taskId: task.id,
      taskTitle: task.title,
      dueAt: task.due_at,
      offsets: body.reminder_offsets,
    });

    return NextResponse.json({ ok: true, data: task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(error) },
      { status: 400 },
    );
  }
}
