import type { JsonRecord, LocalDatabase } from "./local-db";
import {
  activeRows,
  asString,
  createAccountRecord,
  createLinkRecord,
  createSubscriptionRecord,
  createWatchlistRecord,
  createId,
  DEFAULT_SETTINGS,
  Extraction,
  nowIso,
  reminderFrom,
  replaceById,
} from "./local-models";

function settingsOf(db: LocalDatabase): JsonRecord {
  return { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
}

export function findDuplicate(db: LocalDatabase, extraction: Extraction): JsonRecord | undefined {
  const provider = extraction.provider.trim().toLowerCase();
  const product = extraction.product.trim().toLowerCase();
  if (!provider && !product) return undefined;
  return activeRows(db.subscriptions).find((sub) => {
    const subProvider = asString(sub.provider).toLowerCase();
    const subProduct = asString(sub.product).toLowerCase();
    return (provider && subProvider && provider === subProvider) || (product && subProduct && product === subProduct);
  });
}

export function findAccountDuplicate(db: LocalDatabase, extraction: Extraction | JsonRecord): JsonRecord | undefined {
  const rec = extraction as Record<string, any>;
  const service = (asString(rec.service_name) || asString(rec.provider) || asString(rec.product)).trim().toLowerCase();
  const email = (asString(rec.email_used) || asString(rec.account_email)).trim().toLowerCase();
  if (!service) return undefined;
  return activeRows(db.accounts || []).find((acc) => {
    const accService = asString(acc.service_name).toLowerCase();
    const accEmail = asString(acc.email_used).toLowerCase();
    if (email && accEmail) {
      return accService === service && accEmail === email;
    }
    return accService === service;
  });
}

export function addAccount(
  db: LocalDatabase,
  extraction: JsonRecord,
  source: string,
  url = "",
): { next: LocalDatabase; id: string; record: JsonRecord } {
  const record = createAccountRecord(extraction, source, url);
  return {
    id: asString(record.id),
    record,
    next: {
      ...db,
      accounts: [record, ...db.accounts],
    },
  };
}

export function addSubscription(
  db: LocalDatabase,
  extraction: JsonRecord,
  source: string,
  url = "",
  image: string | null = null,
  options: { createReminder?: boolean } = {},
): { next: LocalDatabase; id: string; record: JsonRecord } {
  let updatedDb = db;
  // Subscriptions and Accounts are separate sections: a subscription is only
  // tied to an account when the caller passes an explicit account_id (legacy
  // data). We no longer auto-match accounts by service name.
  const accountId = asString(extraction.account_id);

  const record = createSubscriptionRecord(
    { ...extraction, account_id: accountId || null },
    source,
    url,
    image,
  );
  const reminder = options.createReminder === false ? null : reminderFrom(record, "subscription", asString(record.id));

  // If linked to an account, make sure the account's linked_subscription_ids includes this subscription
  let updatedAccounts = updatedDb.accounts;
  if (accountId) {
    const targetAcc = updatedAccounts.find((a) => a.id === accountId);
    if (targetAcc) {
      const currentLinks = Array.isArray(targetAcc.linked_subscription_ids) ? [...targetAcc.linked_subscription_ids] : [];
      if (!currentLinks.includes(record.id)) {
        currentLinks.push(record.id);
        updatedAccounts = replaceById(updatedAccounts, accountId, {
          linked_subscription_ids: currentLinks,
          account_type: "paid",
          updated_at: nowIso(),
        });
      }
    }
  }

  return {
    id: asString(record.id),
    record,
    next: {
      ...updatedDb,
      subscriptions: [record, ...updatedDb.subscriptions],
      accounts: updatedAccounts,
      reminders: reminder ? [reminder, ...updatedDb.reminders] : updatedDb.reminders,
    },
  };
}

export function addLink(
  db: LocalDatabase,
  extraction: JsonRecord,
  source: string,
  url: string,
  raw = "",
): { next: LocalDatabase; id: string; record: JsonRecord } {
  const record = createLinkRecord(extraction, source, url, raw);
  return { id: asString(record.id), record, next: { ...db, links: [record, ...db.links] } };
}

export function addWatchlist(
  db: LocalDatabase,
  extraction: JsonRecord,
  source: string,
  url = "",
): { next: LocalDatabase; id: string; record: JsonRecord } {
  const record = createWatchlistRecord(extraction, source, url);
  return { id: asString(record.id), record, next: { ...db, watchlist: [record, ...db.watchlist] } };
}

export function runPipeline(
  db: LocalDatabase,
  extraction: Extraction,
  source: string,
  extras: { rawText?: string; url?: string; imageKept?: string | null } = {},
): { next: LocalDatabase; inbox: JsonRecord } {
  const settings = settingsOf(db);
  const confidence = extraction.confidence;
  const contentType = extraction.content_type;
  let status = "needs_review";
  if (confidence >= Number(settings.auto_add_threshold)) status = "auto_added";
  else if (confidence >= Number(settings.confirm_threshold)) status = "needs_confirmation";

  let next = db;
  let duplicate: JsonRecord | undefined;
  let createdRef: string | null = null;
  let createdType: string | null = null;

  const isScreenshot = source.includes("screenshot") || source.includes("image");
  const isCheckLater = contentType === "link" || contentType === "check_later" || contentType === "note";

  if (contentType === "subscription" || contentType === "trial" || contentType === "payment") {
    duplicate = findDuplicate(next, extraction);
    if (duplicate) status = "duplicate";
  } else if (contentType === "account") {
    duplicate = findAccountDuplicate(next, extraction);
    if (duplicate) status = "duplicate";
  }

  // Screenshots of sites/links to check later must not land in subscriptions.
  if (isScreenshot && (contentType === "subscription" || contentType === "trial") && status === "auto_added" && !duplicate) {
    status = "needs_confirmation";
  }

  if (status === "auto_added" && !duplicate) {
    if (contentType === "account") {
      const created = addAccount(next, extraction, source, extras.url || "");
      next = created.next;
      createdRef = created.id;
      createdType = "account";
    } else if (!isScreenshot && (contentType === "subscription" || contentType === "trial")) {
      const created = addSubscription(next, extraction, source, extras.url || "", extras.imageKept ?? null);
      next = created.next;
      createdRef = created.id;
      createdType = "subscription";
    } else if (isCheckLater || extras.url) {
      const created = addLink(
        next,
        { ...extraction, category: contentType === "check_later" ? "Check later" : extraction.category },
        source,
        extras.url || "",
        extras.rawText || "",
      );
      next = created.next;
      createdRef = created.id;
      createdType = "link";
    } else if (contentType === "plan") {
      const created = addWatchlist(next, extraction, source, extras.url || "");
      next = created.next;
      createdRef = created.id;
      createdType = "plan";
    }
  }

  const inbox: JsonRecord = {
    id: createId(),
    user_id: "local",
    deleted_at: null,
    source,
    content_type: contentType,
    status,
    extraction,
    raw_text: (extras.rawText || "").slice(0, 2000),
    url: extras.url || "",
    image_base64: extras.imageKept ?? null,
    summary: extraction.summary,
    confidence,
    duplicate_of: duplicate ? duplicate.id : null,
    created_ref: createdRef,
    created_type: createdType,
    created_at: nowIso(),
  };
  return { next: { ...next, inbox: [inbox, ...next.inbox] }, inbox };
}

export type MoveOptions = { cancelled: boolean; reason?: string };

/**
 * Moves a subscription into the Accounts section and removes it (and its
 * reminders) from Subscriptions. Used when a subscription is cancelled, or when
 * a user decides a subscription with no expiry date is really just an account.
 */
export function moveSubscriptionToAccount(
  db: LocalDatabase,
  sub: JsonRecord,
  options: MoveOptions,
): { next: LocalDatabase; accountId: string; record: JsonRecord } {
  const stamp = nowIso();
  const price = Number(sub.price);
  const plan = asString(sub.plan);
  const noteParts = [
    asString(sub.notes),
    options.cancelled ? `Cancelled on ${stamp.slice(0, 10)}${options.reason ? `: ${options.reason}` : ""}` : "Moved from Subscriptions (no expiry date)",
  ].filter(Boolean);
  const created = addAccount(
    db,
    {
      service_name: asString(sub.provider) || asString(sub.product) || "Unknown",
      category: asString(sub.category) || "Other",
      account_type: options.cancelled ? "cancelled" : Number.isFinite(price) && price > 0 ? "paid" : "free",
      platform_usage: plan,
      email_used: asString(sub.account_email),
      notes: noteParts.join("\n"),
      tags: Array.isArray(sub.tags) ? sub.tags : [],
      registration_date: asString(sub.start_date),
      cancelled_on: options.cancelled ? stamp.slice(0, 10) : "",
      previous_plan: plan,
      previous_price: Number.isFinite(price) ? price : "",
      previous_currency: asString(sub.currency),
      previous_cycle: asString(sub.billing_cycle),
      from_subscription_id: asString(sub.id),
    },
    "subscription_move",
    asString(sub.source_url),
  );
  const subId = asString(sub.id);
  return {
    accountId: created.id,
    record: created.record,
    next: {
      ...created.next,
      subscriptions: replaceById(created.next.subscriptions, subId, {
        deleted_at: stamp,
        updated_at: stamp,
        moved_to_account_id: created.id,
      }),
      reminders: created.next.reminders.map((r) =>
        r.ref_type === "subscription" && r.ref_id === subId ? { ...r, deleted_at: stamp } : r,
      ),
    },
  };
}
