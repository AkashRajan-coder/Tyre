const express = require("express");
const AdminController = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Dashboard
router.get("/dashboard", AdminController.getDashboard);

// All Entries & Filter
router.get("/enquiries", AdminController.getAllEnquiries);
router.patch("/enquiries/:id/reassign", AdminController.reassignEnquiry);
router.delete("/enquiries/:id", AdminController.softDeleteEnquiry);

// Shop Management
router.get("/shops", AdminController.listShops);
router.post("/shops", AdminController.createShop);
router.patch("/shops/:id", AdminController.updateShop);
router.delete("/shops/:id", AdminController.deactivateShop);

// User Management
router.get("/users", AdminController.listUsers);
router.post("/users", AdminController.createUser);
router.patch("/users/:id", AdminController.updateUser);
router.post("/users/:id/reset-password", AdminController.resetPassword);
router.delete("/users/:id", AdminController.deactivateUser);

// CSV Export
router.get("/export/csv", AdminController.exportCsv);

module.exports = router;
