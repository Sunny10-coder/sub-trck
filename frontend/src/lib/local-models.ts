import type { JsonRecord } from "./local-db";

export type Extraction = {
  content_type: string;
  provider: string;
  product: string;
  plan: string;
  price: number | null;
  currency: string;
  billing_cycle: string;
  renewal_date: string | null;
  start_date: string | null;
  trial_end: string | null;
  offer_expiry: string | null;
  category: string;
  tags: string[];
  summary: string;
  source_type: string;
  confidence: number;
  detected_url: string | null;
  email_used?: string | null;
  username?: string | null;
  auth_method?: string | null;
};

// Most users know when a subscription NEXT renews, not when it originally started.
// Only trust an explicit start_date; otherwise estimate one billing cycle back from
// the renewal date (never silently copy the renewal date itself as the start date).
export function deriveStartDate(explicitStart: unknown, renewalDate: unknown, billingCycle: unknown): string | null {
  const explicit = asString(explicitStart);
  if (explicit) return explicit;
  const renewal = asString(renewalDate);
  if (!renewal) return null;
  const d = new Date(`${renewal.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const cycle = asString(billingCycle).toLowerCase();
  if (cycle === "yearly" || cycle === "annual" || cycle === "annually") d.setFullYear(d.getFullYear() - 1);
  else if (cycle === "weekly") d.setDate(d.getDate() - 7);
  else if (cycle === "monthly") d.setMonth(d.getMonth() - 1);
  else return null; // unknown/custom cycle: don't fabricate a start date
  return d.toISOString().slice(0, 10);
}

// Pulls the first http(s) URL out of free text (OCR output, pasted captions, etc.)
// so a screenshot-derived item keeps a working link even when the AI extractor misses it.
export function detectUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s"'<>)\]]+/i);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
}

export const DEFAULT_SETTINGS: JsonRecord = {
  user_id: "local",
  currency: "AED",
  ai_enabled: true,
  auto_add_threshold: 0.95,
  confirm_threshold: 0.75,
  keep_screenshots: false,
  price_monitoring: true,
  notify_reminders: true,
  watchlist_frequency: "daily",
  default_reminder_days: 3,
  theme: "system",
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function isActive(row: JsonRecord): boolean {
  return row.deleted_at == null;
}

export function activeRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.filter(isActive);
}

export function findActive(rows: JsonRecord[], id: string): JsonRecord | undefined {
  return activeRows(rows).find((row) => row.id === id);
}

export function replaceById(rows: JsonRecord[], id: string, patch: JsonRecord): JsonRecord[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function asString(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value).trim() || fallback;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 8);
}

export function asCardLast4(value: unknown): string {
  return asString(value).replace(/\D/g, "").slice(-4);
}

function normalizeContentType(value: unknown): string {
  const type = asString(value, "unknown").toLowerCase();
  if (type === "website" || type === "url" || type === "check later" || type === "check_later") return "check_later";
  if (type === "account" || type === "registered_account" || type === "sign_up" || type === "signup") return "account";
  return type;
}

export function normalizeExtraction(data: JsonRecord, sourceType: string): Extraction {
  const confidenceRaw = asNumber(data.confidence);
  return {
    content_type: normalizeContentType(data.content_type),
    provider: asString(data.provider),
    product: asString(data.product),
    plan: asString(data.plan),
    price: asNumber(data.price),
    currency: (asString(data.currency) || "AED").toUpperCase(),
    billing_cycle: asString(data.billing_cycle).toLowerCase(),
    renewal_date: asString(data.renewal_date) || null,
    start_date: asString(data.start_date) || null,
    trial_end: asString(data.trial_end) || null,
    offer_expiry: asString(data.offer_expiry) || null,
    category: asString(data.category) || "Other",
    tags: asStringList(data.tags),
    summary: asString(data.summary),
    source_type: sourceType,
    confidence: Math.max(0, Math.min(1, confidenceRaw ?? 0.5)),
    detected_url: asString(data.detected_url) || detectUrl(asString(data.summary)) || null,
    email_used: asString(data.email_used) || asString(data.account_email) || null,
    username: asString(data.username) || null,
    auth_method: asString(data.auth_method) || null,
  };
}

export function fallbackExtraction(text: string, sourceType: string): Extraction {
  return normalizeExtraction(
    {
      content_type: "unknown",
      summary: text.slice(0, 140),
      confidence: 0.2,
      detected_url: detectUrl(text),
    },
    sourceType,
  );
}

export function reminderFrom(extraction: JsonRecord, refType: string, refId: string): JsonRecord | null {
  const date = asString(extraction.trial_end) || asString(extraction.renewal_date) || asString(extraction.offer_expiry);
  if (!date) return null;
  const kind = extraction.trial_end ? "trial_ending" : extraction.offer_expiry ? "offer_expiry" : "renewal";
  const label = asString(extraction.provider) || asString(extraction.product) || "Item";
  return {
    id: createId(),
    user_id: "local",
    deleted_at: null,
    title: `${kind.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}: ${label}`,
    kind,
    due_date: date,
    ref_type: refType,
    ref_id: refId,
    completed: false,
    created_at: nowIso(),
  };
}

export function createAccountRecord(
  extraction: JsonRecord,
  source: string,
  url = "",
): JsonRecord {
  const id = createId();
  const stamp = nowIso();
  const serviceName = asString(extraction.service_name) || asString(extraction.provider) || asString(extraction.product) || "Unknown";
  const serviceUrl = url || asString(extraction.service_url) || asString(extraction.detected_url) || asString(extraction.url);
  const accountType = asString(extraction.account_type) || (asNumber(extraction.price) ? "paid" : "free");

  return {
    id,
    user_id: "local",
    deleted_at: null,
    service_name: serviceName,
    service_url: serviceUrl,
    category: asString(extraction.category) || "Other",
    email_used: asString(extraction.email_used) || asString(extraction.account_email),
    username: asString(extraction.username),
    phone_used: asString(extraction.phone_used),
    auth_method: asString(extraction.auth_method) || "email",
    has_2fa: extraction.has_2fa === true || extraction.has_2fa === "true",
    account_type: accountType,
    platform_usage: asString(extraction.platform_usage) || "",
    allowed_credits: asString(extraction.allowed_credits) || "",
    registration_date: asString(extraction.registration_date) || asString(extraction.start_date) || stamp.slice(0, 10),
    last_login: asString(extraction.last_login) || null,
    linked_subscription_ids: asStringList(extraction.linked_subscription_ids),
    source_link_id: asString(extraction.source_link_id) || null,
    cancelled_on: asString(extraction.cancelled_on),
    previous_plan: asString(extraction.previous_plan),
    previous_price: asNumber(extraction.previous_price),
    previous_currency: asString(extraction.previous_currency),
    previous_cycle: asString(extraction.previous_cycle),
    from_subscription_id: asString(extraction.from_subscription_id) || null,
    notes: asString(extraction.notes) || asString(extraction.summary),
    tags: asStringList(extraction.tags),
    logo_url: asString(extraction.logo_url) || asString(extraction.thumbnail) || null,
    source,
    created_at: stamp,
    updated_at: stamp,
  };
}

export function createSubscriptionRecord(
  extraction: JsonRecord,
  source: string,
  url = "",
  image: string | null = null,
): JsonRecord {
  const id = createId();
  const stamp = nowIso();
  const status = extraction.content_type === "trial" || extraction.trial_end ? "Trial" : "Active";
  return {
    id,
    user_id: "local",
    deleted_at: null,
    account_id: asString(extraction.account_id) || null,
    provider: asString(extraction.provider) || asString(extraction.product) || "Unknown",
    product: asString(extraction.product) || asString(extraction.provider) || "Unknown",
    plan: asString(extraction.plan),
    category: asString(extraction.category) || "Other",
    status: asString(extraction.status) || status,
    price: asNumber(extraction.price),
    currency: asString(extraction.currency) || "AED",
    billing_cycle: asString(extraction.billing_cycle) || "monthly",
    renewal_date: extraction.renewal_date || null,
    start_date: deriveStartDate(extraction.start_date, extraction.renewal_date, extraction.billing_cycle),
    trial_end: extraction.trial_end || null,
    auto_renew: extraction.auto_renew !== false,
    cancellation_date: extraction.cancellation_date || null,
    notes: asString(extraction.notes),
    card_last4: asCardLast4(extraction.card_last4),
    account_email: asString(extraction.account_email),
    promo_applied: asString(extraction.promo_applied),
    source,
    source_url: url || asString(extraction.detected_url),
    source_image: image,
    related_links: [],
    tags: asStringList(extraction.tags),
    payments: [],
    price_history: [],
    created_at: stamp,
    updated_at: stamp,
  };
}

export function createLinkRecord(
  extraction: JsonRecord,
  source: string,
  url: string,
  raw = "",
): JsonRecord {
  const stamp = nowIso();
  const resolvedUrl = url || asString(extraction.detected_url) || detectUrl(raw) || "";
  return {
    id: createId(),
    user_id: "local",
    deleted_at: null,
    url: resolvedUrl,
    canonical_url: resolvedUrl,
    title: asString(extraction.product) || asString(extraction.provider) || resolvedUrl.slice(0, 60) || "Saved note",
    source,
    thumbnail: extraction.thumbnail ?? null,
    summary: asString(extraction.summary),
    category: asString(extraction.category) || "Other",
    tags: asStringList(extraction.tags),
    note: resolvedUrl ? "" : raw.slice(0, 500),
    reminder_id: null,
    related_subscription: null,
    archived: false,
    created_at: stamp,
    updated_at: stamp,
  };
}

export function createWatchlistRecord(extraction: JsonRecord, source: string, url = ""): JsonRecord {
  const stamp = nowIso();
  return {
    id: createId(),
    user_id: "local",
    deleted_at: null,
    provider: asString(extraction.provider) || asString(extraction.product) || "Unknown",
    plan: asString(extraction.plan) || asString(extraction.product),
    price: asNumber(extraction.price),
    currency: asString(extraction.currency) || "AED",
    billing_cycle: asString(extraction.billing_cycle) || "monthly",
    url,
    source,
    features: [],
    offer_expiry: extraction.offer_expiry || null,
    last_checked: stamp,
    price_history: [],
    notes: asString(extraction.summary) || asString(extraction.notes),
    status: "Watching",
    tags: asStringList(extraction.tags),
    created_at: stamp,
    updated_at: stamp,
  };
}

export function notFound(entity: string): Error {
  return new Error(`${entity} not found`);
}
