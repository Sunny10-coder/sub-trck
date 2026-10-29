import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppHeader,
  Badge,
  Card,
  Icon,
  Loading,
  PrimaryButton,
} from "@/src/components/ui";
import { api, useInvalidateAll, useLink } from "@/src/lib/api";
import { formatDate } from "@/src/lib/format";
import { makeStyles, useTheme } from "@/src/theme";

export default function LinkDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useLink(id!);
  const invalidate = useInvalidateAll();

  const del = useMutation({
    mutationFn: () => api.deleteLink(id!),
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  const retag = useMutation({
    mutationFn: () => api.retagLink(id!),
    onSuccess: invalidate,
  });

  if (isLoading || !data) {
    return (
      <View style={styles.container}>
        <AppHeader title="Saved Link" back />
        <Loading />
      </View>
    );
  }

  const l = data;

  return (
    <View style={styles.container}>
      <AppHeader title="Saved Link" subtitle={l.source || "Web"} back />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 30,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Text style={styles.title}>{l.title}</Text>
          <Text style={styles.url} numberOfLines={2}>
            {l.url}
          </Text>
          <View style={styles.badges}>
            <Badge label={l.source || "Web"} tone="brand" />
            {l.category ? <Badge label={l.category} tone="mint" /> : null}
            {l.enrichment === "pending" ? (
              <Badge label="Enriching with AI…" tone="warning" />
            ) : null}
          </View>
        </Card>

        {l.summary ? (
          <Card>
            <View style={styles.sectionHeadRow}>
              <Icon name="creation" size={16} color={colors.brandSecondary} />
              <Text style={styles.sectionLabel}>AI Summary</Text>
            </View>
            <Text style={styles.body}>{l.summary}</Text>
          </Card>
        ) : null}

        <View style={styles.tagsContainer}>
          <Text style={styles.tagsLabel}>TOPIC TAGS</Text>
          <View style={styles.tags}>
            {(l.tags || []).map((t: string) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton
            title={l.tags?.length ? "Regenerate tags with AI" : "Generate topic tags with AI"}
            icon="creation"
            variant="secondary"
            onPress={() => retag.mutate()}
            loading={retag.isPending}
            testID="retag-link"
          />
        </View>

        {l.note ? (
          <Card>
            <Text style={styles.sectionLabel}>Your Note</Text>
            <Text style={styles.body}>{l.note}</Text>
          </Card>
        ) : null}

        <Text style={styles.saved}>Saved on {formatDate(l.created_at)}</Text>

        <View style={{ gap: 10, marginTop: 4 }}>
          {l.url?.startsWith("http") ? (
            <PrimaryButton
              title="Open website"
              icon="open-in-new"
              onPress={() => WebBrowser.openBrowserAsync(l.url)}
              testID="open-link"
            />
          ) : null}

          <PrimaryButton
            title="Convert to Registered Account"
            icon="shield-account-outline"
            variant="secondary"
            onPress={() =>
              router.push(
                `/add-account?service_name=${encodeURIComponent(
                  l.title || ""
                )}&service_url=${encodeURIComponent(l.url || "")}&notes=${encodeURIComponent(
                  `Converted from Link: ${l.title}`
                )}` as any
              )
            }
            testID="convert-to-account"
          />

          <PrimaryButton
            title="Edit details"
            icon="pencil-outline"
            variant="secondary"
            onPress={() => router.push(`/edit-link?id=${id}` as any)}
            testID="edit-link"
          />

          <PrimaryButton
            title="Set reminder"
            icon="bell-plus-outline"
            variant="secondary"
            onPress={() =>
              router.push(
                `/add-reminder?title=${encodeURIComponent(
                  l.title
                )}&ref_type=link&ref_id=${id}&return_to=/link/${id}` as any
              )
            }
          />

          <PrimaryButton
            title="Delete link"
            icon="trash-can-outline"
            variant="secondary"
            onPress={() => del.mutate()}
            loading={del.isPending}
            style={{
              backgroundColor: colors.pastelPink,
              borderColor: colors.error + "33",
            }}
            testID="delete-link"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  url: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
  },
  body: {
    color: colors.onSurfaceTertiary,
    fontSize: 14,
    lineHeight: 21,
  },
  tagsContainer: {
    gap: 6,
  },
  tagsLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tagText: {
    color: colors.brandSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  saved: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
}));
