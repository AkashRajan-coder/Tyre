const express = require("express");
const AuthController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");
const { loginLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/login", loginLimiter, AuthController.login);
router.get("/me", requireAuth, AuthController.me);

module.exports = router;
