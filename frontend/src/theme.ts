// Design tokens for SubMind. Light + Dark. Keys match design_guidelines.json.
// Build StyleSheets with makeStyles((colors) => ...); read useTheme().colors for
// non-style color props (icon color, placeholders). Never write hex in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FBF7EF", // bright off-white canvas
  onSurface: "#0A0A0A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#0A0A0A",
  surfaceTertiary: "#F1ECE1",
  onSurfaceTertiary: "#0A0A0A",
  surfaceInverse: "#0A0A0A", // solid black hero cards / nav pill
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B6B6B",

  brand: "#FFD400", // signature bright yellow
  onBrand: "#0A0A0A",
  brandPrimary: "#FFD400",
  onBrandPrimary: "#0A0A0A",
  brandSecondary: "#3DDC84",
  onBrandSecondary: "#0A0A0A",
  brandTertiary: "#FF5C8A",
  onBrandTertiary: "#0A0A0A",

  success: "#2FBF71",
  onSuccess: "#0A0A0A",
  warning: "#FFB300",
  onWarning: "#0A0A0A",
  error: "#FF4D4D",
  onError: "#0A0A0A",
  info: "#4D8DFF",
  onInfo: "#0A0A0A",

  border: "#0A0A0A", // thick black outlines
  borderStrong: "#0A0A0A",
  divider: "#0A0A0A",

  // Bright color-blocks for cards / bubbles / folders
  accentRed: "#FF4D4D",
  accentYellow: "#FFD400",
  accentOrange: "#FF7A2F",
  accentBlue: "#4D8DFF",
  accentPurple: "#A66BFF",
  accentGreen: "#3DDC84",
  accentPink: "#FF5C8A",
  onAccent: "#0A0A0A", // black ink on every bright accent
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  surface: "#12100A",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1A12",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#26231A",
  onSurfaceTertiary: "#F3EFE3",
  surfaceInverse: "#FFD400",
  onSurfaceInverse: "#0A0A0A",
  muted: "#B4AE9C",

  brand: "#FFD400",
  onBrand: "#0A0A0A",
  brandPrimary: "#FFD400",
  onBrandPrimary: "#0A0A0A",
  brandSecondary: "#3DDC84",
  onBrandSecondary: "#0A0A0A",
  brandTertiary: "#FF5C8A",
  onBrandTertiary: "#0A0A0A",

  success: "#3DDC84",
  onSuccess: "#0A0A0A",
  warning: "#FFB300",
  onWarning: "#0A0A0A",
  error: "#FF4D4D",
  onError: "#0A0A0A",
  info: "#4D8DFF",
  onInfo: "#0A0A0A",

  border: "#000000",
  borderStrong: "#000000",
  divider: "#000000",

  accentRed: "#FF4D4D",
  accentYellow: "#FFD400",
  accentOrange: "#FF7A2F",
  accentBlue: "#4D8DFF",
  accentPurple: "#A66BFF",
  accentGreen: "#3DDC84",
  accentPink: "#FF5C8A",
  onAccent: "#0A0A0A",
};

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

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
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Bright color-block palette, cycled per card for the playful look.
export const ACCENT_KEYS = ["accentYellow", "accentRed", "accentOrange", "accentBlue", "accentPurple", "accentGreen", "accentPink"] as const;

export function accentFor(colors: ThemeColors, seed: string | number): string {
  const s = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[ACCENT_KEYS[s % ACCENT_KEYS.length]] as string;
}
