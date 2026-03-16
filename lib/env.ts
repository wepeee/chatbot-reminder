import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_API_BASE_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  DATABASE_URL: z.string().default("postgresql://dev:dev@localhost:5432/dev"),

  OPENAI_API_KEY: z.string().default("dev-placeholder"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_PARSER_MODEL: z.string().optional(),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().optional(),
  AI_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().positive().default(250000),

  AUTH_SECRET: z.string().default("dev-placeholder"),
  AUTH_DISCORD_ID: z.string().default("dev-placeholder"),
  AUTH_DISCORD_SECRET: z.string().default("dev-placeholder"),

  DISCORD_PUBLIC_KEY: z.string().default("dev-placeholder"),
  DISCORD_BOT_TOKEN: z.string().default("dev-placeholder"),
  DISCORD_ALLOWED_USER_ID: z.string().optional(),
  DISCORD_COMMAND_NAME: z.string().default("assistant"),
  DISCORD_OUTBOUND_WEBHOOK_URL: z.string().default("dev-placeholder"),
  NEXT_PUBLIC_DISCORD_BOT_DM_URL: z.string().optional(),

  REMINDER_RUN_AUTH_TOKEN: z.string().default("dev-placeholder"),
  API_INTERNAL_AUTH_TOKEN: z.string().default("dev-placeholder"),
  REMINDER_MAX_LAG_MINUTES: z.coerce.number().int().nonnegative().default(30),
  REMINDER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(15000),

  HOLIDAY_PROVIDER_BASE_URL: z.string().url().default("https://libur.deno.dev"),
  HOLIDAY_SYNC_YEARS_PAST: z.coerce.number().int().min(0).default(0),
  HOLIDAY_SYNC_YEARS_FUTURE: z.coerce.number().int().min(0).default(1),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  INTERNAL_API_BASE_URL: process.env.INTERNAL_API_BASE_URL,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
  DATABASE_URL: process.env.DATABASE_URL,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_PARSER_MODEL: process.env.OPENAI_PARSER_MODEL,
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME,
  AI_MONTHLY_TOKEN_BUDGET: process.env.AI_MONTHLY_TOKEN_BUDGET,

  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
  AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,

  DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_ALLOWED_USER_ID: process.env.DISCORD_ALLOWED_USER_ID,
  DISCORD_COMMAND_NAME: process.env.DISCORD_COMMAND_NAME,
  DISCORD_OUTBOUND_WEBHOOK_URL: process.env.DISCORD_OUTBOUND_WEBHOOK_URL,
  NEXT_PUBLIC_DISCORD_BOT_DM_URL: process.env.NEXT_PUBLIC_DISCORD_BOT_DM_URL,

  REMINDER_RUN_AUTH_TOKEN: process.env.REMINDER_RUN_AUTH_TOKEN,
  API_INTERNAL_AUTH_TOKEN: process.env.API_INTERNAL_AUTH_TOKEN,
  REMINDER_MAX_LAG_MINUTES: process.env.REMINDER_MAX_LAG_MINUTES,
  REMINDER_POLL_INTERVAL_MS: process.env.REMINDER_POLL_INTERVAL_MS,

  HOLIDAY_PROVIDER_BASE_URL: process.env.HOLIDAY_PROVIDER_BASE_URL,
  HOLIDAY_SYNC_YEARS_PAST: process.env.HOLIDAY_SYNC_YEARS_PAST,
  HOLIDAY_SYNC_YEARS_FUTURE: process.env.HOLIDAY_SYNC_YEARS_FUTURE,
});

const DEV_PLACEHOLDERS = new Set([
  "dev-placeholder",
  "http://localhost:3000",
  "postgresql://dev:dev@localhost:5432/dev",
  "https://api.openai.com/v1",
]);

export function isConfigured(value: string) {
  return !DEV_PLACEHOLDERS.has(value);
}

