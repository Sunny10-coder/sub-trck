import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "./_layout";
import { AvatarCircle, Badge, BrandMark, Card, EmptyState, Icon } from "@/src/components/ui";
import { api, useInvalidateAll, useLinks } from "@/src/lib/api";
import { relativeDate } from "@/src/lib/format";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

type CollectionMeta = {
  id: string;
  name: string;
  icon: string;
  tabColor: string;
  badge?: string;
  matches: (item: any) => boolean;
};

export default function LinksVault() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const invalidate = useInvalidateAll();
  const links = useLinks();

  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const collections: CollectionMeta[] = useMemo(
    () => [
      {
        id: "all",
        name: "All Links",
        icon: "bookmark-multiple-outline",
        tabColor: colors.brandPrimary,
        matches: () => true,
      },
      {
        id: "video",
        name: "Must Watch / Video",
        icon: "play-box-multiple-outline",
        tabColor: "#10B981", // green
        badge: "HOT",
        matches: (item) => {
          const text = `${item.title || ""} ${item.url || ""} ${item.category || ""} ${item.source || ""}`.toLowerCase();
          return text.includes("youtube") || text.includes("vimeo") || text.includes("video") || text.includes("watch") || text.includes("movie");
        },
      },
      {
        id: "research",
        name: "Learning & Research",
        icon: "book-open-page-variant-outline",
        tabColor: "#F59E0B", // amber
        matches: (item) => {
          const text = `${item.title || ""} ${item.url || ""} ${item.category || ""} ${item.source || ""}`.toLowerCase();
          return text.includes("learn") || text.includes("research") || text.includes("github") || text.includes("docs") || text.includes("paper") || text.includes("article");
        },
      },
      {
        id: "ai_tools",
        name: "AI & Tools",
        icon: "creation",
        tabColor: "#8B5CF6", // purple
        matches: (item) => {
          const text = `${item.title || ""} ${item.url || ""} ${item.category || ""} ${item.source || ""}`.toLowerCase();
          return text.includes("ai") || text.includes("gpt") || text.includes("tool") || text.includes("app") || text.includes("software");
        },
      },
      {
        id: "social",
        name: "Social & Discovery",
        icon: "compass-outline",
        tabColor: "#EC4899", // pink
        matches: (item) => {
          const text = `${item.title || ""} ${item.url || ""} ${item.category || ""} ${item.source || ""}`.toLowerCase();
          return text.includes("instagram") || text.includes("reddit") || text.includes("x.com") || text.includes("twitter") || text.includes("threads");
        },
      },
      {
        id: "unsorted",
        name: "Unsorted",
        icon: "folder-outline",
        tabColor: "#64748B", // slate
        matches: (item) => !item.category || item.category === "Other" || item.category === "Unsorted",
      },
    ],
    [colors]
  );

  const rawLinks = (links.data || []).filter((l: any) => !l.archived);

  const visibleLinks = useMemo(() => {
    if (activeCollection === "all") return rawLinks;
    const col = collections.find((c) => c.id === activeCollection);
    if (!col) return rawLinks;
    return rawLinks.filter(col.matches);
  }, [rawLinks, activeCollection, collections]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLink(id),
    onSuccess: invalidate,
  });

  const handleQuickPaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && /^https?:\/\//i.test(text.trim())) {
        router.push(`/paste-link?url=${encodeURIComponent(text.trim())}`);
      } else {
        router.push("/paste-link");
      }
    } catch {
      router.push("/paste-link");
    }
  };

  const handleCopyLink = async (id: string, url: string) => {
    await Clipboard.setStringAsync(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Link", `Remove "${title}" from your saved links?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const cardWidth = (width - 48) / 2;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: TAB_BAR_SPACE + insets.bottom + 16,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={links.isFetching}
            onRefresh={() => links.refetch()}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <BrandMark subtitle="Saved links & bookmarks" compact />
          <View style={styles.headerRight}>
            <Pressable
              style={styles.circleBtn}
              onPress={() => router.push("/search")}
              hitSlop={8}
            >
              <Icon name="magnify" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable
              style={[styles.circleBtn, { backgroundColor: colors.pastelLavender }]}
              onPress={() => router.push("/prompts" as any)}
              hitSlop={8}
            >
              <Icon name="creation" size={18} color={colors.brandSecondary} />
            </Pressable>
            <AvatarCircle size={36} />
          </View>
        </View>

        {/* Hero Title Matching Reference Image 1: "Save now. Find anytime." */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Save now.</Text>
          <Text style={styles.heroTitleSub}>Find anytime.</Text>
        </View>

        {/* Quick Paste Bar with Yellow + Button (Image 1) */}
        <View style={styles.pasteBarContainer}>
          <Pressable
            style={styles.pasteBarInput}
            onPress={handleQuickPaste}
            testID="quick-paste-bar"
          >
            <Icon name="pound" size={18} color={colors.muted} />
            <Text style={styles.pasteBarPlaceholder}>Paste link to save</Text>
            <Icon name="content-paste" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            style={styles.pasteBarAddBtn}
            onPress={() => router.push("/paste-link")}
            testID="quick-add-link-btn"
          >
            <Icon name="plus" size={24} color="#000000" />
          </Pressable>
        </View>

        {/* "My Collections" Folder Tabs Grid (Image 1 & 4) */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My Collections</Text>
          <Text style={styles.sectionCount}>{rawLinks.length} links</Text>
        </View>

        <View style={styles.folderGrid}>
          {collections.map((col) => {
            const count = col.id === "all" ? rawLinks.length : rawLinks.filter(col.matches).length;
            const isSelected = activeCollection === col.id;

            return (
              <Pressable
                key={col.id}
                style={[
                  styles.folderCard,
                  { width: cardWidth },
                  isSelected && styles.folderCardActive,
                ]}
                onPress={() => setActiveCollection(col.id)}
              >
                {/* Folder Top Tab */}
                <View
                  style={[
                    styles.folderTab,
                    { backgroundColor: col.tabColor },
                  ]}
                />

                {/* Folder Body */}
                <View style={styles.folderContent}>
                  <View style={styles.folderIconRow}>
                    <View style={[styles.folderIconBox, { backgroundColor: col.tabColor + "20" }]}>
                      <Icon name={col.icon} size={20} color={col.tabColor} />
                    </View>
                    <View style={styles.folderMetaRight}>
                      <Text style={styles.folderCount}>{count} link{count === 1 ? "" : "s"}</Text>
                      {col.badge ? (
                        <View style={styles.folderBadge}>
                          <Text style={styles.folderBadgeText}>{col.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.folderName} numberOfLines={2}>
                    {col.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Links List for Selected Collection */}
        <View style={[styles.sectionHead, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>
            {activeCollection === "all"
              ? "All Saved Links"
              : collections.find((c) => c.id === activeCollection)?.name || "Links"}
          </Text>
          {activeCollection !== "all" ? (
            <Pressable onPress={() => setActiveCollection("all")}>
              <Text style={styles.resetFilterText}>Show all</Text>
            </Pressable>
          ) : null}
        </View>

        {visibleLinks.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="No links in this collection"
            message="Paste a URL or share links from Chrome, YouTube or Instagram to save them here."
          />
        ) : (
          <View style={styles.linksStack}>
            {visibleLinks.map((item: any) => {
              const domain = item.url ? item.url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] : "";
              const avatarBg = accentFor(colors, item.source || item.title || "web");

              return (
                <Card key={item.id} style={styles.linkCard}>
                  <View style={styles.linkCardTop}>
                    <View style={[styles.linkIconCircle, { backgroundColor: avatarBg }]}>
                      <Icon
                        name={
                          domain.includes("youtube")
                            ? "youtube"
                            : domain.includes("github")
                            ? "github"
                            : domain.includes("instagram")
                            ? "instagram"
                            : domain.includes("twitter") || domain.includes("x.com")
                            ? "twitter"
                            : domain.includes("reddit")
                            ? "reddit"
                            : "link-variant"
                        }
                        size={18}
                        color={colors.onAccent}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.linkTitle} numberOfLines={2}>
                        {item.title || item.url}
                      </Text>
                      <Text style={styles.linkDomain} numberOfLines={1}>
                        {domain || item.url}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.iconActionBtn}
                        onPress={() => handleCopyLink(item.id, item.url)}
                        hitSlop={6}
                      >
                        <Icon
                          name={copiedId === item.id ? "check" : "content-copy"}
                          size={16}
                          color={copiedId === item.id ? colors.success : colors.muted}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.iconActionBtn}
                        onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}
                        hitSlop={6}
                      >
                        <Icon name="open-in-new" size={16} color={colors.brandPrimary} />
                      </Pressable>
                    </View>
                  </View>

                  {item.summary ? (
                    <Text style={styles.linkSummary} numberOfLines={2}>
                      {item.summary}
                    </Text>
                  ) : null}

                  <View style={styles.linkFooter}>
                    <View style={styles.linkTagRow}>
                      {item.category ? (
                        <View style={styles.tagPill}>
                          <Text style={styles.tagPillText}>{item.category}</Text>
                        </View>
                      ) : null}
                      {item.source ? (
                        <View style={[styles.tagPill, { backgroundColor: colors.surfaceSecondary }]}>
                          <Text style={[styles.tagPillText, { color: colors.muted }]}>{item.source}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.linkDate}>{relativeDate(item.created_at)}</Text>
                    </View>

                    <View style={styles.linkCardActions}>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => router.push(`/link/${item.id}` as any)}
                      >
                        <Text style={styles.editBtnText}>Details</Text>
                        <Icon name="chevron-right" size={14} color={colors.brandPrimary} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: "Display",
    fontSize: 38,
    fontWeight: "800",
    color: colors.onSurface,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  heroTitleSub: {
    fontFamily: "Display",
    fontSize: 38,
    fontWeight: "800",
    color: colors.brandPrimary,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  pasteBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  pasteBarInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  pasteBarPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  },
  pasteBarAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FACC15", // Bold yellow button matching Image 1
    borderWidth: 1.5,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  resetFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brandPrimary,
  },
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  folderCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    position: "relative",
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 12,
    minHeight: 145,
    shadowColor: "#171714",
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 5 },
    justifyContent: "space-between",
  },
  folderCardActive: {
    borderColor: colors.brandPrimary,
    borderWidth: 2,
    backgroundColor: colors.glassStrong,
  },
  folderTab: {
    position: "absolute",
    top: -10,
    left: 12,
    width: 46,
    height: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  folderContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  folderIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  folderIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  folderMetaRight: {
    alignItems: "flex-end",
  },
  folderCount: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  folderBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  folderBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  folderName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
    lineHeight: 18,
  },
  linksStack: {
    gap: 12,
  },
  linkCard: {
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  linkCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  linkIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    lineHeight: 20,
  },
  linkDomain: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  linkSummary: {
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.8,
    lineHeight: 18,
  },
  linkFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  linkTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    flex: 1,
  },
  tagPill: {
    backgroundColor: colors.pastelMint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.success,
  },
  linkDate: {
    fontSize: 11,
    color: colors.muted,
    marginLeft: 2,
  },
  linkCardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brandPrimary,
  },
}));
