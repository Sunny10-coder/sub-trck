import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { formatTime } from "@/src/lib/format";
import { scheduleReminderNotification } from "@/src/lib/notifications";
import { AppHeader, Card, Icon, PrimaryButton } from "@/src/components/ui";
import { FormScroll, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}
function futureDate(days: number) {
  return iso(new Date(Date.now() + days * 86400000));
}

const DEFAULT_REMINDER_DATE = futureDate(1);
const DEFAULT_REMINDER_TIME = "09:00";
const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "Use tool in 3 days", days: 3 },
  { label: "Use tool in 7 days", days: 7 },
  { label: "3 days before expiry", days: 3 },
  { label: "7 days before expiry", days: 7 },
  { label: "In 30 days", days: 30 },
];

function dateFromParts(date: string, time: string): Date {
  const d = new Date(
    `${date.slice(0, 10)}T${/^\d{2}:\d{2}$/.test(time) ? time : "09:00"}:00`
  );
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default function AddReminder() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const { id, title: titleParam, ref_type, ref_id, return_to } =
    useLocalSearchParams<{
      id?: string;
      title?: string;
      ref_type?: string;
      ref_id?: string;
      return_to?: string;
    }>();
  const editing = !!id;
  const [title, setTitle] = useState(titleParam || "");
  const [date, setDate] = useState(DEFAULT_REMINDER_DATE);
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [preset, setPreset] = useState("Tomorrow");
  const [notify, setNotify] = useState(true);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .reminders()
      .then((rows) => {
        const row = rows.find((item: any) => item.id === id);
        if (!row) return;
        setTitle(row.title || "");
        setDate(row.due_date || DEFAULT_REMINDER_DATE);
        setTime(
          /^\d{2}:\d{2}$/.test(row.due_time) ? row.due_time : DEFAULT_REMINDER_TIME
        );
        setPreset("");
      })
      .catch(() => {});
  }, [id]);

  const pick = (choice: { label: string; days: number }) => {
    setPreset(choice.label);
    setDate(futureDate(choice.days));
  };

  const onPickerChange = (_: any, value?: Date) => {
    const wasPicker = picker;
    setPicker(null);
    if (!value) return;
    if (wasPicker === "date") {
      setDate(iso(value));
      setPreset("");
    } else {
      setTime(
        `${String(value.getHours()).padStart(2, "0")}:${String(
          value.getMinutes()
        ).padStart(2, "0")}`
      );
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (notify) await scheduleReminderNotification({ title, date, time });
      if (editing)
        return api.updateReminder(id!, { title, due_date: date, due_time: time });
      return api.createReminder({
        title,
        due_date: date,
        due_time: time,
        kind: "custom",
        notify,
        ref_type: ref_type || "custom",
        ref_id: ref_id || null,
      });
    },
    onSuccess: () => {
      invalidate();
      router.replace((return_to as any) || "/reminders");
    },
  });

  return (
    <View style={styles.container}>
      <AppHeader
        title={editing ? "Edit Reminder" : "New Reminder"}
        subtitle="Schedule alert & notification"
        back
      />
      <FormScroll>
        <Card style={styles.card}>
          <TextField
            label="Reminder Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Cancel Netflix trial before auto-renew"
            testID="rem-title"
          />

          <Text style={styles.sectionLabel}>Quick Date Presets</Text>
          <View style={styles.presets}>
            {PRESETS.map((choice) => (
              <Pressable
                key={choice.label}
                onPress={() => pick(choice)}
                testID={`preset-${choice.label}`}
                style={[
                  styles.preset,
                  preset === choice.label && styles.presetActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    preset === choice.label && styles.presetTextActive,
                  ]}
                >
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.dateTimeRow}>
            <Pressable
              style={styles.dateTimeField}
              onPress={() => setPicker("date")}
              testID="rem-date-btn"
            >
              <View
                style={[
                  styles.dateTimeIconBox,
                  { backgroundColor: colors.pastelLavender },
                ]}
              >
                <Icon name="calendar-outline" size={18} color={colors.brandSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateTimeLabel}>Due Date</Text>
                <Text style={styles.dateTimeValue}>{date}</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.dateTimeField}
              onPress={() => setPicker("time")}
              testID="rem-time-btn"
            >
              <View
                style={[
                  styles.dateTimeIconBox,
                  { backgroundColor: colors.pastelBlue },
                ]}
              >
                <Icon name="clock-outline" size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Text style={styles.dateTimeValue}>{formatTime(time)}</Text>
              </View>
            </Pressable>
          </View>

          {picker ? (
            <DateTimePicker
              value={dateFromParts(date, time)}
              mode={picker}
              is24Hour={false}
              onChange={onPickerChange}
            />
          ) : null}

          <View style={styles.notifyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifyLabel}>Push Notification</Text>
              <Text style={styles.notifySub}>
                Alert this device at {formatTime(time)} on {date}.
              </Text>
            </View>
            <Switch
              value={notify}
              onValueChange={setNotify}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>
      </FormScroll>

      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton
            title={editing ? "Save changes" : "Create reminder"}
            icon="bell-plus-outline"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!title.trim()}
            testID="rem-save"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  card: {
    gap: 16,
    padding: 18,
  },
  sectionLabel: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 2,
  },
  presets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preset: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  presetActive: {
    backgroundColor: colors.pastelLavender,
    borderColor: colors.brandSecondary,
  },
  presetText: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  presetTextActive: {
    color: colors.brandSecondary,
    fontWeight: "700",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  dateTimeField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dateTimeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  dateTimeValue: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.pastelLavender,
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
  },
  notifyLabel: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  notifySub: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  bar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glassStrong,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
