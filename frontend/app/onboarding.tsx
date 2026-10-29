import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark, HandNote, Icon, PrimaryButton } from "@/src/components/ui";
import { ensureReminderNotifications } from "@/src/lib/notifications";
import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const SLIDES = [
  {
    icon: "brain",
    title: "Your subscription brain",
    body: "Keep useful links, tools, promo codes, subscriptions and ideas together in your personal vault.",
  },
  {
    icon: "auto-fix",
    title: "Share anything, we understand it",
    body: "Drop in a screenshot, link or note. SubMind pulls out useful details and lets you review them before saving.",
  },
  {
    icon: "comment-question-outline",
    title: "Ask anything, anytime",
    body: "Find the things you saved, check what expires soon and ask SubMind questions about your own data.",
  },
];

type PermRow = {
  key: "notifications" | "photos" | "share";
  icon: string;
  tone: string;
  title: string;
  desc: string;
};

const PERMS: PermRow[] = [
  { key: "notifications", icon: "bell-outline", tone: "accentPink", title: "Notifications", desc: "Get renewal and reminder alerts" },
  { key: "photos", icon: "image-outline", tone: "accentPurple", title: "Photos", desc: "Import screenshots for AI auto-fill" },
  { key: "share", icon: "share-variant-outline", tone: "accentOrange", title: "Share to SubMind", desc: "Save links from Instagram, Chrome, YouTube and more" },
];

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  const finish = async () => {
    await storage.setItem("onboarded", true);
    router.replace("/(tabs)");
  };

  const requestPerm = async (key: PermRow["key"]) => {
    if (key === "notifications") {
      const ok = await ensureReminderNotifications();
      setGranted((g) => ({ ...g, notifications: ok }));
      return;
    }
    if (key === "photos") {
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setGranted((g) => ({ ...g, photos: res.granted }));
      return;
    }
    // "Share to SubMind" is a manifest-level Android share target, not a runtime
    // permission — it's already active once installed, so just acknowledge it.
    setGranted((g) => ({ ...g, share: true }));
  };

  const onSlide = i < SLIDES.length;

  if (onSlide) {
    const s = SLIDES[i];
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Icon name={s.icon} size={76} color={colors.onSurface} />
          </View>
          <Text style={styles.brand}>SubMind</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} testID="onboarding-title">{s.title}</Text>
          <Text style={styles.desc}>{s.body}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === i && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <PrimaryButton title="Continue" icon="arrow-right" onPress={() => setI(i + 1)} testID="onboarding-next" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <BrandMark compact />
        <Text style={styles.skip} onPress={finish} testID="onboarding-skip">Skip</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 14, marginTop: 24, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.permTitle}>
            Make SubMind work <Text style={{ color: colors.brandPrimary }}>smarter</Text> for you
          </Text>
          <Text style={styles.permDesc}>
            Detect subscriptions and save links automatically from screenshots, shared links, and alerts.
          </Text>
        </View>
        <View style={{ width: 100, alignItems: "center" }}>
          <View style={styles.mockupWrap}>
            <View style={styles.mockupPhone}>
              <Text style={styles.mockupBrand}>SubMind</Text>
              <View style={styles.mockupLine} />
              <View style={styles.mockupLine} />
            </View>
            <View style={[styles.bubble, { top: -4, left: -8, backgroundColor: colors.accentPink }]}>
              <Icon name="bell" size={13} color="#FFFFFF" />
            </View>
            <View style={[styles.bubble, { top: 32, left: -14, backgroundColor: colors.accentGreen }]}>
              <Icon name="link-variant" size={13} color="#FFFFFF" />
            </View>
            <View style={[styles.bubble, { bottom: 16, left: -8, backgroundColor: colors.brandPrimary }]}>
              <Icon name="image-outline" size={13} color="#FFFFFF" />
            </View>
            <View style={[styles.bubble, { bottom: -4, right: -8, backgroundColor: colors.accentOrange }]}>
              <Icon name="share-variant" size={13} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: 12, marginTop: 24 }}>
        {PERMS.map((p) => (
          <Pressable key={p.key} style={styles.permRow} onPress={() => requestPerm(p.key)} testID={`perm-${p.key}`}>
            <View style={[styles.permIcon, { backgroundColor: (colors as any)[p.tone] + "22" }]}>
              <Icon name={p.icon} size={20} color={(colors as any)[p.tone]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.permRowTitle}>{p.title}</Text>
              <Text style={styles.permRowDesc}>{p.desc}</Text>
            </View>
            <Icon
              name={granted[p.key] ? "check-circle" : "chevron-right"}
              size={20}
              color={granted[p.key] ? colors.success : colors.muted}
            />
          </Pressable>
        ))}

        <View style={styles.privacyRow}>
          <Icon name="email-off-outline" size={18} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>{"We don't scan your Gmail or personal emails"}</Text>
            <Text style={styles.privacyDesc}>
              Your inbox stays private. SubMind only accesses the permissions you selectively enable above.
            </Text>
          </View>
        </View>

        <View style={styles.footNote}>
          <Icon name="shield-check-outline" size={14} color={colors.muted} />
          <Text style={styles.footNoteText}>
            Local on-device storage · Sensitive credentials masked · Complete offline privacy
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 28, gap: 12 }}>
        <PrimaryButton title="Get Started" icon="arrow-right" onPress={finish} testID="onboarding-finish" />
        <Text style={styles.notNow} onPress={finish} testID="onboarding-not-now">
          Not now
        </Text>
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24 },
  hero: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.pastelYellow,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  heroInner: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  brand: { color: colors.onSurface, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  body: { paddingTop: 28, gap: 12 },
  title: { color: colors.onSurface, fontSize: 30, fontWeight: "900", letterSpacing: -0.6 },
  desc: { color: colors.muted, fontSize: 16, lineHeight: 24, fontWeight: "500" },
  footer: { gap: 20, marginTop: 12 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  dot: { height: 5, width: 24, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accentYellow, width: 38 },

  skip: { color: colors.muted, fontSize: 14, fontWeight: "700", paddingTop: 6 },
  permTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: 12, lineHeight: 32, letterSpacing: -0.5 },
  permDesc: { color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 20, fontWeight: "500" },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 16,
  },
  permIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  permRowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  permRowDesc: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "500" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    padding: 16,
  },
  privacyTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  privacyDesc: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 16, fontWeight: "500" },
  footNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  footNoteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 15 },
  notNow: { textAlign: "center", color: colors.muted, fontSize: 14, fontWeight: "700", paddingVertical: 6 },

  mockupWrap: { width: 84, height: 96, alignItems: "center", justifyContent: "center", marginTop: 4 },
  mockupPhone: {
    width: 68,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.glassStrong,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 8,
    gap: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  mockupBrand: { fontSize: 8, fontWeight: "900", color: colors.brandPrimary },
  mockupLine: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceSecondary, width: "80%" },
  bubble: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
}));
