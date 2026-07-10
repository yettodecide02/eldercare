import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../src/store/authStore";
import {
  registerForPushNotifications,
  addNotificationListener,
  addResponseListener,
} from "../src/services/notificationService";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 2 },
    mutations: { retry: 0 },
  },
});

function AuthGuard() {
  const { isAuthenticated, isLoading, user, init } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const notifListener = useRef(null);
  const responseListener = useRef(null);

  // Init stored auth on startup
  useEffect(() => {
    init();
  }, []);

  // Register push notifications when authenticated
  useEffect(() => {
    let isActive = true;

    if (isAuthenticated) {
      registerForPushNotifications().catch(() => {});

      (async () => {
        // Handle foreground notifications
        notifListener.current = await addNotificationListener(
          (notification) => {
            console.log("[FCM] Received:", notification.request.content.title);
          },
        );

        // Handle notification tap (background/killed)
        responseListener.current = await addResponseListener((response) => {
          const data = response.notification.request.content.data;
          if (data?.bookingId) {
            router.push(
              `/(customer)/booking/track?bookingId=${data.bookingId}`,
            );
          }
        });

        if (!isActive) {
          notifListener.current?.remove();
          responseListener.current?.remove();
        }
      })();
    }

    return () => {
      isActive = false;
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  // Route guard
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    const inCustomer = segments[0] === "(customer)";
    const inCaregiver = segments[0] === "(caregiver)";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && !inCustomer && !inCaregiver && segments[0] !== "(admin)") {
      // Covers: in auth group after login, at root on fresh start, or any unmatched route
      if (user?.role === "CAREGIVER") router.replace("/(caregiver)");
      else if (user?.role === "ADMIN") router.replace("/(admin)");
      else router.replace("/(customer)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
