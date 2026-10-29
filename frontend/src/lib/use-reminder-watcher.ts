import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";
import { api, useInsights, useInvalidateAll, useReminders } from "./api";
import { displayNotification, getNotificationPermissionStatus } from "./notifications";

const EXPIRY_NUDGE_KEY = "submind.expiry_nudge_day.v1";

// Runs once per app launch and once per day for the notification:
//  1. cancelled subscriptions from older versions move into Accounts;
//  2. subscriptions with no renewal/expiry date trigger a "please update" nudge
//     (the Subs tab also shows an in-app banner with Add date / Move to Accounts).
export function useExpiryNudge() {
  const insights = useInsights();
  const invalidate = useInvalidateAll();
  const swept = useRef(false);

  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    api
      .sweepCancelledSubscriptions()
      .then((res) => {
        if (res.moved) invalidate();
      })
      .catch(() => {});
  }, [invalidate]);

  const missing: { provider: string }[] = insights.data?.missing_expiry || [];
  const missingCount = missing.length;
  useEffect(() => {
    if (!missingCount) return;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if ((await AsyncStorage.getItem(EXPIRY_NUDGE_KEY)) === today) return;
        // Never prompt for permission at launch; the in-app banner covers that case.
        if ((await getNotificationPermissionStatus()) !== "granted") return;
        const names = missing.slice(0, 3).map((m) => m.provider).join(", ");
        const more = missingCount > 3 ? ` +${missingCount - 3} more` : "";
        const shown = await displayNotification(
          "Add expiry dates",
          `${names}${more} ${missingCount === 1 ? "has" : "have"} no expiry date. Update ${missingCount === 1 ? "it" : "them"} or move to Accounts.`,
        );
        if (shown) await AsyncStorage.setItem(EXPIRY_NUDGE_KEY, today);
      } catch {
        // Notifications are best-effort.
      }
    })();
  }, [missingCount]);
}

// Keep track of reminders fired in this session
const firedReminders = new Set<string>();

export function useReminderWatcher() {
  const { data: reminders } = useReminders();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!reminders || reminders.length === 0) return;

    const checkReminders = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        for (const r of reminders) {
          if (r.completed) continue;
          if (!r.notify) continue;
          if (!r.due_date) continue;

          const dateStr = String(r.due_date).slice(0, 10);
          const reminderId = r.id || `${r.title}-${dateStr}`;

          if (firedReminders.has(reminderId)) continue;

          // Check if due today or overdue
          if (dateStr < todayStr) {
            // Overdue reminder alert
            firedReminders.add(reminderId);
            await displayNotification(
              "SubMind — Overdue Alert",
              `"${r.title}" was due on ${dateStr}.`
            );
            continue;
          }

          if (dateStr === todayStr) {
            // If it has due_time, check if time has arrived
            if (r.due_time && /^\d{2}:\d{2}$/.test(r.due_time)) {
              const [h, m] = r.due_time.split(":").map(Number);
              if (
                currentHours > h ||
                (currentHours === h && currentMinutes >= m)
              ) {
                firedReminders.add(reminderId);
                await displayNotification(
                  "SubMind Reminder ✦",
                  r.title || "Upcoming subscription / reminder"
                );
              }
            } else {
              // Due today without specific time (default 09:00 or morning)
              firedReminders.add(reminderId);
              await displayNotification(
                "SubMind Reminder ✦",
                `Due today: ${r.title}`
              );
            }
          }
        }
      } catch {
        // Silently ignore watcher checks
      } finally {
        checkingRef.current = false;
      }
    };

    // Run check on mount and every 15 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 15000);

    return () => clearInterval(interval);
  }, [reminders]);
}
