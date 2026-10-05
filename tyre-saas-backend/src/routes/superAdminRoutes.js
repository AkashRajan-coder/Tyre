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
router.patch(
  "/business-admins/:id/activate",
  SuperAdminController.activateBusinessAdmin
);

// Global Master Tyre Sizes Management
router.get("/tyre-sizes", SuperAdminController.listTyreSizes);
router.post("/tyre-sizes/bulk", SuperAdminController.bulkCreateTyreSizes);
router.post("/tyre-sizes/bulk-action", SuperAdminController.bulkActionTyreSizes);
router.post("/tyre-sizes/cleanup-unused", SuperAdminController.cleanupUnusedTyreSizes);
router.delete("/tyre-sizes/organization/:organizationId", SuperAdminController.deleteOrganizationTyreSizes);
router.delete("/organizations/:organizationId/tyre-sizes", SuperAdminController.deleteOrganizationTyreSizes);
router.patch("/tyre-sizes/:id/status", SuperAdminController.toggleTyreSizeStatus);
router.delete("/tyre-sizes/:id", SuperAdminController.deleteTyreSize);

// Global Master Tyre Brands Management
router.get("/tyre-brands", SuperAdminController.listTyreBrands);
router.post("/tyre-brands/bulk", SuperAdminController.bulkCreateTyreBrands);
router.post("/tyre-brands/bulk-action", SuperAdminController.bulkActionTyreBrands);
router.post("/tyre-brands/cleanup-unused", SuperAdminController.cleanupUnusedTyreBrands);
router.delete("/tyre-brands/organization/:organizationId", SuperAdminController.deleteOrganizationTyreBrands);
router.delete("/organizations/:organizationId/tyre-brands", SuperAdminController.deleteOrganizationTyreBrands);
router.patch("/tyre-brands/:id/status", SuperAdminController.toggleTyreBrandStatus);
router.delete("/tyre-brands/:id", SuperAdminController.deleteTyreBrand);

module.exports = router;
