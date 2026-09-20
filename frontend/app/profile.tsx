import { type ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { FormScroll, TextField } from "@/src/components/form";
import { AppHeader, Card, Icon, Loading, PrimaryButton } from "@/src/components/ui";
import {
  isHttpsBackend,
  loadClientConfig,
  saveClientConfig,
  secretsPersistOnThisPlatform,
  testBackendConnection,
  type ClientConfig,
} from "@/src/lib/client-config";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme } from "@/src/theme";

const EMPTY_CONFIG: ClientConfig = {
  displayName: "",
  backendUrl: "",
  backendToken: "",
  geminiApiKey: "",
  openAiApiKey: "",
};

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState<ClientConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"save" | "test" | "clear" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    loadClientConfig({ refresh: true })
      .then(setDraft)
      .catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not load profile." }))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ClientConfig) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setAction("save");
    setNotice(null);
    try {
      const saved = await saveClientConfig(draft);
      setDraft(saved);
      queryClient.clear();
      setNotice({ tone: "success", text: "Profile saved. App data will now use this backend." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save profile." });
    } finally {
      setAction(null);
    }
  };

  const test = async () => {
    setAction("test");
    setNotice({ tone: "info", text: "Testing your backend…" });
    try {
      const text = await testBackendConnection(draft);
      setNotice({ tone: "success", text });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Connection failed." });
    } finally {
      setAction(null);
    }
  };

  const clearKeys = async () => {
    const cleared = { ...draft, backendToken: "", geminiApiKey: "", openAiApiKey: "" };
    setAction("clear");
    setNotice(null);
    try {
      const saved = await saveClientConfig(cleared);
      setDraft(saved);
      queryClient.clear();
      setNotice({ tone: "success", text: "Saved tokens and provider keys were removed." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not clear keys." });
    } finally {
      setAction(null);
    }
  };

  if (loading) {
    return <View style={styles.container}><AppHeader title="Profile" back /><Loading /></View>;
  }

  const insecureConnection = !!draft.backendUrl && !isHttpsBackend(draft.backendUrl);

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" subtitle="Your app, backend, and provider keys" back />
      <FormScroll>
        <Section title="You">
          <TextField
            label="Display name"
            value={draft.displayName}
            onChangeText={set("displayName")}
            placeholder="Your name"
            autoCapitalize="words"
            testID="profile-display-name"
          />
        </Section>

        <Section title="Connection">
          <TextField
            label="SubMind backend URL"
            value={draft.backendUrl}
            onChangeText={set("backendUrl")}
            placeholder="https://api.example.com"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-backend-url"
          />
          <Text style={styles.help}>Enter the server origin only. A trailing /api is accepted and removed automatically.</Text>
          <TextField
            label="App access token (optional locally)"
            value={draft.backendToken}
            onChangeText={set("backendToken")}
            placeholder="Matches SUBMIND_API_TOKEN"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-backend-token"
          />
          {insecureConnection ? (
            <View style={[styles.notice, { backgroundColor: colors.warning + "20" }]}>
              <Icon name="alert-outline" size={18} color={colors.warning} />
              <Text style={[styles.noticeText, { color: colors.warning }]}>HTTP exposes tokens on the network. Use it only for trusted LAN development; use HTTPS for a real build.</Text>
            </View>
          ) : null}
        </Section>

        <Section title="Bring your own AI keys">
          <TextField
            label="Gemini API key"
            value={draft.geminiApiKey}
            onChangeText={set("geminiApiKey")}
            placeholder="Used for extraction, chat, and comparisons"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-gemini-key"
          />
          <TextField
            label="OpenAI API key"
            value={draft.openAiApiKey}
            onChangeText={set("openAiApiKey")}
            placeholder="Used only for voice transcription"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-openai-key"
          />
          <View style={styles.securityRow}>
            <Icon name={secretsPersistOnThisPlatform ? "shield-lock-outline" : "web"} size={20} color={colors.brandSecondary} />
            <Text style={styles.help}>
              {secretsPersistOnThisPlatform
                ? "On this phone, secrets are stored in the device keychain and sent only to the backend URL above. The backend uses them per request and does not save them."
                : "Browsers do not provide app-grade secure storage. Keys remain only for this page session; use the native phone app for saved keys."}
            </Text>
          </View>
          <PrimaryButton title="Remove saved keys" variant="secondary" icon="key-remove" onPress={clearKeys} loading={action === "clear"} disabled={!!action && action !== "clear"} />
        </Section>

        <Section title="App settings">
          <Card style={styles.linkCard} onPress={() => router.push("/settings")} testID="profile-open-settings">
            <View style={styles.linkIcon}><Icon name="tune-variant" size={20} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Preferences</Text>
              <Text style={styles.help}>Currency, AI processing, privacy, and monitoring</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.muted} />
          </Card>
        </Section>

        {notice ? (
          <View style={[styles.notice, { backgroundColor: colors[notice.tone] + "18" }]}>
            <Icon name={notice.tone === "success" ? "check-circle-outline" : notice.tone === "error" ? "alert-circle-outline" : "information-outline"} size={18} color={colors[notice.tone]} />
            <Text style={[styles.noticeText, { color: colors[notice.tone] }]}>{notice.text}</Text>
          </View>
        ) : null}
      </FormScroll>

      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton title="Test" variant="secondary" icon="lan-connect" onPress={test} loading={action === "test"} disabled={!draft.backendUrl || (!!action && action !== "test")} style={{ flex: 1 }} />
          <PrimaryButton title="Save profile" icon="content-save-outline" onPress={save} loading={action === "save"} disabled={!draft.backendUrl || (!!action && action !== "save")} style={{ flex: 2 }} testID="profile-save" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  section: { gap: 10 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: "800", textTransform: "uppercase", marginLeft: 4 },
  sectionCard: { gap: 14 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 },
  securityRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  notice: { borderRadius: 14, padding: 12, flexDirection: "row", gap: 9, alignItems: "flex-start" },
  noticeText: { fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "600" },
  linkCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 0, borderWidth: 0 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary + "16", alignItems: "center", justifyContent: "center" },
  linkTitle: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "800" },
  bar: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
}));
