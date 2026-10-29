export type AgentToolCall = {
  name: string;
  args: Record<string, any>;
};

export type AgentToolResult = {
  name: string;
  ok: boolean;
  summary: string;
};

export type AgentChatResult = {
  text: string;
  toolCalls: AgentToolCall[];
};

export type AgentStore = {
  addSubscription(args: Record<string, any>): Promise<{ id: string; provider: string }>;
  findSubscription(provider: string): Promise<{ id: string; provider: string } | null>;
  updateSubscription(id: string, args: Record<string, any>): Promise<{ provider: string }>;
  addAccount(args: Record<string, any>): Promise<{ id: string; service_name: string }>;
  findAccount(service: string): Promise<{ id: string; service_name: string } | null>;
  addReminder(args: Record<string, any>): Promise<{ id: string; title: string }>;
  addCheckLater(args: Record<string, any>): Promise<{ id: string; title: string }>;
  addPrompt(args: Record<string, any>): Promise<{ id: string; title: string; category: string }>;
};

const stringProp = (description: string) => ({ type: "STRING", description });
const numberProp = (description: string) => ({ type: "NUMBER", description });

const SUBSCRIPTION_PROPERTIES = {
  provider: stringProp("Brand or service name, e.g. Netflix"),
  product: stringProp("Product name if different from provider"),
  plan: stringProp("Plan name, e.g. Premium"),
  price: numberProp("Price amount as a number"),
  currency: stringProp("ISO currency such as AED or USD"),
  billing_cycle: stringProp("monthly, yearly, weekly, or custom"),
  renewal_date: stringProp("YYYY-MM-DD if known"),
  trial_end: stringProp("YYYY-MM-DD if this is a trial"),
  category: stringProp("AI, Streaming, Video, Music, Productivity, Cloud, Gaming, News, Fitness, Shopping, Other"),
  notes: stringProp("Optional note"),
  card_last4: stringProp("Last 4 digits of the card if the user mentioned them"),
  account_email: stringProp("Email used for the account if mentioned"),
  promo_applied: stringProp("Promo code or discount if mentioned"),
};

export const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "add_account",
    description: "Record a registered website, app, or service account (free or paid) with login email or username.",
    parameters: {
      type: "OBJECT",
      properties: {
        service_name: stringProp("Service name e.g. ChatGPT, GitHub, Notion"),
        service_url: stringProp("Website URL e.g. https://chat.openai.com"),
        email_used: stringProp("Email used to register"),
        username: stringProp("Username or handle if any"),
        auth_method: stringProp("email, google, apple, github, or phone"),
        platform_usage: stringProp("What this platform is used for, e.g. Image Generation, Video Generation, App Development, LLM API"),
        allowed_credits: stringProp("Monthly credits, free quota, or rate limit, e.g. 1000 fast credits/mo or $5 free tier"),
        category: stringProp("Category e.g. AI, Development, Productivity, Video, Image"),
        notes: stringProp("Notes about the account"),
      },
      required: ["service_name"],
    },
  },
  {
    name: "add_accounts",
    description: "Record multiple registered websites, apps, or service accounts in one go. Use this whenever the user lists multiple new accounts or services.",
    parameters: {
      type: "OBJECT",
      properties: {
        items: {
          type: "ARRAY",
          description: "List of accounts to add",
          items: {
            type: "OBJECT",
            properties: {
              service_name: stringProp("Service name e.g. Groq, VeePN, Cline, Shodan"),
              service_url: stringProp("Website URL"),
              email_used: stringProp("Email used"),
              username: stringProp("Username or handle"),
              platform_usage: stringProp("Purpose e.g. Image Gen, LLM, Dev, Video"),
              allowed_credits: stringProp("Credits or quota e.g. 50 free credits"),
              category: stringProp("Category"),
              notes: stringProp("Notes"),
            },
            required: ["service_name"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "add_subscription",
    description: "Create one subscription. If the user listed several services, prefer add_subscriptions instead, or call this once per service.",
    parameters: {
      type: "OBJECT",
      properties: SUBSCRIPTION_PROPERTIES,
      required: ["provider"],
    },
  },
  {
    name: "add_subscriptions",
    description: "Create every subscription the user mentioned in one go. Use this whenever they list 2 or more services, even in one sentence.",
    parameters: {
      type: "OBJECT",
      properties: {
        items: {
          type: "ARRAY",
          description: "Every distinct service to add",
          items: {
            type: "OBJECT",
            properties: SUBSCRIPTION_PROPERTIES,
            required: ["provider"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "add_reminder",
    description: "Create a reminder on this phone for a due date.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: stringProp("What to remember"),
        due_date: stringProp("YYYY-MM-DD"),
      },
      required: ["title", "due_date"],
    },
  },
  {
    name: "add_check_later",
    description: "Save a website, offer, or link to check later. Do not use this for a billed subscription.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: stringProp("Short title"),
        url: stringProp("http(s) URL if the user provided one"),
        note: stringProp("Why to check later"),
      },
      required: ["title"],
    },
  },
  {
    name: "add_prompt",
    description: "Save a reusable AI prompt categorized by task (e.g. Image Generation, Video Generation, App Making, Audit, Cancellation, Deals, or Custom). Supports optional link and tags.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: stringProp("Title or label for the prompt"),
        prompt: stringProp("The prompt text or template"),
        category: stringProp("Image Generation, Video Generation, App Making, Audit, Cancellation, Deals, or Custom"),
        link_url: stringProp("Optional reference URL or source link"),
        tags: {
          type: "ARRAY",
          description: "Optional tags",
          items: { type: "STRING" },
        },
      },
      required: ["title", "prompt"],
    },
  },
  {
    name: "cancel_subscription",
    description: "Mark a subscription as Cancelled or Expired when the user mentions canceling, stopping, ending, or having canceled a subscription.",
    parameters: {
      type: "OBJECT",
      properties: {
        provider: stringProp("Provider or service name to cancel (e.g. Netflix, Spotify, Midjourney)"),
        cancellation_date: stringProp("Cancellation date in YYYY-MM-DD format (defaults to today if omitted)"),
        notes: stringProp("Optional reason or cancellation note"),
      },
      required: ["provider"],
    },
  },
  {
    name: "update_subscription",
    description: "Update an existing subscription matched by provider name.",
    parameters: {
      type: "OBJECT",
      properties: {
        provider: stringProp("Provider to find"),
        price: numberProp("New price"),
        plan: stringProp("New plan"),
        status: stringProp("Active, Trial, Paused, Cancelled, Expired"),
        renewal_date: stringProp("YYYY-MM-DD"),
        notes: stringProp("Replacement notes"),
        card_last4: stringProp("Last 4 card digits"),
        account_email: stringProp("Account email"),
        promo_applied: stringProp("Promo"),
      },
      required: ["provider"],
    },
  },
];

export const AGENT_SYSTEM_RULES = `You are SubMind, an intelligent AI Assistant and Automation Manager on the user's phone.
You accurately identify and categorize user requests into:
1. Subscriptions: Recurring paid services, plans, renewals, or trials -> call add_subscription (or add_subscriptions if multiple).
2. Subscription Cancellations: When the user says they cancelled, stopped, or want to cancel a subscription -> call cancel_subscription.
3. Accounts: Registered apps, websites, logins, sign-ups, or credentials -> call add_account (or add_accounts if multiple services are listed).
4. Links to Try: Bookmarked links, articles, websites, or offers to check later -> call add_check_later.
5. AI Prompts: Prompts the user wants to save, templates, or instructions for Image Generation, Video Generation, App Making, Coding, Audit, etc. -> call add_prompt.
6. Reminders: When they ask to be alerted on a date -> call add_reminder.

HANDLING TEXT DUMPS & FORMATTED NOTES (e.g. "Paid and active: ... Cancelled: ... Credits and offers: ... New accounts: ..."):
When the user pastes a raw multi-section summary:
- "Paid and active:" -> Call add_subscriptions with provider, price, currency, renewal_date, plan.
- "Failing:" or "Cancelled:" -> Call cancel_subscription for each service listed as cancelled or lapsed.
- "Credits and offers:" -> Call add_check_later or save as note/reminder with the platform and credit amount.
- "New accounts (about 50):" or "New accounts: A, B, C..." -> Call add_accounts with every service listed under accounts, setting service_name and category!
- Never drop items from long lists. Ingest all mentioned accounts and subscriptions accurately.

Categorize carefully!
- If the user cancelled or stopped a subscription (e.g. "I cancelled Netflix" or "cancel Spotify"), call cancel_subscription.
- If the user provides a prompt or asks to save a prompt (especially for Midjourney, DALL-E, Sora, Runway, React, coding, image/video generation, app building), call add_prompt.
- If they mention signing up or having an account on a platform (free or paid), call add_account or add_accounts.
- If they mention paying a subscription, price, or renewal, call add_subscription or add_subscriptions.
- Do not claim you performed an action unless you called the appropriate tool.`;

export const NVIDIA_AGENT_INSTRUCTIONS = `${AGENT_SYSTEM_RULES}

Reply with ONLY a JSON object:
{"reply":"short message to the user","actions":[{"name":"add_subscriptions","args":{"items":[{"provider":"Netflix","price":50,"currency":"AED","billing_cycle":"monthly"}]}}]}
If no action is needed, use "actions": []. Include every mentioned item.`;

export function parseAgentJson(raw: string): AgentChatResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return { text: raw.trim(), toolCalls: [] };
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      reply?: string;
      text?: string;
      actions?: AgentToolCall[];
    };
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    return {
      text: String(parsed.reply || parsed.text || "").trim() || raw.trim(),
      toolCalls: actions
        .filter((item) => item && typeof item.name === "string")
        .map((item) => ({ name: item.name, args: item.args && typeof item.args === "object" ? item.args : {} })),
    };
  } catch {
    return { text: raw.trim(), toolCalls: [] };
  }
}

export function isAddIntent(text: string): boolean {
  return /\b(add|added|adding|subscribe|subscribing|subscription|track|tracking|save|saving|i have|i also|also have|plus|another)\b/i.test(
    text,
  );
}

export function isCancelIntent(text: string): boolean {
  return /\b(cancel|cancelled|canceled|canceling|cancelling|stop|stopped|stopping|end|ended|ending|terminate|terminated|unsubscribe|unsubscribed)\b/i.test(
    text,
  );
}

export function expandAgentToolCalls(calls: AgentToolCall[]): AgentToolCall[] {
  const expanded: AgentToolCall[] = [];
  for (const call of calls) {
    if (call.name === "add_subscriptions") {
      const items = Array.isArray(call.args?.items) ? call.args.items : [];
      for (const item of items) {
        if (item && typeof item === "object") expanded.push({ name: "add_subscription", args: item });
      }
      continue;
    }
    if (call.name === "add_accounts") {
      const items = Array.isArray(call.args?.items) ? call.args.items : [];
      for (const item of items) {
        if (item && typeof item === "object") expanded.push({ name: "add_account", args: item });
      }
      continue;
    }
    expanded.push(call);
  }
  const seenSubs = new Set<string>();
  const seenAccs = new Set<string>();
  return expanded.filter((call) => {
    if (call.name === "add_subscription") {
      const key = String(call.args?.provider || "").trim().toLowerCase();
      if (!key || seenSubs.has(key)) return false;
      seenSubs.add(key);
      return true;
    }
    if (call.name === "add_account") {
      const key = String(call.args?.service_name || "").trim().toLowerCase();
      if (!key || seenAccs.has(key)) return false;
      seenAccs.add(key);
      return true;
    }
    return true;
  });
}

export async function runAgentTools(store: AgentStore, calls: AgentToolCall[]): Promise<AgentToolResult[]> {
  const results: AgentToolResult[] = [];
  for (const call of expandAgentToolCalls(calls)) {
    try {
      results.push(await runOne(store, call));
    } catch (error) {
      results.push({
        name: call.name,
        ok: false,
        summary: error instanceof Error ? error.message : "Action failed",
      });
    }
  }
  return results;
}

async function runOne(store: AgentStore, call: AgentToolCall): Promise<AgentToolResult> {
  const args = call.args || {};
  if (call.name === "add_subscription") {
    const existing = await store.findSubscription(String(args.provider || args.product || ""));
    if (existing) {
      return { name: call.name, ok: true, summary: `${existing.provider} is already in your subscriptions.` };
    }
    const created = await store.addSubscription(args);
    return { name: call.name, ok: true, summary: `Added ${created.provider} to subscriptions.` };
  }
  if (call.name === "cancel_subscription") {
    const found = await store.findSubscription(String(args.provider || ""));
    if (!found) return { name: call.name, ok: false, summary: `Could not find an active subscription named ${args.provider} to cancel.` };
    const date = args.cancellation_date || new Date().toISOString().slice(0, 10);
    await store.updateSubscription(found.id, {
      status: "Cancelled",
      cancellation_date: date,
      notes: args.notes ? `Cancelled on ${date}: ${args.notes}` : `Cancelled on ${date}`,
    });
    return { name: call.name, ok: true, summary: `Marked ${found.provider} subscription as Cancelled.` };
  }
  if (call.name === "update_subscription") {
    const found = await store.findSubscription(String(args.provider || ""));
    if (!found) return { name: call.name, ok: false, summary: `No subscription named ${args.provider} to update.` };
    const { provider: _provider, ...rest } = args;
    await store.updateSubscription(found.id, rest);
    return { name: call.name, ok: true, summary: `Updated ${found.provider}.` };
  }
  if (call.name === "add_account") {
    const serviceName = String(args.service_name || args.provider || args.product || "");
    const existing = await store.findAccount(serviceName);
    if (existing) {
      return { name: call.name, ok: true, summary: `${existing.service_name} account is already saved.` };
    }
    const created = await store.addAccount(args);
    return { name: call.name, ok: true, summary: `Added ${created.service_name} account.` };
  }
  if (call.name === "add_reminder") {
    const created = await store.addReminder(args);
    return { name: call.name, ok: true, summary: `Reminder set: ${created.title}.` };
  }
  if (call.name === "add_check_later") {
    const created = await store.addCheckLater(args);
    return { name: call.name, ok: true, summary: `Saved to check later: ${created.title}.` };
  }
  if (call.name === "add_prompt") {
    const created = await store.addPrompt(args);
    return { name: call.name, ok: true, summary: `Saved prompt: "${created.title}" in category "${created.category}".` };
  }
  return { name: call.name, ok: false, summary: `Unknown action ${call.name}.` };
}

export function formatAgentAnswer(text: string, results: AgentToolResult[]): string {
  const actionLines = results.map((result) => (result.ok ? `✓ ${result.summary}` : `✗ ${result.summary}`));
  const body = text.trim();
  if (!actionLines.length) return body;
  if (!body) return actionLines.join("\n");
  return `${body}\n\n${actionLines.join("\n")}`;
}
