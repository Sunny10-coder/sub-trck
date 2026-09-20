import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, useInvalidateAll } from "@/src/lib/api";
import { AppHeader, PrimaryButton } from "@/src/components/ui";
import { FormScroll, TextField } from "@/src/components/form";
import { makeStyles, useTheme } from "@/src/theme";

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function futureDate(days: number) { return iso(new Date(Date.now() + days * 86400000)); }

const DEFAULT_REMINDER_DATE = futureDate(1);
const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "This weekend", days: (6 - new Date().getDay() + 7) % 7 || 6 },
  { label: "Next week", days: 7 },
  { label: "In 7 days", days: 7 },
  { label: "In 30 days", days: 30 },
  { label: "Before expiry (3d)", days: 3 },
];

async function scheduleLocal(title: string, date: string) {
  try {
    const permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted;
    if (!granted && permission.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const when = new Date(date + "T09:00:00");
    if (when.getTime() <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: "SubMind reminder", body: title },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when } as any,
    });
  } catch {}
}

export default function AddReminder() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invalidate = useInvalidateAll();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(DEFAULT_REMINDER_DATE);
  const [preset, setPreset] = useState("Tomorrow");

  const pick = (choice: { label: string; days: number }) => {
    setPreset(choice.label);
    setDate(futureDate(choice.days));
  };

  const save = useMutation({
    mutationFn: async () => {
      await scheduleLocal(title, date);
      return api.createReminder({ title, due_date: date, kind: "custom" });
    },
    onSuccess: () => { invalidate(); router.replace("/reminders"); },
  });

  return (
    <View style={styles.container}>
      <AppHeader title="New reminder" back />
      <FormScroll>
        <TextField label="What to remember" value={title} onChangeText={setTitle} placeholder="Cancel Netflix before renewal" testID="rem-title" />
        <Text style={styles.label}>When</Text>
        <View style={styles.presets}>
          {PRESETS.map((choice) => (
            <Pressable key={choice.label} onPress={() => pick(choice)} testID={`preset-${choice.label}`} style={[styles.preset, preset === choice.label && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
              <Text style={[styles.presetText, preset === choice.label && { color: colors.onBrandPrimary }]}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextField label="Date" value={date} onChangeText={(value: string) => { setDate(value); setPreset(""); }} placeholder="YYYY-MM-DD" testID="rem-date" />
      </FormScroll>
      <KeyboardStickyView>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <PrimaryButton title="Set reminder" icon="bell-plus" onPress={() => save.mutate()} loading={save.isPending} disabled={!title.trim()} testID="rem-save" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  label: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "800", marginLeft: 4 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  presetText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  bar: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
}));
