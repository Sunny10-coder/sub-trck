// Formatting helpers.
export function money(amount?: number | null, currency = "AED"): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "—";
  const n = Number(amount);
  const s = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
  return `${currency} ${s}`;
}

export function formatDate(d?: string | null): string {
  if (!d) return "—";
  try {
    const date = new Date(String(d).slice(0, 10) + "T00:00:00");
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

export function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  try {
    const date = new Date(String(d).slice(0, 10) + "T00:00:00");
    if (isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((date.getTime() - today.getTime()) / 86400000);
  } catch {
    return null;
  }
}

export function relativeDate(d?: string | null): string {
  const n = daysUntil(d);
  if (n === null) return "—";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return `${Math.abs(n)}d ago`;
  if (n < 7) return `In ${n} days`;
  if (n < 30) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30)} months`;
}

export function formatTime(t?: string | null): string {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function daysLeftLabel(d?: string | null): string {
  const n = daysUntil(d);
  if (n === null) return "—";
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "Today";
  if (n === 1) return "1 day left";
  return `${n} days left`;
}

export const CATEGORIES = ["Video", "Streaming", "AI", "Music", "Productivity", "Cloud", "Gaming", "News", "Fitness", "Shopping", "Other"];
export const CURRENCIES = ["AED", "USD", "EUR", "GBP", "INR", "SAR"];
export const CYCLES = ["monthly", "yearly", "weekly", "custom"];
export const STATUSES = ["Active", "Trial", "Paused", "Cancelled", "Expired", "Unknown"];
