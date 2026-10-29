import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { CURRENCIES, CYCLES } from "@/src/lib/format";
import { AppHeader, Card, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { makeStyles } from "@/src/theme";

export default function AddPlan() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [f, setF] = useState<any>({
    provider: "",
    plan: "",
    price: "",
    currency: "AED",
    billing_cycle: "monthly",
    url: "",
    offer_expiry: "",
    notes: "",
  });
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api
      .plan(id)
      .then((row) => {
        setF({
          provider: row.provider || "",
          plan: row.plan || "",
          price: row.price != null ? String(row.price) : "",
          currency: row.currency || "AED",
          billing_cycle: row.billing_cycle || "monthly",
          url: row.url || "",
          offer_expiry: row.offer_expiry || "",
          notes: row.notes || "",
        });
      })
      .catch(() => {});
  }, [id]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        price: f.price ? parseFloat(f.price) : null,
        offer_expiry: f.offer_expiry || null,
      };
      return editing ? api.updatePlan(id!, body) : api.createPlan(body);
    },
    onSuccess: () => {
      invalidate();
      router.replace("/watchlist");
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title={editing ? "Edit Watched Plan" : "Watch a New Plan"}
        subtitle="Track potential tools and price changes"
        back
      />
      <FormScroll>
        <Card style={styles.card}>
          <TextField
            label="Service / Provider"
            value={f.provider}
            onChangeText={set("provider")}
            placeholder="e.g. Midjourney, Framer, Cursor"
            testID="plan-provider"
          />
          <TextField
            label="Plan Name"
            value={f.plan}
            onChangeText={set("plan")}
            placeholder="e.g. Pro, Starter, Lifetime"
            testID="plan-plan"
          />
          <TextField
            label="Price"
            value={f.price}
            onChangeText={set("price")}
            placeholder="99"
            keyboardType="decimal-pad"
            testID="plan-price"
          />
          <SelectField
            label="Currency"
            options={CURRENCIES}
            value={f.currency}
            onChange={set("currency")}
            testID="plan-currency"
          />
          <SelectField
            label="Billing cycle"
            options={CYCLES}
            value={f.billing_cycle}
            onChange={set("billing_cycle")}
            testID="plan-cycle"
          />
          <TextField
            label="Website or pricing URL (optional)"
            value={f.url}
            onChangeText={set("url")}
            placeholder="https://…"
            testID="plan-url"
          />
          <TextField
            label="Offer expiry date (optional)"
            value={f.offer_expiry}
            onChangeText={set("offer_expiry")}
            placeholder="YYYY-MM-DD"
            testID="plan-offer"
          />
          <TextField
            label="Notes"
            value={f.notes}
            onChangeText={set("notes")}
            placeholder="What features do you need? Why watch this?"
            multiline
            testID="plan-notes"
          />
        </Card>
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title={editing ? "Save changes" : "Save to Watchlist"}
            icon="eye-plus-outline"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!f.provider}
            testID="plan-save"
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
}));
