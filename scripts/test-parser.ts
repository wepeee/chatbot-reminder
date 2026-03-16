import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function parseArg(prefix: string) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const timezone = parseArg("--timezone=") ?? "Asia/Jakarta";
  const nowISO = parseArg("--now=") ?? new Date().toISOString();
  const baseUrlRaw =
    parseArg("--base-url=") ??
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const baseUrl = baseUrlRaw.replace(/\/+$/, "");

  const cliTexts = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--"))
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  const defaultTexts = [
    "aku ada tugas basis data tanggal 20 maret jam 23.59",
    "setiap senin jam 8 pagi kuliah AI",
    "ingetin aku tiap jumat jam 10 buat siap jumatan",
    "hari ini ada apa aja?",
    "minggu ini deadline apa?",
    "ubah deadline tugas AI jadi kamis",
  ];

  const texts = cliTexts.length > 0 ? cliTexts : defaultTexts;

  console.log(`[parser:test] base_url=${baseUrl}`);
  console.log(`[parser:test] timezone=${timezone}`);
  console.log(`[parser:test] now_iso=${nowISO}`);
  console.log(`[parser:test] cases=${texts.length}`);

  for (const [index, rawText] of texts.entries()) {
    const response = await fetch(`${baseUrl}/api/parse-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: rawText,
        timezone,
        now_iso: nowISO,
      }),
    });

    const json = (await response.json()) as { ok?: boolean; data?: unknown; error?: string };

    console.log(`\n[case ${index + 1}] ${rawText}`);
    if (!response.ok || !json.ok) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            status: response.status,
            error: json.error ?? "Unknown API error",
          },
          null,
          2,
        ),
      );
      continue;
    }

    console.log(JSON.stringify(json.data, null, 2));
  }
}

main().catch((error) => {
  console.error("[parser:test] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
