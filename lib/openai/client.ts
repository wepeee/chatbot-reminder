import OpenAI from "openai";

import { env } from "@/lib/env";

const isOpenRouter = env.OPENAI_BASE_URL.includes("openrouter.ai");

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
  defaultHeaders: isOpenRouter
    ? {
        "HTTP-Referer": env.OPENROUTER_SITE_URL ?? env.NEXT_PUBLIC_APP_URL,
        "X-Title": env.OPENROUTER_APP_NAME ?? "AI Student Assistant"
      }
    : undefined
});

export function getAiProviderName() {
  return isOpenRouter ? "openrouter" : "openai";
}
