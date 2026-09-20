import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useSettings } from "@/src/lib/api";
import { CURRENCIES } from "@/src/lib/format";
import { AppHeader, Card, Chip, Icon, Loading, PrimaryButton } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSettings();

  const patch = useMutation({ mutationFn: (body: any) => api.patchSettings(body), onSuccess: () => refetch() });
  const set = (key: string, value: any) => patch.mutate({ [key]: value });
  const resetOnboarding = async () => { await storage.setItem("onboarded", false); router.replace("/onboarding"); };

  if (isLoading) return <View style={styles.container}><AppHeader title="Settings" back /><Loading /></View>;
  if (isError || !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Settings" back />
        <View style={styles.errorState}>
          <Icon name="server-network-off" size={34} color={colors.error} />
          <Text style={styles.errorTitle}>Settings backend unavailable</Text>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : "Check the backend in Profile."}</Text>
          <PrimaryButton title="Open profile" icon="account-cog-outline" onPress={() => router.push("/profile")} />
          <PrimaryButton title="Try again" variant="secondary" icon="refresh" onPress={() => refetch()} />
        </View>
      </View>
    );
  }

  const thresholdPct = Math.round((data.auto_add_threshold || 0.95) * 100);

  return (
    <View style={styles.container}>
      <AppHeader title="Settings" back />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Section title="Profile & connection">
          <ToggleRowStatic icon="account-cog-outline" label="Profile, backend & API keys" onPress={() => router.push("/profile")} />
        </Section>

        <Section title="AI & processing">
          <ToggleRow icon="brain" label="AI processing" value={data.ai_enabled} onChange={(value: boolean) => set("ai_enabled", value)} />
          <ToggleRow icon="image-lock" label="Keep original screenshots" sub="Off = extract then discard image" value={data.keep_screenshots} onChange={(value: boolean) => set("keep_screenshots", value)} />
          <View style={styles.rowCol}>
            <Text style={styles.label}>Auto-add confidence</Text>
            <Text style={styles.sub}>Items above this are added automatically ({thresholdPct}%).</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {[0.85, 0.9, 0.95, 0.98].map((threshold) => <Chip key={threshold} label={`${Math.round(threshold * 100)}%`} active={Math.abs(data.auto_add_threshold - threshold) < 0.001} onPress={() => set("auto_add_threshold", threshold)} testID={`thr-${threshold}`} />)}
            </ScrollView>
          </View>
        </Section>

        <Section title="Money">
          <View style={styles.rowCol}>
            <Text style={styles.label}>Default currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {CURRENCIES.map((currency) => <Chip key={currency} label={currency} active={data.currency === currency} onPress={() => set("currency", currency)} testID={`cur-${currency}`} />)}
            </ScrollView>
          </View>
        </Section>

        <Section title="Monitoring">
          <ToggleRow icon="chart-line" label="Price monitoring" sub="Track watchlist plan prices" value={data.price_monitoring} onChange={(value: boolean) => set("price_monitoring", value)} />
        </Section>

        <Section title="Privacy">
          <Card style={styles.privacy}>
            <Icon name="shield-check-outline" size={20} color={colors.brandSecondary} />
            <Text style={styles.privacyText}>SubMind processes only what you share. AI content goes from your own backend to the provider configured in Profile or on the server. Screenshots, microphone, and sharing remain optional.</Text>
          </Card>
        </Section>

        <Section title="About">
          <ToggleRowStatic icon="restart" label="Replay onboarding" onPress={resetOnboarding} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: any) {
  const styles = useStyles();
  return <View style={{ gap: 10 }}><Text style={styles.sectionTitle}>{title}</Text><Card style={{ gap: 4, paddingVertical: 6 }}>{children}</Card></View>;
}

function ToggleRow({ icon, label, sub, value, onChange }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.iconBox}><Icon name={icon} size={18} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}><Text style={styles.rowLabel}>{label}</Text>{sub ? <Text style={styles.sub}>{sub}</Text> : null}</View>
      <Switch value={!!value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary, false: colors.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

function ToggleRowStatic({ icon, label, onPress }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.iconBox}><Icon name={icon} size={18} color={colors.brandPrimary} /></View>
      <Text style={[styles.rowLabel, { flex: 1 }]} onPress={onPress}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: "800", textTransform: "uppercase", marginLeft: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandPrimary + "16", alignItems: "center", justifyContent: "center" },
  rowLabel: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "700" },
  rowCol: { paddingVertical: 10 },
  label: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  privacy: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: colors.brandSecondary + "12", borderColor: colors.brandSecondary + "22" },
  privacyText: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  errorState: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 14 },
  errorTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  errorText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 8 },
}));
