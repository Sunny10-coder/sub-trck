import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useSettings } from "@/src/lib/api";
import { CURRENCIES } from "@/src/lib/format";
import { AppHeader, Card, Chip, Icon, Loading, PrimaryButton } from "@/src/components/ui";
import { loadThemePref, makeStyles, saveThemePref, useTheme, type ThemePref } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { testNotification } from "@/src/lib/notifications";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "white-balance-sunny" },
  { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
  { value: "system", label: "System", icon: "cellphone-cog" },
];

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSettings();
  const [themePref, setThemePrefState] = useState<ThemePref>("light");
  const [testingNotification, setTestingNotification] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  useEffect(() => {
    loadThemePref().then(setThemePrefState);
  }, []);

  const pickTheme = async (pref: ThemePref) => {
    setThemePrefState(pref);
    await saveThemePref(pref);
  };

  const patch = useMutation({
    mutationFn: (body: any) => api.patchSettings(body),
    onSuccess: () => refetch(),
  });

  const set = (key: string, value: any) => patch.mutate({ [key]: value });
  const resetOnboarding = async () => {
    await storage.setItem("onboarded", false);
    router.replace("/onboarding");
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Settings" back />
        <Loading />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Settings" back />
        <View style={styles.errorState}>
          <Icon name="database-off-outline" size={34} color={colors.error} />
          <Text style={styles.errorTitle}>Could not load settings</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Local settings on this phone could not be read."}
          </Text>
          <PrimaryButton title="Open profile" icon="account-cog-outline" onPress={() => router.push("/profile")} />
          <PrimaryButton title="Try again" variant="secondary" icon="refresh" onPress={() => refetch()} />
        </View>
      </View>
    );
  }

  const thresholdPct = Math.round((data.auto_add_threshold || 0.95) * 100);

  return (
    <View style={styles.container}>
      <AppHeader title="Settings" subtitle="App preferences & storage" back />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 36,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Account & Storage">
          <ToggleRowStatic
            icon="account-cog-outline"
            label="Profile, phone storage & API keys"
            sub="Manage your keys and export backups"
            onPress={() => router.push("/profile")}
          />
        </Section>

        <Section title="Appearance">
          <View style={styles.rowCol}>
            <Text style={styles.label}>Interface Theme</Text>
            <Text style={styles.sub}>Light is the primary 2026 design. System follows your device setting.</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {THEME_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={themePref === opt.value}
                  onPress={() => pickTheme(opt.value)}
                  testID={`theme-${opt.value}`}
                />
              ))}
            </View>
          </View>
        </Section>

        <Section title="AI & Automation">
          <ToggleRow
            icon="brain"
            label="AI feature processing"
            sub="Smart categorizer, voice chat, and extraction"
            value={data.ai_enabled}
            onChange={(value: boolean) => set("ai_enabled", value)}
          />
          <ToggleRow
            icon="image-lock"
            label="Keep original screenshots"
            sub="When off, image is discarded after extraction"
            value={data.keep_screenshots}
            onChange={(value: boolean) => set("keep_screenshots", value)}
          />
          <View style={styles.rowCol}>
            <Text style={styles.label}>Auto-add confidence ({thresholdPct}%)</Text>
            <Text style={styles.sub}>Items above this confidence level save directly without review.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
              {[0.85, 0.9, 0.95, 0.98].map((threshold) => (
                <Chip
                  key={threshold}
                  label={`${Math.round(threshold * 100)}%`}
                  active={Math.abs(data.auto_add_threshold - threshold) < 0.001}
                  onPress={() => set("auto_add_threshold", threshold)}
                  testID={`thr-${threshold}`}
                />
              ))}
            </ScrollView>
          </View>
        </Section>

        <Section title="Currency">
          <View style={styles.rowCol}>
            <Text style={styles.label}>Default Currency</Text>
            <Text style={styles.sub}>Applied to new subscriptions and spend totals</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
              {CURRENCIES.map((currency) => (
                <Chip
                  key={currency}
                  label={currency}
                  active={data.currency === currency}
                  onPress={() => set("currency", currency)}
                  testID={`cur-${currency}`}
                />
              ))}
            </ScrollView>
          </View>
        </Section>

        <Section title="Notifications & Monitoring">
          <ToggleRow
            icon="bell-ring-outline"
            label="Renewal reminders"
            sub="Receive alerts before subscriptions renew or trials end"
            value={data.notify_reminders !== false}
            onChange={(value: boolean) => set("notify_reminders", value)}
          />
          <ToggleRow
            icon="chart-line"
            label="Watchlist price monitoring"
            sub="Check for plan discounts & price drops"
            value={data.price_monitoring}
            onChange={(value: boolean) => set("price_monitoring", value)}
          />
          <ToggleRowStatic
            icon="bell-check-outline"
            label="Test Notification & Chime"
            sub={notifMessage || "Click to verify PC/mobile alert & sound"}
            onPress={async () => {
              setTestingNotification(true);
              const res = await testNotification();
              setNotifMessage(res.message);
              setTestingNotification(false);
            }}
          />
        </Section>

        <Section title="Privacy & Security">
          <Card style={styles.privacy}>
            <View style={styles.privacyIconBox}>
              <Icon name="shield-check-outline" size={20} color={colors.brandSecondary} />
            </View>
            <Text style={styles.privacyText}>
              Your data stays offline on this device. Optional AI queries only send the specific note or link content you prompt, directly to your configured provider key.
            </Text>
          </Card>
        </Section>

        <Section title="System">
          <ToggleRowStatic icon="restart" label="Replay onboarding tour" onPress={resetOnboarding} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: any) {
  const styles = useStyles();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={{ gap: 4, paddingVertical: 8, paddingHorizontal: 16 }}>{children}</Card>
    </View>
  );
}

function ToggleRow({ icon, label, sub, value, onChange }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={18} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ true: colors.brandPrimary, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ToggleRowStatic({ icon, label, sub, onPress }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={18} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel} onPress={onPress}>
          {label}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.pastelBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowCol: { paddingVertical: 10 },
  label: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  privacy: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: colors.pastelLavender,
    borderColor: colors.brandSecondary + "33",
    padding: 14,
    borderRadius: 10,
  },
  privacyIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FFFFFF80",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyText: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1, fontWeight: "500" },
  errorState: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 14 },
  errorTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 8 },
}));
