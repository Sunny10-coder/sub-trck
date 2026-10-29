import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/lib/api";
import { AppHeader, Badge, Card, Icon, Loading } from "@/src/components/ui";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

export default function Search() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (text: string) => {
    setQ(text);
    if (!text.trim()) {
      setRes(null);
      return;
    }
    setLoading(true);
    try {
      setRes(await api.search(text));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const groups = res
    ? [
        {
          key: "subscriptions",
          label: "Subscriptions",
          icon: "wallet-outline",
          items: res.subscriptions,
          nav: (i: any) => `/subscription/${i.id}`,
          title: (i: any) => i.provider,
          sub: (i: any) => i.plan || i.category,
        },
        {
          key: "links",
          label: "Saved Links",
          icon: "link-variant",
          items: res.links,
          nav: (i: any) => `/link/${i.id}`,
          title: (i: any) => i.title,
          sub: (i: any) => i.source,
        },
        {
          key: "plans",
          label: "Watched Plans",
          icon: "eye-outline",
          items: res.plans,
          nav: () => "/watchlist",
          title: (i: any) => i.provider,
          sub: (i: any) => i.plan,
        },
        {
          key: "reminders",
          label: "Reminders",
          icon: "bell-outline",
          items: res.reminders,
          nav: () => "/reminders",
          title: (i: any) => i.title,
          sub: () => "Reminder",
        },
        {
          key: "promos",
          label: "Promo Codes",
          icon: "ticket-percent-outline",
          items: res.promos,
          nav: () => "/promos",
          title: (i: any) => i.service,
          sub: (i: any) => i.discount || i.code,
        },
      ]
    : [];

  const total = groups.reduce((a, g) => a + (g.items?.length || 0), 0);

  return (
    <View style={styles.container}>
      <AppHeader title="Global Search" subtitle="Search across your entire vault" back />
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={colors.brandPrimary} />
        <TextInput
          autoFocus
          style={styles.search}
          placeholder="Search subscriptions, links, notes, promos…"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={run}
          testID="search-input"
        />
        {q ? (
          <Pressable onPress={() => run("")} hitSlop={10}>
            <Icon name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 30,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {res && total === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="magnify-close" size={32} color={colors.muted} />
              <Text style={styles.noneTitle}>No matching results</Text>
              <Text style={styles.none}>
                {"We couldn't find anything matching “" + q + "”."}
              </Text>
            </View>
          ) : null}

          {groups
            .filter((g) => g.items?.length)
            .map((g) => (
              <View key={g.key} style={{ gap: 10 }}>
                <View style={styles.groupHead}>
                  <Icon name={g.icon} size={16} color={colors.brandPrimary} />
                  <Text style={styles.groupTitle}>{g.label}</Text>
                  <Badge label={String(g.items.length)} tone="brand" />
                </View>

                {g.items.map((i: any, idx: number) => (
                  <Card
                    key={i.id || idx}
                    style={styles.row}
                    onPress={() => router.push(g.nav(i) as any)}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: accentFor(colors, g.title(i) || idx) },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {g.title(i)}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {g.sub(i)}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </Card>
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  search: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  noneTitle: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "700",
  },
  none: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  groupTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
  },
  rowSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
}));
