import { z } from "zod";

import { env } from "@/lib/env";
import { replaceHolidaysForYear } from "@/lib/services/data-service";

type HolidayTypeValue = "national" | "joint_leave" | "observance";

type NormalizedHoliday = {
  date: string;
  name: string;
  local_name: string | null;
  type: HolidayTypeValue;
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function uniqueByDateAndName(rows: NormalizedHoliday[]) {
  const map = new Map<string, NormalizedHoliday>();

  for (const row of rows) {
    map.set(`${row.date}::${row.name.toLowerCase()}`, row);
  }

  return Array.from(map.values());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function toHolidayType(input: {
  name: string;
  note: string | null;
  explicitType: string | null;
  isJointLeave: boolean;
}): HolidayTypeValue {
  const haystack = `${input.name} ${input.note ?? ""} ${input.explicitType ?? ""}`.toLowerCase();

  if (input.isJointLeave || haystack.includes("cuti bersama") || haystack.includes("joint")) {
    return "joint_leave";
  }

  if (
    haystack.includes("peringatan") ||
    haystack.includes("observance") ||
    haystack.includes("anniversary")
  ) {
    return "observance";
  }

  return "national";
}

function normalizeHolidayRecord(raw: unknown): NormalizedHoliday | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const date = pickString(record, ["date", "tanggal", "holiday_date", "tgl"]);
  const name = pickString(record, ["name", "keterangan", "summary", "title", "description", "deskripsi"]);

  if (!date || !name || !isoDateSchema.safeParse(date).success) {
    return null;
  }

  const note = pickString(record, ["localName", "local_name", "catatan", "note"]);
  const explicitType = pickString(record, ["type", "jenis"]);
  const isJointLeave =
    record.is_cuti === true ||
    record.isCuti === true ||
    record.is_cuti_bersama === true ||
    record.cuti_bersama === true;

  return {
    date,
    name,
    local_name: note,
    type: toHolidayType({
      name,
      note,
      explicitType,
      isJointLeave,
    }),
  };
}

function extractHolidayArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = [record.data, record.results, record.holidays, record.items, record.libur];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

export function getDefaultHolidaySyncYears(baseDate = new Date()) {
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
    }).format(baseDate),
  );

  const fromYear = currentYear - env.HOLIDAY_SYNC_YEARS_PAST;
  const toYear = currentYear + env.HOLIDAY_SYNC_YEARS_FUTURE;

  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    years.push(year);
  }

  return years;
}

async function fetchFromCandidateUrls(urls: string[]) {
  let lastError: string | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        lastError = `HTTP ${response.status} on ${url}: ${body.slice(0, 200)}`;
        continue;
      }

      const payload = await response.json();
      const rawItems = extractHolidayArray(payload);
      const normalized = rawItems
        .map(normalizeHolidayRecord)
        .filter((item): item is NormalizedHoliday => Boolean(item));

      if (normalized.length > 0) {
        return uniqueByDateAndName(normalized);
      }

      lastError = `No valid holiday entries found on ${url}`;
    } catch (error) {
      lastError = error instanceof Error ? `${url}: ${error.message}` : `${url}: unknown error`;
    }
  }

  throw new Error(lastError ?? "Failed fetching holidays from all candidate endpoints.");
}

async function fetchIndonesiaHolidaysByYear(year: number) {
  const baseUrl = normalizeBaseUrl(env.HOLIDAY_PROVIDER_BASE_URL);

  const urls = [
    `${baseUrl}/api?year=${year}`,
    `${baseUrl}/api?tahun=${year}`,
    `${baseUrl}/api/${year}`,
    `${baseUrl}/?year=${year}`,
    `${baseUrl}/${year}`,
  ];

  return fetchFromCandidateUrls(urls);
}

export type HolidaySyncYearResult = {
  year: number;
  fetched: number;
  inserted: number;
  deleted: number;
  error: string | null;
};

export async function syncIndonesiaHolidays(input?: { years?: number[] }) {
  const years = (input?.years?.length ? input.years : getDefaultHolidaySyncYears())
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .sort((a, b) => a - b);

  if (years.length === 0) {
    throw new Error("No valid years to sync holidays.");
  }

  const results: HolidaySyncYearResult[] = [];

  for (const year of years) {
    try {
      const holidays = await fetchIndonesiaHolidaysByYear(year);
      const saved = await replaceHolidaysForYear({
        year,
        source: "libur-deno",
        items: holidays,
      });

      results.push({
        year,
        fetched: holidays.length,
        inserted: saved.insertedCount,
        deleted: saved.deletedCount,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        year,
        fetched: 0,
        inserted: 0,
        deleted: 0,
        error: message,
      });
    }
  }

  return {
    provider: "libur-deno",
    years,
    results,
    success_count: results.filter((result) => !result.error).length,
    failed_count: results.filter((result) => Boolean(result.error)).length,
  };
}
