const { verifyToken } = require("../utils/jwt");
const { getOne } = require("../config/db");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await getOne(
      "SELECT id, phone, full_name, role, organization_id, is_active FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated. Please contact your administrator.",
      });
    }

    if (user.organization_id) {
      const org = await getOne("SELECT is_active FROM organizations WHERE id = ?", [user.organization_id]);
      if (org && !org.is_active) {
        return res.status(403).json({
          success: false,
          message: "Organization account has been deactivated. Access blocked.",
        });
      }
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      fullName: user.full_name,
      role: user.role,
      organizationId: user.organization_id,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// Restricted to Platform Super Admin (SaaS Owner)
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access restricted to platform Super Administrators only",
    });
  }
  next();
}

// Business Admin or Super Admin
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN")) {
    return res.status(403).json({
      success: false,
      message: "Access restricted to administrators only",
    });
  }
  next();
}

// Employee, Admin, or Super Admin
function requireEmployee(req, res, next) {
  if (!req.user || !["EMPLOYEE", "ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access restricted to authorized staff",
    });
  }
  next();
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireAdmin,
  requireEmployee,
};
