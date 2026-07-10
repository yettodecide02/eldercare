const express = require("express");
const prisma = require("../utils/prisma");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// POST /notifications/subscribe  — save FCM token
router.post("/subscribe", authenticate, async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: "fcmToken required" });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken },
    });
    res.json({ message: "Subscribed to notifications" });
  } catch (err) {
    next(err);
  }
});

// GET /notifications
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { unreadOnly, page = 1, limit = 50 } = req.query;
    const where = { userId: req.user.id };
    if (unreadOnly === "true") where.isRead = false;

    const [total, notifications, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.notification.count({
        where: { userId: req.user.id, isRead: false },
      }),
    ]);

    res.json({
      data: notifications,
      unreadCount,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /notifications/read-all
router.put("/read-all", authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
});

// PUT /notifications/:id/read
router.put("/:id/read", authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
