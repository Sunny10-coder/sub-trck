import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./ui";
import { useTheme } from "@/src/theme";
import { loadUpcomingItems } from "@/src/widgets/task-handler";
import type { WidgetItem } from "@/src/widgets/upcoming-widget";

const PURPLE_FROM = "#2A2158";
const PURPLE_TO = "#8B5CF6";
const CARD_BG = "#1F1A3E";

export function SubscriptionWidgetPreview() {
  const { colors } = useTheme();
  const [items, setItems] = useState<WidgetItem[]>([]);
  const [pinning, setPinning] = useState(false);
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  useEffect(() => {
    loadUpcomingItems().then(setItems);
  }, []);

  const handlePin = async () => {
    if (Platform.OS !== "android") {
      setPinStatus("Widgets can be placed on Android home screen.");
      setTimeout(() => setPinStatus(null), 3000);
      return;
    }

    setPinning(true);
    try {
      const { requestPinWidget } = await import("react-native-android-widget");
      await requestPinWidget({
        widgetName: "Upcoming",
      });
      setPinStatus("Widget pin requested!");
    } catch {
      setPinStatus("Long-press your home screen to add the SubMind widget.");
    } finally {
      setPinning(false);
      setTimeout(() => setPinStatus(null), 4000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="widgets-outline" size={18} color={colors.brandPrimary} />
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
            Home Screen Widget
          </Text>
        </View>

        {Platform.OS === "android" ? (
          <Pressable
            onPress={handlePin}
            disabled={pinning}
            style={({ pressed }) => [
              styles.pinButton,
              { backgroundColor: colors.pastelLavender, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="pin-outline" size={14} color={colors.brandSecondary} />
            <Text style={[styles.pinText, { color: colors.brandSecondary }]}>
              {pinning ? "Adding…" : "Add to Home"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Styled Widget Replica */}
      <View style={styles.widgetBox}>
        <View style={styles.widgetTop}>
          <View style={styles.widgetBrand}>
            <Text style={styles.brandTitle}>SubMind</Text>
            <Text style={styles.brandSparkle}>  ✦</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live Widget</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nothing due soon 🎉</Text>
            <Text style={styles.emptySub}>Your next renewals will appear here</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {items.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.itemSub,
                      item.overdue ? { color: "#F76E85" } : { color: "#FFFFFFB3" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.sub}
                  </Text>
                </View>
                <Icon name="chevron-right" size={14} color="#FFFFFF66" />
              </View>
            ))}
          </View>
        )}
      </View>

      {pinStatus ? (
        <Text style={[styles.statusText, { color: colors.muted }]}>{pinStatus}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  pinText: {
    fontSize: 12,
    fontWeight: "700",
  },
  widgetBox: {
    backgroundColor: PURPLE_FROM,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#4A3E8A",
    shadowColor: "#2A2158",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  widgetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  widgetBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandSparkle: {
    color: PURPLE_TO,
    fontSize: 14,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1F1A3E99",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    color: "#FFFFFFCC",
    fontSize: 11,
    fontWeight: "600",
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  emptyBox: {
    paddingVertical: 14,
    alignItems: "center",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptySub: {
    color: "#FFFFFF80",
    fontSize: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
});
