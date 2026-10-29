import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandler } from "react-native-android-widget";

import { LOCAL_DB_KEY, parseDatabase } from "@/src/lib/local-db";
import { computeInsights } from "@/src/lib/local-insights";
import { UpcomingWidget, type WidgetItem } from "./upcoming-widget";

export async function loadUpcomingItems(): Promise<WidgetItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_DB_KEY);
    const db = parseDatabase(raw);
    const insights = computeInsights(db);

    if (insights.countdown && insights.countdown.length > 0) {
      return insights.countdown.slice(0, 3).map((item: any) => {
        const days = item.days_left;
        const sub =
          days == null
            ? "Upcoming"
            : days < 0
            ? `${Math.abs(days)}d overdue`
            : days === 0
            ? "Today"
            : days === 1
            ? "Tomorrow"
            : `In ${days} days`;
        return {
          title: item.title || "Reminder",
          sub,
          overdue: typeof days === "number" && days < 0,
        };
      });
    }

    // Fallback to active subscriptions if countdown is empty
    const subs = Object.values(db.subscriptions || {}).filter(
      (s: any) => s && !s.deleted_at && (s.status === "Active" || s.status === "Trial")
    );

    if (subs.length > 0) {
      return subs.slice(0, 3).map((s: any) => ({
        title: s.provider || "Subscription",
        sub: `${s.plan ? `${s.plan} · ` : ""}${s.billing_cycle || "active"}`,
        overdue: false,
      }));
    }

    return [];
  } catch {
    return [];
  }
}

export async function syncUpcomingWidget() {
  if (Platform.OS !== "android") return;
  try {
    const { requestWidgetUpdate } = await import("react-native-android-widget");
    const items = await loadUpcomingItems();
    await requestWidgetUpdate({
      widgetName: "Upcoming",
      renderWidget: () => <UpcomingWidget items={items} />,
    });
  } catch {
    // Non-blocking
  }
}

export const upcomingWidgetTaskHandler: WidgetTaskHandler = async ({
  widgetAction,
  renderWidget,
}) => {
  if (widgetAction === "WIDGET_DELETED") return;
  const items = await loadUpcomingItems();
  renderWidget(<UpcomingWidget items={items} />);
};
