import { ImportDetails } from "@/src/components/import-details";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppHeader,
  Badge,
  Card,
  CategoryDot,
  Icon,
  Loading,
  PrimaryButton,
} from "@/src/components/ui";
import {
  api,
  useAccount,
  useAccountSubscriptions,
  useInvalidateAll,
} from "@/src/lib/api";
import { formatDate, money } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function AccountDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: account, isLoading, refetch } = useAccount(id!);
  const { data: linkedSubs = [] } = useAccountSubscriptions(id!);
  const invalidate = useInvalidateAll();

  const del = useMutation({
    mutationFn: () => api.deleteAccount(id!),
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  if (isLoading || !account) {
    return (
      <View style={styles.container}>
        <AppHeader title="Account Details" back />
        <Loading />
      </View>
    );
  }

  const openUrl = async () => {
    if (account.service_url) {
      const url = account.service_url.startsWith("http")
        ? account.service_url
        : `https://${account.service_url}`;
      await WebBrowser.openBrowserAsync(url).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={account.service_name || "Account"}
        subtitle={`Registered ${account.registration_date ? formatDate(account.registration_date) : "account"}`}
        back
        right={
          <Pressable
            testID="edit-account"
            style={styles.headerBtn}
            onPress={() => router.push({ pathname: "/add-account" as any, params: { id: account.id } })}
          >
            <Icon name="pencil" size={20} color={colors.onSurface} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <ImportDetails record={account} />
        {/* Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}>
              <Icon name="account-circle-outline" size={36} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.heroTitle}>{account.service_name}</Text>
              <View style={styles.badgeRow}>
                <CategoryDot category={account.category || "Other"} />
                <Badge
                  label={account.account_type === "cancelled" ? "Cancelled" : account.account_type === "paid" ? "Paid Account" : "Free / benefit"}
                  tone={account.account_type === "cancelled" ? "error" : account.account_type === "paid" ? "brand" : "muted"}
                />
                {account.has_2fa ? (
                  <Badge label="2FA Enabled" tone="success" />
                ) : (
                  <Badge label="No 2FA" tone="warning" />
                )}
              </View>
            </View>
          </View>

          {account.service_url ? (
            <Pressable style={styles.urlRow} onPress={openUrl}>
              <Icon name="open-in-new" size={16} color={colors.brandPrimary} />
              <Text style={styles.urlText} numberOfLines={1}>
                {account.service_url}
              </Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Platform Usage & Credits Card */}
        {(account.platform_usage || account.allowed_credits) && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Platform Purpose & Quota</Text>
            {account.platform_usage ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Usage / Purpose:</Text>
                <Text style={[styles.metaValue, { fontWeight: "700", color: colors.brandPrimary }]}>
                  {account.platform_usage}
                </Text>
              </View>
            ) : null}
            {account.allowed_credits ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Allowed Credits:</Text>
                <Text style={[styles.metaValue, { fontWeight: "700", color: colors.success }]}>
                  {account.allowed_credits}
                </Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Credentials & Access Context */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Login Credentials Context</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Email Used:</Text>
            <Text style={styles.metaValue}>{account.email_used || "Not specified"}</Text>
          </View>

          {account.username ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Username / Handle:</Text>
              <Text style={styles.metaValue}>{account.username}</Text>
            </View>
          ) : null}

          {account.phone_used ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Phone Registered:</Text>
              <Text style={styles.metaValue}>{account.phone_used}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Sign-in Method:</Text>
            <Text style={styles.metaValue}>{account.auth_method || "Email & Password"}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Two-Factor Auth:</Text>
            <Text style={styles.metaValue}>{account.has_2fa ? "Protected with 2FA" : "Standard login"}</Text>
          </View>
        </Card>

        {/* Linked Subscriptions */}
        <Card style={styles.sectionCard}>
          <View style={styles.subHeaderRow}>
            <Text style={styles.sectionTitle}>Connected Subscriptions</Text>
            <Pressable
              style={styles.addSubBtn}
              onPress={() =>
                router.push({
                  pathname: "/add-subscription",
                  params: {
                    provider: account.service_name,
                    account_email: account.email_used,
                    category: account.category,
                  },
                })
              }
            >
              <Icon name="plus" size={16} color={colors.brandPrimary} />
              <Text style={styles.addSubBtnText}>Add Plan</Text>
            </Pressable>
          </View>

          {linkedSubs.length === 0 ? (
            <Text style={styles.emptySubsText}>
              No active subscription attached. This account is currently tracked as a free registration.
            </Text>
          ) : (
            linkedSubs.map((sub: any) => (
              <Pressable
                key={sub.id}
                style={styles.subItem}
                onPress={() => router.push(`/subscription/${sub.id}`)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.subName}>{sub.plan || sub.provider}</Text>
                  <Text style={styles.subCycle}>
                    {sub.billing_cycle || "monthly"} • Renews: {sub.renewal_date || "N/A"}
                  </Text>
                </View>
                <Text style={styles.subPrice}>{money(sub.price, sub.currency)}</Text>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            ))
          )}
        </Card>

        {/* Notes */}
        {account.notes ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{account.notes}</Text>
          </Card>
        ) : null}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable
            testID="delete-account-btn"
            style={styles.deleteBtn}
            onPress={() => del.mutate()}
          >
            <Icon name="trash-can-outline" size={18} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerBtn: {
    padding: 8,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    padding: 16,
    gap: 12,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.onSurface,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  urlText: {
    fontSize: 13,
    color: colors.brandPrimary,
    fontWeight: "500",
  },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
  },
  subHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 8,
  },
  addSubBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brandPrimary,
  },
  emptySubsText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    fontStyle: "italic",
  },
  subItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  subName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
  subCycle: {
    fontSize: 12,
    color: colors.muted,
  },
  subPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  notesText: {
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 19,
  },
  actionRow: {
    alignItems: "center",
    marginTop: 8,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
  },
}));
