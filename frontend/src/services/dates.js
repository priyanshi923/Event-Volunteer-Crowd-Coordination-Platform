// The API stores timestamps in UTC without a timezone suffix
// (e.g. "2026-10-01T05:16:00"). Treat those as UTC so they render in local time.
export function parseServerDate(value) {
  if (!value) return null;
  const str = String(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(str);
  return new Date(hasZone ? str : `${str.replace(' ', 'T')}Z`);
}
