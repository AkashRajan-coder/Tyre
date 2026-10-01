const express = require("express");

const DailyReportController = require("../controllers/DailyReportController");

const {
  requireAuth,
} = require("../middlewares/auth");

const router = express.Router();

// Employee → create today's report
router.post(
  "/",
  requireAuth,
  DailyReportController.saveDailyReport
);

// Employee → add quantities to today's report
router.put(
  "/",
  requireAuth,
  DailyReportController.updateDailyReport
);

module.exports = router;