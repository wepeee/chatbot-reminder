import { NextResponse } from "next/server";

import { deleteEvent, updateEvent } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { updateEventSchema } from "@/schemas/message";
import { toErrorMessage } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = updateEventSchema.parse(await request.json());

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.start_at !== undefined) patch.start_at = body.start_at;
    if (body.end_at !== undefined) patch.end_at = body.end_at;
    if (body.location !== undefined) patch.location = body.location;

    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const event = await updateEvent({ userId: user.id, eventId: id, patch });
    return NextResponse.json({ ok: true, data: event });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: Params) {
  try {
    const { id } = await context.params;
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await deleteEvent({ userId: user.id, eventId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}


