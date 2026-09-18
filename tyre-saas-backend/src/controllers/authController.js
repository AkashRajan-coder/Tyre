const { getOne, query } = require("../config/db");
const { comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");
const { AppError } = require("../middlewares/error");

class AuthController {
  static async login(req, res, next) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        throw new AppError("Phone and password are required", 400);
      }

      const user = await getOne(
        "SELECT id, organization_id, phone, password_hash, full_name, role, is_active FROM users WHERE phone = ?",
        [phone]
      );

      if (!user) {
        throw new AppError("Invalid phone number or password", 401);
      }

      const isMatch = await comparePassword(password, user.password_hash);
      if (!isMatch) {
        throw new AppError("Invalid phone number or password", 401);
      }

      if (!user.is_active) {
        throw new AppError("Account is deactivated. Please contact administrator.", 403);
      }

      // Check organization status if user is bound to an organization
      let organization = null;
      if (user.organization_id) {
        organization = await getOne("SELECT id, name, slug, is_active FROM organizations WHERE id = ?", [user.organization_id]);
        if (organization && !organization.is_active) {
          throw new AppError("Organization account is deactivated. Please contact platform support.", 403);
        }
      }

      // Fetch active assigned shops (for employees and admins)
      let assignedShops = [];
      if (user.role === "SUPER_ADMIN") {
        // Super Admin can view all active shops
        assignedShops = await query("SELECT id, organization_id, name, code, address, phone FROM shops WHERE is_active = 1");
      } else if (user.role === "ADMIN") {
        // Business Admin has access to all active shops in their organization
        assignedShops = await query(
          "SELECT id, organization_id, name, code, address, phone FROM shops WHERE organization_id = ? AND is_active = 1",
          [user.organization_id]
        );
      } else {
        // Employee only has access to shops specifically assigned in user_shops
        assignedShops = await query(
          `SELECT s.id, s.organization_id, s.name, s.code, s.address, s.phone
           FROM shops s
           INNER JOIN user_shops us ON us.shop_id = s.id
           WHERE us.user_id = ? AND s.is_active = 1`,
          [user.id]
        );
      }

      const token = generateToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
        organizationId: user.organization_id,
      });

      res.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          user: {
            id: user.id,
            organizationId: user.organization_id,
            organizationName: organization ? organization.name : null,
            phone: user.phone,
            fullName: user.full_name,
            role: user.role,
          },
          assignedShops,
          hasMultipleShops: assignedShops.length > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      const user = await getOne(
        "SELECT id, organization_id, phone, full_name, role, is_active FROM users WHERE id = ?",
        [req.user.id]
      );

      if (!user) {
        throw new AppError("User not found", 404);
      }

      let assignedShops = [];
      if (user.role === "SUPER_ADMIN") {
        assignedShops = await query("SELECT id, organization_id, name, code, address, phone FROM shops WHERE is_active = 1");
      } else if (user.role === "ADMIN") {
        assignedShops = await query(
          "SELECT id, organization_id, name, code, address, phone FROM shops WHERE organization_id = ? AND is_active = 1",
          [user.organization_id]
        );
      } else {
        assignedShops = await query(
          `SELECT s.id, s.organization_id, s.name, s.code, s.address, s.phone
           FROM shops s
           INNER JOIN user_shops us ON us.shop_id = s.id
           WHERE us.user_id = ? AND s.is_active = 1`,
          [user.id]
        );
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            organizationId: user.organization_id,
            phone: user.phone,
            fullName: user.full_name,
            role: user.role,
          },
          assignedShops,
          hasMultipleShops: assignedShops.length > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
