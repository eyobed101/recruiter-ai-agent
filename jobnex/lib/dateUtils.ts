export function safeParseDate(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  return new Date(dateString);
}

export function formatDateForDisplay(date: string | Date): string {
  const d = safeParseDate(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}