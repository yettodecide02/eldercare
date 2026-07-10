import Constants from "expo-constants";
import { Platform } from "react-native";
import api from "../lib/api";

const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

let notificationsModulePromise = null;

async function loadNotificationsModule() {
  if (isExpoGo) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications").then((module) => {
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      return module;
    });
  }

  return notificationsModulePromise;
}

export const registerForPushNotifications = async () => {
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("[Notifications] Permission not granted");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("eldercare-default", {
        name: "ElderCare Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#16a34a",
      });
      await Notifications.setNotificationChannelAsync("eldercare-sos", {
        name: "SOS Emergency Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: "#dc2626",
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const fcmToken = tokenData.data;
    await api.post("/notifications/subscribe", { fcmToken });
    return fcmToken;
  } catch (err) {
    console.error("[Notifications] Registration failed:", err.message);
    return null;
  }
};

export const addNotificationListener = async (handler) => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return { remove() {} };
  }

  return Notifications.addNotificationReceivedListener(handler);
};

export const addResponseListener = async (handler) => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return { remove() {} };
  }

  return Notifications.addNotificationResponseReceivedListener(handler);
};
