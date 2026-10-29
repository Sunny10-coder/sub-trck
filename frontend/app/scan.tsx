import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { formatDate, money } from "@/src/lib/format";
import { AppHeader, Card, ConfidenceBadge, Icon, PrimaryButton } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function Scan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const { mode, target } = useLocalSearchParams<{ mode?: string; target?: string }>();
  const [targetMode, setTargetMode] = useState<"subscription" | "link">(
    target === "link" ? "link" : "subscription"
  );
  const [status, setStatus] = useState<
    "idle" | "picking" | "processing" | "done" | "error" | "blocked"
  >("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [blockedKind, setBlockedKind] = useState<"library" | "camera">("library");

  const run = useCallback(
    async (source: "library" | "camera") => {
      setStatus("picking");
      setBlockedKind(source);
      try {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setStatus(permission.canAskAgain ? "idle" : "blocked");
          return;
        }
        const response =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({
                base64: true,
                quality: 0.5,
                mediaTypes: ["images"],
              })
            : await ImagePicker.launchImageLibraryAsync({
                base64: true,
                quality: 0.5,
                mediaTypes: ["images"],
              });
        const imageBase64 = response.assets?.[0]?.base64;
        if (response.canceled || !imageBase64) {
          setStatus("idle");
          return;
        }
        const asset = response.assets[0];
        setPreview(asset.uri);
        setStatus("processing");
        const inbox = await api.ingestImage(imageBase64, "screenshot");
        setResult(inbox);
        invalidate();
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [invalidate]
  );

  const preferCamera = mode === "camera";
  const [saving, setSaving] = useState<"subscription" | "check_later" | null>(null);
  const ex = result?.extraction || {};

  const saveAs = async (action: "subscription" | "check_later") => {
    if (!result?.id) return;
    setSaving(action);
    try {
      await api.inboxAction(result.id, { action });
      invalidate();
      router.replace(
        action === "check_later" ? "/link-vault" : "/(tabs)/subscriptions"
      );
    } catch {
      setStatus("error");
    } finally {
      setSaving(null);
    }
  };

  const isSub = targetMode === "subscription";

  return (
    <View style={styles.container}>
      <AppHeader
        title={isSub ? "Scan Subscription Receipt" : "Save Link from Screenshot"}
        subtitle={
          isSub
            ? "AI parses provider, price, cycle & renewals"
            : "AI detects website URL, headline & tags"
        }
        back
      />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 16,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Target Mode Segmented Switch */}
        <View style={styles.targetSwitchRow}>
          <Pressable
            onPress={() => setTargetMode("subscription")}
            style={[
              styles.targetSwitchBtn,
              isSub && {
                backgroundColor: colors.brandPrimary,
                borderColor: colors.brandPrimary,
              },
            ]}
          >
            <Icon
              name="receipt-text-outline"
              size={17}
              color={isSub ? colors.onBrandPrimary : colors.onSurface}
            />
            <Text
              style={[
                styles.targetSwitchText,
                isSub && { color: colors.onBrandPrimary, fontWeight: "700" },
              ]}
            >
              Subscription Bill
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTargetMode("link")}
            style={[
              styles.targetSwitchBtn,
              !isSub && {
                backgroundColor: colors.warning,
                borderColor: colors.warning,
              },
            ]}
          >
            <Icon
              name="bookmark-box-multiple-outline"
              size={17}
              color={!isSub ? "#FFFFFF" : colors.onSurface}
            />
            <Text
              style={[
                styles.targetSwitchText,
                !isSub && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              Link / Webpage
            </Text>
          </Pressable>
        </View>

        {preview ? (
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
        ) : null}

        {(status === "picking" || status === "processing") && (
          <Card style={styles.center}>
            <View style={styles.loadingOrb}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
            </View>
            <Text style={styles.centerTitle}>
              {status === "processing" ? "Analyzing with AI…" : "Opening gallery…"}
            </Text>
            <Text style={styles.centerText}>
              {status === "processing"
                ? isSub
                  ? "Extracting provider, renewal dates, prices and billing cycle."
                  : "Extracting webpage link, article headline, source and tags."
                : isSub
                ? "Select a clear screenshot of your receipt, bill or subscription invoice."
                : "Select a clear screenshot of a webpage, article or tweet."}
            </Text>
          </Card>
        )}

        {status === "blocked" && (
          <Card style={styles.center}>
            <View style={[styles.heroIcon, { backgroundColor: colors.pastelOrange }]}>
              <Icon name="lock-outline" size={30} color={colors.warning} />
            </View>
            <Text style={styles.centerTitle}>Permission Required</Text>
            <Text style={styles.centerText}>
              {blockedKind === "camera"
                ? "Camera permission is disabled."
                : "Photo library permission is disabled."}{" "}
              Please enable it in Settings to upload photos.
            </Text>
            <PrimaryButton
              title="Open Device Settings"
              icon="cog"
              variant="secondary"
              onPress={() => Linking.openSettings()}
            />
          </Card>
        )}

        {status === "idle" && !preview && (
          <Card style={styles.center}>
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: isSub ? colors.pastelBlue : colors.pastelYellow },
              ]}
            >
              <Icon
                name={isSub ? "receipt-text-outline" : "bookmark-box-multiple-outline"}
                size={36}
                color={isSub ? colors.brandPrimary : colors.accentOrange}
              />
            </View>
            <Text style={styles.centerTitle}>
              {isSub ? "Upload Bill or Receipt" : "Upload Webpage Screenshot"}
            </Text>
            <Text style={styles.centerText}>
              {isSub
                ? "Upload a subscription confirmation, app store receipt or invoice. AI will extract plan details, price and renewal date directly into SubMind."
                : "Upload a screenshot of an article, website, tweet or saved tool. AI will identify the URL, author and tags for your Link Vault."}
            </Text>
            <View style={{ width: "100%", gap: 10, marginTop: 6 }}>
              <PrimaryButton
                title={isSub ? "Select receipt from gallery" : "Select screenshot from gallery"}
                icon="image-plus"
                onPress={() => run("library")}
                testID="scan-start"
              />
              <PrimaryButton
                title={isSub ? "Photograph bill with camera" : "Take photo with camera"}
                icon="camera"
                variant="secondary"
                onPress={() => run("camera")}
              />
            </View>
            {preferCamera ? (
              <Text style={styles.hint}>
                Camera ready. A digital screenshot provides best extraction quality.
              </Text>
            ) : null}
          </Card>
        )}

        {status === "error" && (
          <Card style={styles.center}>
            <View style={[styles.heroIcon, { backgroundColor: colors.pastelPink }]}>
              <Icon name="alert-circle-outline" size={30} color={colors.error} />
            </View>
            <Text style={styles.centerTitle}>Analysis Issue</Text>
            <Text style={styles.centerText}>
              {"We couldn't parse text clearly from that image. Please try another photo."}
            </Text>
            <PrimaryButton
              title="Upload another"
              icon="image-plus"
              onPress={() => run("library")}
            />
          </Card>
        )}

        {status === "done" && (
          <Card testID="scan-result" style={styles.resultCard}>
            <View style={styles.resultTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>
                  {ex.provider || ex.product || (isSub ? "Subscription Receipt" : "Saved Web Link")}
                </Text>
                <Text style={styles.resultType}>
                  {(ex.content_type || (isSub ? "subscription" : "link")).toUpperCase()}
                  {ex.plan ? ` · ${ex.plan}` : ""}
                </Text>
              </View>
              <ConfidenceBadge value={result.confidence} />
            </View>

            <View style={styles.resultDetailsBox}>
              {ex.price != null ? (
                <View style={styles.resultRow}>
                  <Text style={styles.rowLabel}>Price</Text>
                  <Text style={styles.rowVal}>
                    {money(ex.price, ex.currency)} / {ex.billing_cycle || "month"}
                  </Text>
                </View>
              ) : null}
              {ex.renewal_date ? (
                <View style={styles.resultRow}>
                  <Text style={styles.rowLabel}>Next Renewal</Text>
                  <Text style={styles.rowVal}>{formatDate(ex.renewal_date)}</Text>
                </View>
              ) : null}
              {ex.trial_end ? (
                <View style={styles.resultRow}>
                  <Text style={styles.rowLabel}>Trial Ending</Text>
                  <Text style={styles.rowVal}>{formatDate(ex.trial_end)}</Text>
                </View>
              ) : null}
              {ex.url ? (
                <View style={styles.resultRow}>
                  <Text style={styles.rowLabel}>Detected URL</Text>
                  <Text style={[styles.rowVal, { flex: 1, textAlign: "right" }]} numberOfLines={1}>
                    {ex.url}
                  </Text>
                </View>
              ) : null}
            </View>

            {ex.summary ? (
              <Text style={styles.summary}>{ex.summary}</Text>
            ) : null}

            <View style={styles.savedBanner}>
              <Icon name="check-circle" size={16} color={colors.success} />
              <Text style={styles.savedText}>
                {isSub
                  ? "Receipt extracted! Ready to save to your subscriptions."
                  : "Link & screenshot extracted! Ready to save to your vault."}
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 14 }}>
              {isSub ? (
                <>
                  <PrimaryButton
                    title="Save as active subscription"
                    icon="wallet-plus"
                    onPress={() => saveAs("subscription")}
                    loading={saving === "subscription"}
                    disabled={!!saving}
                    testID="scan-as-sub"
                  />
                  <PrimaryButton
                    title="Edit in form before saving"
                    icon="pencil-outline"
                    variant="secondary"
                    onPress={() => {
                      router.push({
                        pathname: "/add-subscription",
                        params: {
                          provider: ex.provider || "",
                          product: ex.product || "",
                          plan: ex.plan || "",
                          price: ex.price != null ? String(ex.price) : "",
                          currency: ex.currency || "AED",
                          billing_cycle: ex.billing_cycle || "monthly",
                          renewal_date: ex.renewal_date || "",
                          trial_end: ex.trial_end || "",
                        },
                      } as any);
                    }}
                  />
                  <PrimaryButton
                    title="Save to Link Vault instead"
                    icon="bookmark-plus-outline"
                    variant="secondary"
                    onPress={() => saveAs("check_later")}
                    loading={saving === "check_later"}
                    disabled={!!saving}
                    testID="scan-as-later"
                  />
                </>
              ) : (
                <>
                  <PrimaryButton
                    title="Save to Link Vault"
                    icon="bookmark-plus-outline"
                    onPress={() => saveAs("check_later")}
                    loading={saving === "check_later"}
                    disabled={!!saving}
                    testID="scan-as-later"
                  />
                  <PrimaryButton
                    title="Open in Link form"
                    icon="pencil-outline"
                    variant="secondary"
                    onPress={() => {
                      router.push({
                        pathname: "/paste-link",
                        params: {
                          url: ex.url || "",
                          note: ex.summary || "",
                          source: "Screenshot",
                        },
                      } as any);
                    }}
                  />
                  <PrimaryButton
                    title="Save as subscription instead"
                    icon="wallet-plus"
                    variant="secondary"
                    onPress={() => saveAs("subscription")}
                    loading={saving === "subscription"}
                    disabled={!!saving}
                    testID="scan-as-sub"
                  />
                </>
              )}

              <PrimaryButton
                title="Review in Smart Inbox"
                icon="inbox-arrow-down"
                variant="secondary"
                onPress={() => router.replace("/(tabs)/inbox")}
                testID="scan-inbox"
              />
              <PrimaryButton
                title="Upload another photo"
                icon="image-plus"
                variant="secondary"
                onPress={() => {
                  setPreview(null);
                  setResult(null);
                  run("library");
                }}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  targetSwitchRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surfaceTertiary,
    padding: 6,
    borderRadius: 10,
  },
  targetSwitchBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  targetSwitchText: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  center: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  loadingOrb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.pastelBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.pastelLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  centerTitle: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  centerText: {
    color: colors.onSurfaceTertiary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  resultCard: {
    padding: 18,
  },
  resultTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  resultTitle: {
    color: colors.onSurface,
    fontSize: 19,
    fontWeight: "800",
  },
  resultType: {
    color: colors.brandSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  resultDetailsBox: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  rowVal: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  summary: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.pastelMint,
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  savedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
}));
