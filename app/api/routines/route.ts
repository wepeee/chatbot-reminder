import { NextResponse } from "next/server";
import { z } from "zod";

import { scheduleCustomRecurringReminder } from "@/lib/reminders/service";
import { createRecurrenceRule } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { toErrorMessage } from "@/lib/utils";

const createRoutineSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  remind_at: z.string().datetime({ offset: true }),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  interval_value: z.number().int().positive().default(1),
  by_day: z.array(z.string()).nullable().optional(),
  by_month_day: z.array(z.number().int()).nullable().optional(),
  start_date: z.string().min(1),
  end_date: z.string().nullable().optional(),
  raw_rule_text: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const body = createRoutineSchema.parse(await request.json());
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const reminders = await scheduleCustomRecurringReminder({
      userId: user.id,
      title: body.title,
      remindAtISO: body.remind_at,
      message: body.message
    });

    const reminderId = reminders[0]?.id ?? null;

    const rule = await createRecurrenceRule({
      userId: user.id,
      entityType: "reminder",
      entityId: reminderId,
      frequency: body.frequency,
      intervalValue: body.interval_value,
      byDay: body.by_day ?? null,
      byMonthDay: body.by_month_day ?? null,
      startDate: body.start_date,
      endDate: body.end_date ?? null,
      rawRuleText: body.raw_rule_text ?? body.title
    });

    return NextResponse.json({ ok: true, data: { reminder: reminders[0] ?? null, rule } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}


