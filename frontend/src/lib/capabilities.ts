// Capability catalog shared by the Brain map and the Tool Finder.
// Pure TypeScript (no React Native imports) so it can be unit tested with node.

import type { JsonRecord } from "./local-db";

export type CapabilityId =
  | "chat"
  | "coding"
  | "image"
  | "video"
  | "audio"
  | "research"
  | "design"
  | "productivity"
  | "automation"
  | "storage"
  | "streaming"
  | "learning"
  | "other";

export type Capability = {
  id: CapabilityId;
  label: string;
  icon: string;
  color: string;
  blurb: string;
  /** Matched against a tool's name/category/plan/notes/tags. */
  keywords: string[];
  /** Matched against what the user asks for ("make a video", "write code"). */
  taskWords: string[];
  /** Tools that are not owned yet, shown only as clearly-labelled suggestions. */
  suggestions: string[];
};

export const CAPABILITIES: Capability[] = [
  {
    id: "chat",
    label: "Chat & Writing",
    icon: "message-text-outline",
    color: "#8B5CF6",
    blurb: "Drafting, brainstorming, summarising, scripts",
    keywords: ["chatgpt", "openai", "claude", "anthropic", "gemini", "copilot", "grok", "mistral", "llama", "poe", "writing", "chatbot", "llm", "jasper", "grammarly"],
    taskWords: ["write", "draft", "script", "essay", "email", "caption", "copy", "summar", "brainstorm", "idea", "blog", "story", "translate", "rewrite", "chat"],
    suggestions: ["ChatGPT (free tier)", "Claude (free tier)", "Gemini (free)"],
  },
  {
    id: "coding",
    label: "Code & Apps",
    icon: "code-braces",
    color: "#3B82F6",
    blurb: "IDEs, coding agents, app builders, hosting",
    keywords: ["cursor", "github", "copilot", "replit", "v0", "lovable", "bolt", "windsurf", "codex", "claude code", "vercel", "netlify", "supabase", "firebase", "railway", "jetbrains", "codespaces", "developer", "api", "ide"],
    taskWords: ["code", "coding", "python", "javascript", "typescript", "react", "app", "website", "web app", "program", "bug", "debug", "deploy", "api", "backend", "frontend", "software", "scrape", "scraper", "function", "repo"],
    suggestions: ["Cursor (free tier)", "Replit", "GitHub Copilot Free", "v0"],
  },
  {
    id: "image",
    label: "Image Generation",
    icon: "image-auto-adjust",
    color: "#EC4899",
    blurb: "Text-to-image, editing, upscaling, product shots",
    keywords: ["midjourney", "dall-e", "dalle", "stable diffusion", "leonardo", "ideogram", "firefly", "flux", "freepik", "krea", "playground", "nano banana", "imagen", "recraft", "image", "photo", "art"],
    taskWords: ["image", "picture", "photo", "logo", "poster", "thumbnail", "illustration", "art", "draw", "avatar", "banner", "product shot", "wallpaper", "upscale", "edit photo"],
    suggestions: ["Leonardo (free daily credits)", "Ideogram (free)", "Midjourney"],
  },
  {
    id: "video",
    label: "Video Generation",
    icon: "movie-open-play-outline",
    color: "#F43F5E",
    blurb: "Text/image-to-video, avatars, editing, effects",
    keywords: ["runway", "sora", "kling", "luma", "pika", "veo", "hailuo", "minimax", "capcut", "premiere", "descript", "heygen", "synthesia", "higgsfield", "invideo", "opus", "video", "animation", "vfx"],
    taskWords: ["video", "reel", "short", "clip", "animation", "animate", "ad", "commercial", "trailer", "film", "movie", "tiktok", "youtube", "avatar", "edit video"],
    suggestions: ["Kling (daily free credits)", "Runway", "CapCut (free)"],
  },
  {
    id: "audio",
    label: "Voice & Music",
    icon: "waveform",
    color: "#10B981",
    blurb: "Text-to-speech, voice cloning, music, transcription",
    keywords: ["elevenlabs", "suno", "udio", "murf", "whisper", "otter", "podcast", "audio", "voice", "music", "speech", "tts"],
    taskWords: ["voice", "voiceover", "narrat", "speech", "audio", "music", "song", "podcast", "transcribe", "dub", "sound", "jingle"],
    suggestions: ["ElevenLabs (free tier)", "Suno (free credits)"],
  },
  {
    id: "research",
    label: "Research & Search",
    icon: "magnify-scan",
    color: "#06B6D4",
    blurb: "Cited answers, deep research, reading papers",
    keywords: ["perplexity", "notebooklm", "consensus", "elicit", "scholar", "you.com", "phind", "kagi", "research", "search", "paper"],
    taskWords: ["research", "find", "compare", "sources", "cite", "paper", "study", "market", "competitor", "fact", "look up", "analyse", "analyze", "data"],
    suggestions: ["Perplexity (free)", "NotebookLM (free)", "Consensus"],
  },
  {
    id: "design",
    label: "Design & Creative",
    icon: "palette-outline",
    color: "#F59E0B",
    blurb: "Layouts, brand kits, mockups, presentations",
    keywords: ["canva", "figma", "adobe", "photoshop", "illustrator", "framer", "penpot", "gamma", "pitch", "miro", "design", "creative"],
    taskWords: ["design", "layout", "mockup", "slide", "deck", "presentation", "brand", "ui", "ux", "prototype", "social post", "flyer", "infographic"],
    suggestions: ["Canva (free)", "Figma (free)", "Gamma"],
  },
  {
    id: "productivity",
    label: "Notes & Productivity",
    icon: "lightning-bolt-outline",
    color: "#22C55E",
    blurb: "Notes, tasks, docs, calendars, team chat",
    keywords: ["notion", "obsidian", "evernote", "todoist", "trello", "asana", "clickup", "slack", "linear", "microsoft 365", "office", "calendar", "airtable", "productivity", "notes", "tasks"],
    taskWords: ["note", "plan", "organise", "organize", "task", "todo", "project", "schedule", "track", "document", "wiki", "meeting"],
    suggestions: ["Notion (free)", "Obsidian (free)", "Todoist"],
  },
  {
    id: "automation",
    label: "Automation & Agents",
    icon: "robot-outline",
    color: "#A855F7",
    blurb: "Workflows, scrapers, agents, integrations",
    keywords: ["zapier", "make.com", "n8n", "ifttt", "apify", "browserbase", "firecrawl", "pipedream", "automation", "agent", "workflow", "scraper"],
    taskWords: ["automate", "automation", "workflow", "scrape", "agent", "integrat", "trigger", "schedule post", "bot", "pipeline"],
    suggestions: ["n8n (self-host free)", "Zapier (free tier)"],
  },
  {
    id: "storage",
    label: "Cloud & Storage",
    icon: "cloud-outline",
    color: "#0EA5E9",
    blurb: "Drives, backup, hosting, VPN",
    keywords: ["icloud", "google one", "google drive", "dropbox", "onedrive", "mega", "aws", "azure", "gcp", "backblaze", "cloudflare", "proton", "vpn", "nord", "express", "cloud", "storage", "backup", "hosting"],
    taskWords: ["store", "storage", "backup", "host", "share files", "vpn", "sync", "cloud", "transfer"],
    suggestions: ["Google Drive (15 GB free)", "Proton Drive (free)"],
  },
  {
    id: "streaming",
    label: "Streaming & Media",
    icon: "television-play",
    color: "#EF4444",
    blurb: "Shows, music, audiobooks, gaming passes",
    keywords: ["netflix", "spotify", "youtube premium", "hulu", "disney", "prime video", "osn", "shahid", "apple tv", "apple music", "audible", "anghami", "xbox", "playstation", "game pass", "streaming", "movies", "gaming"],
    taskWords: ["watch", "stream", "listen", "movie", "series", "show", "relax", "entertain", "play game"],
    suggestions: [],
  },
  {
    id: "learning",
    label: "Learning",
    icon: "school-outline",
    color: "#14B8A6",
    blurb: "Courses, languages, practice",
    keywords: ["coursera", "udemy", "duolingo", "skillshare", "masterclass", "khan", "datacamp", "brilliant", "linkedin learning", "course", "learn", "language", "education"],
    taskWords: ["learn", "course", "study", "teach", "practice", "language", "tutorial", "exam", "certificate"],
    suggestions: ["Khan Academy (free)", "Duolingo (free)"],
  },
  {
    id: "other",
    label: "Everything Else",
    icon: "dots-horizontal-circle-outline",
    color: "#94A3B8",
    blurb: "Utilities that don't fit a task cluster",
    keywords: [],
    taskWords: [],
    suggestions: [],
  },
];

export const CAPABILITY_BY_ID: Record<CapabilityId, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
) as Record<CapabilityId, Capability>;

/** Tools whose capabilities are well known even if the user's notes say nothing. */
const KNOWN_PROFILES: Record<string, CapabilityId[]> = {
  chatgpt: ["chat", "coding", "research", "image"],
  openai: ["chat", "coding", "image"],
  claude: ["chat", "coding", "research"],
  gemini: ["chat", "research", "image", "coding"],
  perplexity: ["research", "chat"],
  notebooklm: ["research", "learning"],
  grok: ["chat", "research"],
  cursor: ["coding"],
  replit: ["coding"],
  lovable: ["coding"],
  github: ["coding"],
  v0: ["coding", "design"],
  midjourney: ["image"],
  leonardo: ["image"],
  ideogram: ["image"],
  firefly: ["image", "design"],
  runway: ["video", "image"],
  sora: ["video"],
  kling: ["video"],
  pika: ["video"],
  luma: ["video"],
  heygen: ["video", "audio"],
  capcut: ["video"],
  higgsfield: ["video", "image"],
  elevenlabs: ["audio"],
  suno: ["audio"],
  canva: ["design", "image"],
  figma: ["design"],
  notion: ["productivity", "chat"],
  obsidian: ["productivity"],
  zapier: ["automation"],
  n8n: ["automation"],
};

export type ToolLike = { name: string; text?: string };

function haystackOf(tool: ToolLike): string {
  return `${tool.name} ${tool.text || ""}`.toLowerCase();
}

/** Capabilities of one tool, strongest first. Never empty ("other" as fallback). */
export function capabilitiesOf(tool: ToolLike): CapabilityId[] {
  const hay = haystackOf(tool);
  const name = tool.name.toLowerCase();
  const scores = new Map<CapabilityId, number>();
  const bump = (id: CapabilityId, by: number) => scores.set(id, (scores.get(id) || 0) + by);

  for (const [key, ids] of Object.entries(KNOWN_PROFILES)) {
    if (name.includes(key)) ids.forEach((id, i) => bump(id, 10 - i));
  }
  for (const cap of CAPABILITIES) {
    for (const kw of cap.keywords) {
      if (hay.includes(kw)) bump(cap.id, name.includes(kw) ? 3 : 1);
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return ranked.length ? ranked.slice(0, 4) : ["other"];
}

export type OwnedTool = {
  id: string;
  name: string;
  kind: "subscription" | "account";
  text: string;
  price: number | null;
  currency: string;
  status: string;
  credits: string;
  accountType: string;
  route: string;
  renewalDate: string | null;
  capabilities: CapabilityId[];
};

const str = (v: unknown) => (v == null ? "" : String(v));

export function toOwnedTools(subscriptions: JsonRecord[], accounts: JsonRecord[]): OwnedTool[] {
  const subs = subscriptions
    .filter((s) => s.status !== "Cancelled" && s.status !== "Expired")
    .map((s): OwnedTool => {
      const name = str(s.provider) || str(s.product) || "Subscription";
      const text = [s.product, s.plan, s.category, s.notes, Array.isArray(s.tags) ? s.tags.join(" ") : ""].map(str).join(" ");
      return {
        id: str(s.id),
        name,
        kind: "subscription",
        text,
        price: s.price == null || s.price === "" ? null : Number(s.price),
        currency: str(s.currency) || "AED",
        status: str(s.status) || "Active",
        credits: "",
        accountType: "paid",
        route: `/subscription/${s.id}`,
        renewalDate: s.renewal_date ? str(s.renewal_date) : s.trial_end ? str(s.trial_end) : null,
        capabilities: capabilitiesOf({ name, text }),
      };
    });
  const accs = accounts
    .filter((a) => a.account_type !== "cancelled")
    .map((a): OwnedTool => {
      const name = str(a.service_name) || "Account";
      const text = [a.platform_usage, a.category, a.notes, a.allowed_credits, Array.isArray(a.tags) ? a.tags.join(" ") : ""].map(str).join(" ");
      return {
        id: str(a.id),
        name,
        kind: "account",
        text,
        price: null,
        currency: str(a.currency) || "AED",
        status: "Active",
        credits: str(a.allowed_credits),
        accountType: str(a.account_type) || "free",
        route: `/account/${a.id}`,
        renewalDate: null,
        capabilities: capabilitiesOf({ name, text }),
      };
    });
  return [...subs, ...accs];
}

export function monthlyOf(tool: OwnedTool, cycle = "monthly"): number {
  if (tool.kind !== "subscription" || !tool.price) return 0;
  return cycle === "yearly" ? tool.price / 12 : tool.price;
}

export type Cluster = {
  capability: Capability;
  tools: OwnedTool[];
  paidCount: number;
  monthly: number;
};

/** A tool appears in every cluster it has a capability for (multi-membership). */
export function buildClusters(tools: OwnedTool[]): Cluster[] {
  return CAPABILITIES.map((capability) => {
    const members = tools.filter((t) => t.capabilities.includes(capability.id));
    return {
      capability,
      tools: members,
      paidCount: members.filter((t) => t.kind === "subscription").length,
      monthly: Math.round(members.reduce((sum, t) => sum + monthlyOf(t), 0) * 100) / 100,
    };
  })
    .filter((c) => c.tools.length > 0)
    .sort((a, b) => b.tools.length - a.tools.length);
}

// ---------- Availability + task matching (Tool Finder) ----------

export type Availability = { score: number; label: string; tone: "good" | "warn" | "bad" };

function daysUntilIso(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function availabilityOf(tool: OwnedTool): Availability {
  if (tool.kind === "subscription") {
    const days = daysUntilIso(tool.renewalDate);
    if (days != null && days < 0) return { score: 0, label: `Renewal ${Math.abs(days)}d overdue — may have lapsed`, tone: "bad" };
    if (days != null && days <= 3) return { score: 3, label: `Ready now · renews in ${days}d`, tone: "warn" };
    if (tool.status === "Trial") return { score: 4, label: days != null ? `Free trial · ${days}d left` : "Free trial", tone: "warn" };
    if (tool.status === "Paused") return { score: 0, label: "Paused", tone: "bad" };
    return { score: 6, label: "Ready now · paid plan", tone: "good" };
  }
  if (tool.accountType === "paid") return { score: 5, label: "Ready now · paid account", tone: "good" };
  const credits = tool.credits ? ` · ${tool.credits}` : "";
  return { score: tool.credits ? 4 : 3, label: `Free account${credits}`, tone: "good" };
}

/** Which capabilities does this task need, in the order they're typically used? */
export function matchTask(task: string): CapabilityId[] {
  const text = task.toLowerCase();
  const scored = CAPABILITIES.map((cap) => ({
    id: cap.id,
    score: cap.taskWords.reduce((sum, word) => (text.includes(word) ? sum + (word.length >= 4 ? 2 : 1) : sum), 0),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.id);
  return scored.length ? scored : ["chat"];
}

// How well a tool fits a capability: being the tool's main strength matters most,
// then whether it is usable right now (so a free specialist beats a paid generalist).
const SPECIALIST_BONUS = [12, 6, 3, 1];
export function fitScore(tool: OwnedTool, capability: CapabilityId): number {
  const rank = Math.max(tool.capabilities.indexOf(capability), 0);
  return availabilityOf(tool).score * 2 + SPECIALIST_BONUS[Math.min(rank, SPECIALIST_BONUS.length - 1)];
}

export type ToolPick = {
  tool: OwnedTool;
  capability: Capability;
  availability: Availability;
  score: number;
};

export type TaskPlan = {
  needs: Capability[];
  picks: ToolPick[];
  /** Needed capabilities none of the user's tools cover. */
  gaps: Capability[];
};

export function rankToolsForTask(task: string, tools: OwnedTool[]): TaskPlan {
  const needs = matchTask(task).map((id) => CAPABILITY_BY_ID[id]);
  const picks: ToolPick[] = [];
  const gaps: Capability[] = [];
  const seen = new Set<string>();

  for (const need of needs) {
    const candidates = tools
      .filter((t) => t.capabilities.includes(need.id))
      .map((tool) => ({ tool, capability: need, availability: availabilityOf(tool), score: fitScore(tool, need.id) }))
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) {
      gaps.push(need);
      continue;
    }
    // Best usable tools first; one lapsed/paused tool is still shown (last) so the user
    // knows it exists but may need renewing.
    const usable = candidates.filter((c) => c.availability.tone !== "bad").slice(0, 3);
    const stale = candidates.filter((c) => c.availability.tone === "bad").slice(0, 1);
    for (const c of [...usable, ...stale]) {
      const key = `${c.tool.kind}:${c.tool.id}:${need.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        picks.push(c);
      }
    }
  }
  return { needs, picks, gaps };
}

// ---------- "Use together" workflows (Brain) ----------

export type WorkflowStep = { capability: Capability; tool: OwnedTool | null; action: string };
export type Workflow = { id: string; title: string; summary: string; steps: WorkflowStep[] };

const WORKFLOW_TEMPLATES: { id: string; title: string; summary: string; steps: [CapabilityId, string][] }[] = [
  {
    id: "video-ad",
    title: "Idea → finished video",
    summary: "Script it, generate visuals, animate, then add voice.",
    steps: [
      ["chat", "Write the script and shot list"],
      ["image", "Generate keyframes / storyboard stills"],
      ["video", "Animate the stills into clips"],
      ["audio", "Add voiceover or music"],
    ],
  },
  {
    id: "ship-app",
    title: "Idea → shipped app",
    summary: "Plan with chat, build in your editor, polish the UI.",
    steps: [
      ["chat", "Turn the idea into a spec and task list"],
      ["coding", "Build and iterate in your coding tool"],
      ["design", "Design/polish the screens and assets"],
      ["storage", "Host, back up, and share"],
    ],
  },
  {
    id: "brand-kit",
    title: "Brand & social content",
    summary: "Concepts from chat, visuals from image tools, layout in design.",
    steps: [
      ["chat", "Draft captions and campaign ideas"],
      ["image", "Generate hero images"],
      ["design", "Lay out posts, carousels and thumbnails"],
    ],
  },
  {
    id: "deep-research",
    title: "Research → write-up",
    summary: "Gather cited sources, then draft and organise.",
    steps: [
      ["research", "Collect and verify sources"],
      ["chat", "Summarise and draft the write-up"],
      ["productivity", "File notes and tasks"],
    ],
  },
  {
    id: "auto-pipeline",
    title: "Automate the boring parts",
    summary: "Let an automation tool call your AI and storage tools.",
    steps: [
      ["automation", "Trigger the workflow on a schedule or event"],
      ["chat", "Use AI to process or summarise results"],
      ["storage", "Save outputs where you can find them"],
    ],
  },
];

function bestFor(capability: CapabilityId, tools: OwnedTool[]): OwnedTool | null {
  const candidates = tools
    .filter((t) => t.capabilities.includes(capability) && availabilityOf(t).tone !== "bad")
    .sort((a, b) => fitScore(b, capability) - fitScore(a, capability));
  return candidates[0] ?? null;
}

/** Only workflows where the user already owns at least two of the needed capabilities. */
export function suggestWorkflows(tools: OwnedTool[]): Workflow[] {
  return WORKFLOW_TEMPLATES.map((tpl) => {
    const steps: WorkflowStep[] = tpl.steps.map(([capId, action]) => ({
      capability: CAPABILITY_BY_ID[capId],
      tool: bestFor(capId, tools),
      action,
    }));
    return { id: tpl.id, title: tpl.title, summary: tpl.summary, steps };
  })
    .filter((wf) => wf.steps.filter((s) => s.tool).length >= 2)
    .sort((a, b) => b.steps.filter((s) => s.tool).length - a.steps.filter((s) => s.tool).length);
}
