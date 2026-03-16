import { NextResponse } from "next/server";

import { getTodayAgenda } from "@/lib/agenda/service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { toErrorMessage } from "@/lib/utils";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const agenda = await getTodayAgenda(user.id);

    return NextResponse.json({ ok: true, data: agenda });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}


