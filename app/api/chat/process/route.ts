import { NextResponse } from "next/server";
import { z } from "zod";

import { assertInternalToken } from "@/lib/services/auth";
import { receiveIncomingChatMessage } from "@/lib/services/message-processor";
import { toErrorMessage } from "@/lib/utils";

const processChatSchema = z.object({
  channel: z.enum(["discord"]),
  from: z.string().min(1),
  text: z.string().min(1),
  raw_payload: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const unauthorized = assertInternalToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = processChatSchema.parse(await request.json());
    let replyText = "";

    const result = await receiveIncomingChatMessage({
      channel: body.channel,
      from: body.from,
      text: body.text,
      rawPayload: body.raw_payload ?? {},
      sendText: async ({ text }) => {
        replyText = text;
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        status: result.status,
        parsed: result.parsed,
        reply_text: replyText,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(error) },
      { status: 400 },
    );
  }
}
