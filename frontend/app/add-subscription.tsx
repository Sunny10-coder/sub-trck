import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll, usePromos } from "@/src/lib/api";
import { CATEGORIES, CURRENCIES, CYCLES, STATUSES } from "@/src/lib/format";
import { deriveStartDate } from "@/src/lib/local-models";
import { scheduleReminderNotification } from "@/src/lib/notifications";
import { AppHeader, Card, Icon, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

export default function AddSubscription() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const promosQuery = usePromos();
  const params = useLocalSearchParams<{
    id?: string;
    provider?: string;
    product?: string;
    plan?: string;
    category?: string;
    price?: string;
    currency?: string;
    billing_cycle?: string;
    renewal_date?: string;
    trial_end?: string;
  }>();
  const { id } = params;
  const editing = !!id;
  const [notify, setNotify] = useState(true);
  const [f, setF] = useState<any>({
    provider: params.provider || "",
    product: params.product || "",
    plan: params.plan || "",
    category: params.category || "Other",
    status: "Active",
    price: params.price != null ? String(params.price) : "",
    currency: params.currency || "AED",
    billing_cycle: params.billing_cycle || "monthly",
    renewal_date: params.renewal_date || "",
    start_date: "",
    trial_end: params.trial_end || "",
    notes: "",
    card_last4: "",
    account_email: "",
    promo_applied: "",
  });
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (id) {
      api
        .subscription(id)
        .then((row) => {
          setF({
            provider: row.provider || "",
            product: row.product || "",
            plan: row.plan || "",
            category: row.category || "Other",
            status: row.status || "Active",
            price: row.price != null ? String(row.price) : "",
            currency: row.currency || "AED",
            billing_cycle: row.billing_cycle || "monthly",
            renewal_date: row.renewal_date || "",
            start_date: row.start_date || "",
            trial_end: row.trial_end || "",
            notes: row.notes || "",
            card_last4: row.card_last4 || "",
            account_email: row.account_email || "",
            promo_applied: row.promo_applied || "",
          });
        })
        .catch(() => {});
    }
  }, [id]);

  const addDays = (days: number, target: "renewal_date" | "trial_end") => {
    const base = f.start_date && /^\d{4}-\d{2}-\d{2}$/.test(f.start_date)
      ? new Date(`${f.start_date}T00:00:00`)
      : new Date();
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    setF((prev: any) => ({ ...prev, [target]: `${yyyy}-${mm}-${dd}` }));
  };

  // Saved promo codes for this service (or all, when no service typed yet).
  const promoChoices = (promosQuery.data || []).filter(
    (p: any) =>
      !p.used &&
      (!f.provider.trim() || String(p.service || "").toLowerCase().includes(f.provider.trim().toLowerCase())),
  );

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...f,
        price: f.price ? parseFloat(f.price) : null,
        renewal_date: f.renewal_date || null,
        start_date: deriveStartDate(f.start_date, f.renewal_date, f.billing_cycle),
        trial_end: f.trial_end || null,
        card_last4: String(f.card_last4 || "")
          .replace(/\D/g, "")
          .slice(-4),
        account_email: f.account_email.trim(),
        promo_applied: f.promo_applied.trim().toUpperCase(),
        create_reminder: notify,
      };
      const saved = editing
        ? await api.updateSubscription(id!, body)
        : await api.createSubscription(body);
      if (notify && (f.renewal_date || f.trial_end)) {
        await scheduleReminderNotification({
          title: `${f.provider || "Subscription"} ${
            f.trial_end ? "trial ending" : "renews"
          }`,
          date: f.trial_end || f.renewal_date,
          daysBefore: f.trial_end ? 0 : 3,
        });
      }
      return saved;
    },
    onSuccess: (saved: any) => {
      invalidate();
      // Marking it Cancelled moves it into Accounts, so the detail screen no longer exists.
      if (saved?.moved_to_account_id) router.replace("/(tabs)/accounts" as any);
      else router.back();
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title={editing ? "Edit Subscription" : "New Subscription"}
        subtitle="Track recurring billing & renewals"
        back
      />
      <FormScroll>
        {!editing ? (
          <Pressable
            onPress={() => router.push("/scan?target=subscription&mode=library" as any)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: colors.pastelBlue,
                borderRadius: 10,
                padding: 14,
                borderWidth: 1.5,
                borderColor: colors.brandPrimary + "35",
                marginBottom: 12,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.brandPrimary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="receipt-text-outline" size={20} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "700" }}>
                Scan Receipt to Auto-fill
              </Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 }}>
                Import plan, price, currency & renewal date with AI
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : null}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Basic Information</Text>
          <TextField
            label="Service / Provider"
            value={f.provider}
            onChangeText={set("provider")}
            placeholder="e.g. Netflix, Spotify, AWS"
            testID="f-provider"
          />
          <TextField
            label="Product or service"
            value={f.product}
            onChangeText={set("product")}
            placeholder="e.g. Premium Family"
            testID="f-product"
          />
          <TextField
            label="Plan name (optional)"
            value={f.plan}
            onChangeText={set("plan")}
            placeholder="e.g. Individual 4K"
            testID="f-plan"
          />
          <SelectField
            label="Category"
            options={CATEGORIES}
            value={f.category}
            onChange={set("category")}
            testID="f-category"
          />
          <SelectField
            label="Status"
            options={STATUSES}
            value={f.status}
            onChange={set("status")}
            testID="f-status"
          />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Pricing & Cycle</Text>
          <TextField
            label="Price"
            value={f.price}
            onChangeText={set("price")}
            placeholder="e.g. 59.99"
            keyboardType="decimal-pad"
            testID="f-price"
          />
          <SelectField
            label="Currency"
            options={CURRENCIES}
            value={f.currency}
            onChange={set("currency")}
            testID="f-currency"
          />
          <SelectField
            label="Billing cycle"
            options={CYCLES}
            value={f.billing_cycle}
            onChange={set("billing_cycle")}
            testID="f-cycle"
          />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Expiry & Reminders</Text>
          <Text style={{ fontSize: 12, color: colors.warning, marginBottom: 8, fontWeight: "600" }}>
            Add the renewal / expiry date so we can remind you. You can skip it, but we will nudge you to add it or move this to Accounts.
          </Text>
          <TextField
            label="Renewal / expiry date"
            value={f.renewal_date}
            onChangeText={set("renewal_date")}
            placeholder="YYYY-MM-DD"
            testID="f-renewal"
          />

          {/* Quick Renewal Date Calculator Chips */}
          <View style={styles.quickDateRow}>
            <Text style={styles.quickDateLabel}>Quick add:</Text>
            {[
              { label: "Today", days: 0 },
              { label: "+7d", days: 7 },
              { label: "+14d", days: 14 },
              { label: "+30 days", days: 30 },
              { label: "+1 yr", days: 365 },
            ].map((chip) => (
              <Pressable
                key={chip.label}
                style={styles.quickDateChip}
                onPress={() => addDays(chip.days, "renewal_date")}
              >
                <Text style={styles.quickDateChipText}>{chip.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Start date (optional)"
            value={f.start_date}
            onChangeText={set("start_date")}
            placeholder="YYYY-MM-DD (or auto-estimated)"
            testID="f-start"
          />
          <TextField
            label="Trial end date (optional)"
            value={f.trial_end}
            onChangeText={set("trial_end")}
            placeholder="YYYY-MM-DD"
            testID="f-trial"
          />

          {/* Quick Trial Date Chips */}
          <View style={styles.quickDateRow}>
            <Text style={styles.quickDateLabel}>Trial:</Text>
            {[
              { label: "7 days", days: 7 },
              { label: "14 days", days: 14 },
              { label: "30 days", days: 30 },
            ].map((chip) => (
              <Pressable
                key={chip.label}
                style={[styles.quickDateChip, { backgroundColor: colors.pastelPeach }]}
                onPress={() => addDays(chip.days, "trial_end")}
              >
                <Text style={[styles.quickDateChipText, { color: colors.warning }]}>{chip.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.notifyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifyLabel}>Enable push reminders</Text>
              <Text style={styles.notifySub}>
                Get notified 3 days before renewal or trial expiration.
              </Text>
            </View>
            <Switch
              value={notify}
              onValueChange={setNotify}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Payment & Promo</Text>
          <TextField
            label="Card last 4 digits (optional)"
            value={f.card_last4}
            onChangeText={(value: string) =>
              set("card_last4")(value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="e.g. 4242"
            keyboardType="number-pad"
            testID="f-card"
          />
          <TextField
            label="Account email used (optional)"
            value={f.account_email}
            onChangeText={set("account_email")}
            placeholder="user@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="f-email"
          />
          {promoChoices.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700" }}>Your saved promo codes</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {promoChoices.slice(0, 8).map((p: any) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setF((prev: any) => ({ ...prev, promo_applied: p.code }))}
                    style={[styles.quickDateChip, f.promo_applied.toUpperCase() === p.code && { backgroundColor: colors.pastelMint }]}
                  >
                    <Text style={styles.quickDateChipText}>
                      {p.code}
                      {p.discount ? ` · ${p.discount}` : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <TextField
            label="Promo code applied (new codes are saved automatically)"
            value={f.promo_applied}
            onChangeText={set("promo_applied")}
            placeholder="e.g. SUMMER25"
            testID="f-promo"
          />
          <TextField
            label="Personal notes (optional)"
            value={f.notes}
            onChangeText={set("notes")}
            placeholder="e.g. Shared with roommates, cancel before price increase"
            multiline
            testID="f-notes"
          />
        </Card>
      </FormScroll>

      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title={editing ? "Save changes" : "Create subscription"}
            icon="check"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!f.provider.trim()}
            testID="save-subscription"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  sectionCard: {
    gap: 14,
    padding: 18,
  },
  sectionHeading: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.pastelLavender,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  notifyLabel: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  notifySub: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  quickDateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: -4,
    marginBottom: 4,
  },
  quickDateLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  quickDateChip: {
    backgroundColor: colors.pastelBlue,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickDateChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
}));
