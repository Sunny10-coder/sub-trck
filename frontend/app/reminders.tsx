import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "./(tabs)/_layout";
import {
  AvatarCircle,
  Badge,
  BrandMark,
  Card,
  EmptyState,
  Icon,
  Loading,
  PrimaryButton,
} from "@/src/components/ui";
import { api, useInvalidateAll, useReminders, useSubscriptions } from "@/src/lib/api";
import { daysLeftLabel, daysUntil, formatDate, money } from "@/src/lib/format";
import { accentFor, makeStyles, useTheme } from "@/src/theme";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type CalendarItem = {
  id: string;
  title: string;
  service: string;
  date: string; // YYYY-MM-DD
  kind: "renewal" | "reminder" | "trial_ending";
  price?: number | null;
  currency?: string | null;
  category?: string;
  completed?: boolean;
  subscriptionId?: string;
};

export default function Reminders({ isTab = false }: { isTab?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const invalidate = useInvalidateAll();

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateString(today), [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  const remindersQuery = useReminders();
  const subscriptionsQuery = useSubscriptions();

  const toggleReminder = useMutation({
    mutationFn: ({ id, completed }: any) => api.updateReminder(id, { completed }),
    onSuccess: invalidate,
  });

  const snoozeReminder = useMutation({
    mutationFn: ({ id, due_date }: any) => {
      const d = new Date(`${String(due_date).slice(0, 10)}T00:00:00`);
      d.setDate(d.getDate() + 3);
      return api.updateReminder(id, { due_date: toDateString(d) });
    },
    onSuccess: invalidate,
  });

  // Combine subscription renewals and reminders into unified calendar items
  const calendarItems = useMemo<CalendarItem[]>(() => {
    const list: CalendarItem[] = [];

    (subscriptionsQuery.data || []).forEach((sub: any) => {
      if (sub.status !== "Cancelled" && sub.status !== "Expired") {
        if (sub.renewal_date) {
          list.push({
            id: `sub-ren-${sub.id}`,
            subscriptionId: sub.id,
            title: `${sub.provider} Renewal`,
            service: sub.provider,
            date: String(sub.renewal_date).slice(0, 10),
            kind: "renewal",
            price: sub.price,
            currency: sub.currency,
            category: sub.category || "Subscription",
          });
        }
        if (sub.trial_end) {
          list.push({
            id: `sub-trial-${sub.id}`,
            subscriptionId: sub.id,
            title: `${sub.provider} Trial Ending`,
            service: sub.provider,
            date: String(sub.trial_end).slice(0, 10),
            kind: "trial_ending",
            price: sub.price,
            currency: sub.currency,
            category: sub.category || "Subscription",
          });
        }
      }
    });

    (remindersQuery.data || []).forEach((rem: any) => {
      if (!rem.completed && rem.due_date) {
        list.push({
          id: rem.id,
          title: rem.title,
          service: rem.title,
          date: String(rem.due_date).slice(0, 10),
          kind: "reminder",
          completed: rem.completed,
          category: rem.ref_type || "Reminder",
        });
      }
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [subscriptionsQuery.data, remindersQuery.data]);

  // Calendar dates matrix for currentMonth & currentYear
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Monday = 0, Sunday = 6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      itemsCount: number;
    }> = [];

    // Prev month padding
    const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, d);
      const str = toDateString(prevDate);
      days.push({
        dateStr: str,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: str === todayStr,
        itemsCount: calendarItems.filter((x) => x.date === str).length,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const curDate = new Date(currentYear, currentMonth, d);
      const str = toDateString(curDate);
      days.push({
        dateStr: str,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: str === todayStr,
        itemsCount: calendarItems.filter((x) => x.date === str).length,
      });
    }

    // Next month padding to fill grid
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const str = toDateString(nextDate);
      days.push({
        dateStr: str,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: str === todayStr,
        itemsCount: calendarItems.filter((x) => x.date === str).length,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr, calendarItems]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Filter items based on selectedDate or upcoming
  const displayedItems = useMemo(() => {
    if (selectedDate) {
      return calendarItems.filter((x) => x.date === selectedDate);
    }
    return calendarItems.filter((x) => {
      const diff = daysUntil(x.date);
      return diff != null && diff >= -1;
    });
  }, [selectedDate, calendarItems]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return "All Upcoming";
    if (selectedDate === todayStr) return "Today";
    const d = new Date(`${selectedDate}T00:00:00`);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }, [selectedDate, todayStr]);

  const isLoading = remindersQuery.isLoading || subscriptionsQuery.isLoading;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: TAB_BAR_SPACE + insets.bottom + 20,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl
            refreshing={remindersQuery.isFetching || subscriptionsQuery.isFetching}
            onRefresh={() => {
              remindersQuery.refetch();
              subscriptionsQuery.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <BrandMark subtitle="Renewals & Dates" compact />
          <View style={styles.headerRight}>
            <Pressable
              style={styles.circleBtn}
              onPress={() => router.push("/add-reminder")}
              hitSlop={8}
            >
              <Icon name="plus" size={20} color={colors.onSurface} />
            </Pressable>
            <AvatarCircle size={36} />
          </View>
        </View>

        {/* Month Selector: < May 2026 > (Matching Image 2) */}
        <View style={styles.monthHeaderRow}>
          <Pressable onPress={prevMonth} style={styles.monthArrowBtn} hitSlop={8}>
            <Icon name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
          <Pressable onPress={nextMonth} style={styles.monthArrowBtn} hitSlop={8}>
            <Icon name="chevron-right" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        {/* Calendar Card (Matching Image 2 Screen 3) */}
        <Card style={styles.calendarCard}>
          {/* Weekday Labels */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekdayText}>
                {w}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((d, index) => {
              const isSelected = selectedDate === d.dateStr;
              const hasEvents = d.itemsCount > 0;

              return (
                <Pressable
                  key={`${d.dateStr}-${index}`}
                  style={styles.dayCell}
                  onPress={() => setSelectedDate(isSelected ? null : d.dateStr)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      d.isToday && styles.todayCircle,
                      isSelected && !d.isToday && styles.selectedCircle,
                      isSelected && d.isToday && styles.selectedTodayCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        !d.isCurrentMonth && styles.dayNumberMuted,
                        d.isToday && styles.todayNumberText,
                        isSelected && !d.isToday && styles.selectedNumberText,
                      ]}
                    >
                      {d.dayNumber}
                    </Text>

                    {/* Event count badge (+2 / dot) like reference Image 2 */}
                    {hasEvents ? (
                      <View style={[styles.eventBadge, d.isToday && styles.eventBadgeOnYellow]}>
                        <Text style={styles.eventBadgeText}>
                          {d.itemsCount > 1 ? `+${d.itemsCount}` : "•"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Section Header: Upcoming renewals / Selected Date */}
        <View style={styles.listSectionHead}>
          <View>
            <Text style={styles.listSectionTitle}>
              {selectedDate ? `Due on ${selectedDateLabel}` : "Upcoming Renewals & Reminders"}
            </Text>
            <Text style={styles.listSectionSub}>
              {displayedItems.length} renewal{displayedItems.length === 1 ? "" : "s"} scheduled
            </Text>
          </View>

          {selectedDate ? (
            <Pressable
              style={styles.showAllPill}
              onPress={() => setSelectedDate(null)}
            >
              <Text style={styles.showAllPillText}>Show all</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Timeline / Renewal Cards List (Matching Image 2 bottom list) */}
        {displayedItems.length === 0 ? (
          <EmptyState
            icon="calendar-check-outline"
            title="Nothing due on this date"
            message="Select another date or view all upcoming renewals."
          />
        ) : (
          <View style={styles.eventsList}>
            {displayedItems.map((item) => {
              const itemDate = new Date(`${item.date}T00:00:00`);
              const monthShort = MONTH_NAMES[itemDate.getMonth()].slice(0, 3);
              const dayNum = itemDate.getDate();
              const days = daysUntil(item.date);
              const isUrgent = days != null && days >= 0 && days <= 3;
              const dateBg = isUrgent ? "#F97316" : item.kind === "trial_ending" ? "#EF4444" : "#8B5CF6";

              return (
                <Pressable
                  key={item.id}
                  style={styles.eventCard}
                  onPress={() => {
                    if (item.subscriptionId) {
                      router.push(`/subscription/${item.subscriptionId}` as any);
                    }
                  }}
                >
                  {/* Left Date Badge (Matching Image 2: Orange/Purple/Red pill) */}
                  <View style={[styles.dateBadgeBlock, { backgroundColor: dateBg }]}>
                    <Text style={styles.dateBadgeDay}>{dayNum}</Text>
                    <Text style={styles.dateBadgeMonth}>{monthShort}</Text>
                  </View>

                  {/* Right Card Details */}
                  <View style={styles.eventCardContent}>
                    <View style={styles.eventCardHeaderRow}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.price != null ? (
                        <Text style={styles.eventPrice}>
                          {money(item.price, item.currency || "AED")}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.eventSubRow}>
                      <Text style={styles.eventSubtitle} numberOfLines={1}>
                        {item.category || "Service"}
                      </Text>

                      {/* Days Left badge */}
                      <View
                        style={[
                          styles.daysLeftTag,
                          { backgroundColor: isUrgent ? colors.pastelPeach : colors.pastelLavender },
                        ]}
                      >
                        <Text
                          style={[
                            styles.daysLeftTagText,
                            { color: isUrgent ? colors.error : colors.brandSecondary },
                          ]}
                        >
                          {daysLeftLabel(item.date || undefined)}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Action row for reminders */}
                    {item.kind === "reminder" ? (
                      <View style={styles.eventActionsRow}>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => toggleReminder.mutate({ id: item.id, completed: true })}
                        >
                          <Icon name="check" size={14} color={colors.success} />
                          <Text style={[styles.actionChipText, { color: colors.success }]}>Done</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => snoozeReminder.mutate({ id: item.id, due_date: item.date })}
                        >
                          <Icon name="clock-plus-outline" size={14} color={colors.brandPrimary} />
                          <Text style={[styles.actionChipText, { color: colors.brandPrimary }]}>+3 days</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 6,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  monthArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCard: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 18,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  weekdayText: {
    width: 40,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  todayCircle: {
    backgroundColor: "#FACC15", // Bright distinctive yellow matching Image 2
  },
  selectedCircle: {
    backgroundColor: colors.brandPrimary,
  },
  selectedTodayCircle: {
    borderWidth: 2,
    borderColor: colors.onSurface,
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  dayNumberMuted: {
    color: colors.border,
    opacity: 0.5,
  },
  todayNumberText: {
    color: "#000000",
    fontWeight: "800",
  },
  selectedNumberText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  eventBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#8B5CF6", // Purple event dot/badge matching Image 2
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  eventBadgeOnYellow: {
    backgroundColor: "#EF4444",
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  listSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  listSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  listSectionSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  showAllPill: {
    backgroundColor: colors.pastelBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  showAllPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
    alignItems: "center",
  },
  dateBadgeBlock: {
    width: 50,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadgeDay: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  eventCardContent: {
    flex: 1,
    gap: 4,
  },
  eventCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    flex: 1,
  },
  eventPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  eventSubRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventSubtitle: {
    fontSize: 12,
    color: colors.muted,
    flex: 1,
  },
  daysLeftTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysLeftTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  eventActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
}));
