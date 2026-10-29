import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import { AppHeader, Card, EmptyState, Icon, Loading, PrimaryButton, SectionTitle } from "@/src/components/ui";
import { api, useAccounts, useSubscriptions } from "@/src/lib/api";
import { buildClusters, suggestWorkflows, toOwnedTools, type Cluster } from "@/src/lib/capabilities";
import { money } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

const MAP_HEIGHT = 380;

// Places each capability cluster on a ring around "You" and fans its tools out around it.
function layout(clusters: Cluster[], width: number) {
  const cx = width / 2;
  const cy = MAP_HEIGHT / 2;
  const ring = Math.min(width, MAP_HEIGHT) * 0.33;
  return clusters.map((cluster, i) => {
    const angle = (i / clusters.length) * Math.PI * 2 - Math.PI / 2;
    const hx = cx + Math.cos(angle) * ring;
    const hy = cy + Math.sin(angle) * ring;
    const shown = cluster.tools.slice(0, 4);
    const nodes = shown.map((tool, j) => {
      const a = angle + ((j - (shown.length - 1) / 2) * 0.62);
      return { tool, x: hx + Math.cos(a) * 46, y: hy + Math.sin(a) * 46 };
    });
    return { cluster, hx, hy, nodes };
  });
}

export default function Brain() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const subsQuery = useSubscriptions();
  const accountsQuery = useAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [advice, setAdvice] = useState("");

  const tools = useMemo(() => toOwnedTools(subsQuery.data || [], accountsQuery.data || []), [subsQuery.data, accountsQuery.data]);
  const clusters = useMemo(() => buildClusters(tools).filter((c) => c.capability.id !== "other" || c.tools.length > 1), [tools]);
  const workflows = useMemo(() => suggestWorkflows(tools), [tools]);
  const placed = useMemo(() => layout(clusters, width - 32), [clusters, width]);
  const active = clusters.find((c) => c.capability.id === selected) || null;

  const askAi = useMutation({
    mutationFn: () =>
      api.brainAdvice(
        clusters
          .map((c) => `${c.capability.label}: ${c.tools.map((t) => `${t.name} (${t.kind === "subscription" ? "paid" : t.accountType})`).join(", ")}`)
          .join("\n"),
      ),
    onSuccess: (text) => setAdvice(text || "AI tips need a Gemini or NVIDIA key (Profile). The combos below work without one."),
    onError: () => setAdvice("Could not reach the AI service. The combos below still work offline."),
  });

  if (subsQuery.isLoading || accountsQuery.isLoading) return <Loading />;

  const overlaps = clusters.filter((c) => c.paidCount > 1 && c.capability.id !== "streaming" && c.capability.id !== "other");

  return (
    <View style={styles.container}>
      <AppHeader title="Brain" subtitle="Your tools, clustered by what they can do" back />
      {tools.length === 0 ? (
        <EmptyState icon="graph-outline" title="Nothing to map yet" message="Add subscriptions or accounts and they appear here grouped by capability." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }} showsVerticalScrollIndicator={false}>
          <Card style={{ padding: 0 }}>
            <Svg width={width - 34} height={MAP_HEIGHT}>
              {placed.map(({ cluster, hx, hy, nodes }) => (
                <G key={cluster.capability.id}>
                  <Line x1={(width - 32) / 2} y1={MAP_HEIGHT / 2} x2={hx} y2={hy} stroke={cluster.capability.color} strokeOpacity={0.45} strokeWidth={2} />
                  {nodes.map((n) => (
                    <Line key={`l-${n.tool.kind}-${n.tool.id}`} x1={hx} y1={hy} x2={n.x} y2={n.y} stroke={cluster.capability.color} strokeOpacity={0.35} strokeWidth={1.2} />
                  ))}
                </G>
              ))}
              <Circle cx={(width - 32) / 2} cy={MAP_HEIGHT / 2} r={30} fill={colors.brandPrimary} fillOpacity={0.9} />
              <SvgText x={(width - 32) / 2} y={MAP_HEIGHT / 2 + 4} fill="#FFFFFF" fontSize={12} fontWeight="800" textAnchor="middle">
                You
              </SvgText>
              {placed.map(({ cluster, hx, hy, nodes }) => {
                const on = selected === cluster.capability.id;
                return (
                  <G key={`h-${cluster.capability.id}`} onPress={() => setSelected(on ? null : cluster.capability.id)}>
                    {nodes.map((n) => (
                      <G key={`n-${n.tool.kind}-${n.tool.id}`}>
                        <Circle cx={n.x} cy={n.y} r={n.tool.kind === "subscription" ? 7 : 5} fill={cluster.capability.color} fillOpacity={n.tool.kind === "subscription" ? 0.95 : 0.5} />
                        <SvgText x={n.x} y={n.y + 18} fill={colors.onSurfaceTertiary} fontSize={9} textAnchor="middle">
                          {n.tool.name.slice(0, 11)}
                        </SvgText>
                      </G>
                    ))}
                    <Circle cx={hx} cy={hy} r={on ? 25 : 21} fill={cluster.capability.color} fillOpacity={0.25} stroke={cluster.capability.color} strokeWidth={on ? 3 : 1.5} />
                    <SvgText x={hx} y={hy + 4} fill={colors.onSurface} fontSize={12} fontWeight="800" textAnchor="middle">
                      {cluster.tools.length}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
            <Text style={styles.mapHint}>Tap a cluster · big dot = paid subscription · small = free account</Text>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {clusters.map((c) => {
              const on = selected === c.capability.id;
              return (
                <Pressable
                  key={c.capability.id}
                  onPress={() => setSelected(on ? null : c.capability.id)}
                  style={[styles.clusterChip, { borderColor: c.capability.color + (on ? "ff" : "55") }, on && { backgroundColor: c.capability.color + "30" }]}
                >
                  <Icon name={c.capability.icon} size={16} color={c.capability.color} />
                  <Text style={styles.clusterChipText}>{c.capability.label}</Text>
                  <Text style={[styles.clusterChipText, { color: c.capability.color }]}>{c.tools.length}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {active ? (
            <Card style={{ gap: 10, borderColor: active.capability.color + "88" }}>
              <View style={styles.row}>
                <Icon name={active.capability.icon} size={22} color={active.capability.color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{active.capability.label}</Text>
                  <Text style={styles.muted}>
                    {active.capability.blurb}
                    {active.monthly > 0 ? ` · ${money(active.monthly, "AED")}/mo` : ""}
                  </Text>
                </View>
              </View>
              {active.tools.map((t) => (
                <Pressable key={`${t.kind}-${t.id}`} style={styles.toolRow} onPress={() => router.push(t.route as any)}>
                  <View style={[styles.dot, { backgroundColor: active.capability.color, opacity: t.kind === "subscription" ? 1 : 0.5 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toolName}>{t.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {t.kind === "subscription" ? `Subscription${t.price ? ` · ${money(t.price, t.currency)}` : ""}` : `Account · ${t.accountType}${t.credits ? ` · ${t.credits}` : ""}`}
                      {t.capabilities.length > 1 ? ` · also ${t.capabilities.filter((c) => c !== active.capability.id).slice(0, 2).join(", ")}` : ""}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </Card>
          ) : null}

          <View>
            <SectionTitle title="Use them together" />
            {workflows.length === 0 ? (
              <Card>
                <Text style={styles.muted}>Add tools from two or more areas (chat, image, video, code…) to get combo workflows.</Text>
              </Card>
            ) : (
              <View style={{ gap: 12 }}>
                {workflows.map((wf) => (
                  <Card key={wf.id} style={{ gap: 8 }}>
                    <Text style={styles.cardTitle}>{wf.title}</Text>
                    <Text style={styles.muted}>{wf.summary}</Text>
                    {wf.steps.map((step, i) => (
                      <View key={i} style={styles.step}>
                        <View style={[styles.stepNum, { backgroundColor: step.capability.color + (step.tool ? "40" : "18") }]}>
                          <Text style={[styles.stepNumText, { color: step.capability.color }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.toolName}>{step.action}</Text>
                          {step.tool ? (
                            <Pressable onPress={() => router.push(step.tool!.route as any)}>
                              <Text style={[styles.stepTool, { color: step.capability.color }]}>Use {step.tool.name}</Text>
                            </Pressable>
                          ) : (
                            <Text style={styles.missing}>No {step.capability.label.toLowerCase()} tool yet{step.capability.suggestions[0] ? ` — try ${step.capability.suggestions[0]}` : ""}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </Card>
                ))}
              </View>
            )}
          </View>

          {overlaps.length ? (
            <Card style={{ gap: 6 }}>
              <View style={styles.row}>
                <Icon name="content-duplicate" size={18} color={colors.warning} />
                <Text style={styles.cardTitle}>Overlap worth a look</Text>
              </View>
              {overlaps.map((c) => (
                <Text key={c.capability.id} style={styles.muted}>
                  {c.capability.label}: {c.tools.filter((t) => t.kind === "subscription").map((t) => t.name).join(" + ")}
                </Text>
              ))}
            </Card>
          ) : null}

          <Card style={{ gap: 10 }}>
            <View style={styles.row}>
              <Icon name="creation" size={18} color={colors.brandPrimary} />
              <Text style={styles.cardTitle}>AI tips for your stack</Text>
            </View>
            {advice ? <Text style={styles.advice}>{advice}</Text> : null}
            <PrimaryButton title={advice ? "Refresh tips" : "Ask AI how to combine them"} icon="creation" variant="secondary" onPress={() => askAi.mutate()} loading={askAi.isPending} />
            <PrimaryButton title="Find the best tool for a task" icon="target" onPress={() => router.push("/find-tool" as any)} />
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mapHint: { color: colors.muted, fontSize: 11, textAlign: "center", paddingBottom: 10 },
  clusterChip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 999,
    backgroundColor: colors.glass, borderWidth: 1.5,
  },
  clusterChipText: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  toolName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 12, fontWeight: "800" },
  stepTool: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  missing: { color: colors.warning, fontSize: 12, marginTop: 2 },
  advice: { color: colors.onSurface, fontSize: 13, lineHeight: 19 },
}));
