import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { useInsights, useSubscriptions } from "@/src/lib/api";
import { daysUntil, money } from "@/src/lib/format";
import { activeRows } from "@/src/lib/local-models";
import { monthlyCost } from "@/src/lib/local-insights";
import { AiCallout, AppHeader, AvatarCircle, BrandMark, Card, GradientHero, Icon, Loading } from "@/src/components/ui";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

const DONUT_SIZE = 120;
const DONUT_STROKE = 18;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

export default function Insights() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useInsights();
  const subscriptions = useSubscriptions();
  const [dismissedTip, setDismissedTip] = useState(false);

  const overlapDetail = useMemo(() => {
    const active = activeRows(subscriptions.data || []).filter((s: any) => s.status === "Active" || s.status === "Trial");
    const byCategory: Record<string, any[]> = {};
    for (const s of active) {
      const cat = s.category || "Other";
      byCategory[cat] = [...(byCategory[cat] || []), s];
    }
    let savings = 0;
    let overlappingGroups = 0;
    for (const rows of Object.values(byCategory)) {
      if (rows.length < 2) continue;
      overlappingGroups += 1;
      const costs = rows.map((r) => monthlyCost(r)).sort((a, b) => b - a);
      savings += costs.slice(1).reduce((sum, c) => sum + c, 0);
    }
    return { savings: Math.round(savings * 100) / 100, overlappingGroups };
  }, [subscriptions.data]);

  if (isLoading || !data) return <View style={styles.container}><AppHeader title="Insights" back /><Loading /></View>;
  const cur = data.currency;
  const categories = data.category_breakdown || [];
  const total = categories.reduce((sum: number, c: any) => sum + c.amount, 0) || 1;

  const segments = categories.slice(0, 5).reduce((acc: any[], c: any, i: number) => {
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    const pct = c.amount / total;
    acc.push({ ...c, pct, color: accentFor(colors, c.category || i), offset: prevOffset });
    return acc;
  }, []);

  const weekBuckets = [0, 0, 0, 0];
  for (const r of data.renewals_30d || []) {
    const d = daysUntil(r.date) ?? 0;
    const idx = Math.min(3, Math.floor(d / 7));
    weekBuckets[idx] += 1;
  }
  const maxBucket = Math.max(...weekBuckets, 1);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <BrandMark />
          <AvatarCircle />
        </View>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Understand your spending. Make smarter choices.</Text>

        <GradientHero>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Your spend this month</Text>
              <Text style={styles.heroValue}>{money(data.monthly_spend, cur)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={{ flex: 1, paddingLeft: 14 }}>
              <Text style={styles.heroLabel}>Yearly total</Text>
              <Text style={styles.heroValue}>{money(data.yearly_spend, cur)}</Text>
            </View>
          </View>
        </GradientHero>

        <View style={styles.twoCol}>
          <Card style={{ flex: 1 }}>
            <View style={styles.sectionHeadRow}>
              <Icon name="chart-donut" size={16} color={colors.brandPrimary} />
              <Text style={styles.h}>Spending by category</Text>
            </View>
            {segments.length ? (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <View style={{ width: DONUT_SIZE, height: DONUT_SIZE, alignItems: "center", justifyContent: "center" }}>
                  <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
                    <Circle cx={DONUT_SIZE / 2} cy={DONUT_SIZE / 2} r={DONUT_RADIUS} stroke={colors.surfaceTertiary} strokeWidth={DONUT_STROKE} fill="none" />
                    {segments.map((s: any) => (
                      <Circle
                        key={s.category}
                        cx={DONUT_SIZE / 2}
                        cy={DONUT_SIZE / 2}
                        r={DONUT_RADIUS}
                        stroke={s.color}
                        strokeWidth={DONUT_STROKE}
                        fill="none"
                        strokeDasharray={`${s.pct * DONUT_CIRC} ${DONUT_CIRC}`}
                        strokeDashoffset={-s.offset * DONUT_CIRC}
                        strokeLinecap="butt"
                        rotation={-90}
                        origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
                      />
                    ))}
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutValue}>{money(total, cur)}</Text>
                    <Text style={styles.donutLabel}>/month</Text>
                  </View>
                </View>
                <View style={{ width: "100%", marginTop: 12, gap: 6 }}>
                  {segments.map((s: any) => (
                    <View key={s.category} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>{s.category}</Text>
                      <Text style={styles.legendPct}>{Math.round(s.pct * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : <Text style={styles.sub}>No spending yet.</Text>}
          </Card>

          <Card style={{ flex: 1 }}>
            <View style={styles.sectionHeadRow}>
              <Icon name="calendar-month-outline" size={16} color={colors.brandPrimary} />
              <Text style={styles.h}>Renewals in next 30 days</Text>
            </View>
            <View style={styles.barsWrap}>
              {weekBuckets.map((v, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barColTrack}>
                    <View style={[styles.barColFill, { height: `${Math.max(6, (v / maxBucket) * 100)}%` }]} />
                  </View>
                  <Text style={styles.barColValue}>{v}</Text>
                  <Text style={styles.barColLabel}>{i === 0 ? "This week" : `Wk ${i + 1}`}</Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {overlapDetail.savings > 0 && !dismissedTip ? (
          <AiCallout
            title={`You could save ${money(overlapDetail.savings, cur)}/month`}
            message={`by reviewing overlapping tools across ${overlapDetail.overlappingGroups} categor${overlapDetail.overlappingGroups === 1 ? "y" : "ies"}.`}
            actionLabel="Review now"
            onAction={() => {}}
            onDismiss={() => setDismissedTip(true)}
          />
        ) : null}

        <View style={styles.statRow}>
          <StatCard icon="piggy-bank-outline" tone="success" value={money(overlapDetail.savings, cur)} label="Potential savings" sub="Based on overlapping tools and unused plans." />
          <StatCard icon="set-split" tone="brandTertiary" value={String(overlapDetail.overlappingGroups)} label="Overlapping subs" sub="Categories with more than one active plan." />
          <StatCard icon="clock-outline" tone="brandSecondary" value={String(data.trials_ending?.length || 0)} label="Trials converting" sub="Ending in the next 30 days." />
        </View>

        <Text style={styles.note}>Insights are informational observations based on your stored data, not financial advice.</Text>
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, tone, value, label, sub }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toneColor = (colors as any)[tone] || colors.brandPrimary;
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: toneColor + "22" }]}><Icon name={icon} size={18} color={toneColor} /></View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "900", marginTop: 16, letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },

  heroLabel: { color: "#FFFFFFB3", fontSize: 11, fontWeight: "700" },
  heroValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 4 },
  heroDivider: { width: 1, backgroundColor: "#FFFFFF22" },

  twoCol: { flexDirection: "row", gap: 10 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  h: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800", flex: 1 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },

  donutCenter: { position: "absolute", alignItems: "center" },
  donutValue: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  donutLabel: { color: colors.muted, fontSize: 9 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  legendPct: { color: colors.muted, fontSize: 11, fontWeight: "700" },

  barsWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 130, marginTop: 10, gap: 6 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barColTrack: { width: 18, flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 9, justifyContent: "flex-end", overflow: "hidden" },
  barColFill: { width: "100%", backgroundColor: colors.brandPrimary, borderRadius: 9 },
  barColValue: { color: colors.onSurface, fontSize: 11, fontWeight: "800", marginTop: 6 },
  barColLabel: { color: colors.muted, fontSize: 9, marginTop: 2, textAlign: "center" },

  statRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, gap: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { color: colors.onSurface, fontSize: 15, fontWeight: "900" },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  statSub: { color: colors.muted, fontSize: 10, lineHeight: 13 },

  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
}));
