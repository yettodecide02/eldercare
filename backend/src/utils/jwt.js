const jwt = require("jsonwebtoken");
const prisma = require("./prisma");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

const generateToken = async (user) => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ userId: user.id, role: user.role }, SECRET, {
    expiresIn: EXPIRES_IN,
  });

  await prisma.session.create({ data: { userId: user.id, token, expiresAt } });
  return token;
};

const generateTempToken = (phone) => {
  return jwt.sign({ phone, type: "temp" }, SECRET, { expiresIn: "15m" });
};

const verifyToken = (token) => jwt.verify(token, SECRET);

const invalidateSession = async (token) => {
  await prisma.session.updateMany({
    where: { token },
    data: { isActive: false },
  });
};

const invalidateAllSessions = async (userId) => {
  await prisma.session.updateMany({
    where: { userId },
    data: { isActive: false },
  });
};

module.exports = {
  generateToken,
  generateTempToken,
  verifyToken,
  invalidateSession,
  invalidateAllSessions,
};
