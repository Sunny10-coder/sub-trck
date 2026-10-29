import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "./_layout";
import {
  AvatarCircle,
  BrandMark,
  Card,
  CategoryDot,
  ChipRow,
  EmptyState,
  Icon,
  Loading,
  PrimaryButton,
  SearchField,
  StatTileRow,
} from "@/src/components/ui";
import { api, useInsights, useInvalidateAll, useSubscriptions, useWatchlist } from "@/src/lib/api";
import { CATEGORIES, daysLeftLabel, daysUntil, money, relativeDate } from "@/src/lib/format";
import { monthlyCost } from "@/src/lib/local-insights";
import { exportAndShare } from "@/src/lib/share-export";
import { categoryHue, makeStyles, useTheme } from "@/src/theme";

const SEGMENTS = ["Subscriptions", "Watchlist"] as const;
type Segment = (typeof SEGMENTS)[number];

const STATUS_FILTERS = ["All", "Active", "Trial", "Due soon", "Needs date", "Review"] as const;
const SORTS = [
  { label: "Soonest", value: "soon", icon: "calendar-clock" },
  { label: "Price ↓", value: "price", icon: "cash" },
  { label: "A–Z", value: "az", icon: "sort-alphabetical-ascending" },
  { label: "Newest", value: "new", icon: "clock-plus-outline" },
];

const expiryOf = (s: any): string | null => s.renewal_date || s.trial_end || null;
const fill = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export default function Subscriptions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidateAll();

  const [segment, setSegment] = useState<Segment>("Subscriptions");
  const [status, setStatus] = useState<string>("All");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("soon");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const subsQuery = useSubscriptions();
  const watchQuery = useWatchlist();
  const insights = useInsights();

  const convertPlan = useMutation({ mutationFn: (id: string) => api.convertPlan(id), onSuccess: invalidate });
  const moveToAccount = useMutation({
    mutationFn: (id: string) => api.moveSubscriptionToAccount(id),
    onSuccess: invalidate,
  });

  const subs = subsQuery.data || [];
  const watch = watchQuery.data || [];
  const missing = subs.filter((s: any) => !expiryOf(s));

  const usedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    subs.forEach((s: any) => counts.set(s.category || "Other", (counts.get(s.category || "Other") || 0) + 1));
    return CATEGORIES.filter((c) => counts.has(c)).map((c) => ({
      label: c,
      value: c,
      tone: categoryHue(c),
      count: counts.get(c),
    }));
  }, [subs]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = subs.filter((s: any) => {
      const days = daysUntil(expiryOf(s));
      if (status === "Review" && s.status !== "Unknown" && !/confirmation|review/i.test(s.review_status || "")) return false;
      if (status === "Active" && s.status !== "Active") return false;
      if (status === "Trial" && s.status !== "Trial") return false;
      if (status === "Due soon" && !(days != null && days <= 7)) return false;
      if (status === "Needs date" && expiryOf(s)) return false;
      if (category !== "All" && (s.category || "Other") !== category) return false;
      if (q && ![s.provider, s.product, s.plan, s.category, s.notes].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
    const by: Record<string, (a: any, b: any) => number> = {
      soon: (a, b) => (daysUntil(expiryOf(a)) ?? 99999) - (daysUntil(expiryOf(b)) ?? 99999),
      price: (a, b) => monthlyCost(b) - monthlyCost(a),
      az: (a, b) => String(a.provider).localeCompare(String(b.provider)),
      new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    };
    return [...list].sort(by[sort]);
  }, [subs, status, category, query, sort]);

  const filteredWatch = watch.filter(
    (p: any) =>
      !query.trim() ||
      [p.provider, p.plan, p.notes, (p.tags || []).join(" ")].some((v) => String(v || "").toLowerCase().includes(query.trim().toLowerCase())),
  );

  const confirmMove = (item: any) =>
    Alert.alert(
      `Move ${item.provider} to Accounts?`,
      "It will leave Subscriptions (and stop counting toward your spend) and be kept as an account.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Move", onPress: () => moveToAccount.mutate(item.id) },
      ],
    );

  const doExport = async () => {
    setExporting(true);
    try {
      await exportAndShare("plans");
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };

  const monthly = insights.data?.monthly_spend ?? 0;
  const stats = [
    { icon: "cash-multiple", value: money(monthly, insights.data?.currency || "AED"), label: "AED / month", tone: "brand" as const },
    { icon: "check-circle-outline", value: subs.filter((s: any) => s.status === "Active").length, label: "Active", tone: "success" as const },
    { icon: "clock-outline", value: subs.filter((s: any) => s.status === "Trial").length, label: "Trials", tone: "purple" as const },
    { icon: "alert-circle-outline", value: missing.length, label: "No date", tone: "warning" as const },
    { icon: "eye-outline", value: watch.length, label: "Watching", tone: "info" as const },
  ];

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <View style={styles.topRow}>
        <BrandMark compact />
        <View style={styles.topRight}>
          <Pressable onPress={() => router.push("/graph")} style={styles.circleBtn} hitSlop={8} testID="subs-brain-btn">
            <Icon name="graph-outline" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Pressable onPress={doExport} style={styles.circleBtn} hitSlop={8} testID="subs-export">
            <Icon name={exporting ? "progress-clock" : "microsoft-excel"} size={20} color={colors.success} />
          </Pressable>
          <AvatarCircle size={38} />
        </View>
      </View>

      <View>
        <Text style={styles.pageTitle}>Subscriptions</Text>
        <Text style={styles.pageSubtitle}>Paid plans & trials. Accounts live in their own tab.</Text>
      </View>

      <StatTileRow items={stats} />

      {missing.length > 0 ? (
        <Card style={styles.nudge}>
          <View style={styles.nudgeHead}>
            <View style={styles.nudgeIcon}>
              <Icon name="calendar-alert" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>
                {missing.length} subscription{missing.length > 1 ? "s" : ""} missing an expiry date
              </Text>
              <Text style={styles.nudgeSub}>Add the date to get renewal alerts, or move it to Accounts.</Text>
            </View>
          </View>
          {missing.slice(0, 3).map((s: any) => (
            <View key={s.id} style={styles.nudgeRow}>
              <Text style={styles.nudgeName} numberOfLines={1}>
                {s.provider}
              </Text>
              <Pressable style={styles.nudgeBtn} onPress={() => router.push(`/add-subscription?id=${s.id}` as any)}>
                <Icon name="calendar-plus" size={14} color={colors.brandPrimary} />
                <Text style={styles.nudgeBtnText}>Add date</Text>
              </Pressable>
              <Pressable style={[styles.nudgeBtn, { backgroundColor: colors.pastelOrange }]} onPress={() => confirmMove(s)}>
                <Icon name="badge-account-outline" size={14} color={colors.warning} />
                <Text style={[styles.nudgeBtnText, { color: colors.warning }]}>To Accounts</Text>
              </Pressable>
            </View>
          ))}
          {missing.length > 3 ? (
            <Pressable onPress={() => setStatus("Needs date")}>
              <Text style={styles.nudgeMore}>Show all {missing.length} ›</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.segmented}>
        {SEGMENTS.map((seg) => {
          const active = segment === seg;
          return (
            <Pressable key={seg} style={[styles.segBtn, active && styles.segBtnActive]} onPress={() => setSegment(seg)}>
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {seg} ({seg === "Subscriptions" ? subs.length : watch.length})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SearchField value={query} onChangeText={setQuery} placeholder={segment === "Subscriptions" ? "Search name, plan, category…" : "Search plans, tags…"} />

      {segment === "Subscriptions" ? (
        <View style={{ gap: 8, marginHorizontal: -16 }}>
          <ChipRow
            items={STATUS_FILTERS.map((s) => ({ label: s, value: s, tone: s === "Needs date" ? colors.warning : undefined }))}
            value={status}
            onChange={setStatus}
          />
          {usedCategories.length > 1 ? (
            <ChipRow items={[{ label: "All categories", value: "All" }, ...usedCategories]} value={category} onChange={setCategory} />
          ) : null}
          <ChipRow items={SORTS} value={sort} onChange={setSort} />
        </View>
      ) : null}
    </View>
  );

  const listPad = { padding: 16, paddingTop: insets.top + 10, paddingBottom: TAB_BAR_SPACE + insets.bottom, gap: 12 };

  if (subsQuery.isLoading) return <Loading />;

  return (
    <View style={styles.container}>
      {segment === "Subscriptions" ? (
        <FlatList
          data={rows}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={listPad}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={subsQuery.isFetching} onRefresh={subsQuery.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title="No subscriptions match"
              message="Add a subscription, or clear the filters."
              action={<PrimaryButton title="Add subscription" icon="plus" onPress={() => router.push("/add-subscription")} />}
            />
          }
          renderItem={({ item }: { item: any }) => {
            const hue = categoryHue(item.category);
            const exp = expiryOf(item);
            const days = exp ? daysUntil(exp) : null;
            const urgent = days != null && days <= 3;
            return (
              <Pressable
                style={({ pressed }) => [styles.subCard, { borderColor: colors.border }, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/subscription/${item.id}`)}
                testID={`sub-${item.id}`}
              >
                <View style={[styles.accentBar, { backgroundColor: hue }]} />
                <CategoryDot category={item.category} provider={item.provider} size={46} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.provider} numberOfLines={1}>
                      {item.provider}
                    </Text>
                    <Text style={styles.price}>{money(item.price, item.currency)}</Text>
                  </View>
                  <Text style={styles.detail} numberOfLines={1}>
                    {item.plan ? `${item.plan} · ` : ""}
                    {item.category || "Service"}
                    {item.billing_cycle ? ` · ${item.billing_cycle}` : ""}
                  </Text>
                  <View style={styles.pillRow}>
                    {exp ? (
                      <View style={[styles.pill, { backgroundColor: urgent ? colors.pastelPeach : colors.pastelMint }]}>
                        <Icon name="clock-outline" size={12} color={urgent ? colors.error : colors.success} />
                        <Text style={[styles.pillText, { color: urgent ? colors.error : colors.success }]}>
                          {item.trial_end && !item.renewal_date ? "Trial · " : ""}
                          {daysLeftLabel(exp)}
                        </Text>
                      </View>
                    ) : (
                      <Pressable style={[styles.pill, { backgroundColor: colors.pastelOrange }]} onPress={() => router.push(`/add-subscription?id=${item.id}` as any)}>
                        <Icon name="calendar-alert" size={12} color={colors.warning} />
                        <Text style={[styles.pillText, { color: colors.warning }]}>Add expiry date</Text>
                      </Pressable>
                    )}
                    {item.status === "Unknown" ? <View style={[styles.pill, { backgroundColor: colors.pastelOrange }]}><Text style={[styles.pillText, { color: colors.warning }]}>Needs review</Text></View> : null}
                    {item.status === "Trial" ? (
                      <View style={[styles.pill, { backgroundColor: colors.pastelLavender }]}>
                        <Text style={[styles.pillText, { color: colors.brandPrimary }]}>Trial</Text>
                      </View>
                    ) : null}
                    {item.promo_applied ? (
                      <View style={[styles.pill, { backgroundColor: colors.pastelYellow }]}>
                        <Icon name="ticket-percent-outline" size={12} color={colors.accentYellow} />
                        <Text style={[styles.pillText, { color: colors.accentYellow }]}>{item.promo_applied}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredWatch}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={listPad}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {header}
              <Card style={styles.watchBanner} onPress={() => router.push("/compare")}>
                <Icon name="scale-balance" size={18} color={colors.brandPrimary} />
                <Text style={styles.watchBannerText}>Compare saved plans side by side</Text>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Card>
            </View>
          }
          refreshControl={<RefreshControl refreshing={watchQuery.isFetching} onRefresh={watchQuery.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              icon="layers-outline"
              title="No plans in watchlist"
              message="Save plan options or alternatives to compare before buying."
              action={<PrimaryButton title="Add plan" icon="plus" onPress={() => router.push("/add-plan")} />}
            />
          }
          renderItem={({ item }: { item: any }) => (
            <Card style={{ gap: 8 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.provider}>{item.provider}</Text>
                  <Text style={styles.detail}>{item.plan || "Target plan"}</Text>
                </View>
                <Text style={styles.price}>
                  {money(item.price, item.currency)}
                  <Text style={styles.detail}>/{item.billing_cycle || "mo"}</Text>
                </Text>
              </View>
              {item.tags?.length ? (
                <View style={styles.pillRow}>
                  {item.tags.slice(0, 4).map((t: string) => (
                    <View key={t} style={[styles.pill, { backgroundColor: colors.pastelBlue }]}>
                      <Text style={[styles.pillText, { color: colors.info }]}>#{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={[styles.rowBetween, { marginTop: 4 }]}>
                <Text style={styles.detail}>Added {relativeDate(item.created_at)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={styles.nudgeBtn} onPress={() => router.push(`/add-plan?id=${item.id}` as any)}>
                    <Icon name="pencil" size={14} color={colors.brandPrimary} />
                    <Text style={styles.nudgeBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable style={[styles.nudgeBtn, { backgroundColor: colors.pastelMint }]} onPress={() => convertPlan.mutate(item.id)}>
                    <Icon name="check" size={14} color={colors.success} />
                    <Text style={[styles.nudgeBtnText, { color: colors.success }]}>Subscribe</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  circleBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.glass, alignItems: "center",
    justifyContent: "center", borderWidth: 1.5, borderColor: colors.glassBorder,
  },
  pageTitle: { fontFamily: "Display", fontSize: 34, fontWeight: "400", color: colors.onSurface, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  segmented: {
    flexDirection: "row", backgroundColor: colors.glass, borderRadius: 10, padding: 4,
    borderWidth: 1.5, borderColor: colors.glassBorder,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  segBtnActive: { backgroundColor: colors.pastelYellow, borderWidth: 1.5, borderColor: colors.border },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segTextActive: { color: colors.brandPrimary, fontWeight: "800" },
  nudge: { gap: 10, borderColor: colors.warning + "88" },
  nudgeHead: { flexDirection: "row", gap: 12, alignItems: "center" },
  nudgeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.pastelOrange, alignItems: "center", justifyContent: "center" },
  nudgeTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  nudgeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  nudgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nudgeName: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  nudgeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.pastelLavender,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
  },
  nudgeBtnText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  nudgeMore: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  subCard: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingLeft: 18,
    backgroundColor: colors.glass, borderRadius: 10, borderWidth: 1.5, overflow: "hidden",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  provider: { fontSize: 16, fontWeight: "800", color: colors.onSurface, flexShrink: 1 },
  price: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  detail: { fontSize: 12, color: colors.muted },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "800" },
  watchBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 4 },
  watchBannerText: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "700" },
}));
