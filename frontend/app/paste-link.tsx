import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

import { api, useInvalidateAll, useLinks } from "@/src/lib/api";
import { AppHeader, Card, Icon, PrimaryButton } from "@/src/components/ui";
import { FormScroll, SelectField, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

const SOURCES = [
  "Website",
  "GitHub",
  "Instagram",
  "Threads",
  "YouTube",
  "Reddit",
  "X",
  "Other",
];

function cleanUrl(value: string) {
  const input = value.trim();
  if (!input) return "";
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes("."))
      return "";
    parsed.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ].forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export default function PasteLink() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; url?: string; note?: string }>();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const links = useLinks();
  const [url, setUrl] = useState(params.url || "");
  const [note, setNote] = useState(params.note || "");
  const [source, setSource] = useState(
    SOURCES.includes(params.source || "") ? params.source! : "Website"
  );
  const normalized = cleanUrl(url);
  const duplicate = normalized
    ? (links.data || []).find((item: any) => cleanUrl(item.url) === normalized)
    : null;

  const save = useMutation({
    mutationFn: () => api.ingestLink(normalized, source, note),
    onSuccess: (res) => {
      invalidate();
      router.replace(res?.inbox ? "/(tabs)/inbox" : "/link-vault");
    },
  });

  const paste = async () => {
    const t = await Clipboard.getStringAsync();
    if (t) setUrl(t);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Paste a Link"
        subtitle="Save any website, video or post"
        back
      />
      <FormScroll>
        <Card style={styles.hint}>
          <View style={styles.hintIconBox}>
            <Icon name="link-variant" size={18} color={colors.brandPrimary} />
          </View>
          <Text style={styles.hintText}>
            {"We'll save the link to your vault, then AI will generate a summary and tags automatically."}
          </Text>
        </Card>

        <Card style={styles.card}>
          <TextField
            label="URL Address"
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/item"
            keyboardType="url"
            autoCapitalize="none"
            testID="link-url"
          />
          {url.trim() && !normalized ? (
            <Text style={styles.error}>Please enter a valid website address.</Text>
          ) : null}

          <PrimaryButton
            title="Paste from clipboard"
            icon="content-paste"
            variant="secondary"
            onPress={paste}
            testID="link-paste"
            style={{ marginTop: 4 }}
          />

          <PrimaryButton
            title="Extract link from screenshot"
            icon="bookmark-box-multiple-outline"
            variant="secondary"
            onPress={() => router.push("/scan?target=link&mode=library" as any)}
            testID="link-from-photo"
            style={{ marginTop: 6 }}
          />

          <SelectField
            label="Platform / Source"
            options={SOURCES}
            value={source}
            onChange={setSource}
            testID="link-source"
          />

          <TextField
            label="Note or Context (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Why are you saving this plan or tool?"
            multiline
            testID="link-note"
          />
        </Card>

        {duplicate ? (
          <Card style={styles.duplicate}>
            <View style={styles.dupHead}>
              <Icon name="information" size={18} color={colors.warning} />
              <Text style={styles.duplicateTitle}>Already in your vault</Text>
            </View>
            <Text style={styles.duplicateText}>{duplicate.title}</Text>
            <View style={styles.duplicateActions}>
              <PrimaryButton
                title="View existing"
                variant="secondary"
                onPress={() => router.push(`/link/${duplicate.id}`)}
              />
              <PrimaryButton
                title="Edit existing"
                variant="secondary"
                onPress={() => router.push(`/edit-link?id=${duplicate.id}` as any)}
              />
            </View>
          </Card>
        ) : null}
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title={duplicate ? "Save as duplicate" : "Save to Vault"}
            icon="check"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!normalized}
            testID="link-save"
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
  hint: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.pastelBlue,
    borderColor: colors.brandPrimary + "33",
    padding: 14,
  },
  hintIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  duplicate: {
    backgroundColor: colors.pastelOrange,
    borderColor: colors.warning + "44",
    padding: 16,
    gap: 8,
  },
  dupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  duplicateTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
  },
  duplicateText: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
  },
  duplicateActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
