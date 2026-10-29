import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDeviceAi } from "@/src/lib/ai-client";
import { createLocalApi } from "@/src/lib/local-repository";
import { mergePersonalWorkbook } from "@/src/lib/personal-import";
import { createLocalDb } from "@/src/lib/local-db";

const localApi = createLocalApi({
  db: createLocalDb({
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  }, mergePersonalWorkbook),
  ai: createDeviceAi(),
});

export const api = localApi;

export const useInsights = () => useQuery({ queryKey: ["insights"], queryFn: api.insights });
export const useSubscriptions = (status?: string, category?: string) =>
  useQuery({ queryKey: ["subscriptions", status, category], queryFn: () => api.subscriptions(status, category) });
export const useSubscription = (id: string) =>
  useQuery({ queryKey: ["subscription", id], queryFn: () => api.subscription(id), enabled: !!id });
export const useAccounts = (category?: string) =>
  useQuery({ queryKey: ["accounts", category], queryFn: () => api.accounts(category) });
export const useAccount = (id: string) =>
  useQuery({ queryKey: ["account", id], queryFn: () => api.account(id), enabled: !!id });
export const useAccountSubscriptions = (accountId: string) =>
  useQuery({ queryKey: ["accountSubscriptions", accountId], queryFn: () => api.accountSubscriptions(accountId), enabled: !!accountId });
export const useInbox = (tab: string) => useQuery({ queryKey: ["inbox", tab], queryFn: () => api.inbox(tab) });
export const useLinks = (source?: string) => useQuery({ queryKey: ["links", source], queryFn: () => api.links(source) });
export const useLink = (id: string) => useQuery({ queryKey: ["link", id], queryFn: () => api.link(id), enabled: !!id });
export const useWatchlist = () => useQuery({ queryKey: ["watchlist"], queryFn: api.watchlist });
export const usePlan = (id: string) => useQuery({ queryKey: ["plan", id], queryFn: () => api.plan(id), enabled: !!id });
export const useReminders = () => useQuery({ queryKey: ["reminders"], queryFn: api.reminders });
export const usePromos = () => useQuery({ queryKey: ["promos"], queryFn: api.promos });
export const useGraph = () => useQuery({ queryKey: ["graph"], queryFn: api.graph });
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: api.settings });
export const usePrompts = (category?: string, query?: string) =>
  useQuery({ queryKey: ["prompts", category, query], queryFn: () => api.prompts(category, query) });
export const usePrompt = (id: string) =>
  useQuery({ queryKey: ["prompt", id], queryFn: () => api.prompt(id), enabled: !!id });

import { syncUpcomingWidget } from "@/src/widgets/task-handler";

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    ["insights", "subscriptions", "subscription", "accounts", "account", "accountSubscriptions", "inbox", "links", "link", "watchlist", "plan", "reminders", "promos", "graph", "prompts", "prompt"].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
    syncUpcomingWidget().catch(() => {});
  }, [queryClient]);
}
