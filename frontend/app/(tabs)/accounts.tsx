import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "./_layout";
import {
  Badge,
  CategoryDot,
  ChipRow,
  EmptyState,
  Icon,
  Loading,
  PrimaryButton,
  StatTileRow,
} from "@/src/components/ui";
import { useAccounts, useInvalidateAll } from "@/src/lib/api";
import { exportAndShare } from "@/src/lib/share-export";
import { CATEGORIES, formatDate } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

const TYPE_FILTERS = ["All", "Free", "Paid", "Cancelled", "2FA Protected"];

export default function Accounts() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidateAll();

  const [category, setCategory] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const accountsQuery = useAccounts(category);
  const rows = accountsQuery.data || [];

  const filtered = rows.filter((acc: any) => {
    if (typeFilter === "Free") return acc.account_type !== "paid" && acc.account_type !== "cancelled";
    if (typeFilter === "Paid") return acc.account_type === "paid";
    if (typeFilter === "Cancelled") return acc.account_type === "cancelled";
    if (typeFilter === "2FA Protected") return Boolean(acc.has_2fa);
    return true;
  });

  const paidCount = rows.filter((a: any) => a.account_type === "paid").length;
  const cancelledCount = rows.filter((a: any) => a.account_type === "cancelled").length;
  const freeCount = rows.length - paidCount - cancelledCount;
  const [exporting, setExporting] = useState(false);
  const doExport = async () => {
    setExporting(true);
    try {
      await exportAndShare("accounts");
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Accounts Opened</Text>
            <Text style={styles.headerSub}>Registered websites, apps & services</Text>
          </View>
          <Pressable testID="export-accounts" style={[styles.addBtn, { backgroundColor: colors.pastelMint, marginLeft: "auto", marginRight: 8 }]} onPress={doExport}>
            <Icon name={exporting ? "progress-clock" : "microsoft-excel"} size={20} color={colors.success} />
          </Pressable>
          <Pressable
            testID="add-account-header-btn"
            style={styles.addBtn}
            onPress={() => router.push("/add-account" as any)}
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <StatTileRow
          items={[
            { icon: "shield-account-outline", label: "Total Accounts", value: String(rows.length), tone: "brand" },
            { icon: "credit-card-check-outline", label: "Paid Accounts", value: String(paidCount), tone: "success" },
            { icon: "account-outline", label: "Free Accounts", value: String(freeCount), tone: "purple" },
            { icon: "cancel", label: "Cancelled", value: String(cancelledCount), tone: "warning" },
          ]}
        />

        <View style={{ gap: 6 }}>
          <ChipRow
            items={TYPE_FILTERS}
            selected={typeFilter}
            onSelect={setTypeFilter}
          />
          <ChipRow
            items={CATEGORIES}
            selected={category}
            onSelect={setCategory}
          />
        </View>
      </View>

      {accountsQuery.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: TAB_BAR_SPACE + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={accountsQuery.isRefetching}
              onRefresh={() => invalidate()}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-outline"
              title="No Accounts Registered"
              message="Keep a record of every app or service you've created an account for, with the email and login method you used."
              action={
                <Pressable
                  onPress={() => router.push("/add-account" as any)}
                  style={{
                    backgroundColor: colors.brandPrimary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Add Account</Text>
                </Pressable>
              }
            />
          }
          renderItem={({ item }: { item: any }) => {
            const type = item.account_type || "free";
            const hasSubs = type === "paid";
            return (
              <Pressable
                testID={`account-item-${item.id}`}
                style={styles.accountCard}
                onPress={() => router.push(`/account/${item.id}` as any)}
              >
                <View style={styles.accountAvatar}>
                  <Icon name="account-circle-outline" size={32} color={colors.brandPrimary} />
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.accountName} numberOfLines={1}>
                      {item.service_name}
                    </Text>
                    <Badge
                      label={type === "cancelled" ? "Cancelled" : type === "paid" ? "Paid" : "Free"}
                      tone={type === "cancelled" ? "error" : type === "paid" ? "brand" : "muted"}
                    />
                  </View>

                  <Text style={styles.emailText} numberOfLines={1}>
                    {item.email_used ? `Login: ${item.email_used}` : item.username ? `@${item.username}` : "No email logged"}
                  </Text>

                  {type === "cancelled" && (item.previous_plan || item.previous_price) ? (
                    <Text style={styles.emailText}>
                      Was {item.previous_plan || "subscribed"}
                      {item.previous_price ? ` · ${item.previous_currency || ""} ${item.previous_price}` : ""}
                      {item.cancelled_on ? ` · cancelled ${item.cancelled_on}` : ""}
                    </Text>
                  ) : null}

                  {item.platform_usage || item.allowed_credits ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                      {item.platform_usage ? (
                        <View style={{ backgroundColor: colors.pastelPink, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.brandPrimary }}>
                            {item.platform_usage}
                          </Text>
                        </View>
                      ) : null}
                      {item.allowed_credits ? (
                        <View style={{ backgroundColor: colors.pastelMint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.success }}>
                            {item.allowed_credits}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.metaRow}>
                    <CategoryDot category={item.category || "Other"} />
                    <Text style={styles.metaText}>{item.auth_method || "email"}</Text>
                    {item.has_2fa ? (
                      <View style={styles.twoFaBadge}>
                        <Icon name="shield-check" size={12} color={colors.success} />
                        <Text style={styles.twoFaText}>2FA</Text>
                      </View>
                    ) : null}

                  </View>
                </View>

                <Icon name="chevron-right" size={20} color={colors.muted} />
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.glassStrong,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.onSurface,
  },
  headerSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 12,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  emailText: {
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "capitalize",
  },
  twoFaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  twoFaText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.success,
  },
  linkedCount: {
    fontSize: 11,
    color: colors.brandPrimary,
    fontWeight: "600",
  },
}));
