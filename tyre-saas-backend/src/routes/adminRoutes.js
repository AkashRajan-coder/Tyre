const express = require("express");
const TyreBrandController = require("../controllers/TyreBrandController");
const AdminController = require("../controllers/adminController");
const TargetController = require("../controllers/TargetController");
const TyreProductController = require("../controllers/TyreProductController");

const {
  requireAuth,
  requireAdmin,
} = require("../middlewares/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// ============================================================
// Dashboard
// ============================================================

router.get(
  "/dashboard",
  AdminController.getDashboard
);


// ============================================================
// Enquiries
// ============================================================

router.get(
  "/enquiries",
  AdminController.getAllEnquiries
);

router.patch(
  "/enquiries/:id/reassign",
  AdminController.reassignEnquiry
);

router.delete(
  "/enquiries/:id",
  AdminController.softDeleteEnquiry
);


// ============================================================
// Shop Management
// ============================================================

router.get(
  "/shops",
  AdminController.listShops
);

router.post(
  "/shops",
  AdminController.createShop
);

router.patch(
  "/shops/:id",
  AdminController.updateShop
);

// Deactivate shop
// is_active = 0
// is_deleted = FALSE
// Shop remains visible
router.patch(
  "/shops/:id/deactivate",
  AdminController.deactivateShop
);

router.patch(
  "/shops/:id/activate",
  AdminController.activateShop
);

// Soft delete shop
// is_active = 0
// is_deleted = TRUE
// Shop disappears from normal list
router.delete(
  "/shops/:id",
  AdminController.softDeleteShop
);


// ============================================================
// User Management
// ============================================================

router.get(
  "/users",
  AdminController.listUsers
);

router.post(
  "/users",
  AdminController.createUser
);

router.patch(
  "/users/:id",
  AdminController.updateUser
);

// Deactivate user
// is_active = 0
// is_deleted = FALSE
// User remains visible
router.patch(
  "/users/:id/deactivate",
  AdminController.deactivateUser
);

router.patch(
  "/users/:id/activate",
  AdminController.activateUser
);

// Soft delete user
// is_active = 0
// is_deleted = TRUE
// User disappears from normal list
router.delete(
  "/users/:id",
  AdminController.softDeleteUser
);

router.post(
  "/users/:id/reset-password",
  AdminController.resetPassword
);

router.get(
  "/tyre-sizes",
  AdminController.listTyreSizes
);

router.post(
  "/tyre-sizes",
  AdminController.createTyreSize
);

router.patch(
  "/tyre-sizes/:id",
  AdminController.updateTyreSize
);

router.patch(
  "/tyre-sizes/:id/deactivate",
  AdminController.deactivateTyreSize
);

router.patch(
  "/tyre-sizes/:id/activate",
  AdminController.activateTyreSize
);

// ============================================================
// TYRE BRAND MASTER
// ============================================================

router.get(
  "/tyre-brands",
  TyreBrandController.listTyreBrands
);

router.post(
  "/tyre-brands",
  TyreBrandController.createTyreBrand
);

router.patch(
  "/tyre-brands/:id",
  TyreBrandController.updateTyreBrand
);

router.patch(
  "/tyre-brands/:id/deactivate",
  TyreBrandController.deactivateTyreBrand
);

router.patch(
  "/tyre-brands/:id/activate",
  TyreBrandController.activateTyreBrand
);

// ============================================================
// TYRE PRODUCT MASTER
// ============================================================

router.get(
  "/tyre-products",
  TyreProductController.listTyreProducts
);

router.post(
  "/tyre-products",
  TyreProductController.createTyreProduct
);

router.patch(
  "/tyre-products/:id",
  TyreProductController.updateTyreProduct
);

router.patch(
  "/tyre-products/:id/deactivate",
  TyreProductController.deactivateTyreProduct
);

router.patch(
  "/tyre-products/:id/activate",
  TyreProductController.activateTyreProduct
);
// ============================================================
// CSV Export
// ============================================================

router.get(
  "/export/csv",
  AdminController.exportCsv
);

router.get(
  "/shops-with-employees",
  AdminController.getShopsWithEmployees
);
// ============================================================
// TARGET ROUTES
// ============================================================

router.post("/targets", TargetController.createTarget);

router.get("/targets/current", TargetController.getCurrentTarget);

router.get(
  "/targets/dashboard",
  TargetController.getTargetDashboard
);

router.patch(
  "/targets/:id",
  TargetController.updateTarget
);

router.get(
  "/targets/history",
  TargetController.getTargetHistory
);

module.exports = router;