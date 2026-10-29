import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export function configureNotificationHandler() {
  if (Platform.OS === "web") return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Graceful fallback
  }
}

export function playNotificationSound() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Upbeat two-tone chime (D5 -> A5)
    playTone(587.33, now, 0.35);
    playTone(880, now + 0.12, 0.55);
  } catch {
    // Ignore audio restriction if before first gesture
  }
}

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "default" | "unsupported"
> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission as "granted" | "denied" | "default";
    }
    return "unsupported";
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted ? "granted" : current.canAskAgain ? "default" : "denied";
  } catch {
    return "unsupported";
  }
}

export async function ensureReminderNotifications(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") {
      return true;
    }
    if (Notification.permission !== "denied") {
      try {
        const res = await Notification.requestPermission();
        return res === "granted";
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminders", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#753BFF",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
          android: {},
        })
      ).granted;
    }
    return granted;
  } catch {
    return false;
  }
}

export async function displayNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (Platform.OS === "web") {
    playNotificationSound();
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const n = new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: `submind-${Date.now()}`,
        });
        n.onclick = () => {
          window.focus();
        };
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

// Active scheduled Web timers to prevent garbage collection
const webTimers = new Map<string, number>();

export async function scheduleReminderNotification(input: {
  title: string;
  date: string;
  time?: string;
  daysBefore?: number;
}): Promise<string | null> {
  const granted = await ensureReminderNotifications();
  if (!granted) return null;

  const time = /^\d{2}:\d{2}$/.test(input.time || "") ? input.time : "09:00";
  const due = new Date(`${input.date.slice(0, 10)}T${time}:00`);
  if (Number.isNaN(due.getTime())) return null;

  const daysBefore = Math.max(0, input.daysBefore ?? 0);
  due.setDate(due.getDate() - daysBefore);

  const diffMs = due.getTime() - Date.now();

  // If due right now or within the past 10 minutes, fire immediately
  if (diffMs <= 0) {
    if (diffMs > -10 * 60 * 1000) {
      await displayNotification("SubMind Reminder", input.title);
      return "immediate";
    }
    return null;
  }

  if (Platform.OS === "web") {
    const timerId = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // If due within 24 hours, schedule via setTimeout
    if (diffMs <= 24 * 60 * 60 * 1000) {
      const handle = window.setTimeout(async () => {
        await displayNotification("SubMind Reminder", input.title);
        webTimers.delete(timerId);
      }, diffMs);
      webTimers.set(timerId, handle);
    }
    return timerId;
  }

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "SubMind Reminder",
        body: input.title,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: due,
      } as Notifications.NotificationTriggerInput,
    });
  } catch {
    return null;
  }
}

export async function testNotification(): Promise<{ ok: boolean; message: string }> {
  const granted = await ensureReminderNotifications();
  if (!granted) {
    return {
      ok: false,
      message:
        Platform.OS === "web"
          ? "Notification permission is not granted. Please allow notifications in your browser."
          : "Notification permission was denied. Please enable alerts in device settings.",
    };
  }

  const ok = await displayNotification(
    "SubMind Alert ✦",
    "Notifications are active! You will receive timely alerts for renewals and reminders."
  );

  return {
    ok,
    message: ok ? "Notification sent successfully!" : "Could not display notification.",
  };
}
