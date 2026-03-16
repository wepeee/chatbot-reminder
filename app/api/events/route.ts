import { NextResponse } from "next/server";

import { scheduleEventReminders } from "@/lib/reminders/service";
import { createEvent } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { createEventSchema } from "@/schemas/message";
import { toErrorMessage } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = createEventSchema.parse(await request.json());
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const event = await createEvent({
      userId: user.id,
      title: body.title,
      description: body.description ?? null,
      startAt: body.start_at,
      endAt: body.end_at ?? null,
      location: body.location ?? null,
      source: body.source,
      rawInput: body.raw_input ?? null
    });

    await scheduleEventReminders({
      userId: user.id,
      eventId: event.id,
      eventTitle: event.title,
      startAt: event.start_at,
      offsets: body.reminder_offsets
    });

    return NextResponse.json({ ok: true, data: event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}


