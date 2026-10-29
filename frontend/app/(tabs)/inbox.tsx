import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppHeader,
  Card,
  ChipRow,
  ConfidenceBadge,
  EmptyState,
  Icon,
  Loading,
} from "@/src/components/ui";
import { api, useInbox, useInvalidateAll } from "@/src/lib/api";
import { formatDate, money } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";
import { TAB_BAR_SPACE } from "./_layout";

const TABS = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs Review" },
  { key: "auto_added", label: "Auto Added" },
  { key: "duplicates", label: "Duplicates" },
];

export default function Inbox() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("all");
  const { data, isLoading, isFetching, refetch } = useInbox(tab);
  const invalidate = useInvalidateAll();

  const act = useMutation({
    mutationFn: ({ id, body }: any) => api.inboxAction(id, body),
    onSuccess: () => {
      refetch();
      invalidate();
    },
  });

  const labelMap: Record<string, string> = {
    needs_review: "Needs review",
    needs_confirmation: "Confirm",
    auto_added: "Auto added",
    duplicate: "Duplicate",
    added: "Added to subscriptions",
    ignored: "Ignored",
    merged: "Merged",
    saved: "Saved to vault",
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Smart Inbox"
        subtitle="AI-processed items ready for review"
      />
      <View style={{ marginTop: 6, marginBottom: 8 }}>
        <ChipRow
          items={TABS.map((t) => t.label)}
          value={TABS.find((t) => t.key === tab)?.label}
          onChange={(l: string) => setTab(TABS.find((t) => t.label === l)!.key)}
          testIDPrefix="inbox-tab"
        />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            padding: 20,
            paddingTop: 8,
            paddingBottom: TAB_BAR_SPACE + insets.bottom,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="inbox-arrow-down-outline"
              title="Inbox is clear"
              message="All items processed. Share a screenshot or link and AI will organize it here."
            />
          }
          renderItem={({ item }) => {
            const ex = item.extraction || {};
            const processed = ["added", "ignored", "merged", "saved"].includes(
              item.status
            );
            return (
              <Card testID={`inbox-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.srcRow}>
                    <View style={styles.srcIconBox}>
                      <Icon
                        name={sourceIcon(item.source)}
                        size={14}
                        color={colors.brandPrimary}
                      />
                    </View>
                    <Text style={styles.src}>{item.source || "Direct upload"}</Text>
                  </View>
                  <ConfidenceBadge value={item.confidence} />
                </View>

                <Text style={styles.title}>
                  {ex.provider || ex.product || "Extracted Item"}
                </Text>
                <Text style={styles.type}>
                  {(ex.content_type || "subscription").toUpperCase()}
                  {ex.plan ? ` · ${ex.plan}` : ""}
                </Text>

                <View style={styles.fields}>
                  {ex.price != null ? (
                    <Field
                      label="Price"
                      value={`${money(ex.price, ex.currency)} / ${
                        ex.billing_cycle || "month"
                      }`}
                    />
                  ) : null}
                  {ex.renewal_date ? (
                    <Field label="Renewal" value={formatDate(ex.renewal_date)} />
                  ) : null}
                  {ex.trial_end ? (
                    <Field label="Trial ends" value={formatDate(ex.trial_end)} />
                  ) : null}
                  {ex.category ? (
                    <Field label="Category" value={ex.category} />
                  ) : null}
                </View>

                {ex.summary ? <Text style={styles.summary}>{ex.summary}</Text> : null}

                {processed ? (
                  <View style={styles.statusPill}>
                    <Icon name="check-circle" size={16} color={colors.success} />
                    <Text style={styles.statusText}>
                      {labelMap[item.status] || item.status}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {item.status === "duplicate" && item.duplicate_of ? (
                      <ActionBtn
                        icon="merge"
                        label="Merge"
                        tone="warning"
                        onPress={() =>
                          act.mutate({
                            id: item.id,
                            body: { action: "merge", merge_into: item.duplicate_of },
                          })
                        }
                      />
                    ) : null}
                    <ActionBtn
                      icon="wallet-plus"
                      label="Subscription"
                      tone="mint"
                      onPress={() =>
                        act.mutate({ id: item.id, body: { action: "subscription" } })
                      }
                    />
                    <ActionBtn
                      icon="shield-account-outline"
                      label="Account"
                      tone="mint"
                      onPress={() =>
                        act.mutate({ id: item.id, body: { action: "account" } })
                      }
                    />
                    <ActionBtn
                      icon="bookmark-plus-outline"
                      label="Save to Vault"
                      tone="brand"
                      onPress={() =>
                        act.mutate({ id: item.id, body: { action: "check_later" } })
                      }
                    />
                    <ActionBtn
                      icon="eye-plus"
                      label="Watch"
                      tone="brand"
                      onPress={() =>
                        act.mutate({ id: item.id, body: { action: "watchlist" } })
                      }
                    />
                    <ActionBtn
                      icon="close"
                      label="Ignore"
                      tone="muted"
                      onPress={() =>
                        act.mutate({ id: item.id, body: { action: "ignore" } })
                      }
                    />
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function sourceIcon(src: string) {
  if (!src) return "help-circle-outline";
  if (src.includes("screenshot") || src.includes("image")) return "image";
  if (src.includes("link")) return "link-variant";
  if (src.includes("notification")) return "bell-outline";
  return "gesture-tap";
}

function Field({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: string;
  label: string;
  tone: "mint" | "warning" | "brand" | "muted";
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bgMap = {
    mint: colors.pastelMint,
    warning: colors.pastelOrange,
    brand: colors.pastelLavender,
    muted: colors.surfaceTertiary,
  };
  const fgMap = {
    mint: colors.success,
    warning: colors.warning,
    brand: colors.brandSecondary,
    muted: colors.muted,
  };

  return (
    <Pressable
      onPress={onPress}
      testID={`inbox-action-${label}`}
      style={[styles.actionBtn, { backgroundColor: bgMap[tone] }]}
    >
      <Icon name={icon} size={15} color={fgMap[tone]} />
      <Text style={[styles.actionLabel, { color: fgMap[tone] }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  srcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  srcIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.pastelBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  src: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  type: {
    color: colors.brandSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  field: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  fieldValue: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  summary: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: colors.pastelMint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "700",
  },
}));
