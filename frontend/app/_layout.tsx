import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { Backdrop } from "@/src/components/ui";
import { configureNotificationHandler } from "@/src/lib/notifications";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";
import { upcomingWidgetTaskHandler } from "@/src/widgets/task-handler";

try {
  configureNotificationHandler();
} catch (e) {
  console.warn("Notification configuration error", e);
}

// Widgets are Android-only; registerWidgetTaskHandler calls a native
// AppRegistry API that doesn't exist on web/iOS and throws if called there.
// Must run at module scope (not inside a component) so it's also registered
// when Android relaunches this JS bundle headlessly to redraw the widget.
try {
  if (Platform.OS === "android") registerWidgetTaskHandler(upcomingWidgetTaskHandler);
} catch (e) {
  console.warn("Widget registration error", e);
}

// Redirects into Paste Link (prefilled) whenever the OS hands us a share-sheet
// intent (e.g. sharing a link from Instagram/Chrome/YouTube into SubMind).
function ShareIntentRedirect() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl || (shareIntent.text?.match(/https?:\/\/[^\s]+/i)?.[0] ?? "");
    const note = shareIntent.text || "";
    router.push({ pathname: "/paste-link", params: { url, note, source: "Shared" } } as any);
    resetShareIntent();
  }, [hasShareIntent]);

  return null;
}

import { useExpiryNudge, useReminderWatcher } from "@/src/lib/use-reminder-watcher";

function ReminderWatcher() {
  useReminderWatcher();
  return null;
}

// Nudges once a day about subscriptions that have no renewal/expiry date, and
// moves legacy "Cancelled" subscriptions into Accounts on first run.
function ExpiryNudge() {
  useExpiryNudge();
  return null;
}

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Display: require("../assets/fonts/Display.ttf"),
    Body: require("../assets/fonts/Body.ttf"),
    MaterialDesignIcons: require("@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf"),
  });

  useEffect(() => {}, [fontsLoaded]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ReminderWatcher />
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ShareIntentProvider>
                <View style={{ flex: 1, backgroundColor: colors.surfaceSolid }}>
                  <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                  <ShareIntentRedirect />
                  <ExpiryNudge />
                  <Stack
                    // Each screen paints its own opaque aurora. A transparent screen lets the
                    // previous (still mounted) screens show through on web and makes layouts overlap.
                    screenLayout={({ children, options }) =>
                      options.presentation === "transparentModal" ? (
                        <>{children}</>
                      ) : (
                        <View style={{ flex: 1, backgroundColor: colors.surfaceSolid }}>
                          <Backdrop />
                          {children}
                        </View>
                      )
                    }
                    screenOptions={{
                      headerShown: false,
                      animation: "fade_from_bottom",
                      contentStyle: { backgroundColor: colors.surfaceSolid },
                    }}
                  >
                    <Stack.Screen name="actions" options={{ presentation: "transparentModal", animation: "fade" }} />
                  </Stack>
                </View>
              </ShareIntentProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
