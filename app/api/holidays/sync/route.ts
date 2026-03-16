import { NextResponse } from "next/server";
import { z } from "zod";

import { getDefaultHolidaySyncYears, syncIndonesiaHolidays } from "@/lib/holidays/service";
import { getHolidaySyncSummary } from "@/lib/services/data-service";
import { getCurrentSessionUser } from "@/lib/services/session-user";
import { toErrorMessage } from "@/lib/utils";

const syncBodySchema = z
  .object({
    years: z.array(z.number().int().min(2000).max(2100)).optional(),
    from_year: z.number().int().min(2000).max(2100).optional(),
    to_year: z.number().int().min(2000).max(2100).optional(),
  })
  .optional();

function resolveYears(input?: z.infer<typeof syncBodySchema>) {
  if (input?.years && input.years.length > 0) {
    return Array.from(new Set(input.years)).sort((a, b) => a - b);
  }

  if (input?.from_year && input?.to_year) {
    const start = Math.min(input.from_year, input.to_year);
    const end = Math.max(input.from_year, input.to_year);
    const years: number[] = [];

    for (let year = start; year <= end; year += 1) {
      years.push(year);
    }

    return years;
  }

  return getDefaultHolidaySyncYears();
}

export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getHolidaySyncSummary();

    return NextResponse.json({
      ok: true,
      data: {
        summary,
        default_years: getDefaultHolidaySyncYears(),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = syncBodySchema.parse(await request.json().catch(() => undefined));
    const years = resolveYears(body);

    const syncResult = await syncIndonesiaHolidays({ years });
    const summary = await getHolidaySyncSummary();

    return NextResponse.json({
      ok: true,
      data: {
        years,
        sync: syncResult,
        summary,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: toErrorMessage(error) }, { status: 400 });
  }
}
