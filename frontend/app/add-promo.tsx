import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader, Card, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { api, useInvalidateAll } from "@/src/lib/api";
import { CATEGORIES } from "@/src/lib/format";
import { scheduleReminderNotification } from "@/src/lib/notifications";
import { makeStyles, useTheme } from "@/src/theme";

const REMINDERS = ["None", "1 day before", "3 days before", "7 days before"];

export default function AddPromo() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [service, setService] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [expiry, setExpiry] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("Deals");
  const [reminder, setReminder] = useState("3 days before");

  const addDays = (days: number) => {
    const base = new Date();
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    setExpiry(`${yyyy}-${mm}-${dd}`);
  };

  useEffect(() => {
    if (!id) return;
    api
      .promo(id)
      .then((item) => {
        setService(item.service || "");
        setCode(item.code || "");
        setDiscount(item.discount || "");
        setExpiry(item.expiry_date || "");
        setSource(item.source || "");
        setUrl(item.url || "");
        setNotes(item.notes || "");
        if (item.category) setCategory(item.category);
      })
      .catch(() => {});
  }, [id]);

  const save = useMutation({
    mutationFn: async () => {
      const days = reminder === "None" ? null : Number(reminder.split(" ")[0]);
      const body = {
        service: service.trim(),
        code: code.trim(),
        discount: discount.trim(),
        expiry_date: expiry.trim(),
        source: source.trim(),
        url: url.trim(),
        notes: notes.trim(),
        category: category.trim(),
      };
      if (id) return api.updatePromo(id, body);
      const result = await api.createPromo({ ...body, remind_days_before: days });
      if (days != null && expiry.trim()) {
        await scheduleReminderNotification({
          title: `Promo expires: ${service.trim()}`,
          date: expiry.trim(),
          daysBefore: days,
        });
      }
      return result;
    },
    onSuccess: () => {
      invalidate();
      router.replace("/promos");
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title={id ? "Edit Promo Code" : "Save Promo Code"}
        subtitle="Store discounts and set expiration alerts"
        back
      />
      <FormScroll>
        <Card style={styles.card}>
          <TextField
            label="Service or Tool"
            value={service}
            onChangeText={setService}
            placeholder="e.g. Figma, Canva, Adobe"
            testID="promo-service"
          />
          <TextField
            label="Promo Code"
            value={code}
            onChangeText={setCode}
            placeholder="e.g. STUDENT25, SAVE50"
            autoCapitalize="characters"
            testID="promo-code"
          />
          <TextField
            label="Discount / Offer"
            value={discount}
            onChangeText={setDiscount}
            placeholder="e.g. 25% off annual plan"
            testID="promo-discount"
          />
          <TextField
            label="Expiration Date (optional)"
            value={expiry}
            onChangeText={setExpiry}
            placeholder="YYYY-MM-DD"
            testID="promo-expiry"
          />

          {/* Quick Date Chips */}
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
                onPress={() => addDays(chip.days)}
              >
                <Text style={styles.quickDateChipText}>{chip.label}</Text>
              </Pressable>
            ))}
          </View>

          <SelectField
            label="Category"
            options={["Deals", ...CATEGORIES]}
            value={category}
            onChange={setCategory}
            testID="promo-category"
          />

          {!id ? (
            <SelectField
              label="Expiry Alert"
              options={REMINDERS}
              value={reminder}
              onChange={setReminder}
              testID="promo-remind"
            />
          ) : null}
          <TextField
            label="Source"
            value={source}
            onChangeText={setSource}
            placeholder="Where you discovered it (e.g. Twitter, Email)"
            testID="promo-source"
          />
          <TextField
            label="Redemption URL (optional)"
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            keyboardType="url"
            autoCapitalize="none"
            testID="promo-url"
          />
          <TextField
            label="Notes or Restrictions"
            value={notes}
            onChangeText={setNotes}
            placeholder="Eligible tiers, region locks, or checkout instructions"
            multiline
            testID="promo-notes"
          />
          {save.error ? (
            <Text style={styles.error}>
              {save.error instanceof Error
                ? save.error.message
                : "Could not save this promo code."}
            </Text>
          ) : null}
        </Card>
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title={id ? "Save changes" : "Save promo code"}
            icon="ticket-percent-outline"
            onPress={() => save.mutate()}
            disabled={!service.trim() || !code.trim()}
            loading={save.isPending}
            testID="promo-save"
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
  card: {
    gap: 14,
    padding: 18,
  },
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
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
