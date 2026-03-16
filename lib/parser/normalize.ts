import { normalizeWhitespace } from "@/lib/utils";

export function normalizeIncomingMessage(text: string): string {
  const cleaned = normalizeWhitespace(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  return cleaned;
}
