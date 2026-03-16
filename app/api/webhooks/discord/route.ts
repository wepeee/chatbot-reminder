import { NextResponse } from "next/server";

import {
  extractDiscordCommandText,
  getDiscordActorId,
  parseAndVerifyDiscordInteraction
} from "@/lib/discord/service";
import { receiveIncomingChatMessage } from "@/lib/services/message-processor";

export async function GET() {
  return NextResponse.json({ ok: true, channel: "discord" });
}

export async function POST(request: Request) {
  const verified = await parseAndVerifyDiscordInteraction(request);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  if (verified.payload.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const from = getDiscordActorId(verified.payload);
  if (!from) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "User Discord tidak terdeteksi."
      }
    });
  }

  const text = extractDiscordCommandText(verified.payload);
  if (!text) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "Gunakan slash command /assistant dengan opsi `text` (contoh: /assistant text: hari ini ada apa aja?)."
      }
    });
  }

  try {
    let outboundText = "Perintah sudah diterima.";

    await receiveIncomingChatMessage({
      channel: "discord",
      from,
      text,
      rawPayload: verified.payload as unknown as Record<string, unknown>,
      sendText: async ({ text: messageText }) => {
        outboundText = messageText;
      }
    });

    return NextResponse.json({
      type: 4,
      data: {
        content: outboundText
      }
    });
  } catch {
    return NextResponse.json({
      type: 4,
      data: {
        content: "Maaf, terjadi kendala saat memproses perintahmu. Coba lagi sebentar lagi."
      }
    });
  }
}
