const { PrismaClient } = require("@prisma/client");

const withPrismaPoolDefaults = (databaseUrl) => {
  if (!databaseUrl) return databaseUrl;

  try {
    const url = new URL(databaseUrl);

    // For constrained/session poolers, keep per-instance connection footprint low.
    if (!url.searchParams.has("connection_limit")) {
      const defaultLimit = process.env.NODE_ENV === "production" ? "1" : "5";
      url.searchParams.set("connection_limit", defaultLimit);
    }

    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }

    return url.toString();
  } catch (_) {
    // Preserve original value when URL parsing fails.
    return databaseUrl;
  }
};

const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: withPrismaPoolDefaults(process.env.DATABASE_URL),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

module.exports = prisma;
