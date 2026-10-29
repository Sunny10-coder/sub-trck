import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

const ACTIONS = [
  {
    icon: "receipt-text-outline",
    label: "Scan Bill / Sub",
    sub: "Invoices & renewals",
    bgKey: "pastelBlue" as const,
    fgKey: "brandPrimary" as const,
    href: "/scan?target=subscription&mode=library",
  },
  {
    icon: "bookmark-box-multiple-outline",
    label: "Photo to Vault",
    sub: "Webpage or tweet",
    bgKey: "pastelYellow" as const,
    fgKey: "warning" as const,
    href: "/scan?target=link&mode=library",
  },
  {
    icon: "camera-outline",
    label: "Camera Scan",
    sub: "Receipts & paper",
    bgKey: "pastelMint" as const,
    fgKey: "success" as const,
    href: "/scan?mode=camera",
  },
  {
    icon: "link-variant",
    label: "Paste Link",
    sub: "Web or social",
    bgKey: "pastelOrange" as const,
    fgKey: "warning" as const,
    href: "/paste-link",
  },
  {
    icon: "badge-account-outline",
    label: "Account Opened",
    sub: "Logins & credentials",
    bgKey: "pastelBlue" as const,
    fgKey: "brandPrimary" as const,
    href: "/add-account",
  },
  {
    icon: "wallet-plus-outline",
    label: "Subscription",
    sub: "Manual entry",
    bgKey: "pastelLavender" as const,
    fgKey: "brandSecondary" as const,
    href: "/add-subscription",
  },
  {
    icon: "lightbulb-on-outline",
    label: "Watch Plan",
    sub: "Price alerts",
    bgKey: "pastelMint" as const,
    fgKey: "success" as const,
    href: "/add-plan",
  },
  {
    icon: "github",
    label: "GitHub Repo",
    sub: "Code & tools",
    bgKey: "surfaceTertiary" as const,
    fgKey: "onSurface" as const,
    href: "/paste-link?source=GitHub",
  },
  {
    icon: "bell-plus-outline",
    label: "Reminder",
    sub: "Custom alert",
    bgKey: "pastelPink" as const,
    fgKey: "error" as const,
    href: "/add-reminder",
  },
  {
    icon: "note-plus-outline",
    label: "Quick Note",
    sub: "Free text",
    bgKey: "pastelLavender" as const,
    fgKey: "brandSecondary" as const,
    href: "/add-note",
  },
  {
    icon: "ticket-percent-outline",
    label: "Promo Code",
    sub: "Save deal",
    bgKey: "pastelYellow" as const,
    fgKey: "accentOrange" as const,
    href: "/add-promo",
  },
  {
    icon: "creation",
    label: "Prompt Vault",
    sub: "Prompts for your tools",
    bgKey: "pastelBlue" as const,
    fgKey: "brandPrimary" as const,
    href: "/prompts",
  },
  {
    icon: "graph-outline",
    label: "Brain",
    sub: "Tools by capability",
    bgKey: "pastelLavender" as const,
    fgKey: "brandSecondary" as const,
    href: "/graph",
  },
  {
    icon: "target",
    label: "Tool Finder",
    sub: "Best tool for a task",
    bgKey: "pastelYellow" as const,
    fgKey: "accentOrange" as const,
    href: "/find-tool",
  },
  {
    icon: "chat-processing-outline",
    label: "Ask AI",
    sub: "Chat assistant",
    bgKey: "pastelMint" as const,
    fgKey: "success" as const,
    href: "/(tabs)/ai",
  },
];

export default function Actions() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as any), 60);
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        testID="actions-backdrop"
        onPress={() => router.back()}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Save to Your Vault</Text>
          <Text style={styles.subtitle}>
            Choose an item to capture, parse or track.
          </Text>
        </View>
        <View style={styles.grid}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              testID={`action-${a.label}`}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              onPress={() => go(a.href)}
            >
              <View
                style={[
                  styles.tileIcon,
                  { backgroundColor: colors[a.bgKey] },
                ]}
              >
                <Icon name={a.icon} size={24} color={colors[a.fgKey]} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {a.label}
              </Text>
              <Text style={styles.tileSub} numberOfLines={1}>
                {a.sub}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(9, 13, 44, 0.4)",
  },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 0,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  tile: {
    width: "18%",
    alignItems: "center",
    gap: 4,
  },
  tilePressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.85,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    color: colors.onSurface,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  tileSub: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "500",
    textAlign: "center",
  },
  cancelBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
}));
