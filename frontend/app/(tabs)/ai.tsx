import { useMutation } from "@tanstack/react-query";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "./_layout";
import { AvatarCircle, BrandMark, ChipRow, Icon } from "@/src/components/ui";
import {
  api,
  useInsights,
  useInvalidateAll,
  useLinks,
  useSubscriptions,
  useWatchlist,
} from "@/src/lib/api";
import { money } from "@/src/lib/format";
import { activeRows } from "@/src/lib/local-models";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

const QUICK_CHIPS = ["Monthly spend", "Trials ending", "Saved links", "Compare plans"];

type ListRow = { icon: string; name: string; sub: string; right?: string };
type Msg =
  | { role: "user"; text: string; image?: string }
  | { role: "ai"; text: string; pending?: boolean }
  | { role: "ai-list"; heading: string; rows: ListRow[]; viewAllLabel: string; viewAllRoute: string };

const SUGGESTIONS = [
  "Add Netflix 50 AED, Spotify 20, and YouTube 15",
  "What renews this month?",
  "How much do I spend every month?",
  "Remind me to cancel Disney in 3 days",
  "Save this to check later: youtube.com/premium",
];

export default function AskAI() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ initialPrompt?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const invalidate = useInvalidateAll();
  const insights = useInsights();
  const subscriptions = useSubscriptions();
  const links = useLinks();
  const watchlist = useWatchlist();

  useEffect(() => {
    api
      .chatHistory()
      .then((h) => {
        const msgs: Msg[] = [];
        h.forEach((row: any) => {
          msgs.push({ role: "user", text: row.question });
          msgs.push({ role: "ai", text: row.answer });
        });
        setMessages(msgs);
      })
      .catch(() => {});
  }, []);

  const chat = useMutation({
    mutationFn: (q: string) => api.chat(q),
    onMutate: (q) => {
      setMessages((m) => [
        ...m,
        { role: "user", text: q },
        { role: "ai", text: "", pending: true },
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onSuccess: (res) => {
      if (res.actions?.length) invalidate();
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "ai", text: res.answer };
        return c;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (error) => {
      const text =
        error instanceof Error
          ? error.message
          : "Sorry, I couldn't process that right now. Please try again.";
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "ai", text };
        return c;
      });
    },
  });

  const pushList = (
    heading: string,
    rows: ListRow[],
    viewAllLabel: string,
    viewAllRoute: string
  ) => {
    setMessages((m) => [
      ...m,
      {
        role: "user",
        text: heading.includes("subscription") ? "What renews this month?" : heading,
      },
      { role: "ai-list", heading, rows, viewAllLabel, viewAllRoute },
    ]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const answerLocally = (chip: string): boolean => {
    const active = activeRows(subscriptions.data || []).filter(
      (s: any) => s.status === "Active" || s.status === "Trial"
    );
    if (chip === "Monthly spend") {
      const rows: ListRow[] = active.slice(0, 5).map((s: any) => ({
        icon: "wallet-outline",
        name: s.provider,
        sub: s.plan || s.category,
        right: money(s.price, s.currency),
      }));
      pushList(
        `You have ${active.length} active subscription${
          active.length === 1 ? "" : "s"
        }, totaling ${money(
          insights.data?.monthly_spend ?? 0,
          insights.data?.currency || "AED"
        )}/month.`,
        rows,
        "View all subscriptions",
        "/(tabs)/subscriptions"
      );
      return true;
    }
    if (chip === "Trials ending") {
      const trials = active.filter((s: any) => s.status === "Trial" || s.trial_end);
      const rows: ListRow[] = trials.slice(0, 5).map((s: any) => ({
        icon: "clock-alert-outline",
        name: s.provider,
        sub: "Trial",
        right: s.trial_end || s.renewal_date,
      }));
      pushList(
        `You have ${trials.length} trial${trials.length === 1 ? "" : "s"} ending soon.`,
        rows,
        "View all trials",
        "/(tabs)/subscriptions"
      );
      return true;
    }
    if (chip === "Saved links") {
      const rows: ListRow[] = (links.data || []).slice(0, 5).map((l: any) => ({
        icon: "link-variant",
        name: l.title,
        sub: l.source || "Web",
      }));
      pushList(
        `You have ${links.data?.length || 0} saved link${
          (links.data?.length || 0) === 1 ? "" : "s"
        }.`,
        rows,
        "View all saved links",
        "/link-vault"
      );
      return true;
    }
    if (chip === "Compare plans") {
      const rows: ListRow[] = (watchlist.data || []).slice(0, 5).map((p: any) => ({
        icon: "eye-outline",
        name: p.provider,
        sub: p.plan || p.category,
        right: money(p.price, p.currency),
      }));
      pushList(
        `You have ${watchlist.data?.length || 0} saved plan${
          (watchlist.data?.length || 0) === 1 ? "" : "s"
        } on your watchlist.`,
        rows,
        "Compare plans",
        "/watchlist"
      );
      return true;
    }
    return false;
  };

  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);

  const attachScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri && res.assets[0].base64) {
      setAttachedImage({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
      });
    }
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    const currentAttachment = attachedImage;
    if ((!q && !currentAttachment) || chat.isPending) return;
    setInput("");
    setAttachedImage(null);

    if (!currentAttachment && QUICK_CHIPS.includes(q) && answerLocally(q)) return;

    if (currentAttachment) {
      // Ingest screenshot image and summarize/add into system
      setMessages((m) => [
        ...m,
        { role: "user", text: q || "Attached screenshot for analysis", image: currentAttachment.uri },
        { role: "ai", text: "", pending: true },
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

      try {
        const inboxItem = await api.ingestImage(currentAttachment.base64, "chat-screenshot");
        invalidate();
        const ex = inboxItem.extraction || {};
        let summaryText = `I analyzed your screenshot!`;
        if (ex.content_type === "subscription" || ex.price != null) {
          summaryText = `✓ Extracted Subscription: **${ex.provider || ex.product || "Service"}** (${money(ex.price, ex.currency)}/${ex.billing_cycle || "mo"}). Added to your Inbox & Subscriptions.`;
        } else if (ex.content_type === "account") {
          summaryText = `✓ Extracted Registered Account: **${ex.service_name || ex.provider || "Account"}** (${ex.email_used || ex.username || "credentials saved"}).`;
        } else {
          summaryText = `✓ Saved to Vault: **${ex.product || ex.provider || "Saved item"}** (${ex.summary || "Extracted content"}).`;
        }
        if (q) {
          // Also run user question with context
          const chatRes = await api.chat(q);
          summaryText += `\n\n${chatRes.answer}`;
        }
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "ai", text: summaryText };
          return c;
        });
      } catch (err: any) {
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "ai", text: err?.message || "Failed to process screenshot." };
          return c;
        });
      }
      return;
    }

    chat.mutate(q);
  };

  const startRecording = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            text: "Microphone access is disabled. Please enable it in Settings.",
          },
        ]);
        Linking.openSettings();
      }
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopRecording = async () => {
    setRecording(false);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;
    setTranscribing(true);
    try {
      const res = await api.transcribe(uri);
      if (res.text) setInput((prev) => (prev ? prev + " " : "") + res.text);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Voice transcription failed.";
      setMessages((m) => [...m, { role: "ai", text }]);
    } finally {
      setTranscribing(false);
    }
  };

  useEffect(() => {
    if (params.initialPrompt) {
      chat.mutate(params.initialPrompt);
    }
  }, [params.initialPrompt]);

  return (
    <View style={styles.container}>
      <View style={[styles.headerBox, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          <BrandMark compact />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              style={styles.promptsBtn}
              onPress={() => router.push("/prompts" as any)}
              hitSlop={8}
            >
              <Icon name="bookmark-outline" size={16} color={colors.brandPrimary} />
              <Text style={styles.promptsBtnText}>Prompts</Text>
            </Pressable>
            <AvatarCircle size={38} />
          </View>
        </View>
        <Text style={styles.title}>AI Intelligence</Text>
        <Text style={styles.subtitle}>
          Ask questions, add subscriptions, or analyze your spending.
        </Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <ChipRow
          items={QUICK_CHIPS}
          value=""
          onChange={(c: string) => send(c)}
          testIDPrefix="ai-chip"
        />
      </View>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={[colors.brandPrimary, colors.brandSecondary]}
              style={styles.aiOrb}
            >
              <Icon name="creation" size={38} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>How can I help you today?</Text>
            <Text style={styles.emptySub}>
              Ask about renewals, upcoming trials, or tell me to track a new subscription.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  style={styles.suggestion}
                  testID={`suggest-${s}`}
                  onPress={() => send(s)}
                >
                  <Icon name="sparkles" size={14} color={colors.brandSecondary} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{
              padding: 16,
              gap: 12,
              paddingBottom: 20,
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              if (item.role === "user") {
                return (
                  <View style={styles.userBubbleWrap}>
                    <LinearGradient
                      colors={[colors.brandPrimary, colors.brandSecondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.userBubble}
                    >
                      {item.image ? (
                        <View style={styles.bubbleImageWrap}>
                          <Image source={{ uri: item.image }} style={styles.bubbleImage} contentFit="cover" />
                        </View>
                      ) : null}
                      <Text style={styles.userBubbleText}>{item.text}</Text>
                    </LinearGradient>
                  </View>
                );
              }
              if (item.role === "ai-list") {
                return (
                  <View style={styles.listCard}>
                    <View style={styles.aiSparkleRow}>
                      <Icon name="creation" size={14} color={colors.brandSecondary} />
                      <Text style={styles.aiBadgeLabel}>AI Analysis</Text>
                    </View>
                    <Text style={styles.listHeading}>{item.heading}</Text>
                    {item.rows.length ? (
                      item.rows.map((r, i) => (
                        <View key={i} style={styles.listRow}>
                          <View
                            style={[
                              styles.listIcon,
                              { backgroundColor: colors.pastelLavender },
                            ]}
                          >
                            <Icon
                              name={r.icon}
                              size={16}
                              color={colors.brandSecondary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listRowTitle} numberOfLines={1}>
                              {r.name}
                            </Text>
                            <Text style={styles.listRowSub} numberOfLines={1}>
                              {r.sub}
                            </Text>
                          </View>
                          {r.right ? (
                            <Text style={styles.listRowRight}>{r.right}</Text>
                          ) : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.listEmpty}>Nothing here yet.</Text>
                    )}
                    <Pressable
                      onPress={() => router.push(item.viewAllRoute as any)}
                      style={styles.listViewAll}
                    >
                      <Text style={styles.listViewAllText}>{item.viewAllLabel}</Text>
                      <Icon
                        name="chevron-right"
                        size={15}
                        color={colors.brandPrimary}
                      />
                    </Pressable>
                  </View>
                );
              }
              return (
                <View style={styles.aiBubble}>
                  <View style={styles.aiSparkleRow}>
                    <Icon name="creation" size={13} color={colors.brandSecondary} />
                    <Text style={styles.aiBadgeLabel}>Assistant</Text>
                  </View>
                  {item.pending ? (
                    <ActivityIndicator color={colors.brandPrimary} size="small" />
                  ) : (
                    <Text style={styles.aiBubbleText}>{item.text}</Text>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Floating Input Bar */}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: (insets.bottom || 12) + TAB_BAR_SPACE - 42 },
          ]}
        >
          {attachedImage ? (
            <View style={styles.attachmentStrip}>
              <View style={styles.attachmentThumbWrap}>
                <Image source={{ uri: attachedImage.uri }} style={styles.attachmentThumb} contentFit="cover" />
                <Pressable onPress={() => setAttachedImage(null)} style={styles.removeAttachmentBtn} hitSlop={6}>
                  <Icon name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={styles.attachmentLabel}>Screenshot attached for AI analysis</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={styles.inputWrap}>
              <Pressable
                testID="ai-attach"
                onPress={attachScreenshot}
                style={styles.attachBtn}
                hitSlop={6}
              >
                <Icon
                  name="camera-outline"
                  size={20}
                  color={attachedImage ? colors.brandPrimary : colors.muted}
                />
              </Pressable>

              <TextInput
                testID="ai-input"
                style={styles.input}
                placeholder={
                  transcribing
                    ? "Transcribing audio…"
                    : attachedImage
                    ? "Add a note or question (optional)…"
                    : "Ask about your subscriptions, accounts, or prompts…"
                }
                placeholderTextColor={colors.muted}
                value={input}
                onChangeText={setInput}
                multiline
                onSubmitEditing={() => send()}
              />
              <Pressable
                testID="ai-mic"
                onPress={recording ? stopRecording : startRecording}
                style={[
                  styles.micBtn,
                  recording && { backgroundColor: colors.pastelPink },
                ]}
              >
                {transcribing ? (
                  <ActivityIndicator color={colors.brandPrimary} size="small" />
                ) : (
                  <Icon
                    name={recording ? "stop" : "microphone-outline"}
                    size={20}
                    color={recording ? colors.error : colors.brandPrimary}
                  />
                )}
              </Pressable>
            </View>
            <Pressable
              testID="ai-send"
              onPress={() => send()}
              disabled={(!input.trim() && !attachedImage) || chat.isPending}
              style={[
                styles.sendBtn,
                { opacity: (!input.trim() && !attachedImage) || chat.isPending ? 0.5 : 1 },
              ]}
            >
              <LinearGradient
                colors={[colors.brandPrimary, colors.brandSecondary]}
                style={styles.sendGradient}
              >
                <Icon name="arrow-up" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerBox: {
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 14,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  aiOrb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 0,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 8,
  },
  suggestions: {
    gap: 8,
    width: "100%",
    marginTop: 6,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 13,
  },
  suggestionText: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  userBubbleWrap: {
    alignSelf: "flex-end",
    maxWidth: "84%",
  },
  userBubble: {
    borderRadius: 10,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubbleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  aiBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
    gap: 6,
  },
  aiSparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  aiBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandSecondary,
    letterSpacing: 0.2,
  },
  aiBubbleText: {
    color: colors.onSurface,
    fontSize: 14,
    lineHeight: 21,
  },

  listCard: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
  },
  listHeading: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowTitle: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  listRowSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  listRowRight: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "800",
  },
  listEmpty: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
  },
  listViewAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  listViewAllText: {
    color: colors.brandPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.glassStrong,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    maxHeight: 100,
    paddingVertical: 8,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  sendGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  promptsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  promptsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  bubbleImageWrap: {
    width: 220,
    height: 140,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 8,
  },
  bubbleImage: {
    width: "100%",
    height: "100%",
  },
  attachmentStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    backgroundColor: colors.surfaceSecondary,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  attachmentThumbWrap: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
  },
  attachmentThumb: {
    width: "100%",
    height: "100%",
  },
  removeAttachmentBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurface,
    flex: 1,
  },
  attachBtn: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    marginRight: 4,
  },
}));
