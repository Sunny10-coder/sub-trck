import * as Clipboard from "expo-clipboard";
import { type ReactNode, useEffect, useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { FormScroll, TextField } from "@/src/components/form";
import { AppHeader, Card, Icon, Loading, PrimaryButton } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { exportAndShare } from "@/src/lib/share-export";
import {
  loadClientConfig,
  saveClientConfig,
  secretsPersistOnThisPlatform,
  type ClientConfig,
} from "@/src/lib/client-config";
import { queryClient } from "@/src/query-client";
import { makeStyles, useTheme } from "@/src/theme";

const EMPTY_CONFIG: ClientConfig = {
  displayName: "",
  geminiApiKey: "",
  nvidiaApiKey: "",
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
  const [action, setAction] = useState<string | null>(null);
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
      setNotice({ tone: "success", text: "Profile saved. Subscriptions stay on this phone." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not save profile." });
    } finally {
      setAction(null);
    }
  };

  const clearKeys = async () => {
    const cleared = { ...draft, geminiApiKey: "", nvidiaApiKey: "", openAiApiKey: "" };
    setAction("clear");
    setNotice(null);
    try {
      const saved = await saveClientConfig(cleared);
      setDraft(saved);
      queryClient.clear();
      setNotice({ tone: "success", text: "Saved provider keys were removed." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not clear keys." });
    } finally {
      setAction(null);
    }
  };

  const exportExcel = async (scope: "plans" | "accounts" | "all") => {
    setAction(`excel-${scope}`);
    setNotice(null);
    try {
      const name = await exportAndShare(scope);
      setNotice({ tone: "success", text: `Excel file ready: ${name}` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not export Excel file." });
    } finally {
      setAction(null);
    }
  };

  const exportBackup = async () => {
    setAction("export");
    setNotice(null);
    try {
      const backup = await api.exportBackup();
      const result = await Share.share({ message: backup, title: "SubMind backup" });
      if (result.action === Share.dismissedAction) {
        setNotice({ tone: "info", text: "Export cancelled. Your data is still on this phone." });
        return;
      }
      setNotice({ tone: "success", text: "Backup shared. Keep that file; restore it later from Profile." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not export data." });
    } finally {
      setAction(null);
    }
  };

  const restoreBackup = async () => {
    setAction("restore");
    setNotice(null);
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (!text) throw new Error("Copy a SubMind backup JSON first, then tap Restore backup.");
      await api.replaceBackup(text);
      queryClient.clear();
      setNotice({ tone: "success", text: "Backup restored onto this phone." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not restore backup." });
    } finally {
      setAction(null);
    }
  };

  const wipeData = () => {
    Alert.alert(
      "Clear all phone data?",
      "This removes subscriptions, links, reminders, inbox items, and chat history stored on this device. API keys in Profile are not removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setAction("wipe");
            setNotice(null);
            try {
              await api.clearAll();
              queryClient.clear();
              setNotice({ tone: "success", text: "All local SubMind data was removed from this phone." });
            } catch (error) {
              setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not clear data." });
            } finally {
              setAction(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={styles.container}><AppHeader title="Profile" back /><Loading /></View>;
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" subtitle="Saved on this phone" back />
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

        <Section title="Phone storage">
          <View style={styles.securityRow}>
            <Icon name="cellphone-key" size={20} color={colors.brandSecondary} />
            <Text style={styles.help}>
              Subscriptions, links, reminders, and inbox items are stored only on this device. Uninstalling the app deletes them unless you export a backup first.
            </Text>
          </View>
          <PrimaryButton title="Export Plans to Excel" variant="secondary" icon="microsoft-excel" onPress={() => exportExcel("plans")} loading={action === "excel-plans"} disabled={!!action && action !== "excel-plans"} />
          <PrimaryButton title="Export Accounts to Excel" variant="secondary" icon="microsoft-excel" onPress={() => exportExcel("accounts")} loading={action === "excel-accounts"} disabled={!!action && action !== "excel-accounts"} />
          <PrimaryButton title="Export everything to Excel" variant="secondary" icon="file-excel-outline" onPress={() => exportExcel("all")} loading={action === "excel-all"} disabled={!!action && action !== "excel-all"} />
          <PrimaryButton title="Export JSON backup" variant="secondary" icon="export" onPress={exportBackup} loading={action === "export"} disabled={!!action && action !== "export"} />
          <PrimaryButton title="Restore backup" variant="secondary" icon="import" onPress={restoreBackup} loading={action === "restore"} disabled={!!action && action !== "restore"} />
          <Text style={styles.help}>Restore copies the SubMind JSON currently on the clipboard onto this phone.</Text>
          <PrimaryButton title="Clear all data" variant="secondary" icon="delete-outline" onPress={wipeData} loading={action === "wipe"} disabled={!!action && action !== "wipe"} />
        </Section>

        <Section title="Optional AI keys">
          <TextField
            label="Gemini API key"
            value={draft.geminiApiKey}
            onChangeText={set("geminiApiKey")}
            placeholder="Gemini key for extraction, chat, and comparisons"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-gemini-key"
          />
          <TextField
            label="NVIDIA API key (fallback)"
            value={draft.nvidiaApiKey}
            onChangeText={set("nvidiaApiKey")}
            placeholder="Used if Gemini is unavailable"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            testID="profile-nvidia-key"
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
                ? "Keys stay in this phone's secure storage. They are sent only to Google or OpenAI when you use AI features, never to a SubMind server."
                : "Browsers do not provide app-grade secure storage. Keys remain only for this page session; use the phone app for saved keys."}
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
          <PrimaryButton title="Save profile" icon="content-save-outline" onPress={save} loading={action === "save"} disabled={!!action && action !== "save"} testID="profile-save" />
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
  section: { gap: 8 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  sectionCard: { gap: 14, padding: 18, borderRadius: 22 },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "500" },
  securityRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.surfaceSecondary, padding: 12, borderRadius: 14 },
  notice: { borderRadius: 10, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noticeText: { fontSize: 13, lineHeight: 18, flex: 1, fontWeight: "600" },
  linkCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 0, borderWidth: 0, backgroundColor: "transparent" },
  linkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.pastelBlue, alignItems: "center", justifyContent: "center" },
  linkTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  bar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.glassStrong, borderTopWidth: 1, borderTopColor: colors.border },
}));
