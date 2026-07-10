const express = require("express");
const { body, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const { v4: uuidv4 } = require("uuid");
const { authenticate, requireRole } = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const s3Service = require("../services/s3Service");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errors.array()[0].msg;
  return null;
};

const generateBookingNumber = () => {
  const year = new Date().getFullYear();
  const seq = String(Date.now()).slice(-7);
  return `BK-${year}-${seq}`;
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// POST /bookings
router.post(
  "/",
  authenticate,
  requireRole("CUSTOMER"),
  body("caregiverId").notEmpty().withMessage("caregiverId required"),
  body("elderId").notEmpty().withMessage("elderId required"),
  body("date")
    .isISO8601()
    .withMessage("Invalid date (YYYY-MM-DD)")
    .custom((v) => {
      if (new Date(v) < new Date(new Date().toDateString()))
        throw new Error("Booking date must be today or future");
      return true;
    }),
  body("startTime")
    .matches(/^\d{2}:\d{2}$/)
    .withMessage("startTime must be HH:MM"),
  body("duration")
    .isInt({ min: 1, max: 12 })
    .withMessage("Duration must be 1-12 hours"),
  body("serviceType").notEmpty(),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const {
        caregiverId,
        elderId,
        date,
        startTime,
        duration,
        serviceType,
        specialNotes,
      } = req.body;

      const caregiver = await prisma.caregiverProfile.findUnique({
        where: { id: caregiverId },
        include: { user: { select: { name: true, id: true } } },
      });
      if (!caregiver || caregiver.verificationStatus !== "VERIFIED") {
        return res
          .status(400)
          .json({
            error: "Caregiver not available",
            code: "CAREGIVER_UNAVAILABLE",
          });
      }

      // Lead time: cannot book within 1 hour
      const bookingDateTime = new Date(`${date}T${startTime}`);
      if (bookingDateTime - Date.now() < 60 * 60 * 1000) {
        return res
          .status(400)
          .json({
            error: "Bookings must be made at least 1 hour in advance",
            code: "LEAD_TIME_VIOLATION",
          });
      }

      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!customer)
        return res.status(404).json({ error: "Customer profile not found" });

      const elder = await prisma.elderProfile.findFirst({
        where: { id: elderId, customerId: customer.id, isActive: true },
      });
      if (!elder)
        return res
          .status(404)
          .json({
            error: "Elder not found or does not belong to you",
            code: "ELDER_NOT_FOUND",
          });

      // Calculate end time
      const [sh, sm] = startTime.split(":").map(Number);
      const endMinutes = sh * 60 + sm + parseInt(duration) * 60;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      // Check overlapping bookings
      const overlapping = await prisma.booking.findFirst({
        where: {
          caregiverId,
          bookingDate: new Date(date),
          status: { notIn: ["CANCELLED"] },
          OR: [
            {
              AND: [
                { startTime: { lte: startTime } },
                { endTime: { gt: startTime } },
              ],
            },
            {
              AND: [
                { startTime: { lt: endTime } },
                { endTime: { gte: endTime } },
              ],
            },
            {
              AND: [
                { startTime: { gte: startTime } },
                { endTime: { lte: endTime } },
              ],
            },
          ],
        },
      });
      if (overlapping) {
        return res
          .status(409)
          .json({
            error: "Caregiver already booked at this time",
            code: "TIME_CONFLICT",
          });
      }

      // Check subscription booking limit
      if (customer.subscriptionPlan === "FREE") {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthCount = await prisma.booking.count({
          where: {
            customerId: customer.id,
            createdAt: { gte: thisMonth },
            status: { not: "CANCELLED" },
          },
        });
        if (monthCount >= 2)
          return res
            .status(403)
            .json({
              error:
                "Free plan allows max 2 bookings/month. Upgrade to continue.",
              code: "SUBSCRIPTION_LIMIT",
            });
      }
      if (customer.subscriptionPlan === "FAMILY_BASIC") {
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const monthCount = await prisma.booking.count({
          where: {
            customerId: customer.id,
            createdAt: { gte: thisMonth },
            status: { not: "CANCELLED" },
          },
        });
        if (monthCount >= 10)
          return res
            .status(403)
            .json({
              error: "Family Basic plan allows max 10 bookings/month.",
              code: "SUBSCRIPTION_LIMIT",
            });
      }

      // Apply subscription discount
      let discountRate = 0;
      if (customer.subscriptionPlan === "FAMILY_BASIC") discountRate = 0.05;
      else if (
        ["FAMILY_PREMIUM", "ENTERPRISE"].includes(customer.subscriptionPlan)
      )
        discountRate = 0.1;
      const baseAmount = parseFloat(caregiver.hourlyRate) * parseInt(duration);
      const totalAmount = parseFloat(
        (baseAmount * (1 - discountRate)).toFixed(2),
      );

      const booking = await prisma.booking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          customerId: customer.id,
          caregiverId,
          elderId,
          bookingDate: new Date(date),
          startTime,
          endTime,
          duration: parseInt(duration),
          serviceType,
          totalAmount,
          specialNotes,
        },
        include: {
          customer: { include: { user: { select: { name: true } } } },
          caregiver: { include: { user: { select: { name: true } } } },
          elder: true,
        },
      });

      await notificationService.sendToUser(caregiver.user.id, {
        type: "NEW_BOOKING_REQUEST",
        title: "New Booking Request",
        message: `${req.user.name} needs care on ${date} at ${startTime}`,
        data: { bookingId: booking.id },
      });

      res.status(201).json({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        customer: { id: customer.id, name: booking.customer.user.name },
        caregiver: {
          id: caregiverId,
          name: booking.caregiver.user.name,
          hourlyRate: caregiver.hourlyRate,
        },
        elder: { id: elderId, name: elder.name },
        date,
        startTime,
        endTime,
        duration: parseInt(duration),
        totalAmount,
        serviceType,
        specialNotes,
        createdAt: booking.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /bookings/customer
router.get(
  "/customer",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (!customer)
        return res.status(404).json({ error: "Profile not found" });

      const where = { customerId: customer.id };
      if (status) where.status = { in: status.split(",") };

      const [total, bookings] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
          include: {
            caregiver: {
              include: {
                user: { select: { name: true, phone: true, avatarUrl: true } },
              },
            },
            elder: true,
            payment: true,
          },
        }),
      ]);

      res.json({
        bookings: bookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          status: b.status,
          caregiver: {
            id: b.caregiverId,
            name: b.caregiver.user.name,
            phone: b.caregiver.user.phone,
            rating: b.caregiver.averageRating,
          },
          elder: { id: b.elderId, name: b.elder.name },
          scheduledAt: new Date(
            `${b.bookingDate.toISOString().split("T")[0]}T${b.startTime}`,
          ),
          durationHours: parseFloat(b.duration),
          totalAmount: parseFloat(b.totalAmount),
          paymentStatus: b.payment?.status,
          createdAt: b.createdAt,
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
  },
);

// GET /bookings/caregiver
router.get(
  "/caregiver",
  authenticate,
  requireRole("CAREGIVER"),
  async (req, res, next) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const where = { caregiverId: profile.id };
      if (status) where.status = { in: status.split(",") };

      const [total, bookings] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where,
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
          include: {
            customer: {
              include: { user: { select: { name: true, phone: true } } },
            },
            elder: true,
            payment: true,
          },
        }),
      ]);

      const SHOW_CONTACT_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];
      res.json({
        bookings: bookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          status: b.status,
          customer: {
            id: b.customerId,
            name: b.customer.user.name,
            // Phone only revealed after caregiver accepts booking
            phone: SHOW_CONTACT_STATUSES.includes(b.status) ? b.customer.user.phone : null,
          },
          elder: { id: b.elderId, name: b.elder.name },
          scheduledAt: new Date(
            `${b.bookingDate.toISOString().split("T")[0]}T${b.startTime}`,
          ),
          durationHours: parseFloat(b.duration),
          totalAmount: parseFloat(b.totalAmount),
          serviceType: b.serviceType,
          specialNotes: b.specialNotes,
          paymentStatus: b.payment?.status,
          createdAt: b.createdAt,
        })),
        pagination: { page: parseInt(page), limit: parseInt(limit), total },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /bookings/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          include: { user: { select: { name: true, phone: true } } },
        },
        caregiver: {
          include: { user: { select: { name: true, phone: true } } },
        },
        elder: true,
        payment: true,
        review: true,
        gpsLogs: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    });
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { id: booking?.customerId },
      select: { latitude: true, longitude: true, address: true },
    });
    if (!booking)
      return res
        .status(404)
        .json({ error: "Booking not found", code: "NOT_FOUND" });

    // Access control
    const isCustomer = req.user.role === "CUSTOMER";
    const isCaregiver = req.user.role === "CAREGIVER";
    if (isCustomer) {
      const cp = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (booking.customerId !== cp?.id)
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }
    if (isCaregiver) {
      const cg = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (booking.caregiverId !== cg?.id)
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    }

    // Restrict sensitive data from caregiver until booking is accepted (CONFIRMED+)
    const SHOW_FULL_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED", "DISPUTED"];
    const caregiverCanSeeContact = !isCaregiver || SHOW_FULL_STATUSES.includes(booking.status);
    const elderData = (isCaregiver && !SHOW_FULL_STATUSES.includes(booking.status))
      ? { id: booking.elder.id, name: booking.elder.name, age: booking.elder.age, gender: booking.elder.gender }
      : booking.elder;

    res.json({
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      customer: {
        id: booking.customerId,
        name: booking.customer.user.name,
        phone: caregiverCanSeeContact ? booking.customer.user.phone : null,
      },
      caregiver: {
        id: booking.caregiverId,
        name: booking.caregiver.user.name,
        phone: booking.caregiver.user.phone,
        hourlyRate: booking.caregiver.hourlyRate,
        rating: booking.caregiver.averageRating,
      },
      elder: elderData,
      scheduledAt: new Date(
        `${booking.bookingDate.toISOString().split("T")[0]}T${booking.startTime}`,
      ),
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationHours: parseFloat(booking.duration),
      totalAmount: parseFloat(booking.totalAmount),
      serviceType: booking.serviceType,
      specialNotes: booking.specialNotes,
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      actualDuration: booking.actualDuration
        ? parseFloat(booking.actualDuration)
        : null,
      payment: booking.payment,
      review: booking.review,
      lastLocation: booking.gpsLogs[0] || null,
      // Customer home location only shown to caregiver once booking is confirmed
      customerLocation: caregiverCanSeeContact && customerProfile?.latitude ? {
        latitude: parseFloat(customerProfile.latitude),
        longitude: parseFloat(customerProfile.longitude),
        address: customerProfile.address,
      } : null,
      createdAt: booking.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/confirm
router.put(
  "/:id/confirm",
  authenticate,
  requireRole("CAREGIVER"),
  body("action")
    .isIn(["accept", "decline"])
    .withMessage("action must be accept or decline"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { action, declineReason } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { customer: { include: { user: true } } },
      });

      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.caregiverId !== profile.id)
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      if (booking.status !== "PENDING")
        return res
          .status(400)
          .json({
            error: "Booking is not in PENDING state",
            code: "INVALID_STATUS",
          });

      const newStatus = action === "accept" ? "CONFIRMED" : "CANCELLED";
      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: newStatus,
          ...(action === "decline"
            ? { cancellationNote: declineReason, cancelledBy: req.user.id }
            : {}),
        },
      });

      await notificationService.sendToUser(booking.customer.userId, {
        type: action === "accept" ? "BOOKING_CONFIRMED" : "BOOKING_DECLINED",
        title: action === "accept" ? "Booking Confirmed" : "Booking Declined",
        message:
          action === "accept"
            ? "Your caregiver has accepted the booking"
            : `Booking declined${declineReason ? ": " + declineReason : ""}`,
        data: { bookingId: booking.id },
      });

      res.json({
        id: booking.id,
        status: newStatus,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /bookings/:id/reschedule  — customer can reschedule PENDING or CONFIRMED bookings
router.put(
  "/:id/reschedule",
  authenticate,
  requireRole("CUSTOMER"),
  body("date").isISO8601().withMessage("Invalid date"),
  body("startTime").matches(/^\d{2}:\d{2}$/).withMessage("startTime must be HH:MM"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { date, startTime } = req.body;
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { caregiver: { include: { user: true } }, customer: { include: { user: true } } },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
        return res.status(400).json({ error: "Only PENDING or CONFIRMED bookings can be rescheduled", code: "INVALID_STATUS" });
      }

      const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      if (booking.customerId !== customer?.id) return res.status(403).json({ error: "Forbidden" });

      const newDateTime = new Date(`${date}T${startTime}`);
      if (newDateTime - Date.now() < 60 * 60 * 1000) {
        return res.status(400).json({ error: "Reschedule must be at least 1 hour in advance", code: "LEAD_TIME_VIOLATION" });
      }

      const [sh, sm] = startTime.split(":").map(Number);
      const endMinutes = sh * 60 + sm + booking.duration * 60;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { bookingDate: new Date(date), startTime, endTime },
      });

      await notificationService.sendToUser(booking.caregiver.userId, {
        type: "BOOKING_RESCHEDULED",
        title: "Booking Rescheduled",
        message: `Booking ${booking.bookingNumber} has been rescheduled to ${date} at ${startTime}`,
        data: { bookingId: booking.id },
      });

      res.json({ id: booking.id, bookingDate: updated.bookingDate, startTime, endTime, updatedAt: updated.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /bookings/:id/cancel
router.put("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        payment: true,
        customer: { include: { user: true } },
        caregiver: { include: { user: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
      return res
        .status(400)
        .json({
          error: "Cannot cancel a completed or already-cancelled booking",
          code: "INVALID_STATUS",
        });
    }

    const bookingDT = new Date(
      `${booking.bookingDate.toISOString().split("T")[0]}T${booking.startTime}`,
    );
    const hoursUntil = (bookingDT - Date.now()) / 3600000;
    let refundPercent = 0;
    if (hoursUntil > 24) refundPercent = 100;
    else if (hoursUntil > 1) refundPercent = 50;
    const refundAmount = parseFloat(
      ((parseFloat(booking.totalAmount) * refundPercent) / 100).toFixed(2),
    );

    const ops = [
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledBy: req.user.id,
          cancellationNote: reason,
        },
      }),
    ];
    if (refundAmount > 0 && booking.payment) {
      ops.push(
        prisma.payment.update({
          where: { bookingId: booking.id },
          data: { status: "REFUNDED", refundAmount },
        }),
      );
    }
    const [updated] = await prisma.$transaction(ops);

    // Notify other party
    const isCustomer = req.user.role === "CUSTOMER";
    const notifyUserId = isCustomer
      ? booking.caregiver.userId
      : booking.customer.userId;
    await notificationService.sendToUser(notifyUserId, {
      type: "BOOKING_CANCELLED",
      title: "Booking Cancelled",
      message: `Booking ${booking.bookingNumber} has been cancelled${reason ? ": " + reason : ""}`,
      data: { bookingId: booking.id },
    });

    res.json({
      id: booking.id,
      status: "CANCELLED",
      cancellationReason: reason,
      refundAmount,
      refundStatus: refundAmount > 0 ? "INITIATED" : "NONE",
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /bookings/:id/check-in
router.post(
  "/:id/check-in",
  authenticate,
  requireRole("CAREGIVER"),
  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { latitude, longitude } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { customer: { include: { user: true } } },
      });

      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.caregiverId !== profile.id)
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      if (booking.status !== "CONFIRMED")
        return res
          .status(400)
          .json({
            error: "Booking must be CONFIRMED to check in",
            code: "INVALID_STATUS",
          });

      // Enforce check-in not before booking start time
      const scheduledStart = new Date(
        `${booking.bookingDate.toISOString().split("T")[0]}T${booking.startTime}`,
      );
      const now = new Date();
      if (now < new Date(scheduledStart.getTime() - 3 * 60 * 60 * 1000)) {
        return res
          .status(400)
          .json({
            error:
              "Check-in not allowed more than 3 hours before booking start",
            code: "TOO_EARLY",
          });
      }

      // Geofence: caregiver must be within 500m of customer's saved location
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { id: booking.customerId },
      });
      if (customerProfile?.latitude && customerProfile?.longitude) {
        const distanceMeters = haversineDistance(
          parseFloat(latitude), parseFloat(longitude),
          parseFloat(customerProfile.latitude), parseFloat(customerProfile.longitude),
        );
        if (distanceMeters > 500) {
          return res.status(400).json({
            error: `You are ${Math.round(distanceMeters)}m from the customer's location. You must be within 500m to check in.`,
            code: "OUT_OF_RANGE",
            distanceMeters: Math.round(distanceMeters),
            allowedMeters: 500,
          });
        }
      }

      const [updated] = await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "ACTIVE", checkInTime: now },
        }),
        prisma.gpsLog.create({
          data: { bookingId: booking.id, latitude, longitude },
        }),
      ]);

      await notificationService.sendToUser(booking.customer.userId, {
        type: "CAREGIVER_CHECKED_IN",
        title: "Caregiver Arrived",
        message: `Your caregiver has checked in for booking ${booking.bookingNumber}`,
        data: {
          bookingId: booking.id,
          latitude: String(latitude),
          longitude: String(longitude),
        },
      });

      res.json({
        id: booking.id,
        status: "ACTIVE",
        checkInTime: now,
        gpsTracking: { enabled: true, updateFrequency: 30 },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bookings/:id/check-out
router.post(
  "/:id/check-out",
  authenticate,
  requireRole("CAREGIVER"),
  body("latitude").isFloat({ min: -90, max: 90 }),
  body("longitude").isFloat({ min: -180, max: 180 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { latitude, longitude } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { payment: true, customer: { include: { user: true } } },
      });

      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.caregiverId !== profile.id)
        return res.status(403).json({ error: "Forbidden" });
      if (booking.status !== "ACTIVE")
        return res
          .status(400)
          .json({
            error: "Booking must be ACTIVE to check out",
            code: "INVALID_STATUS",
          });

      // Minimum 15 minutes
      const minCheckout = new Date(
        booking.checkInTime.getTime() + 15 * 60 * 1000,
      );
      if (new Date() < minCheckout) {
        return res
          .status(400)
          .json({
            error: "Minimum session duration is 15 minutes",
            code: "SESSION_TOO_SHORT",
          });
      }

      const checkOutTime = new Date();
      const actualDuration = (checkOutTime - booking.checkInTime) / 3600000;

      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED", checkOutTime, actualDuration },
        }),
        prisma.payment.updateMany({
          where: { bookingId: booking.id },
          data: { status: "RELEASED" },
        }),
        prisma.caregiverProfile.update({
          where: { id: booking.caregiverId },
          data: {
            totalEarnings: { increment: parseFloat(booking.totalAmount) },
            totalHoursWorked: { increment: actualDuration },
            completedBookings: { increment: 1 },
          },
        }),
        prisma.gpsLog.create({
          data: { bookingId: booking.id, latitude, longitude },
        }),
      ]);

      await notificationService.sendToUser(booking.customer.userId, {
        type: "CAREGIVER_CHECKED_OUT",
        title: "Session Completed",
        message: `Booking ${booking.bookingNumber} is complete. Please review your caregiver!`,
        data: { bookingId: booking.id },
      });

      res.json({
        id: booking.id,
        status: "COMPLETED",
        checkOutTime,
        actualDuration: parseFloat(actualDuration.toFixed(2)),
        payment: {
          status: "RELEASED",
          amount: parseFloat(booking.totalAmount),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bookings/:id/gps-update  — periodic GPS updates during active booking
router.post(
  "/:id/gps-update",
  authenticate,
  requireRole("CAREGIVER"),
  body("latitude").isFloat({ min: -90, max: 90 }),
  body("longitude").isFloat({ min: -180, max: 180 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { latitude, longitude } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({
        where: { userId: req.user.id },
      });
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, caregiverId: profile.id, status: "ACTIVE" },
      });
      if (!booking)
        return res.status(404).json({ error: "Active booking not found" });

      await prisma.gpsLog.create({
        data: { bookingId: booking.id, latitude, longitude },
      });
      res.json({ logged: true, timestamp: new Date() });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bookings/:id/review
router.post(
  "/:id/review",
  authenticate,
  requireRole("CUSTOMER"),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be 1-5"),
  body("text")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Review text max 500 characters"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { rating, text } = req.body;
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { payment: true, caregiver: { include: { user: true } } },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.status !== "COMPLETED")
        return res
          .status(400)
          .json({
            error: "Booking must be completed",
            code: "BOOKING_INCOMPLETE",
          });
      if (booking.payment?.status !== "RELEASED")
        return res
          .status(400)
          .json({
            error: "Payment must be released before reviewing",
            code: "PAYMENT_NOT_RELEASED",
          });

      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (booking.customerId !== customer.id)
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });

      const existing = await prisma.review.findUnique({
        where: { bookingId: booking.id },
      });
      if (existing)
        return res
          .status(409)
          .json({ error: "Review already submitted", code: "REVIEW_EXISTS" });

      const review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          caregiverId: booking.caregiverId,
          rating,
          text,
        },
      });

      const { _avg, _count } = await prisma.review.aggregate({
        where: { caregiverId: booking.caregiverId },
        _avg: { rating: true },
        _count: true,
      });
      await prisma.caregiverProfile.update({
        where: { id: booking.caregiverId },
        data: {
          averageRating: parseFloat(_avg.rating?.toFixed(2)),
          totalReviews: _count,
        },
      });

      await notificationService.sendToUser(booking.caregiver.userId, {
        type: "NEW_REVIEW",
        title: "New Review Received",
        message: `You received a ${rating}-star review`,
        data: { bookingId: booking.id, rating: String(rating) },
      });

      res
        .status(201)
        .json({
          id: review.id,
          bookingId: booking.id,
          rating,
          text,
          createdAt: review.createdAt,
        });
    } catch (err) {
      next(err);
    }
  },
);

// POST /bookings/:id/sos
const SOS_MAX_PER_BOOKING = 3;
router.post(
  "/:id/sos",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          caregiver: { include: { user: true } },
          customer: { include: { user: true } },
        },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.status !== "ACTIVE")
        return res
          .status(400)
          .json({
            error: "SOS only available during active bookings",
            code: "BOOKING_NOT_ACTIVE",
          });

      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      if (booking.customerId !== customer.id)
        return res.status(403).json({ error: "Forbidden" });

      // Check SOS limit: count existing SOS reports for this booking
      const sosCount = await prisma.report.count({
        where: { bookingId: booking.id, reportType: "EMERGENCY_INCIDENT" },
      });
      if (sosCount >= SOS_MAX_PER_BOOKING) {
        return res
          .status(400)
          .json({
            error: `Maximum ${SOS_MAX_PER_BOOKING} SOS alerts per booking`,
            code: "SOS_LIMIT_EXCEEDED",
          });
      }

      // Log as emergency report
      const report = await prisma.report.create({
        data: {
          bookingId: booking.id,
          reportType: "EMERGENCY_INCIDENT",
          reportedById: req.user.id,
          reportedAgainstId: booking.caregiver.userId,
          description: `SOS Alert triggered by customer during booking ${booking.bookingNumber}`,
        },
      });

      await notificationService.sendToUser(booking.caregiver.userId, {
        type: "SOS_ALERT",
        title: "🚨 EMERGENCY SOS ALERT",
        message: `Emergency alert from ${req.user.name}! Please respond immediately.`,
        data: { bookingId: booking.id, alertId: report.id },
      });

      res.json({
        message: "SOS alert sent",
        alertId: report.id,
        alertNumber: sosCount + 1,
        maxAlerts: SOS_MAX_PER_BOOKING,
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /bookings/:id/gps-history
router.get("/:id/gps-history", authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const logs = await prisma.gpsLog.findMany({
      where: { bookingId: req.params.id },
      orderBy: { timestamp: "asc" },
    });
    res.json({ bookingId: req.params.id, locations: logs });
  } catch (err) {
    next(err);
  }
});

// ─── Session Photos ────────────────────────────────────────────────────────────

// POST /bookings/:id/photos/upload-url
// Caregiver requests a presigned S3 URL to upload a session photo
router.post("/:id/photos/upload-url", authenticate, requireRole("CAREGIVER"), async (req, res, next) => {
  try {
    const { mimeType = "image/jpeg", fileSize = 3000000 } = req.body;
    const profile = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, caregiverId: profile?.id, status: "ACTIVE" },
    });
    if (!booking) return res.status(404).json({ error: "Active booking not found" });

    const photoCount = await prisma.sessionPhoto.count({ where: { bookingId: booking.id } });
    if (photoCount >= 20) return res.status(400).json({ error: "Maximum 20 photos per booking", code: "PHOTO_LIMIT_EXCEEDED" });

    const { mimeType: mt = "image/jpeg" } = req.body;
    const ext = mt === "image/png" ? "png" : mt === "image/webp" ? "webp" : "jpg";
    const key = `session-photos/${booking.id}/${uuidv4()}.${ext}`;
    const uploadUrl = await s3Service.getPresignedPutUrl(key, mimeType, fileSize);
    res.json({ uploadUrl, key });
  } catch (err) {
    next(err);
  }
});

// POST /bookings/:id/photos/confirm
// Caregiver confirms S3 upload and saves photo record
router.post("/:id/photos/confirm", authenticate, requireRole("CAREGIVER"),
  body("key").notEmpty().withMessage("key required"),
  body("caption").optional().isLength({ max: 200 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { key, caption } = req.body;
      const profile = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
      const booking = await prisma.booking.findFirst({
        where: { id: req.params.id, caregiverId: profile?.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const photo = await prisma.sessionPhoto.create({
        data: { bookingId: booking.id, s3Key: key, caption: caption || null },
      });
      res.status(201).json({ id: photo.id, createdAt: photo.createdAt });
    } catch (err) {
      next(err);
    }
  }
);

// GET /bookings/:id/photos
// Both customer and caregiver can view session photos
router.get("/:id/photos", authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const isCustomer = req.user.role === "CUSTOMER";
    const isCaregiver = req.user.role === "CAREGIVER";
    if (isCustomer) {
      const cp = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      if (booking.customerId !== cp?.id) return res.status(403).json({ error: "Forbidden" });
    }
    if (isCaregiver) {
      const cg = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
      if (booking.caregiverId !== cg?.id) return res.status(403).json({ error: "Forbidden" });
    }

    const photos = await prisma.sessionPhoto.findMany({
      where: { bookingId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        viewUrl: await s3Service.getSignedViewUrl(p.s3Key),
        caption: p.caption,
        createdAt: p.createdAt,
      }))
    );
    res.json({ photos: photosWithUrls });
  } catch (err) {
    next(err);
  }
});

// ─── In-App Messaging ─────────────────────────────────────────────────────────

// GET /bookings/:id/messages
router.get("/:id/messages", authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const isCustomer = req.user.role === "CUSTOMER";
    const isCaregiver = req.user.role === "CAREGIVER";
    if (isCustomer) {
      const cp = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      if (booking.customerId !== cp?.id) return res.status(403).json({ error: "Forbidden" });
    }
    if (isCaregiver) {
      const cg = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
      if (booking.caregiverId !== cg?.id) return res.status(403).json({ error: "Forbidden" });
    }

    const messages = await prisma.message.findMany({
      where: { bookingId: req.params.id },
      include: { sender: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        text: m.text,
        senderRole: m.senderRole,
        senderName: m.sender.name,
        senderId: m.senderId,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /bookings/:id/messages
router.post("/:id/messages", authenticate,
  body("text").trim().notEmpty().withMessage("Message text required").isLength({ max: 500 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          caregiver: { include: { user: true } },
          customer: { include: { user: true } },
        },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (!["CONFIRMED", "ACTIVE", "COMPLETED"].includes(booking.status)) {
        return res.status(400).json({ error: "Messaging only available for confirmed bookings" });
      }

      const senderRole = req.user.role;
      if (senderRole === "CUSTOMER") {
        const cp = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
        if (booking.customerId !== cp?.id) return res.status(403).json({ error: "Forbidden" });
      } else if (senderRole === "CAREGIVER") {
        const cg = await prisma.caregiverProfile.findUnique({ where: { userId: req.user.id } });
        if (booking.caregiverId !== cg?.id) return res.status(403).json({ error: "Forbidden" });
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      const message = await prisma.message.create({
        data: { bookingId: booking.id, senderId: req.user.id, senderRole, text: req.body.text },
      });

      const notifyUserId = senderRole === "CUSTOMER" ? booking.caregiver.userId : booking.customer.userId;
      await notificationService.sendToUser(notifyUserId, {
        type: "NEW_MESSAGE",
        title: `Message from ${req.user.name}`,
        message: req.body.text.slice(0, 80),
        data: { bookingId: booking.id },
      });

      res.status(201).json({
        id: message.id,
        text: message.text,
        senderRole,
        senderName: req.user.name,
        senderId: req.user.id,
        createdAt: message.createdAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
