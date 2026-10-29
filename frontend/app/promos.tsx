import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader, Badge, Card, EmptyState, Icon } from "@/src/components/ui";
import { api, useInvalidateAll, usePromos } from "@/src/lib/api";
import { daysUntil, formatDate } from "@/src/lib/format";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

export default function Promos() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidateAll();
  const { data = [], isLoading } = usePromos();
  const [filter, setFilter] = useState<"Available" | "Used">("Available");
  const [copied, setCopied] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) => api.updatePromo(id, body),
    onSuccess: invalidate,
  });

  const rows = data.filter((item: any) => (filter === "Used" ? item.used : !item.used));

  const copy = async (id: string, code: string) => {
    await Clipboard.setStringAsync(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Promo Codes"
        subtitle="Saved vouchers & discounts"
        back
        right={
          <Pressable
            onPress={() => router.push("/add-promo")}
            testID="promos-add"
            style={styles.headerAddBtn}
            hitSlop={8}
          >
            <Icon name="plus" size={20} color={colors.brandPrimary} />
          </Pressable>
        }
      />

      {/* Pill filter tabs */}
      <View style={styles.tabsContainer}>
        {(["Available", "Used"] as const).map((label) => {
          const active = filter === label;
          const count = data.filter((item: any) => (label === "Used" ? item.used : !item.used)).length;
          return (
            <Pressable
              key={label}
              onPress={() => setFilter(label)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 36,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <Text style={styles.emptyText}>Loading your promo vouchers…</Text>
        ) : rows.length ? (
          rows.map((item: any, index: number) => {
            const days = item.expiry_date ? daysUntil(item.expiry_date) : null;
            const expired = days != null && days < 0;
            const expiringSoon = days != null && days >= 0 && days <= 5;
            const avatarBg = accentFor(colors, item.service || index);

            return (
              <Card key={item.id} testID={`promo-${item.id}`} style={styles.voucherCard}>
                {/* Top header row */}
                <View style={styles.cardHeader}>
                  <View style={[styles.serviceAvatar, { backgroundColor: avatarBg }]}>
                    <Icon name="ticket-percent-outline" size={20} color={colors.onAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{item.service}</Text>
                    {item.source ? (
                      <Text style={styles.sourceText}>Source: {item.source}</Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {item.category ? (
                      <View style={[styles.discountBadge, { backgroundColor: colors.pastelLavender }]}>
                        <Text style={[styles.discountBadgeText, { color: colors.brandSecondary }]}>{item.category}</Text>
                      </View>
                    ) : null}
                    {item.discount ? (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>{item.discount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Dashed voucher code box */}
                <View style={styles.codeDashedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>PROMO CODE</Text>
                    <Text style={styles.codeText} selectable>
                      {item.code}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => copy(item.id, item.code)}
                    style={[styles.copyBtn, copied === item.id && styles.copiedBtn]}
                    testID={`copy-${item.id}`}
                  >
                    <Icon
                      name={copied === item.id ? "check" : "content-copy"}
                      size={15}
                      color={copied === item.id ? "#FFFFFF" : colors.brandPrimary}
                    />
                    <Text style={[styles.copyBtnText, copied === item.id && { color: "#FFFFFF" }]}>
                      {copied === item.id ? "Copied" : "Copy"}
                    </Text>
                  </Pressable>
                </View>

                {/* Expiry and status info */}
                <View style={styles.metaRow}>
                  <Icon
                    name={expired ? "alert-circle-outline" : expiringSoon ? "clock-alert-outline" : "clock-outline"}
                    size={14}
                    color={expired ? colors.error : expiringSoon ? colors.warning : colors.muted}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      expired && { color: colors.error },
                      expiringSoon && { color: colors.warning },
                    ]}
                  >
                    {item.expiry_date
                      ? `${expired ? "Expired" : "Expires"} ${formatDate(item.expiry_date)}`
                      : "No expiration date"}
                  </Text>
                </View>

                {/* Action buttons */}
                <View style={styles.actionButtonsRow}>
                  {item.url ? (
                    <Pressable
                      onPress={() => Linking.openURL(item.url)}
                      style={[styles.smallBtn, { backgroundColor: colors.pastelBlue }]}
                    >
                      <Icon name="open-in-new" size={13} color={colors.brandPrimary} />
                      <Text style={[styles.smallBtnText, { color: colors.brandPrimary }]}>
                        Open link
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => router.push(`/add-promo?id=${item.id}` as any)}
                    style={styles.smallBtn}
                  >
                    <Icon name="pencil-outline" size={13} color={colors.onSurfaceSecondary} />
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => change.mutate({ id: item.id, body: { used: !item.used } })}
                    style={[styles.smallBtn, item.used && { backgroundColor: colors.pastelMint }]}
                  >
                    <Icon
                      name={item.used ? "check-circle-outline" : "checkbox-blank-circle-outline"}
                      size={13}
                      color={item.used ? colors.success : colors.onSurfaceSecondary}
                    />
                    <Text
                      style={[
                        styles.smallBtnText,
                        item.used && { color: colors.success },
                      ]}
                    >
                      {item.used ? "Used" : "Mark used"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => change.mutate({ id: item.id, body: { archived: true } })}
                    style={[styles.smallBtn, { marginLeft: "auto" }]}
                  >
                    <Icon name="archive-arrow-down-outline" size={13} color={colors.muted} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="ticket-percent-outline"
            title={filter === "Used" ? "No used codes" : "No promo codes yet"}
            message="Save coupon codes, discount links, and student promos before they expire."
            action={
              <Pressable
                style={styles.addButton}
                onPress={() => router.push("/add-promo")}
              >
                <Text style={styles.addText}>Add a promo code</Text>
              </Pressable>
            }
          />
        )}
      </ScrollView>
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
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    alignSelf: "flex-start",
  },
  tab: {
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeTab: {
    backgroundColor: colors.glassStrong,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 0,
  },
  tabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  activeTabText: {
    color: colors.brandPrimary,
    fontWeight: "800",
  },
  voucherCard: {
    padding: 16,
    borderRadius: 10,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  serviceAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sourceText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  discountBadge: {
    backgroundColor: colors.pastelMint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  discountBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
  },
  codeDashedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  codeText: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.pastelBlue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  copiedBtn: {
    backgroundColor: colors.success,
  },
  copyBtnText: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: {
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 8,
  },
  addText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
}));
