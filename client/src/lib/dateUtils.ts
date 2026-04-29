/**
 * Date/time utilities — always use IST (Asia/Kolkata, UTC+5:30)
 */

const IST = 'Asia/Kolkata';

/** Format time only — e.g. "02:30 PM" */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  });
}

/** Format date only — e.g. "Mon, 30 Apr 2026" */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  });
}

/** Format date + time — e.g. "30 Apr, 02:30 PM" */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  });
}

/** Get today's date string in YYYY-MM-DD in IST */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST }); // en-CA gives YYYY-MM-DD
}

/** 
 * Get today's start as UTC ISO string, adjusted for IST offset.
 * Use this for Supabase queries — DB stores timestamps in UTC.
 * e.g. IST midnight (00:00 IST) = previous day 18:30 UTC
 */
export function todayStartUTC(): string {
  const now = new Date();
  // Get IST date parts
  const istDate = now.toLocaleDateString('en-CA', { timeZone: IST }); // YYYY-MM-DD
  // IST midnight = UTC midnight - 5h30m = UTC previous day 18:30
  // So: IST date 00:00:00 in UTC = istDate T00:00:00+05:30
  return `${istDate}T00:00:00+05:30`;
}
