import { NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/env";
import { assertInternalToken } from "@/lib/services/auth";

export async function GET(request: Request) {
  const unauthorized = assertInternalToken(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({
    ok: true,
    data: {
      service: "chatbot-reminder-api",
      timestamp: new Date().toISOString(),
      timezone: env.APP_TIMEZONE,
      ai_model: env.OPENAI_MODEL,
      reminder_runner_configured: isConfigured(env.REMINDER_RUN_AUTH_TOKEN),
      discord_bot_configured: isConfigured(env.DISCORD_BOT_TOKEN)
    }
  });
}
