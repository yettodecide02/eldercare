const express = require("express");
const { body, query, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const s3Service = require("../services/s3Service");
const notificationService = require("../services/notificationService");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errors.array()[0].msg;
  return null;
};

// GET /caregiver/search
router.get("/search", authenticate, async (req, res, next) => {
  try {
    const {
      serviceType,
      city,
      minRate,
      maxRate,
      minRating,
      date,
      startTime,
      duration,
      page = 1,
      limit = 50,
      sortBy = "rating",
    } = req.query;

    const where = { verificationStatus: "VERIFIED", isOnline: true };

    if (city) where.city = { contains: city, mode: "insensitive" };
    if (minRate || maxRate) {
      where.hourlyRate = {};
      if (minRate) where.hourlyRate.gte = parseFloat(minRate);
      if (maxRate) where.hourlyRate.lte = parseFloat(maxRate);
    }
    if (minRating) where.averageRating = { gte: parseFloat(minRating) };
    if (serviceType) where.serviceTypes = { hasSome: serviceType.split(",") };

    const orderBy =
      sortBy === "rate_asc"
        ? { hourlyRate: "asc" }
        : sortBy === "rate_desc"
          ? { hourlyRate: "desc" }
          : { averageRating: { sort: "desc", nulls: "last" } };
    const skip = (parseInt(page) - 1) * Math.min(parseInt(limit), 100);

    const [total, caregivers] = await Promise.all([
      prisma.caregiverProfile.count({ where }),
      prisma.caregiverProfile.findMany({
        where,
        include: {
          user: { select: { name: true, avatarUrl: true } },
          _count: { select: { reviews: true } },
        },
        orderBy,
        skip,
        take: Math.min(parseInt(limit), 100),
      }),
    ]);

    res.json({
      data: caregivers.map((c) => ({
        id: c.id,
        name: c.user.name,
        rating: c.averageRating,
        totalReviews: c.totalReviews,
        hourlyRate: c.hourlyRate,
        serviceTypes: c.serviceTypes,
        city: c.city,
        isVerified: true,
        avatarUrl: c.user.avatarUrl,
        isOnline: c.isOnline,
        languages: c.languages,
        yearsOfExperience: c.yearsOfExperience,
        completedBookings: c.completedBookings,
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

// GET /caregiver/me
router.get(
  "/me",
  authenticate,
  requireRole("CAREGIVER"),
  async (req, res, next) => {
    try {
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
        include: {
          documents: true,
          availability: true,
          user: {
            select: { name: true, phone: true, email: true, avatarUrl: true },
          },
          reviews: {
            include: { customer: { include: { user: { select: { name: true } } } } },
            take: 20,
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!profile)
        return res
          .status(404)
          .json({ error: "Profile not found", code: "NOT_FOUND" });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
);

// GET /caregiver/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const caregiver = await prisma.caregiverProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { name: true, avatarUrl: true, phone: true } },
        availability: true,
        reviews: {
          include: {
            customer: { include: { user: { select: { name: true } } } },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!caregiver)
      return res
        .status(404)
        .json({ error: "Caregiver not found", code: "NOT_FOUND" });

    // Check if the requesting customer has favorited this caregiver
    let isFavorited = false;
    if (req.user.role === "CUSTOMER") {
      const cp = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      if (cp) {
        const fav = await prisma.customerFavorite.findUnique({
          where: { customerId_caregiverId: { customerId: cp.id, caregiverId: caregiver.id } },
        });
        isFavorited = !!fav;
      }
    }

    res.json({
      id: caregiver.id,
      name: caregiver.user.name,
      phone: caregiver.user.phone,
      city: caregiver.city,
      bio: caregiver.bio,
      rating: caregiver.averageRating,
      totalReviews: caregiver.totalReviews,
      hourlyRate: caregiver.hourlyRate,
      serviceTypes: caregiver.serviceTypes,
      languages: caregiver.languages,
      certifications: caregiver.certifications,
      yearsOfExperience: caregiver.yearsOfExperience,
      isVerified: caregiver.verificationStatus === "VERIFIED",
      verificationStatus: caregiver.verificationStatus,
      isOnline: caregiver.isOnline,
      completedBookings: caregiver.completedBookings,
      avatarUrl: caregiver.user.avatarUrl,
      isFavorited,
      reviews: caregiver.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        customerName: r.customer.user.name,
        createdAt: r.createdAt,
      })),
      availability: Object.fromEntries(
        caregiver.availability.map((a) => [
          a.dayOfWeek,
          { start: a.startTime, end: a.endTime, isAvailable: true },
        ]),
      ),
    });
  } catch (err) {
    next(err);
  }
});

// PUT /caregiver/profile
router.put(
  "/profile",
  authenticate,
  requireRole("CAREGIVER"),
  body("name").optional().trim().isLength({ min: 2, max: 100 }),
  body("hourlyRate")
    .optional()
    .isFloat({ min: 250, max: 2000 })
    .withMessage("Hourly rate must be ₹250–₹2000"),
  body("bio").optional().isLength({ max: 1000 }),
  body("yearsOfExperience").optional().isInt({ min: 0, max: 50 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const {
        name,
        bio,
        serviceTypes,
        hourlyRate,
        languages,
        certifications,
        yearsOfExperience,
      } = req.body;
      const profileData = {};
      if (bio !== undefined) profileData.bio = bio;
      if (serviceTypes) profileData.serviceTypes = serviceTypes;
      if (hourlyRate) profileData.hourlyRate = parseFloat(hourlyRate);
      if (languages) profileData.languages = languages;
      if (certifications) profileData.certifications = certifications;
      if (yearsOfExperience !== undefined)
        profileData.yearsOfExperience = parseInt(yearsOfExperience);

      if (name)
        await prisma.user.update({
          where: { id: req.user.id },
          data: { name },
        });

      const profile = await prisma.caregiverProfile.update({
        where: { userId: req.user.id },
        data: profileData,
      });
      res.json({ ...profile, name, updatedAt: profile.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /caregiver/availability
router.put(
  "/availability",
  authenticate,
  requireRole("CAREGIVER"),
  async (req, res, next) => {
    try {
      const { availability } = req.body;
      if (!Array.isArray(availability))
        return res.status(400).json({ error: "availability must be an array" });

      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const ops = availability.map((slot) =>
        prisma.caregiverAvailability.upsert({
          where: {
            caregiverId_dayOfWeek: {
              caregiverId: profile.id,
              dayOfWeek: slot.dayOfWeek,
            },
          },
          create: {
            caregiverId: profile.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          update: { startTime: slot.startTime, endTime: slot.endTime },
        }),
      );
      const updated = await prisma.$transaction(ops);
      res.json({ availability: updated, updatedAt: new Date() });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /caregiver/online-status
router.put(
  "/online-status",
  authenticate,
  requireRole("CAREGIVER"),
  body("isOnline").isBoolean(),
  async (req, res, next) => {
    try {
      const { isOnline } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      if (isOnline && profile.verificationStatus !== "VERIFIED") {
        return res.status(403).json({
          error: "Only verified caregivers can go online. Your profile is under review.",
          code: "NOT_VERIFIED",
          verificationStatus: profile.verificationStatus,
        });
      }
      await prisma.caregiverProfile.update({
        where: { userId: req.user.id },
        data: { isOnline: Boolean(isOnline) },
      });
      res.json({ isOnline: Boolean(isOnline), updatedAt: new Date() });
    } catch (err) {
      next(err);
    }
  },
);

// POST /caregiver/documents/upload-url  — get pre-signed S3 URL
router.post(
  "/documents/upload-url",
  authenticate,
  requireRole("CAREGIVER"),
  body("documentType").isIn([
    "AADHAAR",
    "PAN_CARD",
    "POLICE_CHECK",
    "CERTIFICATION",
    "PHOTO_ID",
    "LIVE_SELFIE",
  ]),
  body("mimeType").isIn([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
  body("fileSize")
    .isInt({ min: 1, max: 10485760 })
    .withMessage("File must be under 10MB"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { documentType, mimeType, fileSize } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { uploadUrl, key, s3Url } = await s3Service.getPresignedUploadUrl(
        profile.id,
        documentType,
        mimeType,
        fileSize,
      );

      res.json({ uploadUrl, key, s3Url, expiresIn: 3600 });
    } catch (err) {
      next(err);
    }
  },
);

// POST /caregiver/documents  — confirm upload and create DB record
router.post(
  "/documents",
  authenticate,
  requireRole("CAREGIVER"),
  body("documentType").isIn([
    "AADHAAR",
    "PAN_CARD",
    "POLICE_CHECK",
    "CERTIFICATION",
    "PHOTO_ID",
    "LIVE_SELFIE",
  ]),
  body("s3Key").notEmpty(),
  body("fileName").notEmpty(),
  body("fileSize").optional().isInt(),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { documentType, s3Key, fileName, fileSize } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });

      // Move to UNDER_REVIEW when first document uploaded
      if (profile.verificationStatus === "PENDING") {
        await prisma.caregiverProfile.update({
          where: { id: profile.id },
          data: { verificationStatus: "UNDER_REVIEW" },
        });
      }

      const doc = await prisma.caregiverDocument.create({
        data: {
          caregiverId: profile.id,
          documentType,
          s3Url: s3Key,
          fileName,
          fileSize: fileSize || null,
        },
      });

      res.status(201).json({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        s3Url: doc.s3Url,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /caregiver/documents — list own documents with view URLs
router.get(
  "/documents",
  authenticate,
  requireRole("CAREGIVER"),
  async (req, res, next) => {
    try {
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const docs = await prisma.caregiverDocument.findMany({
        where: { caregiverId: profile.id },
        orderBy: { uploadedAt: "desc" },
      });

      // Generate signed view URLs
      const docsWithUrls = await Promise.all(
        docs.map(async (d) => {
          let viewUrl = null;
          try {
            viewUrl = await s3Service.getSignedViewUrl(d.s3Url);
          } catch {}
          return { ...d, viewUrl };
        }),
      );
      res.json(docsWithUrls);
    } catch (err) {
      next(err);
    }
  },
);

// GET /caregiver/earnings
router.get(
  "/earnings",
  authenticate,
  requireRole("CAREGIVER"),
  async (req, res, next) => {
    try {
      const {
        period = "month",
        startDate: customStart,
        endDate: customEnd,
      } = req.query;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      let periodStart = new Date();
      if (period === "day") periodStart.setDate(periodStart.getDate() - 1);
      else if (period === "week")
        periodStart.setDate(periodStart.getDate() - 7);
      else if (period === "month")
        periodStart.setMonth(periodStart.getMonth() - 1);
      else if (period === "year")
        periodStart.setFullYear(periodStart.getFullYear() - 1);
      else if (period === "custom" && customStart)
        periodStart = new Date(customStart);

      const periodEnd =
        period === "custom" && customEnd ? new Date(customEnd) : new Date();

      const bookings = await prisma.booking.findMany({
        where: {
          caregiverId: profile.id,
          status: "COMPLETED",
          bookingDate: { gte: periodStart, lte: periodEnd },
        },
        include: {
          payment: true,
          customer: { include: { user: { select: { name: true } } } },
        },
        orderBy: { bookingDate: "desc" },
      });

      const payouts = await prisma.payout.findMany({
        where: { caregiverId: profile.id },
        orderBy: { requestedAt: "desc" },
        take: 20,
      });
      const totalPaidOut = payouts
        .filter((p) => p.status === "COMPLETED")
        .reduce((s, p) => s + parseFloat(p.amount), 0);

      const totalEarned = bookings.reduce(
        (s, b) => s + parseFloat(b.totalAmount),
        0,
      );
      const totalPending = bookings
        .filter((b) => b.payment?.status === "HELD")
        .reduce((s, b) => s + parseFloat(b.totalAmount), 0);
      const totalReleased = bookings
        .filter((b) => b.payment?.status === "RELEASED")
        .reduce((s, b) => s + parseFloat(b.totalAmount), 0);
      const balance = parseFloat(profile.totalEarnings) - totalPaidOut;

      res.json({
        balance: Math.max(0, balance),
        totalEarned,
        totalPending,
        totalReleased,
        thisMonth: totalEarned,
        lastMonth: 0, // fetching separately would add complexity; approximate
        total: parseFloat(profile.totalEarnings),
        breakdown: bookings.map((b) => ({
          bookingId: b.id,
          date: b.bookingDate,
          customerName: b.customer.user.name,
          serviceType: b.serviceType,
          hours: parseFloat(b.duration),
          hourlyRate: parseFloat(b.totalAmount) / parseFloat(b.duration),
          amount: parseFloat(b.totalAmount),
          status: b.payment?.status,
        })),
        periodSummary: {
          totalHours: bookings.reduce((s, b) => s + parseFloat(b.duration), 0),
          totalBookings: bookings.length,
          averageRating: profile.averageRating,
        },
        payouts,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /caregiver/payout-request
router.post(
  "/payout-request",
  authenticate,
  requireRole("CAREGIVER"),
  body("amount").isFloat({ min: 500 }).withMessage("Minimum payout is ₹500"),
  body("bankAccount").notEmpty().withMessage("Bank account required"),
  body("bankCode").notEmpty().withMessage("Bank IFSC code required"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { amount, bankAccount, bankCode } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await prisma.payout.findFirst({
        where: { caregiverId: profile.id, requestedAt: { gte: today } },
      });
      if (existing)
        return res
          .status(400)
          .json({
            error: "Only one payout request per day",
            code: "PAYOUT_LIMIT",
          });

      const payout = await prisma.payout.create({
        data: { caregiverId: profile.id, amount, bankAccount, bankCode },
      });

      res.status(201).json({
        payoutId: payout.id,
        amount: payout.amount,
        status: payout.status,
        requestedAt: payout.requestedAt,
        expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
