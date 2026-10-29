import { ImportDetails } from "@/src/components/import-details";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppHeader,
  Badge,
  Card,
  CategoryDot,
  Chip,
  GradientHero,
  Icon,
  Loading,
  PrimaryButton,
} from "@/src/components/ui";
import {
  api,
  useInvalidateAll,
  useReminders,
  useSubscription,
  useWatchlist,
} from "@/src/lib/api";
import { STATUSES, formatDate, money, relativeDate } from "@/src/lib/format";
import { monthlyCost } from "@/src/lib/local-insights";
import { makeStyles, useTheme } from "@/src/theme";

export default function SubscriptionDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, refetch } = useSubscription(id!);
  const reminders = useReminders();
  const watchlist = useWatchlist();
  const invalidate = useInvalidateAll();

  const patch = useMutation({
    mutationFn: (b: any) => api.updateSubscription(id!, b),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });
  const del = useMutation({
    mutationFn: () => api.deleteSubscription(id!),
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });
  // Cancelling moves the subscription into Accounts (marked Cancelled) instead of keeping it here.
  const cancel = useMutation({
    mutationFn: () => api.updateSubscription(id!, { status: "Cancelled" }),
    onSuccess: () => {
      invalidate();
      router.replace("/(tabs)/accounts" as any);
    },
  });
  const toAccount = useMutation({
    mutationFn: () => api.moveSubscriptionToAccount(id!),
    onSuccess: () => {
      invalidate();
      router.replace("/(tabs)/accounts" as any);
    },
  });
  const confirmCancel = () =>
    Alert.alert(
      "Mark as cancelled?",
      "It stops counting toward your spend and moves to Accounts, marked as cancelled.",
      [
        { text: "Keep", style: "cancel" },
        { text: "Cancel subscription", style: "destructive", onPress: () => cancel.mutate() },
      ],
    );
  const confirmToAccount = () =>
    Alert.alert("Change to an account?", "It will leave Subscriptions and be kept in Accounts.", [
      { text: "Keep", style: "cancel" },
      { text: "Move to Accounts", onPress: () => toAccount.mutate() },
    ]);
  const pay = useMutation({
    mutationFn: () => api.recordPayment(id!, {}),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });

  const linkedReminder = useMemo(
    () =>
      (reminders.data || []).find(
        (r: any) => r.ref_type === "subscription" && r.ref_id === id
      ),
    [reminders.data, id]
  );
  const relatedPlan = useMemo(() => {
    if (!data) return null;
    const name = String(data.provider || "").toLowerCase();
    return (
      (watchlist.data || []).find(
        (p: any) => String(p.provider || "").toLowerCase() === name
      ) || null
    );
  }, [watchlist.data, data]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const rows: {
      icon: string;
      tone: "success" | "warning" | "brand" | "info";
      title: string;
      sub: string;
      date: string;
    }[] = [];
    const history = Array.isArray(data.price_history) ? data.price_history : [];
    for (const entry of history) {
      rows.push({
        icon: "chart-line",
        tone: "warning",
        title: "Price updated",
        sub: `Changed from ${money(entry.price, data.currency)} to ${money(
          data.price,
          data.currency
        )}`,
        date: entry.date,
      });
    }
    for (const p of Array.isArray(data.payments) ? data.payments : []) {
      rows.push({
        icon: "credit-card-check-outline",
        tone: "info",
        title: "Payment recorded",
        sub: `Marked as paid (${money(p.amount, p.currency)})`,
        date: p.date,
      });
    }
    if (linkedReminder) {
      rows.push({
        icon: "bell-check-outline",
        tone: "brand",
        title: "Reminder active",
        sub: `Alert scheduled for ${formatDate(linkedReminder.due_date)}`,
        date: linkedReminder.created_at,
      });
    }
    if (data.created_at) {
      rows.push({
        icon: "plus-circle-outline",
        tone: "success",
        title: "Subscription tracked",
        sub: `Added via ${data.source || "manual entry"}`,
        date: data.created_at,
      });
    }
    return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [data, linkedReminder]);

  if (isLoading || !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Subscription" back />
        <Loading />
      </View>
    );
  }

  const s = data;
  const toneMap = {
    success: colors.success,
    warning: colors.warning,
    brand: colors.brandSecondary,
    info: colors.info,
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={s.provider}
        subtitle={s.category || "Subscription"}
        back
        right={
          <Pressable
            testID="header-edit-sub"
            onPress={() => router.push(`/add-subscription?id=${id}` as any)}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.surfaceTertiary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="pencil" size={18} color={colors.onSurface} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 30,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ImportDetails record={data} />
        {/* Large Information Hero Card */}
        <GradientHero>
          <View style={styles.heroTopRow}>
            <CategoryDot category={s.category} size={50} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{s.provider}</Text>
              <Text style={styles.heroPlan}>
                {s.category} · {s.plan || "Standard Plan"}
              </Text>
            </View>
            <Badge
              label={s.status}
              tone={
                s.status === "Active"
                  ? "mint"
                  : s.status === "Trial"
                  ? "brand"
                  : "muted"
              }
            />
          </View>

          <Text style={styles.heroPrice}>
            {money(s.price, s.currency)}
            <Text style={styles.heroPer}>
              /
              {s.billing_cycle === "yearly"
                ? "year"
                : s.billing_cycle === "weekly"
                ? "week"
                : "month"}
            </Text>
          </Text>

          <View style={styles.heroDatesRow}>
            <View style={styles.heroDateItem}>
              <Icon name="calendar-clock" size={14} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.heroSub}>
                {s.renewal_date
                  ? `Renews on ${formatDate(s.renewal_date)}`
                  : "No renewal date set"}
              </Text>
            </View>
            <Text style={styles.heroSub2}>
              {s.auto_renew ? "• Auto-renew on" : "• Auto-renew off"}
            </Text>
          </View>
        </GradientHero>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionTile}
            onPress={() => router.push(`/add-subscription?id=${id}` as any)}
            testID="edit-sub"
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.pastelLavender },
              ]}
            >
              <Icon name="pencil-outline" size={18} color={colors.brandSecondary} />
            </View>
            <Text style={styles.actionLabel}>Edit</Text>
            <Text style={styles.actionSub}>Update details</Text>
          </Pressable>

          <Pressable
            style={styles.actionTile}
            onPress={() => patch.mutate({ notify_paused: !s.notify_paused })}
            testID="pause-reminder"
          >
            <View
              style={[
                styles.actionIcon,
                {
                  backgroundColor: s.notify_paused
                    ? colors.pastelMint
                    : colors.pastelOrange,
                },
              ]}
            >
              <Icon
                name={s.notify_paused ? "bell-outline" : "bell-off-outline"}
                size={18}
                color={s.notify_paused ? colors.success : colors.warning}
              />
            </View>
            <Text style={styles.actionLabel}>
              {s.notify_paused ? "Resume alert" : "Pause alert"}
            </Text>
            <Text style={styles.actionSub}>
              {s.notify_paused ? "Notifications on" : "Mute alerts"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionTile}
            onPress={() => pay.mutate()}
            testID="record-payment"
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: colors.pastelMint },
              ]}
            >
              <Icon name="check-circle-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>Mark paid</Text>
            <Text style={styles.actionSub}>Log payment</Text>
          </Pressable>
        </View>

        {/* Spending Snapshot Card */}
        <Card>
          <Text style={styles.sectionLabel}>Spending Overview</Text>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotItem}>
              <View
                style={[
                  styles.snapshotIcon,
                  { backgroundColor: colors.pastelBlue },
                ]}
              >
                <Icon name="cash-multiple" size={16} color={colors.brandPrimary} />
              </View>
              <Text style={styles.snapshotLabel}>Yearly spend</Text>
              <Text style={styles.snapshotValue}>
                {money(monthlyCost(s) * 12, s.currency)}
              </Text>
            </View>

            <View style={styles.snapshotItem}>
              <View
                style={[
                  styles.snapshotIcon,
                  { backgroundColor: colors.pastelMint },
                ]}
              >
                <Icon
                  name="calendar-check-outline"
                  size={16}
                  color={colors.success}
                />
              </View>
              <Text style={styles.snapshotLabel}>Last payment</Text>
              <Text style={styles.snapshotValue}>
                {s.payments?.length
                  ? formatDate(s.payments[s.payments.length - 1].date)
                  : "—"}
              </Text>
            </View>

            <View style={styles.snapshotItem}>
              <View
                style={[
                  styles.snapshotIcon,
                  { backgroundColor: colors.pastelLavender },
                ]}
              >
                <Icon name="bell-outline" size={16} color={colors.brandSecondary} />
              </View>
              <Text style={styles.snapshotLabel}>Next reminder</Text>
              <Text style={styles.snapshotValue}>
                {linkedReminder ? formatDate(linkedReminder.due_date) : "None"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Activity & History Timeline */}
        {timeline.length ? (
          <Card>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionLabel}>Activity Timeline</Text>
              <Text style={styles.seeAll}>{timeline.length} events</Text>
            </View>
            {timeline.slice(0, 6).map((t, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: toneMap[t.tone] },
                    ]}
                  />
                  {i < Math.min(timeline.length, 6) - 1 ? (
                    <View style={styles.timelineLine} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={styles.timelineTitle}>{t.title}</Text>
                  <Text style={styles.timelineSub}>{t.sub}</Text>
                </View>
                <Text style={styles.timelineDate}>{formatDate(t.date)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Notes Card */}
        <Card>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Pressable onPress={() => router.push(`/add-subscription?id=${id}` as any)}>
              <Text style={styles.seeAll}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.notes}>
            {s.notes || "No notes yet. Add account credentials or context here."}
          </Text>
        </Card>

        {/* Subscriptions and Accounts are separate; offer the move instead of a link */}
        <Card>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionLabel}>{s.renewal_date || s.trial_end ? "Account options" : "No expiry date set"}</Text>
          </View>
          {!s.renewal_date && !s.trial_end ? (
            <Text style={styles.notes}>Add an expiry date to get renewal reminders, or keep this as a plain account instead.</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            {!s.renewal_date && !s.trial_end ? (
              <Pressable style={[styles.moveBtn, { backgroundColor: colors.pastelLavender }]} onPress={() => router.push(`/add-subscription?id=${id}` as any)}>
                <Icon name="calendar-plus" size={16} color={colors.brandPrimary} />
                <Text style={[styles.moveBtnText, { color: colors.brandPrimary }]}>Add date</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.moveBtn, { backgroundColor: colors.pastelOrange }]} onPress={confirmToAccount} testID="move-to-account">
              <Icon name="badge-account-outline" size={16} color={colors.warning} />
              <Text style={[styles.moveBtnText, { color: colors.warning }]}>Move to Accounts</Text>
            </Pressable>
          </View>
        </Card>

        {/* Related Saved Plans */}
        {relatedPlan ? (
          <Card>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionLabel}>Related Saved Plan</Text>
            </View>
            <Pressable
              style={styles.relatedRow}
              onPress={() => router.push("/watchlist")}
              testID="related-plan"
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.pastelLavender },
                ]}
              >
                <Icon
                  name="eye-outline"
                  size={18}
                  color={colors.brandSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.relatedTitle}>{relatedPlan.provider}</Text>
                <Text style={styles.relatedSub}>
                  {relatedPlan.plan || relatedPlan.category}
                </Text>
              </View>
              <Text style={styles.viewPlan}>View Plan ›</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Status Selector */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Change Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {STATUSES.map((st) => (
              <Chip
                key={st}
                label={st}
                active={s.status === st}
                onPress={() => (st === "Cancelled" ? confirmCancel() : patch.mutate({ status: st }))}
                testID={`status-${st}`}
              />
            ))}
          </ScrollView>
        </View>

        {/* Delete Action */}
        <PrimaryButton
          title="Delete subscription"
          icon="trash-can-outline"
          variant="secondary"
          onPress={() => del.mutate()}
          loading={del.isPending}
          testID="delete-sub"
          style={{
            backgroundColor: colors.pastelPink,
            borderColor: colors.error + "33",
          }}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  moveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  moveBtnText: { fontSize: 13, fontWeight: "800" },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroPlan: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  heroPrice: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 16,
    letterSpacing: -0.5,
  },
  heroPer: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontWeight: "700",
  },
  heroDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  heroDateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroSub: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroSub2: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12,
    fontWeight: "500",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 14,
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionLabel: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSub: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
  },

  sectionLabel: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sectionHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  seeAll: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  snapshotItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
  },
  snapshotIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  snapshotLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  snapshotValue: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },

  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  timelineRail: {
    alignItems: "center",
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineTitle: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  timelineSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  timelineDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },

  notes: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    lineHeight: 19,
  },

  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  relatedTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  relatedSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  viewPlan: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
}));
