import assert from "node:assert/strict";
import { test } from "node:test";

import type { AiPort } from "./ai-port";
import { CAPABILITY_BY_ID, buildClusters, capabilitiesOf, matchTask, rankToolsForTask, suggestWorkflows, toOwnedTools } from "./capabilities";
import { buildXlsx, columnLetter, crc32, safeSheetName, sheetXml, toBase64, utf8 } from "./excel-export";
import { buildTopicTags, githubRepoOf, hashtagsIn, mergeTags, tagMatches } from "./link-tags";
import { createLocalDb, createMemoryKv } from "./local-db";
import { createLocalApi } from "./local-repository";

function stubAi(overrides: Partial<AiPort> = {}): AiPort {
  return {
    extract: async () => ({
      content_type: "link", provider: "", product: "Example", plan: "", price: null, currency: "AED",
      billing_cycle: "", renewal_date: null, start_date: null, trial_end: null, offer_expiry: null,
      category: "Other", tags: [], summary: "An example page", source_type: "manual", confidence: 0.5, detected_url: null,
    }),
    chat: async () => ({ text: "", toolCalls: [] }),
    compare: async () => "",
    transcribe: async () => "",
    extractMany: async () => [],
    fetchMetadata: async () => ({ title: "Example", thumbnail: null, description: "desc", text: "body" }),
    ...overrides,
  };
}

const api = (ai: AiPort = stubAi()) => createLocalApi({ db: createLocalDb(createMemoryKv()), ai });

// ---------- subscriptions vs accounts ----------

test("cancelling a subscription moves it into Accounts and out of totals", async () => {
  const local = api();
  const sub = await local.createSubscription({ provider: "Netflix", price: 50, plan: "Premium", billing_cycle: "monthly", renewal_date: "2099-01-01", create_reminder: true });
  await local.updateSubscription(String(sub.id), { status: "Cancelled" });

  assert.equal((await local.subscriptions()).length, 0);
  assert.equal((await local.insights()).monthly_spend, 0);
  assert.equal((await local.reminders()).length, 0, "reminders for the subscription are removed");

  const accounts = await local.accounts();
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].service_name, "Netflix");
  assert.equal(accounts[0].account_type, "cancelled");
  assert.equal(accounts[0].previous_plan, "Premium");
  assert.equal(accounts[0].previous_price, 50);
  assert.equal((await local.insights()).cancelled_accounts_count, 1);
});

test("subscriptions without an expiry date are flagged and can be moved to Accounts", async () => {
  const local = api();
  const dated = await local.createSubscription({ provider: "Spotify", price: 20, renewal_date: "2099-05-01" });
  const undated = await local.createSubscription({ provider: "Midjourney", price: 30 });
  const insights = await local.insights();
  assert.deepEqual(insights.missing_expiry.map((m: any) => m.provider), ["Midjourney"]);

  const res = await local.moveSubscriptionToAccount(String(undated.id));
  assert.equal(res.ok, true);
  assert.deepEqual((await local.subscriptions()).map((s: any) => s.id), [dated.id]);
  const account = (await local.accounts())[0];
  assert.equal(account.service_name, "Midjourney");
  assert.equal(account.account_type, "paid");
  assert.equal((await local.insights()).missing_expiry.length, 0);
});

test("setting an expiry date later clears the flag and can add a reminder", async () => {
  const local = api();
  const sub = await local.createSubscription({ provider: "Runway", price: 15 });
  await local.updateSubscription(String(sub.id), { renewal_date: "2099-03-03", create_reminder: true });
  assert.equal((await local.insights()).missing_expiry.length, 0);
  assert.equal((await local.reminders()).filter((r: any) => r.ref_id === sub.id).length, 1);
});

test("legacy cancelled subscriptions are swept into Accounts once", async () => {
  const local = api();
  await local.createSubscription({ provider: "OldTool", price: 9, status: "Cancelled", renewal_date: "2099-01-01" });
  assert.deepEqual(await local.sweepCancelledSubscriptions(), { moved: 1 });
  assert.deepEqual(await local.sweepCancelledSubscriptions(), { moved: 0 });
  assert.equal((await local.accounts())[0].account_type, "cancelled");
});

test("a new subscription is not auto-linked to a same-named account", async () => {
  const local = api();
  await local.createAccount({ service_name: "GitHub", email_used: "a@b.c" });
  const sub = await local.createSubscription({ provider: "GitHub", price: 4, renewal_date: "2099-01-01" });
  assert.equal(sub.account_id, null);
});

// ---------- promo codes ----------

test("a promo typed on a subscription is saved and marked used; saved codes are marked used", async () => {
  const local = api();
  await local.createSubscription({ provider: "Figma", price: 12, renewal_date: "2099-01-01", promo_applied: "student25" });
  let promos = await local.promos();
  assert.equal(promos.length, 1);
  assert.equal(promos[0].code, "STUDENT25");
  assert.equal(promos[0].used, true);

  const saved = await local.createPromo({ service: "Canva", code: "SAVE10" });
  assert.equal(saved.used, false);
  const sub = await local.createSubscription({ provider: "Canva", price: 5, renewal_date: "2099-01-01" });
  await local.updateSubscription(String(sub.id), { promo_applied: "save10" });
  promos = await local.promos();
  assert.equal(promos.length, 2);
  assert.equal(promos.find((p: any) => p.code === "SAVE10")?.used, true);
});

// ---------- prompts ----------

test("prompts start empty (no app-specific defaults) and support tool, tags and search", async () => {
  const local = api();
  assert.deepEqual(await local.prompts(), []);
  await local.createPrompt({ title: "Neon city", prompt: "cyberpunk street at night, 35mm", tool: "Midjourney", category: "Image Generation", tags: ["cyberpunk"] });
  await local.createPrompt({ title: "Landing page", prompt: "Build a SaaS landing page", tool: "Cursor", category: "App Making" });
  assert.equal((await local.prompts()).length, 2);
  assert.equal((await local.prompts("Image Generation")).length, 1);
  assert.equal((await local.prompts("All", "cursor"))[0].title, "Landing page");
  assert.equal((await local.prompts("All", "#cyberpunk"))[0].title, "Neon city");
});

test("prompts seeded by older versions are hidden", async () => {
  const local = api();
  await local.replaceBackup(
    JSON.stringify({
      subscriptions: [], links: [], watchlist: [], reminders: [], inbox: [], chatHistory: [], settings: null,
      prompts: [{ id: "prompt-audit", title: "Audit Subscriptions", prompt: "x", category: "Audit", created_at: "2026-01-01" }],
    }),
  );
  assert.deepEqual(await local.prompts(), []);
});

// ---------- link topic tags ----------

test("saving a GitHub link produces AI + topic tags that are searchable", async () => {
  const local = api(
    stubAi({
      tagLink: async () => ["AI Agents", "browser-automation"],
      fetchMetadata: async () => ({ title: "browser-use", thumbnail: null, description: "Make websites accessible for AI agents", text: "agent agent playwright" }),
    }),
  );
  const res: any = await local.ingestLink("https://github.com/browser-use/browser-use", "Website", "");
  const link = res.link;
  assert.equal(link.source, "GitHub");
  assert.ok(link.tags.includes("ai-agents"));
  assert.ok(link.tags.includes("browser-automation"));
  assert.ok(link.tags.length <= 8);
  assert.equal(tagMatches(link, "#ai-agents"), true);
  assert.equal(tagMatches(link, "nonexistent-zzz"), false);
});

test("tags still get generated without an AI key (hashtags + keywords)", async () => {
  const local = api(
    stubAi({
      fetchMetadata: async () => ({ title: "Reel", thumbnail: null, description: "", text: "" }),
    }),
  );
  const res: any = await local.ingestLink("https://www.instagram.com/reel/abc", "Instagram", "Best #midjourney prompts for #productphotography with AI image tools");
  assert.equal(res.link.source, "Instagram");
  assert.ok(res.link.tags.includes("midjourney"));
  assert.ok(res.link.tags.includes("productphotography"));
});

test("retagLink regenerates tags and keeps existing ones", async () => {
  const local = api(stubAi({ tagLink: async () => ["llm"] }));
  const res: any = await local.ingestLink("https://example.com/post", "Website", "#keepme note");
  const out = await local.retagLink(String(res.link_id));
  assert.ok(out.tags.includes("llm"));
  assert.ok(out.tags.includes("keepme"));
});

test("link tag helpers", () => {
  assert.deepEqual(hashtagsIn("hello #AI and #react_native!"), ["AI", "react_native"]);
  assert.deepEqual(githubRepoOf("https://github.com/vercel/next.js/issues/1"), { owner: "vercel", repo: "next.js" });
  assert.equal(githubRepoOf("https://example.com/vercel/next.js"), null);
  assert.deepEqual(mergeTags(["#AI", "ai", "The", "Open Source"]), ["ai", "open-source"]);
  assert.ok(buildTopicTags({ url: "", source: "Other", title: "", description: "", text: "", note: "", aiTags: [], github: { topics: ["rag"], language: "Python", description: "" } }).includes("python"));
});

// ---------- capabilities, brain and tool finder ----------

const subs = [
  { id: "1", provider: "ChatGPT", plan: "Plus", category: "AI", status: "Active", price: 80, currency: "AED", renewal_date: "2099-01-01" },
  { id: "2", provider: "Runway", plan: "Standard", category: "Video", status: "Active", price: 60, currency: "AED", renewal_date: "2099-01-01" },
  { id: "3", provider: "Midjourney", category: "AI", status: "Active", price: 40, currency: "AED", renewal_date: "2000-01-01" },
  { id: "4", provider: "Netflix", category: "Streaming", status: "Active", price: 50, currency: "AED", renewal_date: "2099-01-01" },
  { id: "5", provider: "Zoom Gym", category: "Fitness", status: "Cancelled", price: 5, currency: "AED" },
];
const accounts = [
  { id: "a1", service_name: "Leonardo", account_type: "free", platform_usage: "image generation", allowed_credits: "150 credits/day" },
  { id: "a2", service_name: "Old Tool", account_type: "cancelled" },
];

test("capabilitiesOf recognises known tools and falls back to keywords", () => {
  assert.equal(capabilitiesOf({ name: "Midjourney" })[0], "image");
  assert.ok(capabilitiesOf({ name: "ChatGPT Plus" }).includes("coding"));
  assert.deepEqual(capabilitiesOf({ name: "Mystery Thing" }), ["other"]);
  assert.ok(capabilitiesOf({ name: "Acme", text: "text to speech voice cloning" }).includes("audio"));
});

test("toOwnedTools skips cancelled subscriptions and cancelled accounts", () => {
  const tools = toOwnedTools(subs, accounts);
  assert.deepEqual(tools.map((t) => t.name).sort(), ["ChatGPT", "Leonardo", "Midjourney", "Netflix", "Runway"]);
});

test("buildClusters groups tools by capability with multi-membership", () => {
  const clusters = buildClusters(toOwnedTools(subs, accounts));
  const image = clusters.find((c) => c.capability.id === "image")!;
  assert.deepEqual(image.tools.map((t) => t.name).sort(), ["ChatGPT", "Leonardo", "Midjourney", "Runway"]);
  assert.equal(image.paidCount, 3);
  assert.ok(clusters.find((c) => c.capability.id === "streaming")!.tools.some((t) => t.name === "Netflix"));
});

test("matchTask maps a request to the capabilities it needs", () => {
  assert.ok(matchTask("make a 30 second video ad with a voiceover").includes("video"));
  assert.ok(matchTask("make a 30 second video ad with a voiceover").includes("audio"));
  assert.deepEqual(matchTask("zzz qqq"), ["chat"]);
  assert.equal(matchTask("write python code to scrape a site")[0], "coding");
});

test("tool finder prefers tools that are available now over lapsed ones", () => {
  const tools = toOwnedTools(subs, accounts);
  const plan = rankToolsForTask("generate a product image", tools);
  const imagePicks = plan.picks.filter((p) => p.capability.id === "image").map((p) => p.tool.name);
  // Midjourney's renewal is long overdue (may have lapsed), so it must rank below the live options.
  assert.ok(imagePicks.indexOf("Midjourney") > imagePicks.indexOf("Leonardo") || imagePicks.indexOf("Midjourney") > imagePicks.indexOf("ChatGPT"));
  const midjourney = plan.picks.find((p) => p.tool.name === "Midjourney")!;
  assert.equal(midjourney.availability.tone, "bad");
  assert.match(plan.picks.find((p) => p.tool.name === "Leonardo")!.availability.label, /150 credits/);
});

test("tool finder reports capability gaps the user does not cover", () => {
  const plan = rankToolsForTask("compose a song with vocals", toOwnedTools(subs, accounts));
  assert.deepEqual(plan.gaps.map((g) => g.id), ["audio"]);
  assert.ok(CAPABILITY_BY_ID.audio.suggestions.length > 0);
});

test("findTools combines ranking with optional AI advice and matching saved prompts", async () => {
  const local = api(stubAi({ complete: async () => "1. Use Leonardo first." }));
  await local.createSubscription({ provider: "Midjourney", price: 40, renewal_date: "2099-01-01" });
  await local.createPrompt({ title: "Product shot", prompt: "studio product photo, soft light", tool: "Midjourney", category: "Image Generation" });
  const res = await local.findTools("I need an image for a product poster");
  assert.equal(res.advice, "1. Use Leonardo first.");
  assert.equal(res.plan.picks[0].tool.name, "Midjourney");
  assert.equal(res.prompts.length, 1);
  assert.equal((await api(stubAi()).findTools("anything")).advice, "");
});

test("suggestWorkflows only returns combos where two or more capabilities are owned", () => {
  const flows = suggestWorkflows(toOwnedTools(subs, accounts));
  assert.ok(flows.length > 0);
  for (const wf of flows) assert.ok(wf.steps.filter((s) => s.tool).length >= 2);
  assert.equal(suggestWorkflows([]).length, 0);
});

// ---------- Excel export ----------

function unzipNames(zip: Uint8Array): string[] {
  const names: string[] = [];
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let pos = 0;
  while (pos + 30 <= zip.length && view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    names.push(new TextDecoder().decode(zip.subarray(pos + 30, pos + 30 + nameLen)));
    pos += 30 + nameLen + size;
  }
  return names;
}

test("crc32 and base64 match known values", () => {
  assert.equal(crc32(utf8("123456789")), 0xcbf43926);
  assert.equal(toBase64(utf8("Man")), "TWFu");
  assert.equal(toBase64(utf8("Ma")), "TWE=");
  assert.equal(toBase64(utf8("M")), "TQ==");
});

test("xlsx workbook is a valid zip with every part and escaped cell text", () => {
  const bytes = buildXlsx([
    { name: "Plans", columns: [{ header: "Name", width: 20 }, { header: "Price", width: 10 }], rows: [["A & B <x>", 12.5], ["", null]] },
    { name: "Bad:/Name?*[]", columns: [{ header: "X", width: 5 }], rows: [] },
  ]);
  assert.deepEqual(unzipNames(bytes), [
    "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
    "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml",
  ]);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("A &amp; B &lt;x&gt;"));
  assert.ok(text.includes("<v>12.5</v>"));
  assert.ok(text.includes('name="Bad Name"') || text.includes('name="Bad:/Name?*[]"') === false);
  assert.equal(safeSheetName("a/b:c"), "a b c");
  assert.equal(safeSheetName("x".repeat(60)).length, 31);
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(26), "AA");
  assert.match(sheetXml({ name: "S", columns: [{ header: "H", width: 4 }], rows: [] }), /autoFilter ref="A1:A1"/);
});

test("exportWorkbook builds plans, accounts and combined files", async () => {
  const local = api();
  await local.createSubscription({ provider: "Netflix", price: 50, renewal_date: "2099-01-01" });
  await local.createAccount({ service_name: "GitHub", email_used: "a@b.c" });
  await local.createPlan({ provider: "Claude", plan: "Max", price: 100 });

  const plans = await local.exportWorkbook("plans");
  assert.match(plans.filename, /^SubMind_Plans_\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.ok(plans.base64.startsWith("UEs"), "base64 of a zip starts with PK");
  const accountsFile = await local.exportWorkbook("accounts");
  assert.match(accountsFile.filename, /Accounts/);
  const all = await local.exportWorkbook("all");
  assert.ok(all.size > plans.size);
});
