const express = require("express");
const EnquiryTyreOptionController = require("../controllers/EnquiryTyreOptionController");
const TyreProductController = require("../controllers/TyreProductController");
const EmployeeController = require("../controllers/employeeController");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.use(requireAuth);

// 1. Shop Picker: list assigned shops
router.get("/shops", EmployeeController.getShops);

// 2. Banner summary for active shop (Due Today / Tomorrow / Overdue)
router.get("/banner-summary", EmployeeController.getBannerSummary);

// 3. Duplicate phone check before save
router.get("/check-duplicate", EmployeeController.checkDuplicatePhone);

// 4. Tab 1: Add Customer Enquiry
router.post("/enquiries", EmployeeController.createEnquiry);

// 5. Tab 2: Pending Follow-ups
router.get("/pending", EmployeeController.getPending);

// 6. Tab 3: Completed Follow-ups
router.get("/completed", EmployeeController.getCompleted);

// 7. Tab 4: Customer Search
router.get("/search", EmployeeController.search);

// 8. Follow-up Detail
router.get("/enquiries/:id", EmployeeController.getById);

// 9. Follow-up Action: update status, reschedule, remarks
router.patch("/enquiries/:id", EmployeeController.updateEnquiry);
router.get(
  "/tyre-products",
  TyreProductController.listAvailableTyreProducts
);

// Enquiry Tyre Options
router.get(
  "/enquiries/:enquiryId/tyre-options",
  EnquiryTyreOptionController.listOptions
);

router.post(
  "/enquiries/:enquiryId/tyre-options",
  EnquiryTyreOptionController.createOption
);

router.patch(
  "/enquiries/:enquiryId/tyre-options/:id",
  EnquiryTyreOptionController.updateOption
);

router.delete(
  "/enquiries/:enquiryId/tyre-options/:id",
  EnquiryTyreOptionController.deleteOption
);
router.get("/unfit", EmployeeController.getUnfit);



module.exports = router;
