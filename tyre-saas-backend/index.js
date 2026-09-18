require("dotenv").config();
const express = require("express");
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

app.use(helmet({ contentSecurityPolicy: false })); // Security headers
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI interactive API documentation
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs", (req, res) => res.redirect("/api/docs"));

// Root welcome route
app.get("/", (req, res) => {
  res.json({
    name: "Tyre Shop SaaS Backend (Node.js/JavaScript)",
    version: "1.0.0",
    swaggerDocs: "/api/docs",
    health: "/api/v1/health",
    endpoints: {
      auth: "/api/v1/auth",
      employee: "/api/v1/employee",
      admin: "/api/v1/admin",
      superAdmin: "/api/v1/super-admin",
    },
  });
});

// Mount API v1
app.use("/api/v1", apiLimiter, apiRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

let server = null;

// Start server when run directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      server = app.listen(PORT, () => {
        console.log(`🚀 Tyre Shop SaaS Backend running on http://localhost:${PORT}`);
        console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api/docs`);
        console.log(`🔗 Health Check: http://localhost:${PORT}/api/v1/health`);
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
