import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader, Card, Icon, PrimaryButton, SectionTitle } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { makeStyles, useTheme } from "@/src/theme";

const IDEAS = [
  "Make a 30s product video ad with voiceover",
  "Build a landing page and deploy it",
  "Create a logo and brand poster",
  "Research competitors and write a summary",
  "Write python code to scrape a website",
];

export default function FindTool() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [task, setTask] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const find = useMutation({ mutationFn: (t: string) => api.findTools(t) });
  const res = find.data;
  const run = (t = task) => t.trim() && find.mutate(t.trim());

  return (
    <View style={styles.container}>
      <AppHeader title="Tool Finder" subtitle="Tell me the task — I pick from tools you can use right now" back />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled" bottomOffset={20}>
        <Card style={{ gap: 10 }}>
          <TextInput
            style={styles.input}
            value={task}
            onChangeText={setTask}
            placeholder="e.g. I need to make a reel with AI visuals and a voiceover"
            placeholderTextColor={colors.muted}
            multiline
            testID="task-input"
          />
          <PrimaryButton title="Find best tools" icon="target" onPress={() => run()} loading={find.isPending} disabled={!task.trim()} testID="find-tools" />
        </Card>

        {!res ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.muted}>Try one of these</Text>
            {IDEAS.map((idea) => (
              <Pressable key={idea} style={styles.idea} onPress={() => { setTask(idea); run(idea); }}>
                <Icon name="lightbulb-on-outline" size={16} color={colors.accentYellow} />
                <Text style={styles.ideaText}>{idea}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            {res.ownedCount === 0 ? (
              <Card>
                <Text style={styles.muted}>You have no subscriptions or accounts saved yet, so there is nothing to rank. Add some, then ask again.</Text>
              </Card>
            ) : null}

            {res.advice ? (
              <Card style={{ gap: 6, borderColor: colors.brandPrimary + "88" }}>
                <View style={styles.row}>
                  <Icon name="creation" size={18} color={colors.brandPrimary} />
                  <Text style={styles.title}>AI recommendation</Text>
                </View>
                <Text style={styles.body}>{res.advice}</Text>
              </Card>
            ) : null}

            {res.plan.needs.map((need) => {
              const picks = res.plan.picks.filter((p) => p.capability.id === need.id);
              return (
                <View key={need.id} style={{ gap: 8 }}>
                  <SectionTitle title={need.label} />
                  {picks.length === 0 ? (
                    <Card style={{ gap: 6 }}>
                      <Text style={styles.body}>You don't have a {need.label.toLowerCase()} tool yet.</Text>
                      {need.suggestions.length ? <Text style={styles.muted}>Worth trying: {need.suggestions.join(" · ")} (check current pricing)</Text> : null}
                    </Card>
                  ) : (
                    picks.map((p, i) => (
                      <Card key={`${p.tool.kind}-${p.tool.id}`} style={{ gap: 6, borderColor: need.color + (i === 0 && p.availability.tone !== "bad" ? "cc" : "44") }} onPress={() => router.push(p.tool.route as any)}>
                        <View style={styles.row}>
                          <View style={[styles.rank, { backgroundColor: need.color + "33" }]}>
                            <Text style={[styles.rankText, { color: need.color }]}>{p.availability.tone === "bad" ? "!" : i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{p.tool.name}</Text>
                            <Text style={styles.muted}>{p.tool.kind === "subscription" ? "Subscription" : "Account"}{p.tool.credits ? ` · ${p.tool.credits}` : ""}</Text>
                          </View>
                          <View style={[styles.pill, { backgroundColor: p.availability.tone === "bad" ? colors.pastelPeach : p.availability.tone === "warn" ? colors.pastelOrange : colors.pastelMint }]}>
                            <Text style={[styles.pillText, { color: p.availability.tone === "bad" ? colors.error : p.availability.tone === "warn" ? colors.warning : colors.success }]} numberOfLines={2}>
                              {p.availability.label}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              );
            })}

            {res.prompts.length ? (
              <View style={{ gap: 8 }}>
                <SectionTitle title="Your saved prompts for this" />
                {res.prompts.map((p: any) => (
                  <Card key={p.id} style={{ gap: 6 }}>
                    <Text style={styles.title}>{p.title}{p.tool ? ` · ${p.tool}` : ""}</Text>
                    <Text style={styles.body} numberOfLines={3}>{p.prompt}</Text>
                    <Pressable
                      style={styles.copy}
                      onPress={async () => {
                        await Clipboard.setStringAsync(p.prompt);
                        setCopied(p.id);
                      }}
                    >
                      <Icon name={copied === p.id ? "check" : "content-copy"} size={14} color={colors.brandPrimary} />
                      <Text style={styles.copyText}>{copied === p.id ? "Copied" : "Copy prompt"}</Text>
                    </Pressable>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    minHeight: 90, textAlignVertical: "top", color: colors.onSurface, fontSize: 15,
    backgroundColor: colors.surfaceTertiary, borderRadius: 14, padding: 12,
  },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  body: { color: colors.onSurface, fontSize: 13, lineHeight: 19 },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  idea: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 10,
    backgroundColor: colors.glass, borderWidth: 1.5, borderColor: colors.glassBorder,
  },
  ideaText: { color: colors.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 13, fontWeight: "800" },
  pill: { maxWidth: 150, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  pillText: { fontSize: 11, fontWeight: "800" },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  copyText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
}));
