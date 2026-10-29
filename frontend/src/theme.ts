// Design tokens for SubMind: Glassmorphism, light + dark.
// Screens draw on a shared aurora backdrop (see <Backdrop /> in components/ui),
// so `surface` is transparent and cards use translucent "glass" fills with a
// hairline highlight border. Brand colors stay 6-digit hex because several
// call sites append an alpha suffix (e.g. `colors.brandPrimary + "35"`).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "transparent",
  surfaceSolid: "#F7F4ED",
  onSurface: "#171714",
  surfaceSecondary: "#FFFDFA",
  onSurfaceSecondary: "#171714",
  surfaceTertiary: "#EEEAE1",
  onSurfaceTertiary: "#55554E",
  surfaceInverse: "#171714",
  onSurfaceInverse: "#FFFDFA",
  muted: "#69695F",
  glass: "#FFFDFA",
  glassStrong: "#F7F4ED",
  glassBorder: "#171714",
  glassHighlight: "transparent",
  glassShadow: "#171714",
  backdropFrom: "#F7F4ED",
  backdropVia: "#F7F4ED",
  backdropTo: "#F7F4ED",
  orbA: "transparent",
  orbB: "transparent",
  orbC: "transparent",
  brand: "#171714",
  onBrand: "#FFFFFF",
  brandPrimary: "#171714",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#6450DF",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#007C79",
  onBrandTertiary: "#FFFFFF",
  success: "#176A39",
  onSuccess: "#FFFFFF",
  warning: "#8B5000",
  onWarning: "#FFFFFF",
  error: "#B82336",
  onError: "#FFFFFF",
  info: "#265A8C",
  onInfo: "#FFFFFF",
  border: "#171714",
  borderStrong: "#171714",
  divider: "#D6D2C7",
  pastelMint: "#B2EDCE",
  pastelLavender: "#D8C9FF",
  pastelBlue: "#BCDFF2",
  pastelPink: "#FFB8D0",
  pastelOrange: "#FFC393",
  pastelYellow: "#FCE34D",
  pastelPeach: "#F9D9B8",
  accentRed: "#C02E43",
  accentYellow: "#C19D00",
  accentOrange: "#CA5600",
  accentBlue: "#26679C",
  accentPurple: "#6450DF",
  accentGreen: "#267644",
  accentPink: "#B82B6A",
  onAccent: "#FFFFFF",
  heroGradientFrom: "#171714",
  heroGradientVia: "#171714",
  heroGradientTo: "#171714",
  heroGradientGlow: "transparent",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = { ...light, surfaceSolid: "#20221F", surfaceSecondary: "#2D302A", surfaceTertiary: "#3B3D36", onSurface: "#F7F4ED", onSurfaceSecondary: "#F7F4ED", onSurfaceTertiary: "#CFD1C7", muted: "#B2B6A7", glass: "#2D302A", glassStrong: "#20221F", glassBorder: "#F7F4ED", border: "#F7F4ED", borderStrong: "#F7F4ED", divider: "#62665B", brandPrimary: "#FCE34D", brand: "#FCE34D", onBrandPrimary: "#171714", onBrand: "#171714", brandSecondary: "#C6B4FF", success: "#B2EDCE", warning: "#FCE34D", error: "#FFB8D0", info: "#BCDFF2", backdropFrom: "#20221F", backdropVia: "#20221F", backdropTo: "#20221F" };

// Paper, ink and punchy accents inspired by the supplied design references.
export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export type ThemePref = "light" | "dark" | "system";
const THEME_PREF_KEY = "submind.theme_pref.paper.v2";

export function applyThemePref(pref: ThemePref) {
  setColorScheme(pref === "system" ? null : pref);
}

export async function saveThemePref(pref: ThemePref) {
  applyThemePref(pref);
  await AsyncStorage.setItem(THEME_PREF_KEY, pref);
}

export async function loadThemePref(): Promise<ThemePref> {
  const saved = await AsyncStorage.getItem(THEME_PREF_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : defaultScheme;
}

loadThemePref().then(applyThemePref);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme =
    system === "dark" && themes.dark ? "dark" : system === "light" ? "light" : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => { const styles = factory(colors); return StyleSheet.create(Object.fromEntries(Object.entries(styles).map(([key, value]: [string, any]) => [key, value.fontSize ? { fontFamily: "Body", ...value } : value])) as T); }, [colors]);
  };
}

// Category-flavoured accents used by Plans, Accounts, Brain, etc.
export const ACCENT_KEYS = [
  "accentPurple",
  "accentBlue",
  "accentPink",
  "accentGreen",
  "accentOrange",
  "accentYellow",
] as const;

export function accentFor(colors: ThemeColors, seed: string | number): string {
  const s = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[ACCENT_KEYS[s % ACCENT_KEYS.length]] as string;
}

// Stable per-category hues (same in light and dark; tinted fills come from alpha).
export const CATEGORY_HUES: Record<string, string> = {
  Video: "#EC4899",
  Streaming: "#F43F5E",
  AI: "#8B5CF6",
  Music: "#10B981",
  Productivity: "#3B82F6",
  Cloud: "#06B6D4",
  Gaming: "#A855F7",
  News: "#F59E0B",
  Fitness: "#22C55E",
  Shopping: "#EAB308",
  Other: "#94A3B8",
};

export function categoryHue(category?: string | null): string {
  return CATEGORY_HUES[category || "Other"] || CATEGORY_HUES.Other;
}
