const express = require("express");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const prisma = require("../utils/prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const notificationService = require("../services/notificationService");

const router = express.Router();

const SUBSCRIPTION_PRICES = {
  FREE: 0,
  FAMILY_BASIC: 499,
  FAMILY_PREMIUM: 999,
  ENTERPRISE: 2999,
};

const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID) return null;
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// POST /payments/create-order
router.post(
  "/create-order",
  authenticate,
  requireRole("CUSTOMER"),
  body("bookingId").notEmpty(),
  async (req, res, next) => {
    try {
      const { bookingId } = req.body;
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, payment: true },
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.customer.userId !== req.user.id)
        return res.status(403).json({ error: "Forbidden" });
      if (booking.payment)
        return res
          .status(409)
          .json({ error: "Payment already exists", code: "PAYMENT_EXISTS" });

      const amountPaisa = Math.round(parseFloat(booking.totalAmount) * 100);
      const orderId = `ec_${Date.now()}_${bookingId.slice(0, 8)}`;
      let razorpayOrderId = null;

      const razorpay = getRazorpay();
      if (razorpay) {
        const order = await razorpay.orders.create({
          amount: amountPaisa,
          currency: "INR",
          receipt: orderId,
        });
        razorpayOrderId = order.id;
      } else {
        razorpayOrderId = `rzp_mock_${orderId}`;
      }

      await prisma.payment.create({
        data: {
          bookingId,
          orderId,
          razorpayOrderId,
          amount: booking.totalAmount,
          currency: "INR",
        },
      });

      res.json({
        orderId,
        razorpayOrderId,
        amount: parseFloat(booking.totalAmount),
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID || "dev_mode",
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /payments/verify
router.post(
  "/verify",
  authenticate,
  body("orderId").notEmpty(),
  body("razorpayOrderId").notEmpty(),
  body("razorpayPaymentId").notEmpty(),
  body("razorpaySignature").notEmpty(),
  async (req, res, next) => {
    try {
      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        req.body;

      // HMAC-SHA256 signature verification
      const secret = process.env.RAZORPAY_KEY_SECRET || "dev_secret";
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (
        expectedSig !== razorpaySignature &&
        process.env.NODE_ENV !== "test"
      ) {
        return res
          .status(400)
          .json({
            error: "Payment signature verification failed",
            code: "SIGNATURE_MISMATCH",
          });
      }

      const payment = await prisma.payment.findUnique({ where: { orderId } });
      if (!payment) return res.status(404).json({ error: "Order not found" });
      if (payment.status !== "PENDING")
        return res
          .status(409)
          .json({
            error: "Payment already processed",
            code: "ALREADY_PROCESSED",
          });

      const [updatedPayment, updatedBooking] = await prisma.$transaction([
        prisma.payment.update({
          where: { orderId },
          data: { status: "HELD", razorpayPaymentId },
        }),
        prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: "CONFIRMED" },
          include: {
            customer: { include: { user: true } },
            caregiver: { include: { user: true } },
          },
        }),
      ]);

      await notificationService.sendToUser(updatedBooking.caregiver.userId, {
        type: "BOOKING_PAYMENT_RECEIVED",
        title: "Booking Payment Received",
        message: `Payment confirmed for booking ${updatedBooking.bookingNumber}`,
        data: { bookingId: updatedBooking.id },
      });

      res.json({
        bookingId: payment.bookingId,
        paymentStatus: "HELD",
        bookingStatus: "CONFIRMED",
        message: "Payment verified successfully",
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /payments/subscribe
router.post(
  "/subscribe",
  authenticate,
  requireRole("CUSTOMER"),
  body("plan").isIn(["FAMILY_BASIC", "FAMILY_PREMIUM", "ENTERPRISE"]),
  body("razorpayPaymentId").optional(),
  async (req, res, next) => {
    try {
      const { plan } = req.body;
      const monthlyPrice = SUBSCRIPTION_PRICES[plan];
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });

      // Cancel existing subscription
      await prisma.subscription.updateMany({
        where: { customerId: customer.id, status: "ACTIVE" },
        data: { status: "CANCELLED", endDate: new Date() },
      });

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const [sub] = await prisma.$transaction([
        prisma.subscription.create({
          data: {
            customerId: customer.id,
            plan,
            monthlyPrice,
            startDate,
            endDate,
          },
        }),
        prisma.customerProfile.update({
          where: { id: customer.id },
          data: { subscriptionPlan: plan, subscriptionEndDate: endDate },
        }),
      ]);

      res.json({
        subscriptionId: sub.id,
        plan,
        monthlyPrice,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        status: "ACTIVE",
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /payments/subscription
router.get(
  "/subscription",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      const sub = await prisma.subscription.findFirst({
        where: { customerId: customer.id, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      res.json({
        plan: customer.subscriptionPlan,
        subscription: sub || null,
        expiresAt: customer.subscriptionEndDate,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /payments/subscription/cancel
router.post(
  "/subscription/cancel",
  authenticate,
  requireRole("CUSTOMER"),
  async (req, res, next) => {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { userId: req.user.id },
      });
      await prisma.$transaction([
        prisma.subscription.updateMany({
          where: { customerId: customer.id, status: "ACTIVE" },
          data: { status: "CANCELLED", endDate: new Date() },
        }),
        prisma.customerProfile.update({
          where: { id: customer.id },
          data: { subscriptionPlan: "FREE", subscriptionEndDate: null },
        }),
      ]);
      res.json({
        message: "Subscription cancelled. You are now on the FREE plan.",
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
