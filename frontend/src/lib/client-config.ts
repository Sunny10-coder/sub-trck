import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

export type ClientConfig = {
  displayName: string;
  backendUrl: string;
  backendToken: string;
  geminiApiKey: string;
  openAiApiKey: string;
};

const KEYS = {
  displayName: "profile.displayName",
  backendUrl: "profile.backendUrl",
  backendToken: "profile.backendToken",
  geminiApiKey: "profile.geminiApiKey",
  openAiApiKey: "profile.openAiApiKey",
} as const;

const buildDefaultBackendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || "").trim();
let cachedConfig: ClientConfig | null = null;
let webSessionSecrets = {
  backendToken: "",
  geminiApiKey: "",
  openAiApiKey: "",
};

export const secretsPersistOnThisPlatform = Platform.OS !== "web";

export function normalizeBackendUrl(value: string): string {
  let candidate = value.trim().replace(/\/+$/, "");
  if (candidate.toLowerCase().endsWith("/api")) candidate = candidate.slice(0, -4);
  if (!candidate) throw new Error("Enter your backend URL first.");

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Use a complete URL such as https://api.example.com.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("The backend URL must use http:// or https://.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("The backend URL cannot contain credentials, a query, or a fragment.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export function isHttpsBackend(value: string): boolean {
  try {
    return normalizeBackendUrl(value).startsWith("https://");
  } catch {
    return false;
  }
}

async function loadNativeSecrets() {
  const [backendToken, geminiApiKey, openAiApiKey] = await Promise.all([
    storage.secureGet(KEYS.backendToken, ""),
    storage.secureGet(KEYS.geminiApiKey, ""),
    storage.secureGet(KEYS.openAiApiKey, ""),
  ]);
  return {
    backendToken: backendToken || "",
    geminiApiKey: geminiApiKey || "",
    openAiApiKey: openAiApiKey || "",
  };
}

export async function loadClientConfig(options?: { refresh?: boolean }): Promise<ClientConfig> {
  if (cachedConfig && !options?.refresh) return cachedConfig;
  const [displayName, storedBackendUrl, secrets] = await Promise.all([
    storage.getItem(KEYS.displayName, ""),
    storage.getItem(KEYS.backendUrl, ""),
    Platform.OS === "web" ? Promise.resolve(webSessionSecrets) : loadNativeSecrets(),
  ]);
  cachedConfig = {
    displayName: displayName || "",
    backendUrl: storedBackendUrl || buildDefaultBackendUrl,
    ...secrets,
  };
  return cachedConfig;
}

async function writeNativeSecret(key: string, value: string): Promise<boolean> {
  return value ? storage.secureSet(key, value) : storage.secureRemove(key);
}

export async function saveClientConfig(input: ClientConfig): Promise<ClientConfig> {
  const config: ClientConfig = {
    displayName: input.displayName.trim(),
    backendUrl: normalizeBackendUrl(input.backendUrl),
    backendToken: input.backendToken.trim(),
    geminiApiKey: input.geminiApiKey.trim(),
    openAiApiKey: input.openAiApiKey.trim(),
  };

  const publicWrites = await Promise.all([
    storage.setItem(KEYS.displayName, config.displayName),
    storage.setItem(KEYS.backendUrl, config.backendUrl),
  ]);
  let secretWrites = [true, true, true];
  if (Platform.OS === "web") {
    webSessionSecrets = {
      backendToken: config.backendToken,
      geminiApiKey: config.geminiApiKey,
      openAiApiKey: config.openAiApiKey,
    };
  } else {
    secretWrites = await Promise.all([
      writeNativeSecret(KEYS.backendToken, config.backendToken),
      writeNativeSecret(KEYS.geminiApiKey, config.geminiApiKey),
      writeNativeSecret(KEYS.openAiApiKey, config.openAiApiKey),
    ]);
  }
  if (![...publicWrites, ...secretWrites].every(Boolean)) {
    throw new Error("Some profile values could not be saved on this device.");
  }
  cachedConfig = config;
  return config;
}

function accessHeaders(config: ClientConfig): Record<string, string> {
  return config.backendToken ? { Authorization: `Bearer ${config.backendToken}` } : {};
}

export async function testBackendConnection(input: ClientConfig): Promise<string> {
  const backendUrl = normalizeBackendUrl(input.backendUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${backendUrl}/api/`, {
      headers: accessHeaders(input),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Backend returned ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const body = await response.json();
    if (body?.app !== "SubMind") throw new Error("This URL did not return a SubMind API response.");
    return `Connected to ${backendUrl}`;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Connection timed out after 10 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
