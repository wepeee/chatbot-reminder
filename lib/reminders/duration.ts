export function parseISODurationToMilliseconds(
  duration: string,
): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i.exec(
    duration.trim(),
  );
  if (!match) {
    return null;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);

  return ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
}

export function computeReminderTimes(
  anchorISO: string,
  offsets: string[],
): string[] {
  const anchor = new Date(anchorISO);
  if (Number.isNaN(anchor.getTime())) {
    return [];
  }

  const values = offsets
    .map((offset) => {
      const ms = parseISODurationToMilliseconds(offset);
      if (ms === null) {
        return null;
      }
      return new Date(anchor.getTime() - ms).toISOString();
    })
    .filter((item): item is string => Boolean(item));

  const uniq = Array.from(new Set(values));
  return uniq.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}
