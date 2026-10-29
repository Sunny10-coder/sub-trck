import assert from "node:assert/strict";
import { test } from "node:test";

import type { AiPort } from "./ai-port";
import { LOCAL_DB_KEY, createLocalDb, createMemoryKv } from "./local-db";
import type { Extraction } from "./local-models";
import { createLocalApi } from "./local-repository";

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    content_type: "subscription",
    provider: "Netflix",
    product: "Netflix",
    plan: "Premium",
    price: 50,
    currency: "AED",
    billing_cycle: "monthly",
    renewal_date: "2099-12-01",
    trial_end: null,
    offer_expiry: null,
    category: "Streaming",
    tags: ["video"],
    summary: "Netflix premium plan",
    source_type: "manual",
    confidence: 0.98,
    ...overrides,
  };
}

function stubAi(extract: Extraction = extraction()): AiPort {
  return {
    extract: async () => extract,
    chat: async (question) => ({ text: `Answer for ${question}`, toolCalls: [] }),
    compare: async () => "Plan A is cheaper.",
    transcribe: async () => "hello",
    extractMany: async () => [],
    fetchMetadata: async () => ({ title: "Example", thumbnail: null, description: "desc", text: "body" }),
  };
}

function api(ai: AiPort = stubAi()) {
  return createLocalApi({ db: createLocalDb(createMemoryKv()), ai });
}

test("stores optional card last 4, email, and promo on a subscription", async () => {
  const local = api();
  const created = await local.createSubscription({
    provider: "Netflix",
    status: "Active",
    card_last4: "12-3456",
    account_email: "me@example.com",
    promo_applied: "STUDENT",
  });
  assert.equal(created.card_last4, "3456");
  assert.equal(created.account_email, "me@example.com");
  assert.equal(created.promo_applied, "STUDENT");
});

test("creates a subscription and lists it from phone storage", async () => {
  const local = api();
  const created = await local.createSubscription({
    provider: "Spotify",
    product: "Spotify",
    price: 20,
    currency: "AED",
    billing_cycle: "monthly",
    category: "Music",
    status: "Active",
  });
  assert.equal(created.provider, "Spotify");
  const rows = await local.subscriptions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, created.id);
});

test("soft-deletes a subscription so it no longer appears", async () => {
  const local = api();
  const created = await local.createSubscription({ provider: "Disney", status: "Active" });
  await local.deleteSubscription(String(created.id));
  assert.equal((await local.subscriptions()).length, 0);
});

test("promo code is searchable, prevents duplicates, and creates an expiry reminder", async () => {
  const local = api();
  const promo = await local.createPromo({ service: "Figma", code: "student25", discount: "25% off", expiry_date: "2099-12-20", remind_days_before: 3 });
  assert.equal(promo.code, "STUDENT25");
  assert.equal((await local.search("student25")).promos[0].id, promo.id);
  assert.equal((await local.reminders()).find((row: any) => row.ref_id === promo.id)?.kind, "offer_expiry");
  await assert.rejects(() => local.createPromo({ service: "figma", code: "STUDENT25" }), /already saved/);
  await local.updatePromo(String(promo.id), { used: true });
  assert.equal((await local.promos())[0].used, true);
});

test("older backups without promos stay readable", async () => {
  const local = api();
  await local.replaceBackup(JSON.stringify({ subscriptions: [], links: [], watchlist: [], reminders: [], inbox: [], chatHistory: [], settings: null }));
  assert.deepEqual(await local.promos(), []);
});

test("insights count monthly spend for active subscriptions only", async () => {
  const local = api();
  await local.createSubscription({ provider: "A", price: 12, billing_cycle: "monthly", status: "Active" });
  await local.createSubscription({ provider: "B", price: 120, billing_cycle: "yearly", status: "Active" });
  await local.createSubscription({ provider: "C", price: 99, billing_cycle: "monthly", status: "Cancelled" });
  const insights = await local.insights();
  assert.equal(insights.monthly_spend, 22);
  assert.equal(insights.active_count, 2);
});

test("screenshot ingest never auto-adds a subscription", async () => {
  const local = api(stubAi(extraction({ confidence: 0.99, provider: "YouTube" })));
  const inbox = await local.ingestImage("dGVzdA==", "screenshot");
  assert.equal(inbox.status, "needs_confirmation");
  assert.equal((await local.subscriptions()).length, 0);
});

test("check-later inbox action saves a link instead of a subscription", async () => {
  const local = api(stubAi(extraction({ confidence: 0.2, content_type: "check_later", provider: "Cool site" })));
  const inbox = await local.ingestImage("dGVzdA==", "screenshot");
  const saved = await local.inboxAction(String(inbox.id), { action: "check_later" });
  assert.equal(saved.type, "link");
  assert.equal((await local.subscriptions()).length, 0);
  assert.equal((await local.links())[0].category, "Check later");
});

test("high-confidence ingest auto-adds a subscription on device", async () => {
  const local = api(stubAi(extraction({ confidence: 0.99, provider: "YouTube" })));
  const inbox = await local.ingestText("YouTube Premium 20 AED", "note");
  assert.equal(inbox.status, "auto_added");
  const subs = await local.subscriptions();
  assert.equal(subs.length, 1);
  assert.equal(subs[0].provider, "YouTube");
});

test("low-confidence ingest stays in the review inbox", async () => {
  const local = api(stubAi(extraction({ confidence: 0.2, provider: "Unknown Co" })));
  const inbox = await local.ingestText("random note", "note");
  assert.equal(inbox.status, "needs_review");
  assert.equal((await local.subscriptions()).length, 0);
  assert.equal((await local.inbox("needs_review")).length, 1);
});

test("duplicate ingest is flagged instead of creating a second subscription", async () => {
  const local = api();
  await local.createSubscription({ provider: "Netflix", product: "Netflix", status: "Active" });
  const flagged = await local.ingestText("Netflix again", "note");
  assert.equal(flagged.status, "duplicate");
  assert.equal((await local.subscriptions()).length, 1);
});

test("search finds local subscriptions by provider", async () => {
  const local = api();
  await local.createSubscription({ provider: "Figma", product: "Figma", status: "Active" });
  const result = await local.search("fig");
  assert.equal(result.subscriptions.length, 1);
  assert.equal(result.subscriptions[0].provider, "Figma");
});

test("settings persist on the phone", async () => {
  const local = api();
  const saved = await local.patchSettings({ currency: "USD", ai_enabled: false });
  assert.equal(saved.currency, "USD");
  assert.equal(saved.ai_enabled, false);
  const loaded = await local.settings();
  assert.equal(loaded.currency, "USD");
});

test("creating a subscription with create_reminder stores a reminder", async () => {
  const local = api();
  await local.createSubscription({
    provider: "Adobe",
    renewal_date: "2099-01-01",
    create_reminder: true,
    status: "Active",
  });
  const reminders = await local.reminders();
  assert.equal(reminders.length, 1);
  assert.match(String(reminders[0].title), /Adobe/);
});

test("watchlist convert creates a local subscription", async () => {
  const local = api();
  const plan = await local.createPlan({ provider: "Dropbox", plan: "Plus", price: 10 });
  const converted = await local.convertPlan(String(plan.id));
  assert.ok(converted.subscription_id);
  assert.equal((await local.subscriptions()).length, 1);
  const updated = await local.plan(String(plan.id));
  assert.equal(updated.status, "Subscribed");
});

test("agent chat can add a subscription from a tool call", async () => {
  const local = api({
    ...stubAi(),
    chat: async () => ({
      text: "Adding Spotify now.",
      toolCalls: [{ name: "add_subscription", args: { provider: "Spotify", price: 20, currency: "AED", billing_cycle: "monthly" } }],
    }),
  });
  const reply = await local.chat("add spotify 20 aed monthly");
  assert.match(reply.answer, /Spotify/);
  assert.equal((await local.subscriptions())[0].provider, "Spotify");
  assert.equal((await local.subscriptions())[0].price, 20);
});

test("agent chat identifies and adds every subscription in a list", async () => {
  const local = api({
    ...stubAi(),
    chat: async () => ({
      text: "Adding all of them.",
      toolCalls: [{
        name: "add_subscriptions",
        args: {
          items: [
            { provider: "Netflix", price: 50, currency: "AED", billing_cycle: "monthly" },
            { provider: "Spotify", price: 20, currency: "AED", billing_cycle: "monthly" },
          ],
        },
      }],
    }),
    extractMany: async () => [{ provider: "YouTube", price: 15, currency: "AED", billing_cycle: "monthly" }],
  });
  await local.chat("add netflix 50, spotify 20 and youtube 15");
  const names = (await local.subscriptions()).map((row) => row.provider).sort();
  assert.deepEqual(names, ["Netflix", "Spotify", "YouTube"]);
});

test("chat history is stored on the device", async () => {
  const local = api();
  await local.createSubscription({ provider: "Netflix", price: 50, status: "Active" });
  const reply = await local.chat("What do I pay?");
  assert.equal(reply.answer, "Answer for What do I pay?");
  assert.equal((await local.chatHistory()).length, 1);
});

test("corrupt storage is not overwritten with an empty database", async () => {
  const kv = createMemoryKv({ [LOCAL_DB_KEY]: "{not-json" });
  const broken = createLocalApi({ db: createLocalDb(kv), ai: stubAi() });
  await assert.rejects(() => broken.subscriptions(), /unreadable/);
  assert.equal(await kv.getItem(LOCAL_DB_KEY), "{not-json");
});

test("export and replace backup round-trips local data", async () => {
  const local = api();
  await local.createSubscription({ provider: "BackupCo", status: "Active" });
  const backup = await local.exportBackup();
  await local.clearAll();
  assert.equal((await local.subscriptions()).length, 0);
  await local.replaceBackup(backup);
  assert.equal((await local.subscriptions())[0].provider, "BackupCo");
});

test("creates and retrieves accounts opened separately from subscriptions", async () => {
  const local = api();
  const acc = await local.createAccount({
    service_name: "ChatGPT",
    service_url: "https://chat.openai.com",
    email_used: "dev@example.com",
    auth_method: "google",
    account_type: "free",
    category: "AI",
  });
  assert.equal(acc.service_name, "ChatGPT");
  assert.equal(acc.email_used, "dev@example.com");

  const accounts = await local.accounts();
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].id, acc.id);

  // Subscriptions remain 0 - an account is not a subscription!
  assert.equal((await local.subscriptions()).length, 0);
});

test("linking a subscription to an existing account connects them properly", async () => {
  const local = api();
  const acc = await local.createAccount({
    service_name: "GitHub",
    email_used: "coder@gmail.com",
    account_type: "free",
  });

  const sub = await local.createSubscription({
    provider: "GitHub Copilot",
    price: 10,
    currency: "USD",
    billing_cycle: "monthly",
    account_id: String(acc.id),
  });

  assert.equal(sub.account_id, String(acc.id));
  const accSubs = await local.accountSubscriptions(String(acc.id));
  assert.equal(accSubs.length, 1);
  assert.equal(accSubs[0].id, sub.id);

  const updatedAcc = await local.account(String(acc.id));
  assert.equal(updatedAcc.account_type, "paid");
});

test("converting a Link to Try creates an Account Opened and links them", async () => {
  const local = api();
  const linkRes = await local.ingestLink("https://cursor.com", "manual", "Cool AI code editor");
  const linkId = String(linkRes.link_id);

  const convertedAcc = await local.convertLinkToAccount(linkId, {
    email_used: "sabit@example.com",
    auth_method: "github",
  });

  assert.equal(convertedAcc.source_link_id, linkId);
  assert.equal(convertedAcc.email_used, "sabit@example.com");

  const fetchedLink = await local.link(linkId);
  assert.equal(fetchedLink.converted_to_account_id, convertedAcc.id);
});

test("smart inbox classifies account registration into accounts", async () => {
  const local = api(stubAi(extraction({
    content_type: "account",
    provider: "Perplexity",
    summary: "Created Perplexity account with Google",
    confidence: 0.96,
  })));

  const inbox = await local.ingestText("Signed up for Perplexity using google auth", "manual");
  assert.equal(inbox.status, "auto_added");
  assert.equal(inbox.created_type, "account");

  const accounts = await local.accounts();
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].service_name, "Perplexity");
});
