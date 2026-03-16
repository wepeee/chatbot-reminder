import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export function assertInternalToken(request: Request): NextResponse | null {
  const token = request.headers.get("x-internal-token") ?? request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token || token !== env.API_INTERNAL_AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function assertReminderRunnerToken(request: Request): NextResponse | null {
  const token = request.headers.get("x-reminder-token") ?? request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token || token !== env.REMINDER_RUN_AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
