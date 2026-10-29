import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll, useWatchlist } from "@/src/lib/api";
import { daysUntil, money } from "@/src/lib/format";
import {
  AiCallout,
  AppHeader,
  Badge,
  Card,
  EmptyState,
  GradientHero,
  HeroStat,
  Icon,
  Loading,
  PrimaryButton,
} from "@/src/components/ui";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

export default function Watchlist() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch } = useWatchlist();
  const invalidate = useInvalidateAll();
  const [selected, setSelected] = useState<string[]>([]);
  const [dismissedTip, setDismissedTip] = useState(false);

  const convert = useMutation({
    mutationFn: (id: string) => api.convertPlan(id),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deletePlan(id),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));

  const rows = data || [];
  const expiringSoon = rows.filter(
    (r: any) => r.offer_expiry && (daysUntil(r.offer_expiry) ?? 999) <= 7 && (daysUntil(r.offer_expiry) ?? -1) >= 0,
  ).length;
  const priceDrops = rows.filter((r: any) => {
    const history = Array.isArray(r.price_history) ? r.price_history : [];
    const last = history[history.length - 1];
    return last && Number(last.price) > Number(r.price);
  }).length;

  const overlapProviders = useMemo(() => {
    const seen: Record<string, number> = {};
    for (const r of rows) {
      const cat = (r.category || "AI").toLowerCase();
      seen[cat] = (seen[cat] || 0) + 1;
    }
    const entry = Object.entries(seen).find(([, count]) => count > 1);
    return entry ? { category: entry[0], count: entry[1] } : null;
  }, [rows]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Plan Watchlist"
        subtitle="Track & compare upcoming plans"
        back
        right={
          <Pressable
            onPress={() => router.push("/add-plan")}
            style={styles.headerAddBtn}
            hitSlop={8}
          >
            <Icon name="plus" size={20} color={colors.brandPrimary} />
          </Pressable>
        }
      />
      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + (selected.length === 2 ? 100 : 40),
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ marginBottom: 12, gap: 12 }}>
              <GradientHero>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <HeroStat
                    icon="eye-outline"
                    value={rows.length}
                    label={`plan${rows.length === 1 ? "" : "s"} monitored`}
                    tone="#FFFFFF26"
                  />
                  <Pressable onPress={() => router.push("/insights")}>
                    <Text style={styles.heroLink}>See insights  ›</Text>
                  </Pressable>
                </View>
                <Text style={styles.heroCopy}>
                  We monitor price drops, special discounts, and renewals for you.
                </Text>
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroChip}>
                    <Icon name="clock-outline" size={13} color="#FFFFFF" />
                    <Text style={styles.heroChipText}>{expiringSoon} expiring soon</Text>
                  </View>
                  <View style={styles.heroChip}>
                    <Icon name="trending-down" size={13} color="#FFFFFF" />
                    <Text style={styles.heroChipText}>{priceDrops} price drop{priceDrops === 1 ? "" : "s"}</Text>
                  </View>
                  <View style={styles.heroChip}>
                    <Icon name="scale-balance" size={13} color="#FFFFFF" />
                    <Text style={styles.heroChipText}>{selected.length} to compare</Text>
                  </View>
                </View>
              </GradientHero>

              {overlapProviders && !dismissedTip ? (
                <AiCallout
                  title={`Overlap: ${overlapProviders.count} ${overlapProviders.category.toUpperCase()} plans`}
                  message="Consider comparing features side by side to avoid paying duplicate fees."
                  actionLabel="Compare plans"
                  onAction={() => router.push("/compare")}
                  onDismiss={() => setDismissedTip(true)}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="eye-outline"
              title="Nothing on watch"
              message="Save plans, trials, and offers here before you subscribe, then compare them side by side."
              action={
                <PrimaryButton
                  title="Add plan"
                  icon="plus"
                  onPress={() => router.push("/add-plan")}
                  style={{ marginTop: 8 }}
                />
              }
            />
          }
          renderItem={({ item, index }) => {
            const sel = selected.includes(item.id);
            const history = Array.isArray(item.price_history) ? item.price_history : [];
            const lastPrice = history[history.length - 1];
            const droppedFrom = lastPrice && Number(lastPrice.price) > Number(item.price) ? lastPrice.price : null;
            const expiringDays = item.offer_expiry ? daysUntil(item.offer_expiry) : null;
            const avatarBg = accentFor(colors, item.provider || index);

            return (
              <Card testID={`plan-${item.id}`} style={sel ? { borderColor: colors.brandPrimary, borderWidth: 1.5 } : undefined}>
                <View style={styles.top}>
                  <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                    <Icon name="eye-check" size={20} color={colors.onAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.provider}</Text>
                    <Text style={styles.plan}>{item.plan || "Plan"} · {item.billing_cycle}</Text>
                    {item.url ? (
                      <Text style={styles.source} numberOfLines={1}>
                        {item.url.replace(/^https?:\/\/(www\.)?/i, "")}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.price}>{money(item.price, item.currency)}</Text>
                    <Badge label={item.status || "Watching"} tone={item.status === "Subscribed" ? "success" : "muted"} />
                  </View>
                </View>

                {droppedFrom || (expiringDays !== null && expiringDays >= 0 && expiringDays <= 7) ? (
                  <View style={styles.badgeRow}>
                    {droppedFrom ? (
                      <View style={[styles.flagBadge, { backgroundColor: colors.pastelMint }]}>
                        <Icon name="trending-down" size={12} color={colors.success} />
                        <Text style={[styles.flagText, { color: colors.success }]}>
                          Was {money(droppedFrom, item.currency)}, now {money(item.price, item.currency)}
                        </Text>
                      </View>
                    ) : null}
                    {expiringDays !== null && expiringDays >= 0 && expiringDays <= 7 ? (
                      <View style={[styles.flagBadge, { backgroundColor: colors.pastelPink }]}>
                        <Icon name="clock-alert-outline" size={12} color={colors.error} />
                        <Text style={[styles.flagText, { color: colors.error }]}>
                          {expiringDays === 0 ? "Offer ends today" : `Offer ends in ${expiringDays}d`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    onPress={() => toggle(item.id)}
                    testID={`compare-${item.id}`}
                    style={[styles.act, sel && { backgroundColor: colors.brandPrimary }]}
                  >
                    <Icon
                      name={sel ? "check" : "scale-balance"}
                      size={14}
                      color={sel ? colors.onBrandPrimary : colors.brandPrimary}
                    />
                    <Text style={[styles.actText, sel && { color: colors.onBrandPrimary }]}>
                      {sel ? "Selected" : "Compare"}
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => router.push(`/add-plan?id=${item.id}` as any)} style={styles.act}>
                    <Icon name="pencil-outline" size={14} color={colors.onSurfaceSecondary} />
                    <Text style={styles.actText}>Edit</Text>
                  </Pressable>

                  <Pressable onPress={() => convert.mutate(item.id)} style={[styles.act, { backgroundColor: colors.pastelLavender }]}>
                    <Icon name="arrow-up-bold-box-outline" size={14} color={colors.brandSecondary} />
                    <Text style={[styles.actText, { color: colors.brandSecondary }]}>Subscribe</Text>
                  </Pressable>

                  <Pressable onPress={() => del.mutate(item.id)} style={[styles.act, styles.deleteAct]}>
                    <Icon name="trash-can-outline" size={14} color={colors.muted} />
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}
      {selected.length === 2 ? (
        <View style={[styles.floating, { bottom: insets.bottom + 20 }]}>
          <PrimaryButton
            title="Compare 2 plans"
            icon="scale-balance"
            onPress={() => router.push(`/compare?ids=${selected.join(",")}`)}
            testID="do-compare"
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.pastelBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLink: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  heroCopy: { color: "#FFFFFFD9", fontSize: 13, marginTop: 6, lineHeight: 18 },
  heroStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF26",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  heroChipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  plan: { color: colors.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  source: { color: colors.brandPrimary, fontSize: 11, marginTop: 2, fontWeight: "600" },
  price: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  flagBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  flagText: { fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  act: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteAct: {
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceTertiary,
  },
  actText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceSecondary },
  floating: {
    position: "absolute",
    left: 20,
    right: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },
}));
