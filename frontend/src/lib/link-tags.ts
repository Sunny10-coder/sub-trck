// Topic tagging for saved links (Instagram, GitHub, YouTube, websites...).
// AI tags are preferred; platform signals (GitHub topics, Instagram hashtags) and
// a keyword fallback guarantee that every link ends up searchable even when no
// AI key is configured or the page is behind a login wall.

import { CAPABILITIES } from "./capabilities";

const MAX_TAGS = 8;

const STOPWORDS = new Set(
  "the a an and or of for to in on with from by at is are was be this that these those it its your you our their how what why when best new top free using use via vs into about more most just can will not all any one two get make made like http https www com org net io app html page post video reel instagram github youtube".split(" "),
);

export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 28);
}

export function mergeTags(...groups: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group || []) {
      const tag = normalizeTag(String(raw));
      if (tag.length < 2 || STOPWORDS.has(tag) || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
      if (out.length >= MAX_TAGS) return out;
    }
  }
  return out;
}

export function hashtagsIn(text: string): string[] {
  return (text.match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map((h) => h.slice(1));
}

export function githubRepoOf(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, "") };
}

/** Capability labels + frequent meaningful words, derived without any network call. */
export function heuristicTags(text: string): string[] {
  const hay = text.toLowerCase();
  const tags: string[] = [];

  for (const cap of CAPABILITIES) {
    if (cap.id === "other") continue;
    if (cap.keywords.some((kw) => kw.length > 3 && hay.includes(kw))) tags.push(cap.label.split(/[ &]/)[0]);
  }

  const topics: [RegExp, string][] = [
    [/\b(ai|artificial intelligence|llm|gpt|machine learning)\b/, "ai"],
    [/\b(agent|agents|agentic)\b/, "ai-agents"],
    [/\b(rag|vector|embedding)s?\b/, "rag"],
    [/\b(react native|expo)\b/, "react-native"],
    [/\b(react|next\.?js)\b/, "react"],
    [/\b(python|pytorch|numpy)\b/, "python"],
    [/\b(typescript|javascript|node\.?js)\b/, "javascript"],
    [/\b(open[- ]?source)\b/, "open-source"],
    [/\b(prompt|prompts)\b/, "prompts"],
    [/\b(tutorial|guide|course|learn)\b/, "tutorial"],
    [/\b(free|discount|promo|coupon|deal|offer)\b/, "deal"],
    [/\b(scraper|scraping|crawler)\b/, "scraping"],
    [/\b(automation|workflow|n8n|zapier)\b/, "automation"],
    [/\b(ui|ux|design system|figma)\b/, "design"],
    [/\b(startup|saas|indie hacker|side project)\b/, "startup"],
  ];
  for (const [re, tag] of topics) if (re.test(hay)) tags.push(tag);

  const counts = new Map<string, number>();
  for (const word of hay.match(/[a-z][a-z0-9+#.-]{3,}/g) || []) {
    if (STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  const frequent = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);

  return [...tags, ...frequent];
}

export type GithubMeta = { topics: string[]; language: string; description: string };

export async function fetchGithubMeta(url: string, fetchImpl: typeof fetch = fetch): Promise<GithubMeta | null> {
  const repo = githubRepoOf(url);
  if (!repo) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { topics?: string[]; language?: string | null; description?: string | null };
    return {
      topics: Array.isArray(json.topics) ? json.topics : [],
      language: json.language || "",
      description: json.description || "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type TagInput = {
  url: string;
  source: string;
  title: string;
  description: string;
  text: string;
  note: string;
  aiTags: string[];
  github: GithubMeta | null;
};

/** AI tags first (they understand context), then platform signals, then heuristics. */
export function buildTopicTags(input: TagInput): string[] {
  const corpus = [input.title, input.description, input.note, input.github?.description || "", input.text.slice(0, 1500)].join(" ");
  const platform = input.source && !/^(other|website|share|shared)$/i.test(input.source) ? [input.source] : [];
  return mergeTags(
    input.aiTags,
    input.github?.topics,
    input.github?.language ? [input.github.language] : [],
    hashtagsIn(`${input.note} ${input.description} ${input.text.slice(0, 1500)}`),
    heuristicTags(corpus),
    platform,
  );
}

export function tagMatches(link: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (!q) return true;
  const tags = Array.isArray(link.tags) ? (link.tags as unknown[]).map((t) => String(t).toLowerCase()) : [];
  const hay = `${link.title || ""} ${link.summary || ""} ${link.note || ""} ${link.url || ""} ${link.category || ""} ${link.source || ""}`.toLowerCase();
  return tags.some((t) => t.includes(q)) || hay.includes(q);
}
