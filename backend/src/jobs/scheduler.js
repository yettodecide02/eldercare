const cron = require("node-cron");
const prisma = require("../utils/prisma");
const logger = require("../utils/logger");
const notificationService = require("../services/notificationService");

// Auto-offline caregivers who have been online > 12 hours
const autoOfflineJob = cron.schedule(
  "0 * * * *",
  async () => {
    try {
      // We don't store "went online at" time, so we approximate:
      // caregivers who are online and have no active booking for 12h
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const result = await prisma.caregiverProfile.updateMany({
        where: {
          isOnline: true,
          updatedAt: { lt: twelveHoursAgo },
          bookings: { none: { status: "ACTIVE" } },
        },
        data: { isOnline: false },
      });
      if (result.count > 0) {
        logger.info(`Auto-offline: set ${result.count} caregivers offline`);
      }
    } catch (err) {
      logger.error("Auto-offline job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

// Delete GPS logs older than 90 days
const gpsCleanupJob = cron.schedule(
  "0 2 * * *",
  async () => {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.gpsLog.deleteMany({
        where: { timestamp: { lt: ninetyDaysAgo } },
      });
      if (count > 0) logger.info(`GPS cleanup: deleted ${count} old logs`);
    } catch (err) {
      logger.error("GPS cleanup job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

// Subscription renewal reminders (3 days before expiry)
const subscriptionReminderJob = cron.schedule(
  "0 9 * * *",
  async () => {
    try {
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const expiring = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          endDate: { lte: threeDaysFromNow, gte: new Date() },
        },
        include: { customer: { include: { user: true } } },
      });
      for (const sub of expiring) {
        await notificationService.sendToUser(sub.customer.userId, {
          type: "SUBSCRIPTION_EXPIRING",
          title: "Subscription Expiring Soon",
          message: `Your ${sub.plan} plan expires in 3 days. Renew to keep your benefits.`,
          data: { subscriptionId: sub.id, plan: sub.plan },
        });
      }
      if (expiring.length > 0)
        logger.info(`Subscription reminders sent: ${expiring.length}`);
    } catch (err) {
      logger.error("Subscription reminder job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

// Mark expired subscriptions as CANCELLED
const subscriptionExpiryJob = cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const now = new Date();
      const expired = await prisma.subscription.findMany({
        where: { status: "ACTIVE", endDate: { lt: now } },
        include: { customer: true },
      });
      for (const sub of expired) {
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "CANCELLED" },
          }),
          prisma.customerProfile.update({
            where: { id: sub.customerId },
            data: { subscriptionPlan: "FREE", subscriptionEndDate: null },
          }),
        ]);
      }
      if (expired.length > 0)
        logger.info(`Subscriptions expired: ${expired.length}`);
    } catch (err) {
      logger.error("Subscription expiry job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

// Booking reminders 1 hour before
const bookingReminderJob = cron.schedule(
  "*/30 * * * *",
  async () => {
    try {
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      const thirtyMinsFromNow = new Date(Date.now() + 30 * 60 * 1000);

      const upcoming = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          bookingDate: {
            gte: new Date(thirtyMinsFromNow.toDateString()),
            lte: new Date(oneHourFromNow.toDateString()),
          },
        },
        include: {
          customer: { include: { user: true } },
          caregiver: { include: { user: true } },
        },
      });

      for (const b of upcoming) {
        await Promise.all([
          notificationService.sendToUser(b.customer.userId, {
            type: "BOOKING_REMINDER",
            title: "Booking Reminder",
            message: `Your caregiver arrives in ~1 hour for booking ${b.bookingNumber}`,
            data: { bookingId: b.id },
          }),
          notificationService.sendToUser(b.caregiver.userId, {
            type: "BOOKING_REMINDER",
            title: "Booking Reminder",
            message: `You have a booking in ~1 hour (${b.bookingNumber})`,
            data: { bookingId: b.id },
          }),
        ]);
      }
    } catch (err) {
      logger.error("Booking reminder job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

// Medication reminders — runs every 5 minutes, fires push for any reminder time ±2 min
const medicationReminderJob = cron.schedule(
  "*/5 * * * *",
  async () => {
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hh}:${mm}`;

      // Build a small window of times to match: current minute and ±2 minutes
      const windowTimes = [];
      for (let offset = -2; offset <= 2; offset++) {
        const d = new Date(now.getTime() + offset * 60000);
        windowTimes.push(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }

      const reminders = await prisma.medicationReminder.findMany({
        where: {
          isActive: true,
          times: { hasSome: windowTimes },
        },
        include: {
          customer: { include: { user: true } },
          elder: { select: { name: true } },
        },
      });

      for (const r of reminders) {
        // Skip if already sent within the last 4 minutes to avoid duplicate fires
        if (r.lastSentAt && (now - r.lastSentAt) < 4 * 60 * 1000) continue;

        await Promise.all([
          notificationService.sendToUser(r.customer.userId, {
            type: "MEDICATION_REMINDER",
            title: `💊 Medication Reminder — ${r.elder.name}`,
            message: `Time to give ${r.name}${r.dosage ? ` (${r.dosage})` : ""} to ${r.elder.name}.`,
            data: { reminderId: r.id, elderId: r.elderId, medicationName: r.name },
          }),
          prisma.medicationReminder.update({
            where: { id: r.id },
            data: { lastSentAt: now },
          }),
        ]);
      }

      if (reminders.length > 0) {
        logger.info(`Medication reminders sent: ${reminders.length}`);
      }
    } catch (err) {
      logger.error("Medication reminder job failed", { error: err.message });
    }
  },
  { scheduled: false },
);

const startAllJobs = () => {
  autoOfflineJob.start();
  gpsCleanupJob.start();
  subscriptionReminderJob.start();
  subscriptionExpiryJob.start();
  bookingReminderJob.start();
  medicationReminderJob.start();
  logger.info("Cron jobs started");
};

const stopAllJobs = () => {
  autoOfflineJob.stop();
  gpsCleanupJob.stop();
  subscriptionReminderJob.stop();
  subscriptionExpiryJob.stop();
  bookingReminderJob.stop();
  medicationReminderJob.stop();
};

module.exports = { startAllJobs, stopAllJobs };
