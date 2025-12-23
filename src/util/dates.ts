// I hate this so much but it's more of a pain to fix right now
export function sqliteDateToUTC(dateStr: Date | string): string {
  if (dateStr instanceof Date) {
    return dateStr.toISOString();
  }
  return new Date(Date.parse(dateStr)).toISOString();
}
