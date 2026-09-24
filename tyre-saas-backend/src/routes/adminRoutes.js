const express = require("express");

const AdminController = require("../controllers/adminController");

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

module.exports = router;