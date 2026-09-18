const express = require("express");
const authRoutes = require("./authRoutes");
const employeeRoutes = require("./employeeRoutes");
const adminRoutes = require("./adminRoutes");
const superAdminRoutes = require("./superAdminRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Tyre Shop SaaS Multi-Tenant API (JS)",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/employee", employeeRoutes);
router.use("/admin", adminRoutes);
router.use("/super-admin", superAdminRoutes);

module.exports = router;
