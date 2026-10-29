import { parseDatabase, type JsonRecord, type LocalDatabase, type LocalDb } from "./local-db";
import type { AiPort } from "./ai-port";
import { buildChatContext, buildGraph, computeInsights, searchDatabase } from "./local-insights";
import {
  activeRows,
  asNumber,
  asString,
  asStringList,
  createId,
  DEFAULT_SETTINGS,
  Extraction,
  fallbackExtraction,
  findActive,
  normalizeExtraction,
  notFound,
  nowIso,
  reminderFrom,
  replaceById,
} from "./local-models";
import { expandAgentToolCalls, formatAgentAnswer, isAddIntent, runAgentTools, type AgentStore, type AgentToolCall } from "./agent-tools";
import { addAccount, addLink, addSubscription, addWatchlist, moveSubscriptionToAccount, runPipeline } from "./local-pipeline";
import { rankToolsForTask, toOwnedTools } from "./capabilities";
import { buildExport, type ExportScope, toBase64 } from "./excel-export";
import { buildTopicTags, fetchGithubMeta } from "./link-tags";

export type LocalApi = ReturnType<typeof createLocalApi>;

function sortByCreatedDesc(rows: JsonRecord[]): JsonRecord[] {
  return [...rows].sort((a, b) => asString(b.created_at).localeCompare(asString(a.created_at)));
}

// Prompts are the user's own saved prompts for external tools (Midjourney, Runway,
// Cursor...). Nothing is pre-seeded; the ids below were seeded by older versions
// and are hidden so they don't pollute the library.
export const DEFAULT_PROMPTS: JsonRecord[] = [];
const LEGACY_PROMPT_IDS = new Set(["prompt-audit", "prompt-cancel", "prompt-compare", "prompt-deals"]);

function promptRows(db: LocalDatabase): JsonRecord[] {
  return activeRows(db.prompts || []).filter((row) => !LEGACY_PROMPT_IDS.has(asString(row.id)));
}

export function detectSource(url: string, fallback: string): string {
  const host = url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0].toLowerCase();
  if (host.includes("github.com")) return "GitHub";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("reddit.com")) return "Reddit";
  if (host === "x.com" || host.includes("twitter.com")) return "X";
  if (host.includes("threads.net")) return "Threads";
  return fallback;
}

function newPromo(service: string, code: string, extras: JsonRecord = {}): JsonRecord {
  const stamp = nowIso();
  return {
    id: createId(), user_id: "local", deleted_at: null, service, code: code.toUpperCase(),
    discount: "", expiry_date: null, source: "Manual", url: "", notes: "", category: "Deals",
    used: false, archived: false, favorite: false, created_at: stamp, updated_at: stamp, ...extras,
  };
}

/** Keeps the promo list in step with the code typed on a subscription: marks a saved
 *  code as used, or saves a brand-new code so it shows up in Promo Codes too. */
function syncPromoUsage(promos: JsonRecord[], provider: string, code: string): JsonRecord[] {
  const clean = code.trim().toUpperCase();
  if (!clean || !provider) return promos;
  const hit = activeRows(promos).find(
    (row) => asString(row.code).toUpperCase() === clean && asString(row.service).toLowerCase() === provider.toLowerCase(),
  );
  if (hit) return replaceById(promos, asString(hit.id), { used: true, updated_at: nowIso() });
  return [newPromo(provider, clean, { used: true, source: "Subscription" }), ...promos];
}

/** Pure update step shared by the UI and the AI agent. Cancelling moves the
 *  subscription into Accounts so it stops counting toward spend. */
function applySubscriptionUpdate(current: LocalDatabase, id: string, body: JsonRecord) {
  const existing = current.subscriptions.find((row) => row.id === id);
  if (!existing) throw notFound("Subscription");
  const { id: _id, user_id: _user, create_reminder: wantsReminder, ...rest } = body;
  const patch: JsonRecord = { ...rest, updated_at: nowIso() };
  if ("price" in rest && rest.price !== existing.price) {
    const history = Array.isArray(existing.price_history) ? [...(existing.price_history as JsonRecord[])] : [];
    patch.price_history = [...history, { price: existing.price, date: nowIso() }];
  }
  const merged = { ...existing, ...patch };

  if (patch.status === "Cancelled" && existing.status !== "Cancelled") {
    const moved = moveSubscriptionToAccount(current, merged, { cancelled: true });
    return { next: moved.next, result: { ...merged, moved_to_account_id: moved.accountId } };
  }

  let reminders = current.reminders;
  if (wantsReminder && (patch.renewal_date || patch.trial_end)) {
    const hasOne = activeRows(reminders).some((r) => r.ref_type === "subscription" && r.ref_id === id && !r.completed);
    const fresh = hasOne ? null : reminderFrom(merged, "subscription", id);
    if (fresh) reminders = [fresh, ...reminders];
  }
  const promos =
    patch.promo_applied != null && patch.promo_applied !== existing.promo_applied
      ? syncPromoUsage(current.promos || [], asString(merged.provider), asString(patch.promo_applied))
      : current.promos;
  return {
    next: { ...current, subscriptions: replaceById(current.subscriptions, id, patch), reminders, promos },
    result: merged,
  };
}

function withSettings(db: LocalDatabase): { next: LocalDatabase; settings: JsonRecord } {
  if (db.settings) return { next: db, settings: { ...DEFAULT_SETTINGS, ...db.settings } };
  const settings = { ...DEFAULT_SETTINGS, created_at: nowIso() };
  return { next: { ...db, settings }, settings };
}

async function extractOrFallback(
  ai: AiPort,
  settings: JsonRecord,
  input: { text?: string; imageBase64?: string; sourceType: string },
): Promise<Extraction> {
  if (settings.ai_enabled === false) return fallbackExtraction(input.text || "", input.sourceType);
  try {
    return await ai.extract(input);
  } catch {
    return fallbackExtraction(input.text || "", input.sourceType);
  }
}

export function createLocalApi(deps: { db: LocalDb; ai: AiPort }) {
  const { db, ai } = deps;

  const aiTopicTags = async (
    currentSettings: JsonRecord,
    input: { url: string; title: string; text: string },
  ): Promise<string[]> => {
    if (currentSettings.ai_enabled === false || !ai.tagLink) return [];
    try {
      return await ai.tagLink(input);
    } catch {
      return [];
    }
  };

  const settings = async () => {
    const existing = await db.read((current) => current.settings);
    if (existing) return { ...DEFAULT_SETTINGS, ...existing };
    return db.write((current) => {
      if (current.settings) return { next: current, result: { ...DEFAULT_SETTINGS, ...current.settings } };
      const settingsDoc = { ...DEFAULT_SETTINGS, created_at: nowIso() };
      return { next: { ...current, settings: settingsDoc }, result: settingsDoc };
    });
  };

  return {
    health: async () => ({ app: "SubMind", status: "ok", storage: "phone" }),

    insights: () => db.read((current) => computeInsights(withSettings(current).next)),

    subscriptions: (status?: string, category?: string) =>
      db.read((current) => {
        let rows = activeRows(current.subscriptions).filter((row) => row.status !== "Cancelled");
        if (status && status !== "All") rows = rows.filter((row) => row.status === status);
        if (category && category !== "All") rows = rows.filter((row) => row.category === category);
        return sortByCreatedDesc(rows);
      }),

    subscription: (id: string) =>
      db.read((current) => {
        const row = findActive(current.subscriptions, id);
        if (!row) throw notFound("Subscription");
        return row;
      }),

    createSubscription: (body: JsonRecord) =>
      db.write((current) => {
        const created = addSubscription(
          current,
          body,
          asString(body.source) || "manual",
          asString(body.source_url),
          null,
          { createReminder: Boolean(body.create_reminder) },
        );
        const promos = syncPromoUsage(created.next.promos || [], asString(created.record.provider), asString(body.promo_applied));
        return { next: { ...created.next, promos }, result: created.record };
      }),

    updateSubscription: (id: string, body: JsonRecord) =>
      db.write((current) => applySubscriptionUpdate(current, id, body)),

    /** "Change to accounts": keeps the service as an account and drops it from Subscriptions. */
    moveSubscriptionToAccount: (id: string, options: { cancelled?: boolean; reason?: string } = {}) =>
      db.write((current) => {
        const sub = findActive(current.subscriptions, id);
        if (!sub) throw notFound("Subscription");
        const moved = moveSubscriptionToAccount(current, sub, { cancelled: Boolean(options.cancelled), reason: options.reason });
        return { next: moved.next, result: { ok: true, account_id: moved.accountId } };
      }),

    /** One-time cleanup: cancelled subscriptions from older versions belong in Accounts. */
    sweepCancelledSubscriptions: async () => {
      const pending = await db.read((current) => activeRows(current.subscriptions).some((row) => row.status === "Cancelled"));
      if (!pending) return { moved: 0 };
      return db.write((current) => {
        let next = current;
        let moved = 0;
        for (const sub of activeRows(current.subscriptions).filter((row) => row.status === "Cancelled")) {
          next = moveSubscriptionToAccount(next, sub, { cancelled: true }).next;
          moved += 1;
        }
        return { next, result: { moved } };
      });
    },

    recordPayment: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const existing = current.subscriptions.find((row) => row.id === id);
        if (!existing) throw notFound("Subscription");
        const payments = [
          ...(Array.isArray(existing.payments) ? (existing.payments as JsonRecord[]) : []),
          {
            amount: body.amount ?? existing.price,
            currency: existing.currency || "AED",
            date: body.date || nowIso(),
          },
        ];
        const patch = { payments, updated_at: nowIso() };
        return {
          next: { ...current, subscriptions: replaceById(current.subscriptions, id, patch) },
          result: { ok: true, payments },
        };
      }),

    deleteSubscription: (id: string) =>
      db.write((current) => ({
        next: { ...current, subscriptions: replaceById(current.subscriptions, id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    // ---------- Accounts Module (Accounts Opened) ----------
    accounts: (category?: string) =>
      db.read((current) => {
        let rows = activeRows(current.accounts || []);
        if (category && category !== "All") rows = rows.filter((row) => row.category === category);
        return sortByCreatedDesc(rows);
      }),

    account: (id: string) =>
      db.read((current) => {
        const row = findActive(current.accounts || [], id);
        if (!row) throw notFound("Account");
        return row;
      }),

    createAccount: (body: JsonRecord) =>
      db.write((current) => {
        const created = addAccount(
          current,
          body,
          asString(body.source) || "manual",
          asString(body.service_url) || asString(body.url),
        );
        return { next: created.next, result: created.record };
      }),

    updateAccount: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const existing = (current.accounts || []).find((row) => row.id === id);
        if (!existing) throw notFound("Account");
        const { id: _id, user_id: _user, ...rest } = body;
        const patch = { ...rest, updated_at: nowIso() };
        return {
          next: { ...current, accounts: replaceById(current.accounts || [], id, patch) },
          result: { ...existing, ...patch },
        };
      }),

    deleteAccount: (id: string) =>
      db.write((current) => ({
        next: { ...current, accounts: replaceById(current.accounts || [], id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    linkSubscriptionToAccount: (accountId: string, subscriptionId: string) =>
      db.write((current) => {
        const acc = findActive(current.accounts || [], accountId);
        if (!acc) throw notFound("Account");
        const sub = findActive(current.subscriptions, subscriptionId);
        if (!sub) throw notFound("Subscription");

        const currentLinks = Array.isArray(acc.linked_subscription_ids) ? [...acc.linked_subscription_ids] : [];
        if (!currentLinks.includes(subscriptionId)) {
          currentLinks.push(subscriptionId);
        }

        const nextAccounts = replaceById(current.accounts || [], accountId, {
          linked_subscription_ids: currentLinks,
          account_type: "paid",
          updated_at: nowIso(),
        });
        const nextSubs = replaceById(current.subscriptions, subscriptionId, {
          account_id: accountId,
          updated_at: nowIso(),
        });

        return {
          next: { ...current, accounts: nextAccounts, subscriptions: nextSubs },
          result: { ok: true, account_id: accountId, subscription_id: subscriptionId },
        };
      }),

    accountSubscriptions: (accountId: string) =>
      db.read((current) => {
        const acc = findActive(current.accounts || [], accountId);
        if (!acc) throw notFound("Account");
        const linkedIds = new Set(Array.isArray(acc.linked_subscription_ids) ? acc.linked_subscription_ids : []);
        return activeRows(current.subscriptions).filter(
          (sub) => sub.account_id === accountId || linkedIds.has(sub.id)
        );
      }),

    convertLinkToAccount: (linkId: string, accountDetails: JsonRecord = {}) =>
      db.write((current) => {
        const link = findActive(current.links, linkId);
        if (!link) throw notFound("Link");

        const created = addAccount(
          current,
          {
            service_name: link.title || "Unknown",
            service_url: link.url,
            category: link.category || "Other",
            notes: link.summary || link.note || "",
            tags: link.tags || [],
            source_link_id: linkId,
            ...accountDetails,
          },
          "link_conversion",
          asString(link.url),
        );

        // Mark the link with converted_to_account_id
        const nextLinks = replaceById(created.next.links, linkId, {
          converted_to_account_id: created.id,
          updated_at: nowIso(),
        });

        return {
          next: { ...created.next, links: nextLinks },
          result: created.record,
        };
      }),

    inbox: (tab: string) =>
      db.read((current) => {
        let rows = activeRows(current.inbox);
        if (tab === "needs_review") {
          rows = rows.filter((row) => row.status === "needs_review" || row.status === "needs_confirmation");
        } else if (tab === "auto_added") {
          rows = rows.filter((row) => row.status === "auto_added");
        } else if (tab === "duplicates") {
          rows = rows.filter((row) => row.status === "duplicate");
        }
        return sortByCreatedDesc(rows);
      }),

    inboxAction: (id: string, body: { action: string; edits?: JsonRecord; merge_into?: string }) =>
      db.write((current) => {
        const item = current.inbox.find((row) => row.id === id);
        if (!item) throw notFound("Inbox item");
        const extraction = normalizeExtraction(
          { ...((item.extraction as JsonRecord) || {}), ...(body.edits || {}) },
          asString(item.source) || "manual",
        );
        if (body.action === "ignore") {
          return {
            next: { ...current, inbox: replaceById(current.inbox, id, { status: "ignored", deleted_at: nowIso() }) },
            result: { ok: true, status: "ignored" },
          };
        }
        if (body.action === "merge" && body.merge_into) {
          const patch = Object.fromEntries(
            Object.entries({
              price: extraction.price,
              renewal_date: extraction.renewal_date,
              trial_end: extraction.trial_end,
              plan: extraction.plan,
            }).filter(([, value]) => value),
          );
          return {
            next: {
              ...current,
              subscriptions: replaceById(current.subscriptions, body.merge_into, { ...patch, updated_at: nowIso() }),
              inbox: replaceById(current.inbox, id, { status: "merged" }),
            },
            result: { ok: true, status: "merged", subscription_id: body.merge_into },
          };
        }
        if (body.action === "watchlist") {
          const created = addWatchlist(current, extraction, asString(item.source) || "manual", asString(item.url));
          return {
            next: {
              ...created.next,
              inbox: replaceById(created.next.inbox, id, { status: "saved", created_ref: created.id, created_type: "plan" }),
            },
            result: { ok: true, status: "saved", plan_id: created.id },
          };
        }
        if (body.action === "check_later") {
          const created = addLink(
            current,
            { ...extraction, category: "Check later" },
            asString(item.source) || "manual",
            asString(item.url) || asString(extraction.summary),
            asString(item.raw_text),
          );
          return {
            next: {
              ...created.next,
              inbox: replaceById(created.next.inbox, id, { status: "saved", created_ref: created.id, created_type: "link" }),
            },
            result: { ok: true, status: "saved", link_id: created.id, type: "link" },
          };
        }
        if (body.action === "account") {
          const created = addAccount(
            current,
            extraction,
            asString(item.source) || "manual",
            asString(item.url),
          );
          return {
            next: {
              ...created.next,
              inbox: replaceById(created.next.inbox, id, { status: "added", created_ref: created.id, created_type: "account" }),
            },
            result: { ok: true, status: "added", ref: created.id, type: "account" },
          };
        }
        if (body.action === "subscription") {
          const created = addSubscription(
            current,
            extraction,
            asString(item.source) || "manual",
            asString(item.url),
            (item.image_base64 as string | null) || null,
          );
          return {
            next: {
              ...created.next,
              inbox: replaceById(created.next.inbox, id, { status: "added", created_ref: created.id, created_type: "subscription" }),
            },
            result: { ok: true, status: "added", ref: created.id, type: "subscription" },
          };
        }
        const contentType = extraction.content_type;
        const created =
          contentType === "account"
            ? { ...addAccount(current, extraction, asString(item.source) || "manual", asString(item.url)), type: "account" }
            : contentType === "plan"
            ? { ...addWatchlist(current, extraction, asString(item.source) || "manual", asString(item.url)), type: "plan" }
            : contentType === "link" || contentType === "check_later" || (item.url && contentType !== "subscription" && contentType !== "trial")
              ? { ...addLink(current, extraction, asString(item.source) || "manual", asString(item.url), asString(item.raw_text)), type: "link" }
              : { ...addSubscription(current, extraction, asString(item.source) || "manual", asString(item.url), (item.image_base64 as string | null) || null), type: "subscription" };
        return {
          next: {
            ...created.next,
            inbox: replaceById(created.next.inbox, id, { status: "added", created_ref: created.id, created_type: created.type }),
          },
          result: { ok: true, status: "added", ref: created.id, type: created.type },
        };
      }),

    links: (source?: string) =>
      db.read((current) => {
        let rows = activeRows(current.links).filter((row) => row.archived !== true);
        if (source && source !== "All") rows = rows.filter((row) => row.source === source);
        return sortByCreatedDesc(rows);
      }),

    link: (id: string) =>
      db.read((current) => {
        const row = findActive(current.links, id);
        if (!row) throw notFound("Link");
        return row;
      }),

    updateLink: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const existing = current.links.find((row) => row.id === id);
        if (!existing) throw notFound("Link");
        const { id: _id, ...rest } = body;
        const patch = { ...rest, updated_at: nowIso() };
        return { next: { ...current, links: replaceById(current.links, id, patch) }, result: { ...existing, ...patch } };
      }),

    deleteLink: (id: string) =>
      db.write((current) => ({
        next: { ...current, links: replaceById(current.links, id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    watchlist: () => db.read((current) => sortByCreatedDesc(activeRows(current.watchlist))),

    plan: (id: string) =>
      db.read((current) => {
        const row = findActive(current.watchlist, id);
        if (!row) throw notFound("Plan");
        return row;
      }),

    createPlan: (body: JsonRecord) =>
      db.write((current) => {
        const created = addWatchlist(
          current,
          {
            provider: asString(body.provider) || "Unknown",
            plan: asString(body.plan),
            price: asNumber(body.price),
            currency: asString(body.currency) || "AED",
            billing_cycle: asString(body.billing_cycle) || "monthly",
            offer_expiry: body.offer_expiry || null,
            summary: asString(body.notes),
            tags: asStringList(body.tags),
          },
          asString(body.source) || "manual",
          asString(body.url),
        );
        return { next: created.next, result: created.record };
      }),

    updatePlan: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const existing = current.watchlist.find((row) => row.id === id);
        if (!existing) throw notFound("Plan");
        const { id: _id, user_id: _user, ...rest } = body;
        const patch = { ...rest, updated_at: nowIso() };
        return { next: { ...current, watchlist: replaceById(current.watchlist, id, patch) }, result: { ...existing, ...patch } };
      }),

    deletePlan: (id: string) =>
      db.write((current) => ({
        next: { ...current, watchlist: replaceById(current.watchlist, id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    convertPlan: (id: string) =>
      db.write((current) => {
        const plan = current.watchlist.find((row) => row.id === id);
        if (!plan) throw notFound("Plan");
        const created = addSubscription(
          current,
          {
            content_type: "subscription",
            provider: plan.provider,
            product: plan.provider,
            plan: plan.plan,
            price: plan.price,
            currency: plan.currency,
            billing_cycle: plan.billing_cycle,
            category: "Other",
            tags: plan.tags,
          },
          "watchlist",
          asString(plan.url),
        );
        return {
          next: {
            ...created.next,
            watchlist: replaceById(created.next.watchlist, id, { status: "Subscribed", updated_at: nowIso() }),
          },
          result: { ok: true, subscription_id: created.id },
        };
      }),

    reminders: () =>
      db.read((current) =>
        [...activeRows(current.reminders)].sort((a, b) => asString(a.due_date).localeCompare(asString(b.due_date))),
      ),

    promos: () => db.read((current) => sortByCreatedDesc(activeRows(current.promos).filter((row) => !row.archived))),

    promo: (id: string) => db.read((current) => {
      const row = findActive(current.promos, id);
      if (!row) throw notFound("Promo code");
      return row;
    }),

    createPromo: (body: JsonRecord) => db.write((current) => {
      const service = asString(body.service);
      const code = asString(body.code).toUpperCase();
      if (!service || !code) throw new Error("Service and promo code are required.");
      const duplicate = activeRows(current.promos).find((row) =>
        asString(row.service).toLowerCase() === service.toLowerCase() && asString(row.code).toUpperCase() === code,
      );
      if (duplicate) throw new Error("This promo code is already saved for that service.");
      const stamp = nowIso();
      const record: JsonRecord = {
        id: createId(), user_id: "local", deleted_at: null, service, code,
        discount: asString(body.discount), expiry_date: asString(body.expiry_date) || null,
        source: asString(body.source) || "Manual", url: asString(body.url),
        notes: asString(body.notes), category: asString(body.category) || "Deals",
        used: false, archived: false, favorite: false, created_at: stamp, updated_at: stamp,
      };
      const reminders = [...current.reminders];
      if (body.remind_days_before != null && record.expiry_date) {
        const days = Number(body.remind_days_before);
        const expiry = new Date(`${record.expiry_date}T09:00:00`);
        if (Number.isFinite(days) && !Number.isNaN(expiry.getTime())) {
          expiry.setDate(expiry.getDate() - days);
          reminders.unshift({ id: createId(), user_id: "local", deleted_at: null,
            title: `Promo expires: ${service}`, kind: "offer_expiry", due_date: expiry.toISOString(),
            ref_type: "promo", ref_id: record.id, completed: false, created_at: stamp });
        }
      }
      return { next: { ...current, promos: [record, ...current.promos], reminders }, result: record };
    }),

    updatePromo: (id: string, body: JsonRecord) => db.write((current) => {
      const existing = findActive(current.promos, id);
      if (!existing) throw notFound("Promo code");
      const { id: _id, user_id: _user, created_at: _created, ...rest } = body;
      const patch = { ...rest, updated_at: nowIso() };
      return { next: { ...current, promos: replaceById(current.promos, id, patch) }, result: { ...existing, ...patch } };
    }),

    deletePromo: (id: string) => db.write((current) => ({
      next: { ...current, promos: replaceById(current.promos, id, { deleted_at: nowIso() }) }, result: { ok: true },
    })),

    prompts: (category?: string, query?: string) =>
      db.read((current) => {
        let rows = promptRows(current);
        if (category && category !== "All") rows = rows.filter((r) => r.category === category);
        const needle = (query || "").trim().toLowerCase().replace(/^#/, "");
        if (needle) {
          rows = rows.filter((r) =>
            [r.title, r.prompt, r.tool, r.category, Array.isArray(r.tags) ? r.tags.join(" ") : ""]
              .map((v) => asString(v).toLowerCase())
              .some((v) => v.includes(needle)),
          );
        }
        return [...rows].sort(
          (a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || asString(b.created_at).localeCompare(asString(a.created_at)),
        );
      }),

    prompt: (id: string) =>
      db.read((current) => {
        const row = promptRows(current).find((r) => r.id === id);
        if (!row) throw notFound("Prompt");
        return row;
      }),

    createPrompt: (body: JsonRecord) =>
      db.write((current) => {
        const title = asString(body.title).trim();
        const prompt = asString(body.prompt).trim();
        if (!title || !prompt) throw new Error("Title and prompt text are required.");
        const stamp = nowIso();
        const record: JsonRecord = {
          id: createId(),
          user_id: "local",
          deleted_at: null,
          title,
          prompt,
          tool: asString(body.tool),
          category: asString(body.category) || "General",
          link_url: asString(body.link_url) || null,
          photo_url: asString(body.photo_url) || null,
          tags: asStringList(body.tags),
          icon: asString(body.icon) || "creation",
          favorite: Boolean(body.favorite),
          created_at: stamp,
          updated_at: stamp,
        };
        return { next: { ...current, prompts: [record, ...(current.prompts || [])] }, result: record };
      }),

    updatePrompt: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const target = promptRows(current).find((r) => r.id === id);
        if (!target) throw notFound("Prompt");
        const { id: _id, ...rest } = body;
        const patch = { ...rest, updated_at: nowIso() };
        return { next: { ...current, prompts: replaceById(current.prompts || [], id, patch) }, result: { ...target, ...patch } };
      }),

    deletePrompt: (id: string) =>
      db.write((current) => ({
        next: { ...current, prompts: replaceById(current.prompts || [], id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    createReminder: (body: JsonRecord) =>
      db.write((current) => {
        const record: JsonRecord = {
          id: createId(),
          user_id: "local",
          deleted_at: null,
          title: asString(body.title) || "Reminder",
          kind: asString(body.kind) || "custom",
          due_date: body.due_date || null,
          due_time: /^\d{2}:\d{2}$/.test(asString(body.due_time)) ? body.due_time : "09:00",
          ref_type: asString(body.ref_type) || "custom",
          ref_id: body.ref_id || null,
          recurring: body.recurring || null,
          completed: false,
          created_at: nowIso(),
        };
        return { next: { ...current, reminders: [record, ...current.reminders] }, result: record };
      }),

    updateReminder: (id: string, body: JsonRecord) =>
      db.write((current) => {
        const existing = current.reminders.find((row) => row.id === id);
        if (!existing) throw notFound("Reminder");
        const { id: _id, ...rest } = body;
        return {
          next: { ...current, reminders: replaceById(current.reminders, id, rest) },
          result: { ...existing, ...rest },
        };
      }),

    deleteReminder: (id: string) =>
      db.write((current) => ({
        next: { ...current, reminders: replaceById(current.reminders, id, { deleted_at: nowIso() }) },
        result: { ok: true },
      })),

    ingestText: async (text: string, source = "manual") => {
      const currentSettings = await settings();
      const extraction = await extractOrFallback(ai, currentSettings, { text, sourceType: source });
      return db.write((current) => {
        const ran = runPipeline(current, extraction, source, { rawText: text });
        return { next: ran.next, result: ran.inbox };
      });
    },

    ingestImage: async (imageBase64: string, source = "screenshot") => {
      const currentSettings = await settings();
      const extraction = await extractOrFallback(ai, currentSettings, { imageBase64, sourceType: source });
      return db.write((current) => {
        const ran = runPipeline(current, extraction, source, { imageKept: null });
        return { next: ran.next, result: ran.inbox };
      });
    },

    ingestLink: async (url: string, source = "share", text = "") => {
      const domain = url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0];
      const stamp = nowIso();
      const baseLink: JsonRecord = {
        id: createId(),
        user_id: "local",
        deleted_at: null,
        url,
        canonical_url: url,
        title: domain || url.slice(0, 60),
        source,
        thumbnail: null,
        summary: "",
        category: "Other",
        tags: [],
        note: text.slice(0, 500),
        reminder_id: null,
        related_subscription: null,
        archived: false,
        enrichment: "pending",
        created_at: stamp,
        updated_at: stamp,
      };
      await db.write((current) => ({ next: { ...current, links: [baseLink, ...current.links] }, result: baseLink }));

      const meta = await ai.fetchMetadata(url);
      const combined = `URL: ${url}\nTitle: ${meta.title}\n${meta.description}\n${meta.text}\n${text}`;
      const currentSettings = await settings();
      const extraction = await extractOrFallback(ai, currentSettings, { text: combined, sourceType: `link:${source}` });
      const resolvedSource = detectSource(url, source);
      const github = await fetchGithubMeta(url).catch(() => null);
      const aiTags = await aiTopicTags(currentSettings, { url, title: meta.title, text: combined });
      const tags = buildTopicTags({
        url,
        source: resolvedSource,
        title: meta.title,
        description: github?.description || meta.description,
        text: meta.text,
        note: text,
        aiTags: [...aiTags, ...extraction.tags],
        github,
      });
      const update = {
        title: meta.title || extraction.product || baseLink.title,
        source: resolvedSource,
        thumbnail: meta.thumbnail,
        summary: extraction.summary || github?.description || meta.description,
        category: extraction.category,
        tags,
        enrichment: "done",
        updated_at: nowIso(),
      };

      return db.write((current) => {
        let next: LocalDatabase = {
          ...current,
          links: replaceById(current.links, asString(baseLink.id), update),
        };
        if ((extraction.content_type === "subscription" || extraction.content_type === "trial" || extraction.content_type === "plan") && extraction.provider) {
          const routed = runPipeline(next, { ...extraction, confidence: Math.min(extraction.confidence, 0.9) }, `link:${source}`, {
            rawText: combined.slice(0, 2000),
            url,
          });
          return { next: routed.next, result: { link_id: baseLink.id, inbox: routed.inbox, extraction } };
        }
        const link = findActive(next.links, asString(baseLink.id));
        return { next, result: { link_id: baseLink.id, link, extraction } };
      });
    },

    /** Re-reads the page and regenerates searchable topic tags (existing tags are kept). */
    retagLink: async (id: string) => {
      const link = await db.read((current) => findActive(current.links, id));
      if (!link) throw notFound("Link");
      const url = asString(link.url);
      const currentSettings = await settings();
      const meta = url ? await ai.fetchMetadata(url).catch(() => ({ title: "", thumbnail: null, description: "", text: "" })) : { title: "", thumbnail: null, description: "", text: "" };
      const github = url ? await fetchGithubMeta(url).catch(() => null) : null;
      const title = meta.title || asString(link.title);
      const corpus = `URL: ${url}\nTitle: ${title}\n${asString(link.summary)}\n${meta.description}\n${meta.text}\n${asString(link.note)}`;
      const aiTags = await aiTopicTags(currentSettings, { url, title, text: corpus });
      const tags = buildTopicTags({
        url,
        source: detectSource(url, asString(link.source)),
        title,
        description: github?.description || meta.description || asString(link.summary),
        text: meta.text,
        note: asString(link.note),
        aiTags: [...aiTags, ...asStringList(link.tags)],
        github,
      });
      return db.write((current) => ({
        next: { ...current, links: replaceById(current.links, id, { tags, updated_at: nowIso() }) },
        result: { tags, usedAi: aiTags.length > 0 },
      }));
    },

    /** "Which of my tools is best for this task?" — ranks what the user already has,
     *  weighting what is actually available right now (active plan, trial, free credits). */
    findTools: async (task: string) => {
      const owned = await db.read((current) => ({
        tools: toOwnedTools(activeRows(current.subscriptions), activeRows(current.accounts || [])),
        prompts: promptRows(current),
      }));
      const plan = rankToolsForTask(task, owned.tools);
      const prompts = owned.prompts
        .filter((p) => {
          const hay = `${asString(p.title)} ${asString(p.tool)} ${asString(p.category)} ${asString(p.prompt)}`.toLowerCase();
          return plan.needs.some((n) => n.keywords.some((kw) => hay.includes(kw)) || n.taskWords.some((w) => w.length > 3 && hay.includes(w)));
        })
        .slice(0, 3);

      let advice = "";
      const currentSettings = await settings();
      if (ai.complete && currentSettings.ai_enabled !== false && owned.tools.length) {
        try {
          const toolsJson = JSON.stringify(
            owned.tools.map((t) => ({
              name: t.name, kind: t.kind, plan_status: t.status, account_type: t.accountType,
              renews_or_expires: t.renewalDate, credits: t.credits, good_for: t.capabilities,
            })),
          ).slice(0, 9000);
          advice = await ai.complete(
            "You help a person pick which of THEIR OWN tools to use for a task. Only recommend tools from the list. Prefer tools that are available right now (active paid plan, then free account with credits); warn about lapsed or about-to-expire ones. Reply in at most 90 words, plain text, as a short numbered plan. If nothing in the list fits, say what kind of tool they would need.",
            `Task: ${task}\n\nMy tools:\n${toolsJson}`,
          );
        } catch {
          advice = "";
        }
      }
      return { task, plan, advice: advice.trim(), prompts, ownedCount: owned.tools.length };
    },

    /** Optional AI paragraph for the Brain screen: how the user's tool clusters combine. */
    brainAdvice: async (summary: string) => {
      const currentSettings = await settings();
      if (!ai.complete || currentSettings.ai_enabled === false) return "";
      return (
        await ai.complete(
          "You are a practical workflow coach. Given the user's tool clusters (grouped by capability) suggest how to use them together: one best combo, one overlap worth reviewing, one gap. Max 110 words, plain text, no markdown.",
          summary.slice(0, 6000),
        )
      ).trim();
    },

    /** Real .xlsx workbook, base64-encoded so the screen can write it to a file and share it. */
    exportWorkbook: (scope: ExportScope = "all") =>
      db.read((current) => {
        const { bytes, filename } = buildExport(current, scope);
        return { filename, bytes, base64: toBase64(bytes), size: bytes.length };
      }),

    graph: () => db.read(buildGraph),
    search: (query: string) => db.read((current) => searchDatabase(current, query)),

    chat: async (question: string) => {
      const context = await db.read(buildChatContext);
      const planned = await ai.chat(question, context);
      const store: AgentStore = {
        addSubscription: (args) =>
          db.write((current) => {
            const created = addSubscription(
              current,
              { ...args, status: args.trial_end ? "Trial" : "Active", source: "ai" },
              "ai",
              "",
              null,
              { createReminder: true },
            );
            return { next: created.next, result: { id: created.id, provider: asString(created.record.provider) } };
          }),
        findSubscription: (provider) =>
          db.read((current) => {
            const needle = provider.trim().toLowerCase();
            const found = activeRows(current.subscriptions).find(
              (row) => asString(row.provider).toLowerCase() === needle || asString(row.product).toLowerCase() === needle,
            );
            return found ? { id: asString(found.id), provider: asString(found.provider) } : null;
          }),
        updateSubscription: (id, args) =>
          db.write((current) => {
            const existing = current.subscriptions.find((row) => row.id === id);
            if (!existing) throw notFound("Subscription");
            const applied = applySubscriptionUpdate(current, id, args);
            return { next: applied.next, result: { provider: asString(existing.provider) } };
          }),
        addAccount: (args) =>
          db.write((current) => {
            const created = addAccount(
              current,
              { ...args, source: "ai" },
              "ai",
              asString(args.service_url) || asString(args.url),
            );
            return { next: created.next, result: { id: created.id, service_name: asString(created.record.service_name) } };
          }),
        findAccount: (service) =>
          db.read((current) => {
            const needle = service.trim().toLowerCase();
            const found = activeRows(current.accounts || []).find(
              (row) => asString(row.service_name).toLowerCase() === needle,
            );
            return found ? { id: asString(found.id), service_name: asString(found.service_name) } : null;
          }),
        addReminder: (args) =>
          db.write((current) => {
            const record: JsonRecord = {
              id: createId(),
              user_id: "local",
              deleted_at: null,
              title: asString(args.title) || "Reminder",
              kind: "custom",
              due_date: args.due_date || null,
              completed: false,
              created_at: nowIso(),
            };
            return { next: { ...current, reminders: [record, ...current.reminders] }, result: { id: asString(record.id), title: asString(record.title) } };
          }),
        addCheckLater: (args) =>
          db.write((current) => {
            const created = addLink(
              current,
              { product: args.title, summary: args.note, category: "Check later" },
              "ai",
              asString(args.url),
              asString(args.note),
            );
            return { next: created.next, result: { id: created.id, title: asString(created.record.title) } };
          }),
        addPrompt: (args) =>
          db.write((current) => {
            const stamp = nowIso();
            const category = asString(args.category) || "Custom";
            const record: JsonRecord = {
              id: createId(),
              user_id: "local",
              deleted_at: null,
              title: asString(args.title) || "Saved prompt",
              prompt: asString(args.prompt) || "",
              tool: asString(args.tool),
              category,
              link_url: asString(args.link_url) || null,
              photo_url: asString(args.photo_url) || null,
              tags: asStringList(args.tags),
              icon: "creation",
              favorite: false,
              created_at: stamp,
              updated_at: stamp,
            };
            return {
              next: { ...current, prompts: [record, ...(current.prompts || [])] },
              result: { id: asString(record.id), title: asString(record.title), category },
            };
          }),
      };
      let calls: AgentToolCall[] = expandAgentToolCalls(planned.toolCalls || []);
      if (isAddIntent(question) && typeof ai.extractMany === "function") {
        try {
          const extras = await ai.extractMany(question);
          for (const item of extras) {
            const provider = asString(item?.provider);
            if (!provider) continue;
            const already = calls.some(
              (call) =>
                call.name === "add_subscription" &&
                asString(call.args?.provider).toLowerCase() === provider.toLowerCase(),
            );
            if (!already) calls = [...calls, { name: "add_subscription", args: item }];
          }
        } catch {
          // Keep whatever tools we already have.
        }
      }
      const results = calls.length ? await runAgentTools(store, calls) : [];
      const answer = formatAgentAnswer(planned.text || "", results);
      const record: JsonRecord = {
        id: createId(),
        user_id: "local",
        question,
        answer,
        actions: results,
        created_at: nowIso(),
      };
      await db.write((current) => ({ next: { ...current, chatHistory: [...current.chatHistory, record] }, result: record }));
      return { answer, actions: results };
    },

    chatHistory: () => db.read((current) => current.chatHistory),

    compare: async (ids: string[]) => {
      const items = await db.read((current) => {
        const found: JsonRecord[] = [];
        for (const id of ids) {
          const plan = findActive(current.watchlist, id);
          if (plan) {
            found.push({
              provider: plan.provider,
              plan: plan.plan,
              price: plan.price,
              currency: plan.currency,
              billing_cycle: plan.billing_cycle,
              notes: plan.notes,
            });
            continue;
          }
          const sub = findActive(current.subscriptions, id);
          if (sub) {
            found.push({
              provider: sub.provider,
              product: sub.product,
              plan: sub.plan,
              price: sub.price,
              currency: sub.currency,
              billing_cycle: sub.billing_cycle,
            });
          }
        }
        return found;
      });
      if (items.length < 2) throw new Error("Need at least 2 items to compare");
      const comparison = await ai.compare(items);
      return { comparison, items };
    },

    settings,
    patchSettings: (body: JsonRecord) =>
      db.write((current) => {
        const ensured = withSettings(current);
        const { user_id: _user, ...rest } = body;
        const settingsDoc = { ...ensured.settings, ...rest };
        return { next: { ...ensured.next, settings: settingsDoc }, result: settingsDoc };
      }),

    transcribe: async (uri: string) => ({ text: await ai.transcribe(uri) }),

    exportBackup: () => db.read((current) => JSON.stringify(current)),

    exportExcelCsv: () =>
      db.read((current) => {
        const escapeCell = (val: any) => {
          if (val == null) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };

        const lines: string[] = [];

        // Sheet 1: SUBSCRIPTIONS & PLANS
        lines.push('"=== SHEET 1: SUBSCRIPTIONS & PLANS ==="');
        lines.push('"ID","Provider","Product","Plan","Price","Currency","Billing Cycle","Status","Renewal Date","Trial End","Category","Account Email","Card Last4","Notes"');
        const subs = activeRows(current.subscriptions);
        for (const s of subs) {
          lines.push([
            escapeCell(s.id),
            escapeCell(s.provider),
            escapeCell(s.product),
            escapeCell(s.plan),
            escapeCell(s.price),
            escapeCell(s.currency),
            escapeCell(s.billing_cycle),
            escapeCell(s.status),
            escapeCell(s.renewal_date),
            escapeCell(s.trial_end),
            escapeCell(s.category),
            escapeCell(s.account_email),
            escapeCell(s.card_last4),
            escapeCell(s.notes),
          ].join(","));
        }
        lines.push('""');

        // Sheet 2: ACCOUNTS OPENED
        lines.push('"=== SHEET 2: ACCOUNTS OPENED ==="');
        lines.push('"ID","Service Name","Category","Account Type","Platform Usage / Purpose","Allowed Credits / Quota","Email Used","Username","Phone","Auth Method","2FA Enabled","Registration Date","Service URL","Notes"');
        const accs = activeRows(current.accounts || []);
        for (const a of accs) {
          lines.push([
            escapeCell(a.id),
            escapeCell(a.service_name),
            escapeCell(a.category),
            escapeCell(a.account_type),
            escapeCell(a.platform_usage),
            escapeCell(a.allowed_credits),
            escapeCell(a.email_used),
            escapeCell(a.username),
            escapeCell(a.phone_used),
            escapeCell(a.auth_method),
            escapeCell(a.has_2fa ? "YES" : "NO"),
            escapeCell(a.registration_date),
            escapeCell(a.service_url),
            escapeCell(a.notes),
          ].join(","));
        }
        lines.push('""');

        // Sheet 3: SAVED LINKS & VAULT
        lines.push('"=== SHEET 3: SAVED LINKS & VAULT ==="');
        lines.push('"ID","Title","URL","Category","Summary","Note","Created At"');
        const links = activeRows(current.links);
        for (const l of links) {
          lines.push([
            escapeCell(l.id),
            escapeCell(l.title),
            escapeCell(l.url),
            escapeCell(l.category),
            escapeCell(l.summary),
            escapeCell(l.note),
            escapeCell(l.created_at),
          ].join(","));
        }

        return lines.join("\r\n");
      }),

    replaceBackup: (raw: string) =>
      db.write(() => {
        const text = raw.trim();
        if (!text) throw new Error("Backup is empty.");
        return { next: parseDatabase(text), result: { ok: true } };
      }),

    clearAll: () =>
      db.write(() => ({
        next: {
          subscriptions: [],
          accounts: [],
          links: [],
          watchlist: [],
          reminders: [],
          promos: [],
          inbox: [],
          chatHistory: [],
          prompts: [],
          settings: { ...DEFAULT_SETTINGS, created_at: nowIso() },
        },
        result: { ok: true },
      })),
  };
}
