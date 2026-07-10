const prisma = require("../utils/prisma");
const logger = require("../utils/logger");

let firebaseAdmin = null;

const getFirebase = () => {
  if (firebaseAdmin) return firebaseAdmin;
  if (!process.env.FIREBASE_PROJECT_ID) return null;

  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (err) {
    logger.error("Firebase init failed", { error: err.message });
    return null;
  }
};

const sendToUser = async (userId, { type, title, message, data = {} }) => {
  try {
    // Store in DB
    const notification = await prisma.notification.create({
      data: { userId, notificationType: type, title, message, data },
    });

    // Push via FCM
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (user?.fcmToken) {
      const admin = getFirebase();
      if (admin) {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: { title, body: message },
          data: {
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, String(v)]),
            ),
            type,
          },
          android: {
            notification: { channelId: "eldercare-default", priority: "high" },
          },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        });
      }
    }

    return notification;
  } catch (err) {
    logger.error("Notification send failed", {
      userId,
      type,
      error: err.message,
    });
    // Non-fatal — don't throw
  }
};

const sendBulk = async (userIds, payload) => {
  await Promise.allSettled(userIds.map((id) => sendToUser(id, payload)));
};

module.exports = { sendToUser, sendBulk };
