import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppConfigStatus } from "@/lib/services/config-status";
import { updateUser } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { toErrorMessage } from "@/lib/utils";

const updateSettingsSchema = z.object({
  full_name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional()
});

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        user,
        config_status: getAppConfigStatus()
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = updateSettingsSchema.parse(await request.json());

    const currentUser = await getCurrentSessionUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await updateUser({
      userId: currentUser.id,
      fullName: body.full_name,
      timezone: body.timezone
    });

    return NextResponse.json({ ok: true, data: user });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}
