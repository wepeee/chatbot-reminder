import { NextResponse } from "next/server";

import { runDueReminderDispatch } from "@/lib/reminders/service";
import { assertReminderRunnerToken } from "@/lib/services/auth";
import { toErrorMessage } from "@/lib/utils";

export async function POST(request: Request) {
  const unauthorized = assertReminderRunnerToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await runDueReminderDispatch();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}
