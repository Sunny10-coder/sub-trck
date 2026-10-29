import type { AgentChatResult } from "./agent-tools";
import type { Extraction } from "./local-models";

export type LinkMetadata = {
  title: string;
  thumbnail: string | null;
  description: string;
  text: string;
};

export type AiPort = {
  extract(input: { text?: string; imageBase64?: string; sourceType: string }): Promise<Extraction>;
  chat(question: string, context: string): Promise<AgentChatResult>;
  extractMany(text: string): Promise<Record<string, any>[]>;
  compare(items: Record<string, unknown>[]): Promise<string>;
  transcribe(uri: string): Promise<string>;
  fetchMetadata(url: string): Promise<LinkMetadata>;
  /** Plain text completion (no tools). Used for tool recommendations and workflow tips. */
  complete?(system: string, prompt: string): Promise<string>;
  /** Short lowercase topic tags for a saved link. Returns [] when no AI is configured. */
  tagLink?(input: { url: string; title: string; text: string }): Promise<string[]>;
};
