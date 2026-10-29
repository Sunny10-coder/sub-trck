import { Platform } from "react-native";

import { DEVICE_GEMINI_SEED } from "@/src/lib/device-ai-seed";
import { storage } from "@/src/utils/storage";

export type ClientConfig = {
  displayName: string;
  geminiApiKey: string;
  nvidiaApiKey: string;
  openAiApiKey: string;
};

const KEYS = {
  displayName: "profile.displayName",
  geminiApiKey: "profile.geminiApiKey",
  nvidiaApiKey: "profile.nvidiaApiKey",
  openAiApiKey: "profile.openAiApiKey",
} as const;

let cachedConfig: ClientConfig | null = null;
let webSessionSecrets = {
  geminiApiKey: "",
  nvidiaApiKey: "",
  openAiApiKey: "",
};

export const secretsPersistOnThisPlatform = Platform.OS !== "web";

async function loadNativeSecrets() {
  const [geminiApiKey, nvidiaApiKey, openAiApiKey] = await Promise.all([
    storage.secureGet(KEYS.geminiApiKey, ""),
    storage.secureGet(KEYS.nvidiaApiKey, ""),
    storage.secureGet(KEYS.openAiApiKey, ""),
  ]);
  return {
    geminiApiKey: geminiApiKey || "",
    nvidiaApiKey: nvidiaApiKey || "",
    openAiApiKey: openAiApiKey || "",
  };
}

function bundledGeminiSeed(): string {
  return (process.env.EXPO_PUBLIC_GEMINI_API_KEY || DEVICE_GEMINI_SEED || "").trim();
}

export async function loadClientConfig(options?: { refresh?: boolean }): Promise<ClientConfig> {
  if (cachedConfig && !options?.refresh) return cachedConfig;
  const [displayName, secrets] = await Promise.all([
    storage.getItem(KEYS.displayName, ""),
    Platform.OS === "web" ? Promise.resolve(webSessionSecrets) : loadNativeSecrets(),
  ]);
  let geminiApiKey = secrets.geminiApiKey || "";
  const seed = bundledGeminiSeed();
  if (!geminiApiKey && seed) {
    geminiApiKey = seed;
    if (Platform.OS === "web") {
      webSessionSecrets = { ...webSessionSecrets, geminiApiKey: seed };
    } else {
      await writeNativeSecret(KEYS.geminiApiKey, seed);
    }
  }
  cachedConfig = {
    displayName: displayName || "",
    geminiApiKey,
    nvidiaApiKey: secrets.nvidiaApiKey || "",
    openAiApiKey: secrets.openAiApiKey || "",
  };
  return cachedConfig;
}

async function writeNativeSecret(key: string, value: string): Promise<boolean> {
  return value ? storage.secureSet(key, value) : storage.secureRemove(key);
}

export async function saveClientConfig(input: ClientConfig): Promise<ClientConfig> {
  const config: ClientConfig = {
    displayName: input.displayName.trim(),
    geminiApiKey: input.geminiApiKey.trim(),
    nvidiaApiKey: input.nvidiaApiKey.trim(),
    openAiApiKey: input.openAiApiKey.trim(),
  };

  const publicWrite = await storage.setItem(KEYS.displayName, config.displayName);
  let secretWrites = [true, true, true];
  if (Platform.OS === "web") {
    webSessionSecrets = {
      geminiApiKey: config.geminiApiKey,
      nvidiaApiKey: config.nvidiaApiKey,
      openAiApiKey: config.openAiApiKey,
    };
  } else {
    secretWrites = await Promise.all([
      writeNativeSecret(KEYS.geminiApiKey, config.geminiApiKey),
      writeNativeSecret(KEYS.nvidiaApiKey, config.nvidiaApiKey),
      writeNativeSecret(KEYS.openAiApiKey, config.openAiApiKey),
    ]);
  }
  if (![publicWrite, ...secretWrites].every(Boolean)) {
    throw new Error("Some profile values could not be saved on this device.");
  }
  cachedConfig = config;
  return config;
}
