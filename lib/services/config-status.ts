import { env, isConfigured } from "@/lib/env";

export type AppConfigStatus = {
  openai_configured: boolean;
  messaging_provider: "discord";
  messaging_configured: boolean;
  database_configured: boolean;
  internal_api_base_url_configured: boolean;
  internal_api_token_configured: boolean;
  reminder_runner_token_configured: boolean;
  reminder_poll_interval_ms: number;
  webhook_fallback_configured: boolean;
};

export function getAppConfigStatus(): AppConfigStatus {
  return {
    openai_configured: isConfigured(env.OPENAI_API_KEY),
    messaging_provider: "discord",
    messaging_configured: isConfigured(env.DISCORD_BOT_TOKEN),
    database_configured: isConfigured(env.DATABASE_URL),
    internal_api_base_url_configured: isConfigured(env.INTERNAL_API_BASE_URL),
    internal_api_token_configured: isConfigured(env.API_INTERNAL_AUTH_TOKEN),
    reminder_runner_token_configured: isConfigured(env.REMINDER_RUN_AUTH_TOKEN),
    reminder_poll_interval_ms: env.REMINDER_POLL_INTERVAL_MS,
    webhook_fallback_configured: isConfigured(env.DISCORD_OUTBOUND_WEBHOOK_URL)
  };
}
