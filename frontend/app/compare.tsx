import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/lib/api";
import { money } from "@/src/lib/format";
import { AppHeader, Card, Icon, Loading } from "@/src/components/ui";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

export default function Compare() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const idList = (ids || "").split(",").filter(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => api.compare(idList),
    enabled: idList.length >= 2,
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title="Compare Plans"
        subtitle="Side-by-side plan analysis"
        back
      />
      {isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 36,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Side by side comparison cards */}
          <View style={styles.cardsRow}>
            {(data?.items || []).map((it: any, i: number) => {
              const bg = accentFor(colors, it.provider || i);
              return (
                <View key={i} style={[styles.compareCard, { backgroundColor: bg }]}>
                  <View style={styles.providerBadge}>
                    <Icon name="tag-outline" size={13} color={colors.onAccent} />
                    <Text style={styles.badgeLabel}>Option {i + 1}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{it.provider}</Text>
                  <Text style={styles.plan} numberOfLines={1}>{it.plan || it.product || "Plan"}</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>{money(it.price, it.currency)}</Text>
                    <Text style={styles.cycle}>/{it.billing_cycle || "mo"}</Text>
                  </View>
                  {it.status ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{it.status}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* AI Analysis Card */}
          <Card style={styles.aiCard}>
            <View style={styles.aiHead}>
              <View style={styles.aiSparkleIcon}>
                <Icon name="creation" size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiTitle}>SubMind AI recommendation</Text>
                <Text style={styles.aiSubtitle}>Feature overlap & value comparison</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.analysis}>
              {data?.comparison || "No side-by-side analysis available for these plans."}
            </Text>
          </Card>

          {/* Helper advice */}
          <View style={styles.tipBox}>
            <Icon name="information-outline" size={16} color={colors.muted} />
            <Text style={styles.tipText}>
              You can subscribe directly from the watchlist once you’ve made your choice.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  cardsRow: { flexDirection: "row", gap: 12 },
  compareCard: {
    flex: 1,
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF30",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeLabel: {
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: "700",
  },
  name: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  plan: {
    color: colors.onAccent,
    opacity: 0.85,
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 14,
    gap: 2,
  },
  price: {
    color: colors.onAccent,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  cycle: {
    color: colors.onAccent,
    opacity: 0.8,
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF28",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: "700",
  },
  aiCard: {
    padding: 18,
    borderRadius: 10,
    borderColor: colors.border,
    borderWidth: 1.5,
  },
  aiHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiSparkleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.pastelLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  aiSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  analysis: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
}));
