const express = require("express");
const { body, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errors.array()[0].msg;
  return null;
};

// GET /customer/profile
router.get(
  "/profile",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
        include: {
          elders: { where: { isActive: true } },
          subscriptions: { where: { status: "ACTIVE" }, take: 1 },
        },
      });
      const profileJson = profile ? {
        ...profile,
        latitude: profile.latitude ? parseFloat(profile.latitude) : null,
        longitude: profile.longitude ? parseFloat(profile.longitude) : null,
      } : null;
      res.json({ ...req.user, profile: profileJson });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /customer/profile
router.put(
  "/profile",
  authenticate,
  requireRole("CUSTOMER"),
  body("name").optional().trim().isLength({ min: 2, max: 100 }),
  body("email").optional().isEmail().normalizeEmail(),
  body("city").optional().trim().isLength({ min: 2, max: 50 }),
  body("emergencyContact")
    .optional()
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Invalid emergency contact format"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const {
        name,
        email,
        city,
        address,
        emergencyContact,
        languagePreference,
      } = req.body;
      if (name)
        await prisma.user.update({
          where: { id: req.user.id },
          data: { name },
        });
      if (email)
        await prisma.user.update({
          where: { id: req.user.id },
          data: { email },
        });

      const profileData = {};
      if (city !== undefined) profileData.city = city;
      if (address !== undefined) profileData.address = address;
      if (emergencyContact !== undefined)
        profileData.emergencyContact = emergencyContact;
      if (languagePreference !== undefined)
        profileData.languagePreference = languagePreference;

      const profile = await prisma.customerProfile.update({
        where: { userId: req.user.id },
        data: profileData,
      });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
);

// GET /customer/elders
router.get(
  "/elders",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      const elders = await prisma.elderProfile.findMany({
        where: { customerId: customer.id, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      res.json(elders);
    } catch (err) {
      next(err);
    }
  },
);

// POST /customer/elders
router.post(
  "/elders",
  authenticate,
  requireRole("CUSTOMER"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Elder name required"),
  body("age").optional().isInt({ min: 18, max: 120 }),
  body("relationship").optional().trim().isLength({ min: 1, max: 50 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      const {
        name,
        age,
        gender,
        relationship,
        medicalConditions,
        medications,
        allergies,
        specialNeeds,
      } = req.body;

      const elder = await prisma.elderProfile.create({
        data: {
          customerId: customer.id,
          name,
          age,
          gender,
          relationship,
          medicalConditions: medicalConditions || [],
          medications: medications || [],
          allergies: allergies || [],
          specialNeeds,
        },
      });
      res.status(201).json(elder);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /customer/elders/:id
router.put(
  "/elders/:id",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      const elder = await prisma.elderProfile.findFirst({
        where: { id: req.params.id, customerId: customer.id, isActive: true },
      });
      if (!elder) return res.status(404).json({ error: "Elder not found" });

      const {
        name,
        age,
        gender,
        relationship,
        medicalConditions,
        medications,
        allergies,
        specialNeeds,
      } = req.body;
      const updated = await prisma.elderProfile.update({
        where: { id: elder.id },
        data: {
          name,
          age,
          gender,
          relationship,
          medicalConditions,
          medications,
          allergies,
          specialNeeds,
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /customer/elders/:id
router.delete(
  "/elders/:id",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      const elder = await prisma.elderProfile.findFirst({
        where: { id: req.params.id, customerId: customer.id },
      });
      if (!elder) return res.status(404).json({ error: "Elder not found" });

      await prisma.elderProfile.update({
        where: { id: elder.id },
        data: { isActive: false },
      });
      res.json({ message: "Elder profile removed" });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /customer/location  — save GPS coords for service delivery location
router.put(
  "/location",
  authenticate,
  requireRole("CUSTOMER"),
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  body("address").optional().trim().isLength({ max: 500 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { latitude, longitude, address } = req.body;
      const profile = await prisma.customerProfile.update({
        where: { userId: req.user.id },
        data: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          ...(address !== undefined ? { address } : {}),
        },
      });
      res.json({ latitude: parseFloat(profile.latitude), longitude: parseFloat(profile.longitude), address: profile.address, updatedAt: profile.updatedAt });
    } catch (err) {
      next(err);
    }
  },
);

// POST /customer/reports  — file a report/dispute
router.post(
  "/reports",
  authenticate,
  requireRole("CUSTOMER"),
  body("reportType").isIn([
    "NO_SHOW",
    "QUALITY_COMPLAINT",
    "SAFETY_CONCERN",
    "BILLING_DISPUTE",
    "EMERGENCY_INCIDENT",
    "CUSTOMER_CANCELLATION",
  ]),
  body("description")
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage("Description must be 20-1000 characters"),
  body("reportedAgainstId").notEmpty(),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const {
        reportType,
        description,
        reportedAgainstId,
        bookingId,
        evidence,
      } = req.body;

      const report = await prisma.report.create({
        data: {
          bookingId: bookingId || null,
          reportType,
          reportedById: req.user.id,
          reportedAgainstId,
          description,
          evidence: evidence || null,
        },
      });
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Caregiver Favorites ──────────────────────────────────────────────────────

// GET /customer/favorites
router.get("/favorites", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
    if (!customer) return res.status(404).json({ error: "Profile not found" });

    const favorites = await prisma.customerFavorite.findMany({
      where: { customerId: customer.id },
      include: {
        caregiver: {
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(favorites.map((f) => ({
      id: f.caregiver.id,
      name: f.caregiver.user.name,
      city: f.caregiver.city,
      rating: f.caregiver.averageRating,
      totalReviews: f.caregiver.totalReviews,
      hourlyRate: f.caregiver.hourlyRate,
      serviceTypes: f.caregiver.serviceTypes,
      isOnline: f.caregiver.isOnline,
      avatarUrl: f.caregiver.user.avatarUrl,
      completedBookings: f.caregiver.completedBookings,
    })));
  } catch (err) {
    next(err);
  }
});

// POST /customer/favorites/toggle/:caregiverId
router.post("/favorites/toggle/:caregiverId", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
    if (!customer) return res.status(404).json({ error: "Profile not found" });

    const caregiver = await prisma.caregiverProfile.findUnique({ where: { id: req.params.caregiverId } });
    if (!caregiver) return res.status(404).json({ error: "Caregiver not found" });

    const existing = await prisma.customerFavorite.findUnique({
      where: { customerId_caregiverId: { customerId: customer.id, caregiverId: caregiver.id } },
    });

    if (existing) {
      await prisma.customerFavorite.delete({ where: { id: existing.id } });
      res.json({ isFavorited: false });
    } else {
      await prisma.customerFavorite.create({ data: { customerId: customer.id, caregiverId: caregiver.id } });
      res.json({ isFavorited: true });
    }
  } catch (err) {
    next(err);
  }
});

// ─── Medication Reminders ─────────────────────────────────────────────────────

const VALID_FREQUENCIES = ["DAILY", "TWICE_DAILY", "THREE_TIMES_DAILY", "WEEKLY", "AS_NEEDED"];

// GET /customer/medications
router.get("/medications", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
    if (!customer) return res.status(404).json({ error: "Profile not found" });

    const reminders = await prisma.medicationReminder.findMany({
      where: { customerId: customer.id },
      include: { elder: { select: { id: true, name: true, age: true } } },
      orderBy: [{ elderId: "asc" }, { createdAt: "asc" }],
    });
    res.json(reminders);
  } catch (err) {
    next(err);
  }
});

// POST /customer/medications
router.post(
  "/medications",
  authenticate,
  requireRole("CUSTOMER"),
  body("elderId").notEmpty().withMessage("Elder is required"),
  body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Medication name required"),
  body("dosage").optional().trim().isLength({ max: 100 }),
  body("frequency").isIn(VALID_FREQUENCIES).withMessage("Invalid frequency"),
  body("times").isArray({ min: 1 }).withMessage("At least one reminder time required"),
  body("notes").optional().trim().isLength({ max: 500 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      if (!customer) return res.status(404).json({ error: "Profile not found" });

      const elder = await prisma.elderProfile.findFirst({
        where: { id: req.body.elderId, customerId: customer.id, isActive: true },
      });
      if (!elder) return res.status(404).json({ error: "Elder not found" });

      const reminder = await prisma.medicationReminder.create({
        data: {
          customerId: customer.id,
          elderId: elder.id,
          name: req.body.name,
          dosage: req.body.dosage || null,
          frequency: req.body.frequency,
          times: req.body.times,
          notes: req.body.notes || null,
        },
        include: { elder: { select: { id: true, name: true, age: true } } },
      });
      res.status(201).json(reminder);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /customer/medications/:id
router.put(
  "/medications/:id",
  authenticate,
  requireRole("CUSTOMER"),
  body("name").optional().trim().isLength({ min: 1, max: 100 }),
  body("dosage").optional().trim().isLength({ max: 100 }),
  body("frequency").optional().isIn(VALID_FREQUENCIES),
  body("times").optional().isArray({ min: 1 }),
  body("notes").optional().trim().isLength({ max: 500 }),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
      const reminder = await prisma.medicationReminder.findFirst({
        where: { id: req.params.id, customerId: customer.id },
      });
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });

      const { name, dosage, frequency, times, notes } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (dosage !== undefined) updateData.dosage = dosage;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (times !== undefined) updateData.times = times;
      if (notes !== undefined) updateData.notes = notes;

      const updated = await prisma.medicationReminder.update({
        where: { id: reminder.id },
        data: updateData,
        include: { elder: { select: { id: true, name: true, age: true } } },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /customer/medications/:id/toggle
router.put("/medications/:id/toggle", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
    const reminder = await prisma.medicationReminder.findFirst({
      where: { id: req.params.id, customerId: customer.id },
    });
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });

    const updated = await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { isActive: !reminder.isActive },
    });
    res.json({ isActive: updated.isActive });
  } catch (err) {
    next(err);
  }
});

// DELETE /customer/medications/:id
router.delete("/medications/:id", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({ where: { userId: req.user.id } });
    const reminder = await prisma.medicationReminder.findFirst({
      where: { id: req.params.id, customerId: customer.id },
    });
    if (!reminder) return res.status(404).json({ error: "Reminder not found" });

    await prisma.medicationReminder.delete({ where: { id: reminder.id } });
    res.json({ message: "Reminder deleted" });
  } catch (err) {
    next(err);
  }
});

// ─── AI Care Recommendations ──────────────────────────────────────────────────

// GET /customer/ai-recommendations
router.get("/ai-recommendations", authenticate, requireRole("CUSTOMER"), async (req, res, next) => {
  try {
    const customer = await prisma.customerProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        elders: { where: { isActive: true } },
        bookings: {
          where: { status: { in: ["COMPLETED", "ACTIVE", "CONFIRMED"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { serviceType: true, createdAt: true, status: true },
        },
      },
    });
    if (!customer) return res.status(404).json({ error: "Profile not found" });

    const elders = customer.elders;
    const bookings = customer.bookings;
    const recommendations = [];

    // — Analyse elder conditions
    const allConditions = elders.flatMap(e => e.medicalConditions.map(c => c.toLowerCase()));
    const allMeds = elders.flatMap(e => e.medications);
    const allServiceTypes = bookings.map(b => b.serviceType);
    const usedTypes = new Set(allServiceTypes);
    const daysSinceLastBooking = bookings.length > 0
      ? Math.floor((Date.now() - new Date(bookings[0].createdAt)) / 86400000)
      : null;

    // Medication management nudge
    if (allMeds.length > 0 && !usedTypes.has("MEDICATION_MANAGEMENT")) {
      recommendations.push({
        id: "med_mgmt",
        type: "SERVICE_SUGGESTION",
        priority: "HIGH",
        icon: "💊",
        title: "Add Medication Management",
        description: `${elders.length === 1 ? elders[0].name : "Your elders"} ${allMeds.length > 2 ? `take${elders.length > 1 ? "" : "s"} ${allMeds.length} medications` : "take medication"} daily. A caregiver trained in medication management can ensure doses are never missed.`,
        action: { label: "Find Caregiver", screen: "/(customer)/search", params: { serviceType: "MEDICATION_MANAGEMENT" } },
      });
    }

    // Condition-based suggestions
    const needsMedical = allConditions.some(c =>
      ["diabetes", "heart", "hypertension", "bp", "blood pressure", "parkinson", "alzheimer", "dementia", "stroke"].some(k => c.includes(k))
    );
    if (needsMedical && !usedTypes.has("MEDICAL_MONITORING")) {
      recommendations.push({
        id: "medical_monitoring",
        type: "SERVICE_SUGGESTION",
        priority: "HIGH",
        icon: "🩺",
        title: "Consider Medical Monitoring",
        description: "Based on the medical conditions recorded, regular health monitoring by a trained caregiver can help detect changes early and prevent emergencies.",
        action: { label: "Find Caregiver", screen: "/(customer)/search", params: { serviceType: "MEDICAL_MONITORING" } },
      });
    }

    // Mobility assistance
    const needsMobility = allConditions.some(c =>
      ["arthritis", "fracture", "fall", "mobility", "knee", "hip", "joint"].some(k => c.includes(k))
    );
    if (needsMobility && !usedTypes.has("MOBILITY_ASSISTANCE")) {
      recommendations.push({
        id: "mobility",
        type: "SERVICE_SUGGESTION",
        priority: "MEDIUM",
        icon: "🚶",
        title: "Mobility Assistance May Help",
        description: "Mobility-related conditions make daily movement challenging. A caregiver specialised in mobility assistance can reduce fall risk significantly.",
        action: { label: "Find Caregiver", screen: "/(customer)/search", params: { serviceType: "MOBILITY_ASSISTANCE" } },
      });
    }

    // Re-booking nudge
    if (daysSinceLastBooking !== null && daysSinceLastBooking > 14) {
      recommendations.push({
        id: "rebook_nudge",
        type: "SCHEDULING",
        priority: "MEDIUM",
        icon: "📅",
        title: "Time to Schedule Care",
        description: `It's been ${daysSinceLastBooking} days since your last booking. Regular care keeps elders healthier and reduces emergency risks.`,
        action: { label: "Book Now", screen: "/(customer)/search", params: {} },
      });
    }

    // Location missing
    if (!customer.latitude || !customer.longitude) {
      recommendations.push({
        id: "location_missing",
        type: "SETUP",
        priority: "HIGH",
        icon: "📍",
        title: "Set Home Location",
        description: "Your caregivers need your home address to check in for sessions. Add it now to avoid delays on booking day.",
        action: { label: "Set Location", screen: "/(customer)/profile", params: {} },
      });
    }

    // Companionship for elderly alone
    const hasElderly = elders.some(e => e.age && e.age >= 70);
    if (hasElderly && !usedTypes.has("COMPANIONSHIP")) {
      recommendations.push({
        id: "companionship",
        type: "WELLNESS",
        priority: "MEDIUM",
        icon: "🤝",
        title: "Companionship Improves Wellbeing",
        description: "Social isolation is a major health risk for seniors over 70. Even a few hours of companionship each week can improve mood and cognitive function.",
        action: { label: "Find Caregiver", screen: "/(customer)/search", params: { serviceType: "COMPANIONSHIP" } },
      });
    }

    // Meal prep tip
    if (allConditions.some(c => ["diabetes", "diet", "nutrition", "weight", "kidney"].some(k => c.includes(k))) && !usedTypes.has("MEAL_PREPARATION")) {
      recommendations.push({
        id: "meal_prep",
        type: "WELLNESS",
        priority: "MEDIUM",
        icon: "🍲",
        title: "Diet-Aware Meal Preparation",
        description: "Managing dietary restrictions is crucial for the recorded conditions. A caregiver skilled in meal preparation can prepare meals that meet medical dietary requirements.",
        action: { label: "Find Caregiver", screen: "/(customer)/search", params: { serviceType: "MEAL_PREPARATION" } },
      });
    }

    // Daily care tip based on day of week
    const dayTips = [
      { icon: "💧", title: "Hydration Reminder", description: "Seniors often feel less thirsty but still need 6-8 glasses of water daily. Ask your caregiver to set hourly water reminders." },
      { icon: "🌞", title: "Morning Routine Matters", description: "A consistent morning routine helps elders with memory conditions feel secure and reduces anxiety throughout the day." },
      { icon: "🏃", title: "Gentle Exercise", description: "Even 10 minutes of gentle seated exercises daily can improve circulation and reduce joint stiffness in elderly patients." },
      { icon: "😴", title: "Sleep Quality", description: "Poor sleep affects elder health significantly. Ensure your caregiver maintains a consistent bedtime routine." },
      { icon: "🧠", title: "Mental Stimulation", description: "Crosswords, card games, and conversation help maintain cognitive function. Ask caregivers to include brain exercises." },
      { icon: "👁️", title: "Medication Side Effects", description: "Watch for signs like dizziness, confusion, or appetite changes — common medication side effects in seniors." },
      { icon: "📞", title: "Family Check-ins", description: "Regular family video calls have been shown to reduce depression in isolated elders. Schedule a weekly call today." },
    ];
    recommendations.push({
      id: "daily_tip",
      type: "DAILY_TIP",
      priority: "LOW",
      ...dayTips[new Date().getDay()],
      action: null,
    });

    // Sort by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({
      recommendations,
      meta: {
        elderCount: elders.length,
        totalBookings: bookings.length,
        daysSinceLastBooking,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
