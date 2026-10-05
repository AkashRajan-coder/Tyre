require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const { apiLimiter } = require("./src/middlewares/rateLimiter");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./src/config/swagger");
const { initDatabase } = require("./src/config/db");
const apiRoutes = require("./src/routes");
const { notFoundHandler, errorHandler } = require("./src/middlewares/error");

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

// Render reverse proxy trust for correct client IP detection in rate limiting
app.set("trust proxy", 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration: Allow native apps with no Origin header, restrict web browsers to CORS_ORIGIN
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["*"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile Flutter apps, Postman, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dedicated health check for Render & Flutter cold-start wake-up (unauthenticated, outside rate limiter)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
  });
});

// Swagger UI interactive API documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs", (req, res) => res.redirect("/api/docs"));

// Static files (Super Admin portal UI)
app.use(express.static(path.join(__dirname, "public")));
app.get("/superadmin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "superadmin.html"));
});

// Root welcome route
app.get("/", (req, res) => {
  res.json({
    name: "Tyre Shop SaaS Backend (Node.js/JavaScript)",
    version: "1.0.0",
    superAdminPortal: "/superadmin",
    swaggerDocs: "/api/docs",
    health: "/health",
    endpoints: {
      auth: "/api/v1/auth",
      employee: "/api/v1/employee",
      admin: "/api/v1/admin",
      superAdmin: "/api/v1/super-admin",
      dailyReports: "/api/v1/daily-reports",
    },
  });
});

// Mount API v1 under rate limiter
app.use("/api/v1", apiLimiter, apiRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

let server = null;

// Start server when run directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      server = app.listen(PORT, HOST, () => {
        console.log(`🚀 Tyre Shop SaaS Backend running on http://${HOST}:${PORT}`);
        console.log(`📖 Swagger API Docs: http://${HOST}:${PORT}/api/docs`);
        console.log(`🔗 Health Check: http://${HOST}:${PORT}/health`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  const { closeDatabase } = require("./src/config/db");
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      await closeDatabase();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
