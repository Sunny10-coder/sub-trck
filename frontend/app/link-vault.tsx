import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AvatarCircle,
  BrandMark,
  ChipRow,
  EmptyState,
  Icon,
  Loading,
  SearchField,
} from "@/src/components/ui";
import {
  api,
  useInvalidateAll,
  useLinks,
  useReminders,
  useSubscriptions,
} from "@/src/lib/api";
import { formatDate } from "@/src/lib/format";
import { tagMatches } from "@/src/lib/link-tags";
import { makeStyles, useTheme } from "@/src/theme";

const FILTERS = [
  { label: "All", icon: "view-grid-outline", test: () => true },
  { label: "Instagram", icon: "instagram", test: (l: any) => /instagram/i.test(l.source || "") },
  { label: "Web", icon: "web", test: (l: any) => /website|web/i.test(l.source || "") },
  { label: "YouTube", icon: "youtube", test: (l: any) => /youtube/i.test(l.source || "") },
  {
    label: "Offers",
    icon: "tag-outline",
    test: (l: any) => /offer|promo|deal/i.test(`${l.category} ${l.tags?.join(" ")}`),
  },
  {
    label: "Research",
    icon: "flask-outline",
    test: (l: any) => /research|compar/i.test(`${l.category} ${l.tags?.join(" ")}`),
  },
];

function sourceIcon(source: string) {
  if (/instagram/i.test(source)) return "instagram";
  if (/youtube/i.test(source)) return "youtube";
  if (/github/i.test(source)) return "github";
  if (/reddit/i.test(source)) return "reddit";
  return "web";
}

export default function LinkVault() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const { data, isLoading, refetch } = useLinks();
  const reminders = useReminders();
  const subscriptions = useSubscriptions();
  const invalidate = useInvalidateAll();
  const archive = useMutation({
    mutationFn: (id: string) => api.updateLink(id, { archived: true }),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });

  const reminderByLink = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of reminders.data || []) {
      if (r.ref_type === "link" && r.ref_id) map[r.ref_id] = r.due_date;
    }
    return map;
  }, [reminders.data]);

  const activeFilter = FILTERS.find((f) => f.label === filter) || FILTERS[0];
  const rows = (data || []).filter((l: any) => !l.archived);
  const filtered = rows.filter(activeFilter.test).filter((l: any) => tagMatches(l, query));
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((l: any) => (l.tags || []).forEach((t: string) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [rows]);
  const withReminders = rows.filter((l: any) => reminderByLink[l.id]).length;
  const subscriptionPlans = (subscriptions.data || []).length;

  return (
    <View style={styles.container}>
      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            padding: 20,
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 30,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ marginBottom: 14 }}>
              <View style={styles.topRow}>
                <BrandMark compact />
                <View style={styles.topRight}>
                  <Pressable
                    onPress={() => router.push("/scan?target=link&mode=library" as any)}
                    hitSlop={8}
                    style={[styles.circleBtn, { backgroundColor: colors.pastelYellow }]}
                    testID="vault-screenshot-btn"
                  >
                    <Icon name="bookmark-box-multiple-outline" size={18} color={colors.accentOrange} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push("/search")}
                    hitSlop={8}
                    style={styles.circleBtn}
                  >
                    <Icon name="magnify" size={20} color={colors.onSurface} />
                  </Pressable>
                  <AvatarCircle size={38} />
                </View>
              </View>

              <Text style={styles.title}>Link Vault</Text>
              <Text style={styles.subtitle}>
                All your saved links & bookmarks, organized with AI.
              </Text>

              {/* Quick Actions Strip */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={() => router.push("/paste-link")}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      backgroundColor: colors.pastelBlue,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: colors.brandPrimary + "30",
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Icon name="link-variant" size={16} color={colors.brandPrimary} />
                  <Text style={{ color: colors.brandPrimary, fontSize: 13, fontWeight: "700" }}>
                    Paste Link
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/scan?target=link&mode=library" as any)}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      backgroundColor: colors.pastelYellow,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: colors.accentOrange + "35",
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Icon name="bookmark-box-multiple-outline" size={16} color={colors.accentOrange} />
                  <Text style={{ color: colors.accentOrange, fontSize: 13, fontWeight: "700" }}>
                    Scan Photo
                  </Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <SearchField value={query} onChangeText={setQuery} placeholder="Search links, topics or #tags…" testID="vault-search" />
                {topTags.length ? (
                  <View style={{ marginHorizontal: -20 }}>
                    <ChipRow
                      items={topTags.map(([t, n]) => ({ label: `#${t}`, value: `#${t}`, count: n }))}
                      value={query}
                      onChange={(v: string) => setQuery(query === v ? "" : v)}
                    />
                  </View>
                ) : null}
                <ChipRow
                  items={FILTERS.map((f) => f.label)}
                  value={filter}
                  onChange={setFilter}
                  testIDPrefix="link-filter"
                />
              </View>

              <View style={styles.insightStrip}>
                <Icon name="creation" size={16} color={colors.brandSecondary} />
                <Text style={styles.insightText}>
                  {rows.length} saved · {withReminders} with reminder · {subscriptionPlans} plans detected
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="link-variant"
              title="No links yet"
              message="Share links from Instagram, Chrome or YouTube — or paste one."
            />
          }
          renderItem={({ item }) => {
            const reminderDate = reminderByLink[item.id];
            const isAI = item.category === "AI Tools" || /\bai\b/i.test(item.category || "");

            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                testID={`link-${item.id}`}
                onPress={() => router.push(`/link/${item.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.sourcePill}>
                    <Icon name={sourceIcon(item.source || "")} size={13} color={colors.brandPrimary} />
                    <Text style={styles.cardSource} numberOfLines={1}>
                      {item.source || "Web"}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {item.created_at ? formatDate(item.created_at) : ""}
                  </Text>
                </View>

                <View style={styles.cardHeadRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {isAI ? (
                    <View style={styles.aiBadge}>
                      <Icon name="creation" size={11} color={colors.brandSecondary} />
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  ) : null}
                </View>

                {item.summary ? (
                  <Text style={styles.cardSummary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}

                <View style={styles.tagRow}>
                  {(item.tags || []).slice(0, 4).map((t: string) => (
                    <Text key={t} style={styles.tag} onPress={() => setQuery(`#${t}`)}>
                      #{t}
                    </Text>
                  ))}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => router.push(`/link/${item.id}` as any)}
                    style={styles.actionBtn}
                    testID={`link-open-${item.id}`}
                  >
                    <Icon name="open-in-new" size={14} color={colors.onSurface} />
                    <Text style={styles.actionText}>Open</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/add-account?service_name=${encodeURIComponent(
                          item.title || ""
                        )}&service_url=${encodeURIComponent(item.url || "")}&notes=${encodeURIComponent(
                          `Converted from Link: ${item.title}`
                        )}` as any
                      )
                    }
                    style={styles.actionBtn}
                    testID={`link-convert-${item.id}`}
                  >
                    <Icon name="shield-account-outline" size={14} color={colors.success} />
                    <Text style={[styles.actionText, { color: colors.success }]}>Account</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/add-reminder?title=${encodeURIComponent(
                          item.title
                        )}&ref_type=link&ref_id=${item.id}&return_to=/link-vault` as any
                      )
                    }
                    style={styles.actionBtn}
                    testID={`link-remind-${item.id}`}
                  >
                    <Icon
                      name="bell-outline"
                      size={14}
                      color={reminderDate ? colors.brandPrimary : colors.onSurface}
                    />
                    <Text
                      style={[
                        styles.actionText,
                        reminderDate && { color: colors.brandPrimary },
                      ]}
                    >
                      {reminderDate ? `Remind · ${formatDate(reminderDate)}` : "Remind"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => archive.mutate(item.id)}
                    style={styles.actionBtn}
                    testID={`link-archive-${item.id}`}
                  >
                    <Icon name="archive-outline" size={14} color={colors.muted} />
                    <Text style={[styles.actionText, { color: colors.muted }]}>Archive</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 14,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  insightStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.pastelLavender,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  insightText: {
    flex: 1,
    color: colors.brandSecondary,
    fontSize: 12,
    fontWeight: "600",
  },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.pastelBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardSource: {
    color: colors.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  cardDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  cardHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.pastelLavender,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brandSecondary,
  },
  cardSummary: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceTertiary,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
}));
