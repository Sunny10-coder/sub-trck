import { FlexWidget, TextWidget } from "react-native-android-widget";

export type WidgetItem = { title: string; sub: string; overdue?: boolean };

const RED_FROM = "#7F1D1D";
const RED_ACCENT = "#EF4444";
const CARD_BG = "#1A1517";

// Rendered by the widget task handler (headless JS) — no access to the app's
// normal RN tree/theme, so colors are hard-coded to match the in-app gradient hero.
export function UpcomingWidget({ items }: { items: WidgetItem[] }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "submind:///(tabs)/reminders" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: RED_FROM,
        borderRadius: 24,
        padding: 14,
        flexDirection: "column",
      }}
    >
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <TextWidget text="SubMind" style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "bold" }} />
        <TextWidget text="  ✦" style={{ color: RED_ACCENT, fontSize: 13 }} />
      </FlexWidget>
      {items.length === 0 ? (
        <TextWidget text="Nothing due soon 🎉" style={{ color: "#FFFFFFB3", fontSize: 13 }} />
      ) : (
        items.slice(0, 3).map((item, i) => (
          <FlexWidget
            key={i}
            style={{
              flexDirection: "column",
              backgroundColor: CARD_BG,
              borderRadius: 14,
              padding: 8,
              marginBottom: i === Math.min(items.length, 3) - 1 ? 0 : 6,
            }}
          >
            <TextWidget text={item.title} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "bold" }} maxLines={1} />
            <TextWidget text={item.sub} style={{ color: item.overdue ? "#F76E85" : "#FFFFFFB3", fontSize: 11 }} maxLines={1} />
          </FlexWidget>
        ))
      )}
    </FlexWidget>
  );
}
