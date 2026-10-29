import { daysUntil } from "./format";
import type { JsonRecord, LocalDatabase } from "./local-db";
import { activeRows, asString, DEFAULT_SETTINGS } from "./local-models";

export function monthlyCost(sub: JsonRecord): number {
  const price = Number(sub.price) || 0;
  const cycle = asString(sub.billing_cycle, "monthly").toLowerCase();
  if (sub.status === "Cancelled" || sub.status === "Expired") return 0;
  if (!["yearly", "monthly", "weekly"].includes(cycle)) return 0;
  if (cycle === "yearly") return price / 12;
  if (cycle === "weekly") return price * 4.33;
  return price;
}

function parseDate(value: unknown): Date | null {
  try {
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function matchesQuery(row: JsonRecord, query: string, fields: string[]): boolean {
  const needle = query.toLowerCase();
  return fields.some((field) => asString(row[field]).toLowerCase().includes(needle));
}

export function computeInsights(db: LocalDatabase) {
  const settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
  // Cancelled subscriptions live in Accounts; they never count toward totals.
  const subs = activeRows(db.subscriptions).filter((sub) => sub.status !== "Cancelled");
  const active = subs.filter((sub) => sub.status === "Active" || sub.status === "Trial");
  const monthlyByCurrency: Record<string,number> = {};
  for (const sub of active) { const currency = asString(sub.currency, "AED"); monthlyByCurrency[currency] = (monthlyByCurrency[currency] || 0) + monthlyCost(sub); }
  const monthly = Math.round((monthlyByCurrency[asString(settings.currency, "AED")] || 0) * 100) / 100;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);

  const renewals: JsonRecord[] = [];
  const trials: JsonRecord[] = [];
  const lapsed: JsonRecord[] = [];
  for (const sub of active) {
    const renewal = parseDate(sub.renewal_date);
    if (renewal) {
      if (renewal < today) {
        lapsed.push({
          id: sub.id,
          provider: sub.provider,
          date: sub.renewal_date,
          price: sub.price,
          currency: sub.currency,
          days_overdue: Math.floor((today.getTime() - renewal.getTime()) / (1000 * 60 * 60 * 24)),
          type: "renewal",
        });
      } else if (renewal <= horizon) {
        renewals.push({
          id: sub.id,
          provider: sub.provider,
          date: sub.renewal_date,
          price: sub.price,
          currency: sub.currency,
        });
      }
    }
    const trialEnd = parseDate(sub.trial_end);
    if (trialEnd) {
      if (trialEnd < today && sub.status === "Trial") {
        lapsed.push({
          id: sub.id,
          provider: sub.provider,
          date: sub.trial_end,
          price: sub.price,
          currency: sub.currency,
          days_overdue: Math.floor((today.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24)),
          type: "trial",
        });
      } else if (trialEnd >= today && trialEnd <= horizon) {
        trials.push({ id: sub.id, provider: sub.provider, date: sub.trial_end });
      }
    }
  }
  renewals.sort((a, b) => asString(a.date).localeCompare(asString(b.date)));
  trials.sort((a, b) => asString(a.date).localeCompare(asString(b.date)));
  lapsed.sort((a, b) => Number(b.days_overdue || 0) - Number(a.days_overdue || 0));

  const countdown: JsonRecord[] = [];
  for (const row of renewals) {
    countdown.push({
      id: row.id,
      title: row.provider,
      date: row.date,
      days_left: daysUntil(asString(row.date)),
      kind: "renewal",
      href: `/subscription/${row.id}`,
    });
  }
  for (const row of trials) {
    countdown.push({
      id: `trial-${row.id}`,
      title: `${row.provider} trial`,
      date: row.date,
      days_left: daysUntil(asString(row.date)),
      kind: "trial",
      href: `/subscription/${row.id}`,
    });
  }
  for (const reminder of activeRows(db.reminders).filter((row) => !row.completed && row.due_date)) {
    countdown.push({
      id: reminder.id,
      title: reminder.title,
      date: reminder.due_date,
      days_left: daysUntil(asString(reminder.due_date)),
      kind: "reminder",
      href: "/reminders",
    });
  }
  countdown.sort((a, b) => Number(a.days_left ?? 9999) - Number(b.days_left ?? 9999));
  const upcoming = countdown.slice(0, 8);

  const cats: Record<string, number> = {};
  const catCount: Record<string, string[]> = {};
  for (const sub of active) {
    const category = asString(sub.category, "Other");
    cats[category] = (cats[category] || 0) + (asString(sub.currency, "AED") === settings.currency ? monthlyCost(sub) : 0);
    catCount[category] = [...(catCount[category] || []), asString(sub.provider)];
  }
  const topCategory = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0] || null;
  const overlaps = Object.entries(catCount)
    .filter(([, providers]) => providers.length > 1)
    .map(([category, providers]) => ({ category, providers }));

  const increases: JsonRecord[] = [];
  for (const sub of subs) {
    const history = Array.isArray(sub.price_history) ? (sub.price_history as JsonRecord[]) : [];
    for (const entry of history) {
      if (entry.price && sub.price && Number(sub.price) > Number(entry.price)) {
        increases.push({ provider: sub.provider, from: entry.price, to: sub.price });
        break;
      }
    }
  }

  const missingExpiry = active
    .filter((sub) => !parseDate(sub.renewal_date) && !parseDate(sub.trial_end))
    .map((sub) => ({ id: sub.id, provider: asString(sub.provider, "Subscription"), price: sub.price, currency: sub.currency }));

  const allAccounts = activeRows(db.accounts || []);
  const cancelledAccountsCount = allAccounts.filter((a) => a.account_type === "cancelled").length;
  const paidAccountsCount = allAccounts.filter((a) => a.account_type === "paid").length;
  const freeAccountsCount = allAccounts.length - paidAccountsCount - cancelledAccountsCount;

  return {
    currency: settings.currency,
    monthly_spend: monthly,
    monthly_by_currency: monthlyByCurrency,
    yearly_spend: Math.round(monthly * 12 * 100) / 100,
    active_count: active.length,
    total_count: subs.length,
    accounts_count: allAccounts.length,
    paid_accounts_count: paidAccountsCount,
    free_accounts_count: freeAccountsCount,
    cancelled_accounts_count: cancelledAccountsCount,
    missing_expiry: missingExpiry,
    links_to_try_count: activeRows(db.links).filter((l) => !l.archived).length,
    renewals_30d: renewals,
    trials_ending: trials,
    lapsed_subscriptions: lapsed,
    countdown: upcoming,
    next_due_days: upcoming[0]?.days_left ?? null,
    next_due_title: upcoming[0]?.title ?? null,
    category_breakdown: Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 })),
    top_category: topCategory,
    overlaps,
    price_increases: increases,
    watchlist_count: activeRows(db.watchlist).length,
  };
}

export function searchDatabase(db: LocalDatabase, query: string) {
  const q = query.trim();
  if (!q) return { subscriptions: [], accounts: [], links: [], plans: [], reminders: [], promos: [] };
  return {
    subscriptions: activeRows(db.subscriptions)
      .filter((row) => matchesQuery(row, q, ["provider", "product", "plan", "category", "notes", "tags", "source"]))
      .slice(0, 50),
    accounts: activeRows(db.accounts || [])
      .filter((row) => matchesQuery(row, q, ["service_name", "email_used", "username", "category", "notes", "tags", "service_url"]))
      .slice(0, 50),
    links: activeRows(db.links)
      .filter((row) => matchesQuery(row, q, ["title", "summary", "url", "category", "note", "tags", "source"]))
      .slice(0, 50),
    plans: activeRows(db.watchlist)
      .filter((row) => matchesQuery(row, q, ["provider", "plan", "notes", "tags", "source", "url"]))
      .slice(0, 50),
    reminders: activeRows(db.reminders)
      .filter((row) => matchesQuery(row, q, ["title"]))
      .slice(0, 50),
    promos: activeRows(db.promos)
      .filter((row) => matchesQuery(row, q, ["service", "code", "discount", "notes", "source"]))
      .slice(0, 50),
  };
}

export function buildGraph(db: LocalDatabase) {
  const nodes: JsonRecord[] = [];
  const edges: JsonRecord[] = [];
  const tagNodes: Record<string, string> = {};
  const catNodes: Record<string, string> = {};

  const tagId = (tag: string) => {
    const key = tag.toLowerCase().trim();
    if (!tagNodes[key]) {
      const id = `tag:${key}`;
      tagNodes[key] = id;
      nodes.push({ id, label: tag, type: "tag" });
    }
    return tagNodes[key];
  };
  const catId = (category: string) => {
    const key = category.toLowerCase().trim();
    if (!catNodes[key]) {
      const id = `cat:${key}`;
      catNodes[key] = id;
      nodes.push({ id, label: category, type: "category" });
    }
    return catNodes[key];
  };

  for (const acc of activeRows(db.accounts || [])) {
    const id = `acc:${acc.id}`;
    nodes.push({
      id,
      label: asString(acc.service_name, "Account"),
      type: "account",
      meta: { email: acc.email_used, auth_method: acc.auth_method, account_type: acc.account_type },
    });
    if (acc.category) edges.push({ source: id, target: catId(asString(acc.category)) });
    for (const tag of Array.isArray(acc.tags) ? acc.tags : []) edges.push({ source: id, target: tagId(String(tag)) });
  }

  for (const sub of activeRows(db.subscriptions)) {
    const id = `sub:${sub.id}`;
    nodes.push({
      id,
      label: asString(sub.provider, "Sub"),
      type: "subscription",
      meta: { price: sub.price, currency: sub.currency, status: sub.status },
    });
    if (sub.category) edges.push({ source: id, target: catId(asString(sub.category)) });
    for (const tag of Array.isArray(sub.tags) ? sub.tags : []) edges.push({ source: id, target: tagId(String(tag)) });
  }
  for (const link of activeRows(db.links)) {
    const id = `link:${link.id}`;
    nodes.push({
      id,
      label: asString(link.title, "Link").slice(0, 20),
      type: "link",
      meta: { source: link.source },
    });
    if (link.category) edges.push({ source: id, target: catId(asString(link.category)) });
    if (link.converted_to_account_id) edges.push({ source: id, target: `acc:${link.converted_to_account_id}` });
    for (const tag of Array.isArray(link.tags) ? link.tags : []) edges.push({ source: id, target: tagId(String(tag)) });
  }
  for (const plan of activeRows(db.watchlist)) {
    const id = `plan:${plan.id}`;
    nodes.push({ id, label: asString(plan.provider, "Plan"), type: "plan" });
    for (const tag of Array.isArray(plan.tags) ? plan.tags : []) edges.push({ source: id, target: tagId(String(tag)) });
  }
  return { nodes, edges };
}

export function buildChatContext(db: LocalDatabase): string {
  const insights = computeInsights(db);
  const pick = (row: JsonRecord, keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, row[key]]));
  const ctx = {
    spend: { monthly: insights.monthly_spend, yearly: insights.yearly_spend, currency: insights.currency },
    accounts_opened: activeRows(db.accounts || []).map((row) =>
      pick(row, ["service_name", "service_url", "email_used", "username", "auth_method", "account_type", "category", "tags", "notes"]),
    ),
    subscriptions: activeRows(db.subscriptions).map((row) =>
      pick(row, ["provider", "product", "plan", "category", "status", "price", "currency", "billing_cycle", "renewal_date", "trial_end", "account_id", "tags"]),
    ),
    links_to_try: activeRows(db.links).map((row) =>
      pick(row, ["title", "url", "source", "category", "summary", "tags", "converted_to_account_id"]),
    ),
    plan_watchlist: activeRows(db.watchlist).map((row) =>
      pick(row, ["provider", "plan", "price", "currency", "status", "offer_expiry", "url"]),
    ),
    reminders: activeRows(db.reminders).map((row) => pick(row, ["title", "kind", "due_date", "completed"])),
  };
  return JSON.stringify(ctx).slice(0, 24000);
}
