import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

export function Icon({ name, size = 22, color, style }: { name: any; size?: number; color?: string; style?: any }) {
  const { colors } = useTheme();
  return <MaterialDesignIcons name={name} size={size} color={color ?? colors.onSurface} style={style} />;
}

// A quiet paper canvas keeps the bold cards readable.
export function Backdrop() { const { colors } = useTheme(); return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSolid }]} />; }

export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.searchField}>
      <Icon name="magnify" size={18} color={colors.muted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || "Search"}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Icon name="close-circle" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {right}
    </View>
  );
}

// Clean minimal placeholder if MountainSun is referenced
export function MountainSun({ width = 48, height = 32 }: { width?: number; height?: number }) {
  return null;
}

export function HandNote({ text, style }: { text: string; style?: any }) {
  return null;
}

export function AvatarCircle({ initial = "A", size = 40 }: { initial?: string; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      onPress={() => router.push("/profile")}
      testID="header-avatar"
    >
      <LinearGradient
        colors={[colors.pastelLavender, colors.pastelBlue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatarGradient, { borderRadius: size / 2 }]}
      >
        <Text style={[styles.avatarCircleText, { color: colors.brandPrimary, fontSize: size * 0.38 }]}>
          {initial.slice(0, 2).toUpperCase()}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

// Sleek modern App Brandmark
export function BrandMark({ compact, subtitle }: { compact?: boolean; subtitle?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLogoBox}>
        <LinearGradient
          colors={[colors.brandPrimary, colors.brandPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandLogoGradient}
        >
          <Icon name="checkbox-multiple-blank-circle-outline" size={16} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <View>
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandSub}>Sub</Text>
          <Text style={styles.brandBrand}>Mind</Text>
          <View style={styles.sparkleDot}>
            <Icon name="creation" size={13} color={colors.brandSecondary} />
          </View>
        </View>
        {!compact ? (
          <Text style={styles.brandTagline}>{subtitle || "Intelligent tracker & vault"}</Text>
        ) : null}
      </View>
    </View>
  );
}

// Signature Blue -> Indigo -> Violet Gradient Hero Banner
export function GradientHero({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <LinearGradient
      colors={[colors.heroGradientFrom, colors.heroGradientVia, colors.heroGradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, style]}
    >
      <View style={styles.heroGlowOverlay} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

// Pill stat inside GradientHero
export function HeroStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: any;
  value: string | number;
  label: string;
  tone?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.heroStat}>
      <View style={[styles.heroStatIcon, tone ? { backgroundColor: tone } : null]}>
        <Icon name={icon} size={18} color="#FFFFFF" />
      </View>
      <View>
        <Text style={styles.heroStatValue}>{value}</Text>
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
    </View>
  );
}

// Modern stat tile row with contextual pastel backgrounds
export function StatTileRow({
  items,
}: {
  items: {
    icon: any;
    value: string | number;
    label: string;
    tone: "success" | "brand" | "warning" | "info" | "purple";
  }[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const getToneStyles = (tone: string) => {
    switch (tone) {
      case "success":
        return { bg: colors.pastelMint, fg: colors.success };
      case "warning":
        return { bg: colors.pastelOrange, fg: colors.warning };
      case "info":
        return { bg: colors.pastelBlue, fg: colors.info };
      case "purple":
        return { bg: colors.pastelLavender, fg: colors.brandSecondary };
      default:
        return { bg: colors.pastelLavender, fg: colors.brandPrimary };
    }
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statTileRow}>
      {items.map((it) => {
        const t = getToneStyles(it.tone);
        return (
          <View key={it.label} style={styles.statTile}>
            <View style={[styles.statTileIcon, { backgroundColor: t.bg }]}>
              <Icon name={it.icon} size={16} color={t.fg} />
            </View>
            <Text style={styles.statTileValue}>{it.value}</Text>
            <Text style={styles.statTileLabel}>{it.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// Modern AI Insight callout card
export function AiCallout({
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.aiCallout} testID="ai-callout">
      <View style={styles.aiCalloutIcon}>
        <Icon name="creation" size={18} color={colors.brandSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.aiCalloutHeadRow}>
          <View style={styles.aiSparkleBadge}>
            <Text style={styles.aiCalloutKicker}>✨ AI Insight</Text>
          </View>
          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={12}>
              <Icon name="close" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.aiCalloutTitle}>{title}</Text>
        {message ? <Text style={styles.aiCalloutMsg}>{message}</Text> : null}
        {actionLabel ? (
          <Pressable onPress={onAction} style={styles.aiCalloutAction}>
            <Text style={styles.aiCalloutActionText}>{actionLabel}  ›</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Modern AppHeader: Clean and spacious with [Logo] [Search] [Avatar] or [Back] Title [Right]
export function AppHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} hitSlop={12} testID="header-back" style={styles.backBtn}>
            <View style={styles.backBtnCircle}>
              <Icon name="arrow-left" size={20} color={colors.onSurface} />
            </View>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

// Modern 20-24px rounded white card with subtle 1px border and soft shadow
export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
      >

        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} testID={testID}>

      {children}
    </View>
  );
}

// Primary Button with Blue->Violet Gradient or clean Secondary
export function PrimaryButton({
  title,
  onPress,
  icon,
  disabled,
  loading,
  variant = "primary",
  testID,
  style,
}: any) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (variant === "secondary") {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.btnSecondary,
          { opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onSurface} size="small" />
        ) : (
          <>
            {icon ? <Icon name={icon} size={18} color={colors.onSurface} /> : null}
            <Text style={styles.btnSecondaryText}>{title}</Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btnWrap,
        { opacity: disabled ? 0.5 : pressed ? 0.92 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={[colors.brandPrimary, colors.brandPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btnGradient}
      >
        {loading ? (
          <ActivityIndicator color={colors.onBrandPrimary} size="small" />
        ) : (
          <>
            {icon ? <Icon name={icon} size={18} color={colors.onBrandPrimary} /> : null}
            <Text style={styles.btnText}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// Filter chip. `tone` (a hex color) gives the chip its own hue so filter rows
// read as color-coded; without it the chip uses the brand tint.
export function Chip({ label, active, onPress, testID, tone, icon, count }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const hue: string = tone || colors.brandPrimary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.chip,
        { borderColor: colors.border },
        active && { backgroundColor: colors.pastelYellow, borderColor: colors.border },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={active ? "#171714" : colors.onSurfaceTertiary} /> : null}
      <Text style={[styles.chipText, active && { color: "#171714", fontWeight: "800" }]}>{label}</Text>
      {count != null ? (
        <View style={[styles.chipCount, { backgroundColor: active ? hue : colors.surfaceTertiary }]}>
          <Text style={[styles.chipCountText, { color: active ? "#FFFFFF" : colors.onSurfaceTertiary }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Items are plain strings or {label, value, tone?, icon?, count?}. `selected` /
// `onSelect` are accepted as aliases for `value` / `onChange`.
export function ChipRow({ items, value, onChange, selected, onSelect, testIDPrefix }: any) {
  const styles = useStyles();
  const current = value ?? selected;
  const change = onChange ?? onSelect;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRowContent}
      style={styles.chipRow}
    >
      {items.map((it: any) => {
        const item = typeof it === "string" ? { label: it, value: it } : it;
        return (
          <Chip
            key={String(item.value)}
            label={item.label}
            tone={item.tone}
            icon={item.icon}
            count={item.count}
            active={current === item.value}
            onPress={() => change?.(item.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${item.value}` : undefined}
          />
        );
      })}
    </ScrollView>
  );
}

// Contextual Pill Badges with soft tinted backgrounds
export function Badge({
  label,
  tone = "brand",
}: {
  label: string;
  tone?: "brand" | "mint" | "peach" | "success" | "warning" | "error" | "muted" | "info";
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const map: Record<string, [string, string]> = {
    brand: [colors.pastelLavender, colors.brandSecondary],
    mint: [colors.pastelMint, colors.success],
    peach: [colors.pastelOrange, colors.warning],
    success: [colors.pastelMint, colors.success],
    warning: [colors.pastelOrange, colors.warning],
    error: [colors.pastelPink, colors.error],
    info: [colors.pastelBlue, colors.info],
    muted: [colors.surfaceTertiary, colors.muted],
  };

  const [bg, fg] = map[tone] || map.brand;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  const tone = pct >= 95 ? "mint" : pct >= 75 ? "warning" : "muted";
  return <Badge label={`${pct}% match`} tone={tone as any} />;
}

// Clean Modern Empty State
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: any;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={36} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const BRAND_ICONS: Record<string, { icon: string; bg: string; fg: string }> = {
  netflix: { icon: "netflix", bg: "#FEE2E2", fg: "#E50914" },
  spotify: { icon: "spotify", bg: "#DCFCE7", fg: "#1DB954" },
  youtube: { icon: "youtube", bg: "#FEE2E2", fg: "#FF0000" },
  google: { icon: "google", bg: "#E0F2FE", fg: "#4285F4" },
  github: { icon: "github", bg: "#F3F4F6", fg: "#24292E" },
  apple: { icon: "apple", bg: "#F3F4F6", fg: "#000000" },
  amazon: { icon: "amazon", bg: "#FEF3C7", fg: "#FF9900" },
  discord: { icon: "discord", bg: "#EEF2FF", fg: "#5865F2" },
  chatgpt: { icon: "creation", bg: "#DCFCE7", fg: "#10A37F" },
  openai: { icon: "creation", bg: "#DCFCE7", fg: "#10A37F" },
  midjourney: { icon: "image-filter-drama", bg: "#F3E8FF", fg: "#8B5CF6" },
  elevenlabs: { icon: "waveform", bg: "#F3F4F6", fg: "#111827" },
  cursor: { icon: "cursor-default-click", bg: "#E0E7FF", fg: "#4F46E5" },
  replit: { icon: "code-braces", bg: "#FFEDD5", fg: "#F97316" },
  notion: { icon: "notebook-outline", bg: "#F3F4F6", fg: "#111827" },
  canva: { icon: "palette-outline", bg: "#E0F2FE", fg: "#00C4CC" },
  figma: { icon: "vector-square", bg: "#FEE2E2", fg: "#F24E1E" },
  pika: { icon: "video-vintage", bg: "#FEF3C7", fg: "#D97706" },
  runway: { icon: "filmstrip", bg: "#F3F4F6", fg: "#111827" },
  sora: { icon: "video-outline", bg: "#E0E7FF", fg: "#6366F1" },
  claude: { icon: "robot-outline", bg: "#FFEDD5", fg: "#D97706" },
  dropbox: { icon: "dropbox", bg: "#E0F2FE", fg: "#0061FF" },
  skrill: { icon: "credit-card-outline", bg: "#FCE7F3", fg: "#811559" },
};

// Modern Category Icon Circle / Rounded Square with matched brand icons or contextual tint
export function CategoryDot({
  category,
  provider,
  logo_url,
  size = 44,
}: {
  category?: string;
  provider?: string;
  logo_url?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();

  const brandKey = provider
    ? Object.keys(BRAND_ICONS).find((k) => provider.toLowerCase().includes(k))
    : undefined;
  const brandMatch = brandKey ? BRAND_ICONS[brandKey] : null;

  const palette: Record<string, { bg: string; fg: string }> = {
    Video: { bg: colors.pastelPink, fg: colors.accentPink },
    AI: { bg: colors.pastelLavender, fg: colors.brandSecondary },
    Streaming: { bg: colors.pastelPink, fg: colors.error },
    Music: { bg: colors.pastelMint, fg: colors.success },
    Productivity: { bg: colors.pastelBlue, fg: colors.info },
    Cloud: { bg: colors.pastelBlue, fg: colors.info },
    Gaming: { bg: colors.pastelLavender, fg: colors.brandTertiary },
    News: { bg: colors.pastelOrange, fg: colors.warning },
    Fitness: { bg: colors.pastelMint, fg: colors.success },
    Shopping: { bg: colors.pastelYellow, fg: colors.accentYellow },
    Other: { bg: colors.surfaceTertiary, fg: colors.muted },
  };

  const icons: Record<string, string> = {
    Video: "movie-open-outline",
    AI: "creation",
    Streaming: "play-circle-outline",
    Music: "music-note-outline",
    Productivity: "briefcase-outline",
    Cloud: "cloud-outline",
    Gaming: "gamepad-variant-outline",
    News: "newspaper-variant-outline",
    Fitness: "dumbbell",
    Shopping: "shopping-outline",
    Other: "shape-outline",
  };

  // Brand marks keep their own hue on a translucent tint; near-black marks
  // (GitHub, Apple, Notion...) fall back to the theme text color so they stay visible on dark glass.
  const isDarkMark = brandMatch ? /^#(0|1|2)[0-9A-F]{5}$/i.test(brandMatch.fg) : false;
  const brandFg = brandMatch ? (isDarkMark ? colors.onSurface : brandMatch.fg) : "";
  const theme = brandMatch
    ? { bg: brandFg + "26", fg: brandFg }
    : palette[category || "Other"] || palette.Other;
  const iconName = brandMatch
    ? brandMatch.icon
    : icons[category || "Other"] || "shape-outline";

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={iconName} size={size * 0.52} color={theme.fg} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    marginRight: 2,
  },
  backBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Display",
    color: colors.onSurface,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    overflow: "visible",
    shadowColor: colors.glassShadow,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  cardSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "70%",
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    paddingVertical: 0,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitleText: {
    fontFamily: "Display",
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  chipCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  btnWrap: {
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0,
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  btnText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 22,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  btnSecondaryText: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
  },
  chipRow: {
    flexGrow: 0,
  },
  chipRowContent: {
    gap: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  chip: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    flexShrink: 0,
  },
  chipText: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.pastelLavender,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyMsg: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    overflow: "hidden",
  },
  brandLogoGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  brandSub: {
    fontFamily: "Display",
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  brandBrand: {
    fontFamily: "Display",
    fontSize: 22,
    fontWeight: "800",
    color: colors.brandPrimary,
    letterSpacing: -0.5,
  },
  sparkleDot: {
    marginLeft: 3,
  },
  brandTagline: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },

  hero: {
    borderRadius: 10,
    padding: 22,
    position: "relative",
    overflow: "hidden",
    shadowColor: colors.brandSecondary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },
  heroGlowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  heroStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroStatIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroStatLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontWeight: "600",
  },

  statTileRow: {
    gap: 10,
    paddingVertical: 4,
  },
  statTile: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 92,
    gap: 4,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  statTileIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statTileValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  statTileLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },

  aiCallout: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.pastelLavender,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.brandSecondary + "55",
  },
  aiCalloutIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiCalloutHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiSparkleBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiCalloutKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brandSecondary,
    letterSpacing: 0.3,
  },
  aiCalloutTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  aiCalloutMsg: {
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: 4,
    lineHeight: 18,
  },
  aiCalloutAction: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  aiCalloutActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brandSecondary,
  },

  avatarCircle: {
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircleText: {
    fontWeight: "800",
  },
}));
