import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useAccounts, useInvalidateAll } from "@/src/lib/api";
import { CATEGORIES } from "@/src/lib/format";
import { AppHeader, Card, Icon, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

const AUTH_METHODS = ["email", "google", "apple", "github", "phone", "other"];
const ACCOUNT_TYPES = ["free", "paid", "trial", "enterprise"];

export default function AddAccount() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const params = useLocalSearchParams<{
    id?: string;
    service_name?: string;
    service_url?: string;
    email_used?: string;
    category?: string;
    source_link_id?: string;
  }>();
  const { id } = params;
  const editing = !!id;

  const [f, setF] = useState<any>({
    service_name: params.service_name || "",
    service_url: params.service_url || "",
    category: params.category || "AI",
    email_used: params.email_used || "",
    username: "",
    phone_used: "",
    auth_method: "email",
    has_2fa: false,
    account_type: "free",
    platform_usage: "",
    allowed_credits: "",
    registration_date: new Date().toISOString().slice(0, 10),
    notes: "",
    source_link_id: params.source_link_id || null,
  });

  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (id) {
      api
        .account(id)
        .then((row) => {
          setF({
            service_name: row.service_name || "",
            service_url: row.service_url || "",
            category: row.category || "Other",
            email_used: row.email_used || "",
            username: row.username || "",
            phone_used: row.phone_used || "",
            auth_method: row.auth_method || "email",
            has_2fa: Boolean(row.has_2fa),
            account_type: row.account_type || "free",
            platform_usage: row.platform_usage || "",
            allowed_credits: row.allowed_credits || "",
            registration_date: row.registration_date || "",
            notes: row.notes || "",
            source_link_id: row.source_link_id || null,
          });
        })
        .catch(() => {});
    }
  }, [id]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...f,
        service_name: f.service_name.trim(),
        service_url: f.service_url.trim(),
        email_used: f.email_used.trim(),
        username: f.username.trim(),
      };
      if (editing && id) {
        return api.updateAccount(id, body);
      }
      return api.createAccount(body);
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title={editing ? "Edit Account" : "Add Registered Account"}
        subtitle="Keep track of logins, credentials, and registered services"
        back
      />
      <FormScroll>
        <Card style={styles.card}>
          <Text style={styles.cardHeader}>Service Details</Text>
          <TextField
            label="Service Name *"
            placeholder="e.g. ChatGPT, GitHub, Canva, Notion"
            value={f.service_name}
            onChangeText={set("service_name")}
            autoCapitalize="words"
          />
          <TextField
            label="Website or Login URL"
            placeholder="https://..."
            value={f.service_url}
            onChangeText={set("service_url")}
            autoCapitalize="none"
            keyboardType="url"
          />
          <SelectField
            label="Category"
            value={f.category}
            options={CATEGORIES}
            onSelect={set("category")}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardHeader}>Login Credentials & Access</Text>
          <TextField
            label="Email Address Used"
            placeholder="e.g. personal@gmail.com"
            value={f.email_used}
            onChangeText={set("email_used")}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Username / Handle (if applicable)"
            placeholder="e.g. @sabit"
            value={f.username}
            onChangeText={set("username")}
            autoCapitalize="none"
          />
          <TextField
            label="Phone Number (if used for registration)"
            placeholder="+1 ..."
            value={f.phone_used}
            onChangeText={set("phone_used")}
            keyboardType="phone-pad"
          />
          <SelectField
            label="Sign-in Method"
            value={f.auth_method}
            options={AUTH_METHODS}
            onSelect={set("auth_method")}
          />
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Two-Factor Authentication (2FA)</Text>
              <Text style={styles.switchSub}>Is 2FA enabled on this account?</Text>
            </View>
            <Switch
              value={f.has_2fa}
              onValueChange={set("has_2fa")}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardHeader}>Account Tier & Platform Quota</Text>
          <SelectField
            label="Account Tier"
            value={f.account_type}
            options={ACCOUNT_TYPES}
            onSelect={set("account_type")}
          />
          <TextField
            label="Platform Usage & Purpose"
            placeholder="e.g. Image Generation, App Development, Video Gen"
            value={f.platform_usage}
            onChangeText={set("platform_usage")}
          />
          <TextField
            label="Allowed Credits / Quota"
            placeholder="e.g. 500 fast hours, 1000 credits/mo, Free $5 credit"
            value={f.allowed_credits}
            onChangeText={set("allowed_credits")}
          />
          <TextField
            label="Registered Date (YYYY-MM-DD)"
            placeholder="2026-01-01"
            value={f.registration_date}
            onChangeText={set("registration_date")}
          />
          <TextField
            label="Notes & Context"
            placeholder="e.g. Registered with personal Gmail, used for work projects"
            value={f.notes}
            onChangeText={set("notes")}
            multiline
            numberOfLines={3}
          />
        </Card>
      </FormScroll>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PrimaryButton
            title={editing ? "Save Changes" : "Save Account"}
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!f.service_name.trim()}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    gap: 14,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurface,
  },
  switchSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bottomBar: {
    backgroundColor: colors.glassStrong,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
