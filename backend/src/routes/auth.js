const express = require("express");
const { body, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const {
  generateToken,
  generateTempToken,
  invalidateSession,
} = require("../utils/jwt");
const { sendOtp, verifyOtp } = require("../services/otpService");
const { authenticate, authenticateTempToken } = require("../middleware/auth");

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errors.array()[0].msg;
  return null;
};

// POST /auth/send-otp
router.post(
  "/send-otp",
  body("phone")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Invalid Indian phone number format (+91XXXXXXXXXX)"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err)
        return res
          .status(400)
          .json({ error: err, code: "INVALID_PHONE_FORMAT" });
      const result = await sendOtp(req.body.phone);
      res.json({
        message: "OTP sent to phone",
        expiresIn: 600,
        ...(result?.otp ? { otp: result.otp } : {}),
      });
    } catch (err) {
      if (err.code === "RATE_LIMIT_EXCEEDED")
        return res
          .status(429)
          .json({
            error: err.message,
            code: err.code,
            retryAfter: err.retryAfter,
          });
      next(err);
    }
  },
);

// POST /auth/verify-otp
router.post(
  "/verify-otp",
  body("phone")
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage("Invalid phone"),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be 6 digits"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err, code: "INVALID_OTP" });

      const { phone, otp } = req.body;
      await verifyOtp(phone, otp);

      const user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        const tempToken = generateTempToken(phone);
        return res.json({ isNewUser: true, tempToken, expiresIn: 900 });
      }

      if (!user.isActive) {
        return res
          .status(403)
          .json({ error: "Account suspended", code: "ACCOUNT_SUSPENDED" });
      }

      const token = await generateToken(user);
      res.json({
        isNewUser: false,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        expiresIn: 2592000,
      });
    } catch (err) {
      if (["OTP_EXPIRED", "INVALID_OTP"].includes(err.code)) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  },
);

// POST /auth/complete-signup
router.post(
  "/complete-signup",
  authenticateTempToken,
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be 2-50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name must only contain letters"),
  body("role")
    .isIn(["CUSTOMER", "CAREGIVER"])
    .withMessage("Role must be CUSTOMER or CAREGIVER"),
  body("city")
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("City must be 2-30 characters"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email format"),
  async (req, res, next) => {
    try {
      const err = validate(req, res);
      if (err) return res.status(400).json({ error: err });

      const { name, role, city, email } = req.body;
      const phone = req.tempPhone;

      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing)
        return res
          .status(409)
          .json({ error: "Phone already registered", code: "PHONE_EXISTS" });

      if (email) {
        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists)
          return res
            .status(409)
            .json({ error: "Email already in use", code: "EMAIL_EXISTS" });
      }

      const user = await prisma.user.create({
        data: {
          phone,
          name,
          role,
          email: email || undefined,
          customerProfile:
            role === "CUSTOMER" ? { create: { city } } : undefined,
          caregiverProfile:
            role === "CAREGIVER"
              ? {
                  create: {
                    city,
                    hourlyRate: 350,
                    serviceTypes: [],
                    languages: [],
                    certifications: [],
                  },
                }
              : undefined,
        },
      });

      const token = await generateToken(user);
      res.status(201).json({
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          email: user.email,
        },
        expiresIn: 2592000,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await invalidateSession(req.token);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh-token
router.post("/refresh-token", authenticate, async (req, res, next) => {
  try {
    await invalidateSession(req.token);
    const token = await generateToken(req.user);
    res.json({ token, expiresIn: 2592000 });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        customerProfile: { include: { elders: { where: { isActive: true } } } },
        caregiverProfile: { include: { availability: true } },
      },
    });
    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      profile: user.customerProfile || user.caregiverProfile,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
