import { createPublicKey, verify } from "crypto";

import { env } from "@/lib/env";
import {
  discordInteractionSchema,
  type DiscordInteraction,
} from "@/schemas/discord";

const DISCORD_PUBLIC_KEY_PREFIX_DER = "302a300506032b6570032100";

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) {
    throw new Error("Invalid hex length.");
  }

  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    out[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  }

  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function verifyDiscordSignature(params: {
  signature: string;
  timestamp: string;
  rawBody: string;
  publicKeyHex: string;
}) {
  const keyBytes = hexToBytes(params.publicKeyHex);
  const signatureBytes = hexToBytes(params.signature);
  const messageBytes = new TextEncoder().encode(
    `${params.timestamp}${params.rawBody}`,
  );

  const derPrefix = hexToBytes(DISCORD_PUBLIC_KEY_PREFIX_DER);
  const derKey = concatBytes(derPrefix, keyBytes);

  const publicKey = createPublicKey({
    key: derKey as unknown as never,
    format: "der",
    type: "spki",
  });

  return verify(
    null,
    messageBytes as unknown as NodeJS.ArrayBufferView,
    publicKey,
    signatureBytes as unknown as NodeJS.ArrayBufferView,
  );
}

export async function parseAndVerifyDiscordInteraction(request: Request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return { ok: false as const, reason: "missing_signature_headers" };
  }

  const rawBody = await request.text();

  try {
    const isValid = verifyDiscordSignature({
      signature,
      timestamp,
      rawBody,
      publicKeyHex: env.DISCORD_PUBLIC_KEY,
    });

    if (!isValid) {
      return { ok: false as const, reason: "invalid_signature" };
    }

    const parsed = discordInteractionSchema.parse(JSON.parse(rawBody));
    return { ok: true as const, payload: parsed, rawBody };
  } catch {
    return { ok: false as const, reason: "invalid_payload" };
  }
}

export function getDiscordActorId(interaction: DiscordInteraction) {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null;
}

export function extractDiscordCommandText(interaction: DiscordInteraction) {
  if (interaction.type !== 2 || !interaction.data?.name) {
    return null;
  }

  if (
    interaction.data.name.toLowerCase() !==
    env.DISCORD_COMMAND_NAME.toLowerCase()
  ) {
    return null;
  }

  const options = interaction.data.options ?? [];
  const textOption = options.find(
    (option) => option.name === "text" || option.name === "message",
  );

  if (typeof textOption?.value === "string") {
    return textOption.value.trim();
  }

  return null;
}

export function buildDiscordReminderText(params: {
  title: string;
  body: string;
  whenISO?: string;
}) {
  const header = params.whenISO
    ? `Pengingat: ${params.title}\nWaktu: ${new Date(params.whenISO).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      })}`
    : `Pengingat: ${params.title}`;

  return `${header}\n${params.body}`;
}

export async function sendDiscordWebhookMessage(params: { text: string }) {
  const response = await fetch(env.DISCORD_OUTBOUND_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook error ${response.status}: ${body}`);
  }

  return response;
}

async function createDiscordDmChannel(discordUserId: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord create DM error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("Discord create DM error: missing channel id");
  }

  return json.id;
}

export async function sendDiscordDirectMessage(input: {
  discordUserId: string;
  text: string;
}) {
  const channelId = await createDiscordDmChannel(input.discordUserId);

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: input.text }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord DM send error ${response.status}: ${body}`);
  }

  return response;
}

export async function sendDiscordReminder(params: {
  title: string;
  body: string;
  whenISO?: string;
}) {
  return sendDiscordWebhookMessage({
    text: buildDiscordReminderText(params),
  });
}
