const express = require("express");
const { body, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const s3Service = require("../services/s3Service");

const router = express.Router();
router.use(authenticate, requireRole("ADMIN"));

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errors.array()[0].msg;
  return null;
};

// GET /admin/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const [
      totalCustomers,
      totalCaregivers,
      activeCaregivers,
      totalBookings,
      completedBookings,
      activeBookings,
      pendingVerifications,
      activeDisputes,
      revenueResult,
      avgRatingResult,
      failedPayments,
    ] = await Promise.all([
      prisma.customerProfile.count(),
      prisma.caregiverProfile.count(),
      prisma.caregiverProfile.count({ where: { isOnline: true } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
      prisma.booking.count({ where: { status: "ACTIVE" } }),
      prisma.caregiverProfile.count({
        where: { verificationStatus: "UNDER_REVIEW" },
      }),
      prisma.report.count({
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      }),
      prisma.payment.aggregate({
        where: { status: "RELEASED" },
        _sum: { amount: true },
      }),
      prisma.caregiverProfile.aggregate({ _avg: { averageRating: true } }),
      prisma.payment.count({ where: { status: "FAILED" } }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [bookingTrends, serviceDistribution, userGrowth, revenueByMonth] =
      await Promise.all([
        prisma.booking.groupBy({
          by: ["bookingDate"],
          where: { bookingDate: { gte: thirtyDaysAgo } },
          _count: true,
          orderBy: { bookingDate: "asc" },
        }),
        prisma.booking.groupBy({ by: ["serviceType"], _count: true }),
        prisma.user.groupBy({
          by: ["createdAt"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: true,
        }),
        prisma.payment.findMany({
          where: {
            status: "RELEASED",
            createdAt: {
              gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
            },
          },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    res.json({
      metrics: {
        totalUsers: totalCustomers + totalCaregivers,
        totalCustomers,
        activeCaregivers,
        totalBookings,
        completedBookings,
        totalRevenue: revenueResult._sum.amount || 0,
        activeBookings,
        avgRating: avgRatingResult._avg.averageRating || 0,
      },
      charts: {
        dailyBookings: bookingTrends.map((b) => ({
          date: b.bookingDate,
          count: b._count,
        })),
        serviceTypeDistribution: serviceDistribution.map((s) => ({
          type: s.serviceType,
          count: s._count,
        })),
        userGrowth: userGrowth.map((u) => ({
          date: u.createdAt,
          count: u._count,
        })),
        revenueByMonth: revenueByMonth.reduce((acc, p) => {
          const month = p.createdAt.toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + parseFloat(p.amount);
          return acc;
        }, {}),
      },
      alerts: { pendingVerifications, activeDisputes, failedPayments },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/caregivers/pending
router.get("/caregivers/pending", async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [total, caregivers] = await Promise.all([
      prisma.caregiverProfile.count({
        where: { verificationStatus: "UNDER_REVIEW" },
      }),
      prisma.caregiverProfile.findMany({
        where: { verificationStatus: "UNDER_REVIEW" },
        include: {
          user: { select: { name: true, phone: true } },
          documents: true,
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Generate signed S3 view URLs for documents
    const data = await Promise.all(
      caregivers.map(async (c) => {
        const docsWithUrls = await Promise.all(
          c.documents.map(async (d) => {
            let viewUrl = null;
            try {
              viewUrl = await s3Service.getSignedViewUrl(d.s3Url);
            } catch {}
            return {
              id: d.id,
              type: d.documentType,
              url: d.s3Url,
              viewUrl,
              status: d.status,
              fileName: d.fileName,
            };
          }),
        );
        return {
          id: c.id,
          name: c.user.name,
          phone: c.user.phone,
          city: c.city,
          documents: docsWithUrls,
          submittedAt: c.createdAt,
          status: c.verificationStatus,
        };
      }),
    );

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/caregivers/:id/verify
router.put(
  "/caregivers/:id/verify",
  body("action")
    .isIn(["APPROVE", "REJECT"])
    .withMessage("action must be APPROVE or REJECT"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { action, reason } = req.body;
      const newStatus = action === "APPROVE" ? "VERIFIED" : "REJECTED";
      const docStatus = action === "APPROVE" ? "VERIFIED" : "REJECTED";

      const [caregiver] = await prisma.$transaction([
        prisma.caregiverProfile.update({
          where: { id: req.params.id },
          data: { verificationStatus: newStatus },
          include: { user: true },
        }),
        prisma.caregiverDocument.updateMany({
          where: { caregiverId: req.params.id },
          data: { status: docStatus, verifiedAt: new Date(), verificationNotes: reason || null },
        }),
      ]);

      await notificationService.sendToUser(caregiver.userId, {
        type:
          action === "APPROVE"
            ? "VERIFICATION_APPROVED"
            : "VERIFICATION_REJECTED",
        title:
          action === "APPROVE" ? "Profile Verified! 🎉" : "Verification Update",
        message:
          action === "APPROVE"
            ? "Your profile has been verified. You can now accept bookings!"
            : `Verification was not approved${reason ? ": " + reason : ""}. Please re-upload your documents.`,
        data: { reason: reason || "" },
      });

      res.json({
        id: caregiver.id,
        status: newStatus,
        verifiedAt: new Date(),
        reason,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/caregivers
router.get("/caregivers", async (req, res, next) => {
  try {
    const { status, city, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.verificationStatus = status;
    if (city) where.city = { contains: city, mode: "insensitive" };

    const [total, caregivers] = await Promise.all([
      prisma.caregiverProfile.count({ where }),
      prisma.caregiverProfile.findMany({
        where,
        include: {
          user: {
            select: { name: true, phone: true, email: true, isActive: true },
          },
          _count: { select: { bookings: true, reviews: true } },
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      caregivers: caregivers.map((c) => ({
        id: c.id,
        city: c.city,
        hourlyRate: c.hourlyRate,
        serviceTypes: c.serviceTypes,
        verificationStatus: c.verificationStatus,
        isOnline: c.isOnline,
        avgRating: c.averageRating,
        totalReviews: c.totalReviews,
        completedBookings: c.completedBookings,
        totalEarnings: c.totalEarnings,
        user: c.user,
        _count: c._count,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/caregivers/:id/suspend
router.put(
  "/caregivers/:id/suspend",
  body("reason").notEmpty().withMessage("Suspension reason required"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { reason, days } = req.body;
      const caregiver = await prisma.caregiverProfile.findUnique({
        where: { id: req.params.id },
        include: { user: true },
      });
      if (!caregiver)
        return res.status(404).json({ error: "Caregiver not found" });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: caregiver.userId },
          data: { isActive: false },
        }),
        prisma.caregiverProfile.update({
          where: { id: req.params.id },
          data: { isOnline: false },
        }),
      ]);

      await notificationService.sendToUser(caregiver.userId, {
        type: "ACCOUNT_SUSPENDED",
        title: "Account Suspended",
        message: `Your account has been suspended${reason ? ": " + reason : ""}. Contact support.`,
        data: { reason, days: String(days || "") },
      });

      res.json({ id: req.params.id, suspended: true, reason, days });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/bookings
router.get("/bookings", async (req, res, next) => {
  try {
    const {
      status,
      startDate,
      endDate,
      caregiverId,
      customerId,
      serviceType,
      page = 1,
      limit = 50,
    } = req.query;
    const where = {};
    if (status) where.status = { in: status.split(",") };
    if (caregiverId) where.caregiverId = caregiverId;
    if (customerId) where.customerId = customerId;
    if (serviceType) where.serviceType = serviceType;
    if (startDate || endDate) {
      where.bookingDate = {};
      if (startDate) where.bookingDate.gte = new Date(startDate);
      if (endDate) where.bookingDate.lte = new Date(endDate);
    }

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          customer: { include: { user: { select: { name: true } } } },
          caregiver: { include: { user: { select: { name: true } } } },
          payment: true,
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        customer: { name: b.customer.user.name },
        caregiver: { name: b.caregiver.user.name },
        serviceType: b.serviceType,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        durationHours: parseFloat(b.duration),
        totalAmount: parseFloat(b.totalAmount),
        payment: b.payment,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/reports
router.get("/reports", async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.reportType = type;

    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: {
          reportedBy: { select: { name: true } },
          reportedAgainst: { select: { name: true } },
          booking: { select: { bookingNumber: true } },
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/reports/:id/resolve  — with full side-effect logic
router.put(
  "/reports/:id/resolve",
  body("resolution")
    .isIn([
      "REFUND",
      "PARTIAL_REFUND",
      "WARN",
      "SUSPEND",
      "DEACTIVATE",
      "CLOSE",
    ])
    .withMessage("Invalid resolution type"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { resolution, refundAmount, reason, suspensionDays } = req.body;
      const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
          booking: { include: { payment: true } },
          reportedAgainst: true,
          reportedBy: true,
        },
      });
      if (!report) return res.status(404).json({ error: "Report not found" });

      const ops = [
        prisma.report.update({
          where: { id: req.params.id },
          data: {
            status: "RESOLVED",
            resolution,
            refundAmount,
            reason,
            suspensionDays,
            resolvedAt: new Date(),
          },
        }),
      ];

      // Side effects
      if (
        (resolution === "REFUND" || resolution === "PARTIAL_REFUND") &&
        report.booking?.payment
      ) {
        const amt = refundAmount || parseFloat(report.booking.payment.amount);
        ops.push(
          prisma.payment.update({
            where: { bookingId: report.bookingId },
            data: { status: "REFUNDED", refundAmount: amt },
          }),
        );
        ops.push(
          prisma.booking.update({
            where: { id: report.bookingId },
            data: { status: "CANCELLED" },
          }),
        );
      }
      if (resolution === "SUSPEND" || resolution === "DEACTIVATE") {
        const cg = await prisma.caregiverProfile.findFirst({
          where: { userId: report.reportedAgainstId },
        });
        if (cg) {
          ops.push(
            prisma.caregiverProfile.update({
              where: { id: cg.id },
              data: { isOnline: false },
            }),
          );
          if (resolution === "DEACTIVATE") {
            ops.push(
              prisma.user.update({
                where: { id: report.reportedAgainstId },
                data: { isActive: false },
              }),
            );
          }
        }
      }

      const [updated] = await prisma.$transaction(ops);

      // Notify both parties
      await notificationService.sendToUser(report.reportedById, {
        type: "REPORT_RESOLVED",
        title: "Your Report Has Been Resolved",
        message: `Report #${report.id.slice(0, 8)} resolved: ${resolution}${reason ? " - " + reason : ""}`,
        data: { reportId: report.id, resolution },
      });
      await notificationService.sendToUser(report.reportedAgainstId, {
        type: "REPORT_ACTION_TAKEN",
        title: "Account Action",
        message: reason || `Action taken on your account: ${resolution}`,
        data: { reportId: report.id, resolution },
      });

      res.json({
        id: report.id,
        status: "RESOLVED",
        resolution,
        refundAmount,
        resolvedAt: updated.resolvedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/analytics
router.get("/analytics", async (req, res, next) => {
  try {
    const {
      period = "30d",
      startDate: customStart,
      endDate: customEnd,
    } = req.query;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const startDate = customStart
      ? new Date(customStart)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = customEnd ? new Date(customEnd) : new Date();

    const [
      newUsers,
      newBookings,
      revenue,
      topCaregivers,
      serviceBreakdown,
      cityBreakdown,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.booking.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.payment.aggregate({
        where: {
          status: "RELEASED",
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      prisma.caregiverProfile.findMany({
        take: 10,
        orderBy: { completedBookings: "desc" },
        include: { user: { select: { name: true } } },
        select: {
          id: true,
          completedBookings: true,
          averageRating: true,
          totalEarnings: true,
          city: true,
          user: { select: { name: true } },
        },
      }),
      prisma.booking.groupBy({
        by: ["serviceType"],
        where: { createdAt: { gte: startDate } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.caregiverProfile.groupBy({
        by: ["city"],
        _count: true,
        orderBy: { _count: { city: "desc" } },
        take: 10,
      }),
    ]);

    res.json({
      period: { start: startDate, end: endDate },
      newUsers,
      newBookings,
      revenue: revenue._sum.amount || 0,
      topCaregivers,
      serviceBreakdown: serviceBreakdown.map((s) => ({
        serviceType: s.serviceType,
        count: s._count,
        revenue: s._sum.totalAmount,
      })),
      cityBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/customers
router.get("/customers", async (req, res, next) => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;
    const where = {};
    if (isActive !== undefined) where.user = { isActive: isActive === "true" };
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customerProfile.count({ where }),
      prisma.customerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, isActive: true, createdAt: true } },
          _count: { select: { bookings: true, elders: true } },
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      customers: customers.map((c) => ({
        id: c.id,
        userId: c.userId,
        address: c.address,
        city: c.city,
        subscriptionPlan: c.subscriptionPlan,
        user: c.user,
        _count: c._count,
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/customers/:id/toggle-active
router.put("/customers/:id/toggle-active", async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const newState = !customer.user.isActive;
    await prisma.user.update({ where: { id: customer.userId }, data: { isActive: newState } });

    if (!newState) {
      await notificationService.sendToUser(customer.userId, {
        type: "ACCOUNT_DEACTIVATED",
        title: "Account Deactivated",
        message: "Your account has been deactivated. Contact support for help.",
        data: {},
      });
    }

    res.json({ id: customer.id, userId: customer.userId, isActive: newState });
  } catch (err) {
    next(err);
  }
});

// POST /admin/notify/bulk  — send notification to all caregivers or all customers
router.post(
  "/notify/bulk",
  body("title").notEmpty().withMessage("Title required"),
  body("message").notEmpty().withMessage("Message required"),
  body("audience").isIn(["CAREGIVER", "CUSTOMER", "ALL"]).withMessage("audience must be CAREGIVER, CUSTOMER, or ALL"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { title, message, audience } = req.body;
      const roleFilter = audience === "ALL" ? undefined : { role: audience };
      const users = await prisma.user.findMany({ where: { isActive: true, ...roleFilter }, select: { id: true } });

      let sent = 0;
      for (const u of users) {
        try {
          await notificationService.sendToUser(u.id, { type: "ADMIN_BROADCAST", title, message, data: {} });
          sent++;
        } catch {}
      }

      res.json({ sent, total: users.length, audience });
    } catch (err) {
      next(err);
    }
  },
);

// GET /admin/active-bookings  — for live sessions map (#25)
router.get("/active-bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: "ACTIVE" },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        caregiver: { include: { user: { select: { name: true } } } },
        gpsLogs: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    });

    res.json({
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customer.user.name,
        caregiverName: b.caregiver.user.name,
        serviceType: b.serviceType,
        checkInTime: b.checkInTime,
        lastLocation: b.gpsLogs[0] || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/settings
router.get("/settings", async (req, res, next) => {
  // Platform-wide settings (can be extended to a DB-backed config table)
  res.json({
    commission: { percent: 10, minimumFee: 50 },
    payoutMinimum: 500,
    rateRange: { min: 250, max: 2000 },
    subscriptionPrices: {
      FREE: 0,
      FAMILY_BASIC: 499,
      FAMILY_PREMIUM: 999,
      ENTERPRISE: 2999,
    },
    otpRateLimit: 5,
    bookingLeadTimeHours: 1,
    maxBookingHours: 12,
    sosLimit: 3,
    gpsUpdateFrequencySeconds: 30,
    caregiverAutoOfflineHours: 12,
  });
});

module.exports = router;
