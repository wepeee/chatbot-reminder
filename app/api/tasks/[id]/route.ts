import { NextResponse } from "next/server";

import { deleteTask, updateTask } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { updateTaskSchema } from "@/schemas/message";
import { toErrorMessage } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = updateTaskSchema.parse(await request.json());

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.due_at !== undefined) patch.due_at = body.due_at;
    if (body.status !== undefined) patch.status = body.status;

    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const task = await updateTask({ userId: user.id, taskId: id, patch });
    return NextResponse.json({ ok: true, data: task });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await deleteTask({ userId: user.id, taskId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(error) },
      { status: 400 },
    );
  }
}
