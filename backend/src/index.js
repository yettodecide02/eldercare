require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const logger = require("./utils/logger");

const app = express();

// Security
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((o) => o.trim());
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(compression());

// Logging
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === "/health",
  }),
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global rate limiting
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" }),
  }),
);

// Stricter auth rate limit
app.use(
  "/api/auth/send-otp",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: "Too many OTP requests", code: "RATE_LIMIT_EXCEEDED" }),
  }),
);

// Health check
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  }),
);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/caregiver", require("./routes/caregiver"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/customer", require("./routes/customer"));
app.use("/api/notifications", require("./routes/notifications"));

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({
      error: `Route ${req.method} ${req.path} not found`,
      code: "NOT_FOUND",
    });
});

// Error handler
const { errorHandler } = require("./middleware/errorHandler");
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  logger.info(
    `ElderCare API running on port ${PORT} (${process.env.NODE_ENV || "development"})`,
  );

  // Start background jobs in non-test environments
  if (process.env.NODE_ENV !== "test") {
    const { startAllJobs } = require("./jobs/scheduler");
    startAllJobs();
  }
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  const closeServer = new Promise((resolve) => {
    server.close(() => {
      logger.info("HTTP server closed");
      resolve();
    });
  });

  const prisma = require("./utils/prisma");
  const disconnectPrisma = prisma.$disconnect().catch((err) => {
    logger.error("Prisma disconnect failed", { error: err.message });
  });

  await Promise.race([
    Promise.all([closeServer, disconnectPrisma]),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Forced shutdown")), 10000),
    ),
  ]).catch((err) => logger.error(err.message));

  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) =>
  logger.error("Unhandled Rejection", { reason }),
);
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err.message });
  process.exit(1);
});

module.exports = app; // for testing
