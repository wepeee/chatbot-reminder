import { loadEnvConfig } from "@next/env";
import { ChannelType, Client, Events, GatewayIntentBits, Partials, type Message } from "discord.js";

loadEnvConfig(process.cwd());

const apiBaseUrlRaw = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const appBaseUrl = apiBaseUrlRaw.replace(/\/+$/, "");
const internalToken = process.env.API_INTERNAL_AUTH_TOKEN;
const reminderRunnerToken = process.env.REMINDER_RUN_AUTH_TOKEN;
const botToken = process.env.DISCORD_BOT_TOKEN;
const allowedUserId = process.env.DISCORD_ALLOWED_USER_ID;
const reminderPollIntervalMs = Math.max(1000, Number.parseInt(process.env.REMINDER_POLL_INTERVAL_MS ?? "15000", 10));

if (!botToken || botToken === "dev-placeholder") {
  throw new Error("DISCORD_BOT_TOKEN is required to run Discord DM bot.");
}

if (!internalToken || internalToken === "dev-placeholder") {
  throw new Error("API_INTERNAL_AUTH_TOKEN is required to run Discord DM bot.");
}

const internalTokenValue = internalToken;
const reminderTokenValue = reminderRunnerToken ?? "";
let reminderDispatchRunning = false;

const client = new Client({
  // DM-only bot: avoid privileged intents so login won't fail.
  intents: [GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

async function parseJsonResponse<T>(response: Response, fallbackLabel: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = rawBody.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `${fallbackLabel} returned non-JSON (status ${response.status}) from ${response.url || "unknown"}. ` +
        `redirected=${response.redirected}. content-type=${contentType || "unknown"}. body=${preview}`
    );
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    const preview = rawBody.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`${fallbackLabel} JSON parse failed (status ${response.status}). body=${preview}`);
  }
}

async function pingInternalApi() {
  const url = `${appBaseUrl}/api/internal/health`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-internal-token": internalTokenValue
    }
  });

  const json = await parseJsonResponse<{
    ok: boolean;
    data?: {
      service?: string;
      timezone?: string;
      ai_model?: string;
      timestamp?: string;
      reminder_runner_configured?: boolean;
      discord_bot_configured?: boolean;
    };
    error?: string;
  }>(response, "Internal API /api/internal/health");

  if (!response.ok || !json.ok) {
    throw new Error(json.error ?? `Internal API health error ${response.status}`);
  }

  const service = json.data?.service ?? "unknown-service";
  const timezone = json.data?.timezone ?? "unknown-timezone";
  const model = json.data?.ai_model ?? "unknown-model";
  console.log(`[discord-bot] API health OK: service=${service}, timezone=${timezone}, model=${model}`);
}


const DISCORD_MESSAGE_LIMIT = 2000;

function fitDiscordMessage(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.length <= DISCORD_MESSAGE_LIMIT) {
    return trimmed;
  }

  return `${trimmed.slice(0, DISCORD_MESSAGE_LIMIT - 3)}...`;
}

async function processMessage(input: { from: string; text: string; rawPayload: Record<string, unknown> }) {
  const url = `${appBaseUrl}/api/chat/process`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalTokenValue
    },
    body: JSON.stringify({
      channel: "discord",
      from: input.from,
      text: input.text,
      raw_payload: input.rawPayload
    })
  });

  const json = await parseJsonResponse<{
    ok: boolean;
    data?: { reply_text?: string };
    error?: string;
  }>(response, "Internal API /api/chat/process");

  if (!response.ok || !json.ok) {
    throw new Error(json.error ?? `Internal API error ${response.status}`);
  }

  return json.data?.reply_text ?? "";
}

async function runReminderDispatchTick() {
  if (!reminderTokenValue || reminderTokenValue === "dev-placeholder") {
    return;
  }

  if (reminderDispatchRunning) {
    return;
  }

  reminderDispatchRunning = true;
  try {
    const url = `${appBaseUrl}/api/reminders/run-due`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-reminder-token": reminderTokenValue
      },
      body: "{}"
    });

    const json = await parseJsonResponse<{
      ok: boolean;
      data?: { processed?: number; sent?: number; failed?: number; skipped_stale?: number };
      error?: string;
    }>(response, "Internal API /api/reminders/run-due");

    if (!response.ok || !json.ok) {
      throw new Error(json.error ?? `Reminder dispatch error ${response.status}`);
    }

    const processed = json.data?.processed ?? 0;
    const sent = json.data?.sent ?? 0;
    const failed = json.data?.failed ?? 0;
    const skippedStale = json.data?.skipped_stale ?? 0;

    if (processed > 0 || sent > 0 || failed > 0 || skippedStale > 0) {
      console.log(
        `[discord-bot] reminder tick: processed=${processed}, sent=${sent}, failed=${failed}, skipped_stale=${skippedStale}`
      );
    }
  } catch (error) {
    console.error("[discord-bot] reminder dispatch failed:", error instanceof Error ? error.message : error);
  } finally {
    reminderDispatchRunning = false;
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[discord-bot] Logged in as ${readyClient.user.tag}`);
  console.log(`[discord-bot] Internal API base URL: ${appBaseUrl}`);

  void pingInternalApi().catch((error) => {
    console.error("[discord-bot] API health check failed:", error instanceof Error ? error.message : error);
  });

  if (!reminderTokenValue || reminderTokenValue === "dev-placeholder") {
    console.log("[discord-bot] Reminder poller disabled: REMINDER_RUN_AUTH_TOKEN not configured.");
    return;
  }

  console.log(`[discord-bot] Reminder poller enabled: every ${reminderPollIntervalMs}ms`);
  void runReminderDispatchTick();
  setInterval(() => {
    void runReminderDispatchTick();
  }, reminderPollIntervalMs);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) {
    return;
  }

  if (message.channel.type !== ChannelType.DM) {
    return;
  }

  if (!message.content?.trim()) {
    return;
  }

  if (allowedUserId && message.author.id !== allowedUserId) {
    await message.reply("Bot ini sedang dikunci untuk user tertentu.");
    return;
  }

  let pendingReply: Message | null = null;

  try {
    pendingReply = await message.reply("Thinking...");

    const replyText = await processMessage({
      from: message.author.id,
      text: message.content,
      rawPayload: {
        message_id: message.id,
        author_id: message.author.id,
        author_username: message.author.username,
        channel_id: message.channel.id,
        guild_id: message.guildId,
        content: message.content,
        created_at: message.createdAt.toISOString()
      }
    });

    const finalReply = fitDiscordMessage(replyText) || "Perintah sudah diproses.";
    await pendingReply.edit(finalReply);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[discord-bot] message processing failed:", errorMessage);

    const fallbackReply = "Maaf, lagi ada kendala saat memproses pesanmu.";
    if (pendingReply) {
      await pendingReply.edit(fallbackReply);
    } else {
      await message.reply(fallbackReply);
    }
  }
});

client.login(botToken).catch((error) => {
  console.error("[discord-bot] login failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
