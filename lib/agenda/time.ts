const JAKARTA_OFFSET_HOURS = 7;
const HOUR_MS = 60 * 60 * 1000;

export function toJakartaBoundaryISO(baseDate = new Date(), dayOffset = 0) {
  const shifted = new Date(baseDate.getTime() + JAKARTA_OFFSET_HOURS * HOUR_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const date = shifted.getUTCDate() + dayOffset;

  const utcMillis = Date.UTC(year, month, date, 0, 0, 0, 0) - JAKARTA_OFFSET_HOURS * HOUR_MS;
  return new Date(utcMillis).toISOString();
}

export function formatJakartaDateTime(isoString: string) {
  return new Date(isoString).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatJakartaDate(isoString: string) {
  return new Date(isoString).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
