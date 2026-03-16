import { NextResponse } from "next/server";

import { parseMessageWithAI } from "@/lib/openai/parser";
import { parseDeterministicReminder } from "@/lib/parser/deterministic-reminder";
import {
  buildParserNlpSignals,
  enforceNlpAmbiguityGuard,
  resolveMeridiemAmbiguityForIndonesianHour,
  parseDeterministicAgendaIntent,
} from "@/lib/parser/nlp-preprocess";
import { normalizeIncomingMessage } from "@/lib/parser/normalize";
import { enforceParsedTemporalConsistency } from "@/lib/parser/temporal-guard";
import { applyParsedFixups } from "@/lib/parser/fixups";
import { parseMessageRequestSchema } from "@/schemas/message";
import { toErrorMessage } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = parseMessageRequestSchema.parse(await request.json());
    const normalizedText = normalizeIncomingMessage(body.text);
    const nowISO = body.now_iso ?? new Date().toISOString();
    const now = new Date(nowISO);
    const nlpSignals = buildParserNlpSignals(normalizedText);

    const deterministicParsed =
      parseDeterministicAgendaIntent(normalizedText) ??
      parseDeterministicReminder(normalizedText, body.timezone);

    const parsedFromAI =
      deterministicParsed ??
      (await parseMessageWithAI({
        text: normalizedText,
        timezone: body.timezone,
        nowISO,
        nlpSignals,
      }));

    const parsedWithTemporalGuard = enforceParsedTemporalConsistency({
      parsed: parsedFromAI,
      normalizedText,
      timezone: body.timezone,
      now,
    });

    const parsedWithNlpGuard = enforceNlpAmbiguityGuard({
      parsed: parsedWithTemporalGuard,
      nlpSignals,
    });

    const parsedAfterMeridiem = resolveMeridiemAmbiguityForIndonesianHour({
      parsed: parsedWithNlpGuard,
      normalizedText,
      timezone: body.timezone,
      now,
    });

    const parsed = applyParsedFixups({
      parsed: parsedAfterMeridiem,
      normalizedText,
      timezone: body.timezone,
      now,
    });

    return NextResponse.json({ ok: true, data: parsed });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: toErrorMessage(error),
      },
      { status: 400 },
    );
  }
}











