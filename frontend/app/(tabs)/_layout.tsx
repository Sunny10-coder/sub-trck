import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Icon } from "@/src/components/ui";
import { useReminders } from "@/src/lib/api";
import { makeStyles, useTheme } from "@/src/theme";

// Space that scroll content leaves at the bottom to clear the floating bar
export const TAB_BAR_SPACE = 96;

const TAB_META: Record<string, { icon: string; iconActive: string; label: string }> = {
  index: { icon: "home-variant-outline", iconActive: "home-variant", label: "Home" },
  accounts: { icon: "badge-account-outline", iconActive: "badge-account", label: "Accounts" },
  subscriptions: { icon: "layers-outline", iconActive: "layers", label: "Subs" },
  vault: { icon: "bookmark-multiple-outline", iconActive: "bookmark-multiple", label: "Vault" },
  reminders: { icon: "calendar-month-outline", iconActive: "calendar-month", label: "Calendar" },
};

function TabBar({ state, navigation }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reminders = useReminders();

  const routes = state.routes.filter((r: { key: string; name: string }) => TAB_META[r.name]);
  const left = routes.filter((route: { name: string }) => ["index", "accounts"].includes(route.name));
  const right = routes.filter((route: { name: string }) => ["subscriptions", "vault"].includes(route.name));

  const hasUrgentReminders = (reminders.data || []).some(
    (item: any) => !item.completed && item.due_date && new Date(item.due_date) <= new Date()
  );

  const renderTab = (route: any) => {
    const idx = state.routes.findIndex((r: { key: string; name: string }) => r.key === route.key);
    const focused = state.index === idx;
    const meta = TAB_META[route.name] || {
      icon: "circle-outline",
      iconActive: "circle",
      label: route.name,
    };
    const showDot = route.name === "reminders" && hasUrgentReminders;

    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        style={[styles.tab, focused && { backgroundColor: colors.pastelYellow, borderColor: "#171714", borderWidth: 1.5 }]}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <View style={styles.iconContainer}>
          <Icon
            name={focused ? meta.iconActive : meta.icon}
            size={22}
            color={focused ? "#171714" : "#FFFFFF"}
          />
          {showDot ? <View style={styles.badgeDot} /> : null}
          {focused ? <View style={styles.focusedPill} /> : null}
        </View>
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.shell}>
        {left.map(renderTab)}

        <View style={styles.fabWrap}>
          <Pressable
            testID="tab-add"
            style={({ pressed }) => [styles.fabPressable, pressed && styles.fabPressed]}
            onPress={() => router.push("/actions")}
          >
            <LinearGradient
              colors={[colors.pastelYellow, colors.pastelYellow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Icon name="plus" size={26} color="#171714" />
            </LinearGradient>
          </Pressable>
        </View>

        {right.map(renderTab)}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      // Opaque per-tab backdrop: transparent scenes let other tabs show through and overlap.
      screenLayout={({ children }) => (
        <View style={{ flex: 1, backgroundColor: colors.surfaceSolid }}>
          <Backdrop />
          {children}
        </View>
      )}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surfaceSolid } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="accounts" />
      <Tabs.Screen name="subscriptions" />
      <Tabs.Screen name="vault" />
      <Tabs.Screen name="reminders" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="inbox" options={{ href: null }} />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  shell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#007C79",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "90%",
    maxWidth: 390,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    shadowColor: colors.glassShadow,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 5 },
    elevation: 0,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 7,
    paddingHorizontal: 5,
    minWidth: 50,
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  badgeDot: {
    position: "absolute",
    top: 0,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.error,
  },
  focusedPill: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brandPrimary,
  },
  tabLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  tabLabelActive: {
    color: "#171714",
    fontWeight: "700",
  },
  fabWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  fabPressable: {
    borderRadius: 10,
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 0,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  fabGradient: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.glassBorder,
  },
}));
