const { verifyToken } = require("../utils/jwt");
const prisma = require("../utils/prisma");

const authenticate = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }

    const token = auth.split(" ")[1];
    const payload = verifyToken(token);

    if (payload.type === "temp") {
      return res
        .status(401)
        .json({
          error: "Temp token cannot access this route",
          code: "TEMP_TOKEN",
        });
    }

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return res
        .status(401)
        .json({ error: "Session expired or invalid", code: "SESSION_INVALID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "User account inactive", code: "ACCOUNT_INACTIVE" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    if (err.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ error: "Invalid token", code: "TOKEN_INVALID" });
    }
    next(err);
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return res
        .status(401)
        .json({ error: "Authentication required", code: "UNAUTHORIZED" });
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          error: "Insufficient permissions",
          code: "FORBIDDEN",
          required: roles,
        });
    }
    next();
  };

const authenticateTempToken = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Temp token required", code: "UNAUTHORIZED" });
    }
    const token = auth.split(" ")[1];
    const payload = verifyToken(token);
    if (payload.type !== "temp") {
      return res
        .status(401)
        .json({ error: "Expected temp token", code: "TOKEN_TYPE_MISMATCH" });
    }
    req.tempPhone = payload.phone;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid or expired temp token", code: "TOKEN_INVALID" });
  }
};

module.exports = { authenticate, requireRole, authenticateTempToken };
