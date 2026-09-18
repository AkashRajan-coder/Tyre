const express = require("express");
const SuperAdminController = require("../controllers/superAdminController");
const { requireAuth, requireSuperAdmin } = require("../middlewares/auth");

const router = express.Router();

// Enforce Super Admin authorization on all routes
router.use(requireAuth, requireSuperAdmin);

// Platform Global Dashboard
router.get("/dashboard", SuperAdminController.getPlatformDashboard);

// Organization Management
router.get("/organizations", SuperAdminController.listOrganizations);
router.post("/organizations", SuperAdminController.createOrganization);
router.get("/organizations/:id", SuperAdminController.getOrganizationById);
router.patch("/organizations/:id", SuperAdminController.updateOrganization);
router.delete("/organizations/:id", SuperAdminController.deactivateOrganization);

// Business Admin Management
router.get("/business-admins", SuperAdminController.listBusinessAdmins);
router.post("/business-admins", SuperAdminController.createBusinessAdmin);
router.patch("/business-admins/:id", SuperAdminController.updateBusinessAdmin);
router.post("/business-admins/:id/reset-password", SuperAdminController.resetBusinessAdminPassword);
router.delete("/business-admins/:id", SuperAdminController.deleteBusinessAdmin);
router.patch("/business-admins/:id/deactivate", SuperAdminController.deactivateBusinessAdmin);

module.exports = router;
