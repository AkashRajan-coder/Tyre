const { getOne, query, execute, uuid } = require("../config/db");
const { hashPassword } = require("../utils/password");
const { AppError } = require("../middlewares/error");

class SuperAdminController {
  // 1. Global SaaS Dashboard Overview
  static async getPlatformDashboard(req, res, next) {
    try {
      const [orgsCount, shopsCount, adminsCount, employeesCount, enquiriesCount] = await Promise.all([
        getOne("SELECT COUNT(*) as c FROM organizations WHERE is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM shops WHERE is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM users WHERE role = 'ADMIN' AND is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM users WHERE role = 'EMPLOYEE' AND is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE is_deleted = 0"),
      ]);

      const organizations = await query(
        "SELECT id, name, slug, phone, email, is_active, created_at FROM organizations ORDER BY created_at DESC"
      );

      for (const org of organizations) {
        const [shops, users, enq] = await Promise.all([
          getOne("SELECT COUNT(*) as c FROM shops WHERE organization_id = ? AND is_active = 1", [org.id]),
          getOne("SELECT COUNT(*) as c FROM users WHERE organization_id = ? AND is_active = 1", [org.id]),
          getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE organization_id = ? AND is_deleted = 0", [org.id]),
        ]);
        org.active_shops_count = parseInt(shops?.c || 0, 10);
        org.active_users_count = parseInt(users?.c || 0, 10);
        org.total_enquiries_count = parseInt(enq?.c || 0, 10);
      }

      res.json({
        success: true,
        data: {
          platformMetrics: {
            totalOrganizations: parseInt(orgsCount?.c || 0, 10),
            totalShops: parseInt(shopsCount?.c || 0, 10),
            totalBusinessAdmins: parseInt(adminsCount?.c || 0, 10),
            totalEmployees: parseInt(employeesCount?.c || 0, 10),
            totalEnquiries: parseInt(enquiriesCount?.c || 0, 10),
          },
          organizations,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------
  // Organization Management
  // -------------------------------------------------------------

  static async listOrganizations(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const sql = includeInactive
        ? "SELECT * FROM organizations ORDER BY created_at DESC"
        : "SELECT * FROM organizations WHERE is_active = 1 ORDER BY created_at DESC";

      const orgs = await query(sql);

      // Attach statistics
      for (const org of orgs) {
        const [shops, admins, employees] = await Promise.all([
          getOne("SELECT COUNT(*) as c FROM shops WHERE organization_id = ? AND is_active = 1", [org.id]),
          getOne("SELECT COUNT(*) as c FROM users WHERE organization_id = ? AND role = 'ADMIN' AND is_active = 1", [org.id]),
          getOne("SELECT COUNT(*) as c FROM users WHERE organization_id = ? AND role = 'EMPLOYEE' AND is_active = 1", [org.id]),
        ]);
        org.shopsCount = parseInt(shops?.c || 0, 10);
        org.adminsCount = parseInt(admins?.c || 0, 10);
        org.employeesCount = parseInt(employees?.c || 0, 10);
      }

      res.json({ success: true, data: orgs });
    } catch (error) {
      next(error);
    }
  }

  static async createOrganization(req, res, next) {
    try {
      const { name, slug, phone, email, address, adminName, adminPhone, adminPassword } = req.body;

      if (!name) {
        throw new AppError("Organization name is required", 400);
      }

      const orgId = uuid();
      const now = new Date().toISOString();
      const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");

      const existingSlug = await getOne("SELECT id FROM organizations WHERE slug = ?", [generatedSlug]);
      if (existingSlug) {
        throw new AppError("An organization with this slug already exists", 409);
      }

      await execute(
        `INSERT INTO organizations (id, name, slug, phone, email, address, is_active, created_at, created_by, last_modified_at, last_modified_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [orgId, name, generatedSlug, phone || null, email || null, address || null, now, req.user.id, now, req.user.id]
      );

      let createdAdmin = null;
      // Optionally create the initial Business Admin account
      if (adminPhone && adminPassword) {
        const existingUser = await getOne("SELECT id FROM users WHERE phone = ?", [adminPhone]);
        if (existingUser) {
          throw new AppError("A user with this phone number already exists", 409);
        }

        const adminId = uuid();
        const passHash = await hashPassword(adminPassword);

        await execute(
          `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
           VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?, ?, ?)`,
          [adminId, orgId, adminPhone, passHash, adminName || `${name} Admin`, now, req.user.id, now, req.user.id]
        );

        createdAdmin = {
          id: adminId,
          phone: adminPhone,
          fullName: adminName || `${name} Admin`,
          role: "ADMIN",
        };
      }

      const organization = await getOne("SELECT * FROM organizations WHERE id = ?", [orgId]);

      res.status(201).json({
        success: true,
        message: "Organization created successfully",
        data: {
          organization,
          businessAdmin: createdAdmin,
        },
      });
    } catch (error) {
      next(error);
    }
  }

static async getOrganizationById(req, res, next) {
  try {
    const { id } = req.params;

    const org = await getOne(
      "SELECT * FROM organizations WHERE id = ?",
      [id]
    );

    if (!org) {
      throw new AppError("Organization not found", 404);
    }

    const [shops, admins, employees] = await Promise.all([
      query(
        "SELECT id, name, address, phone, is_active FROM shops WHERE organization_id = ? ORDER BY name ASC",
        [id]
      ),

      query(
        "SELECT id, phone, full_name, role, is_active, created_at FROM users WHERE organization_id = ? AND role = 'ADMIN'",
        [id]
      ),

      query(
        "SELECT id, phone, full_name, role, is_active, created_at FROM users WHERE organization_id = ? AND role = 'EMPLOYEE'",
        [id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        ...org,
        shops,
        businessAdmins: admins,
        employees,
      },
    });
  } catch (error) {
    next(error);
  }
}

  static async updateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { name, slug, phone, email, address, isActive } = req.body;

      const org = await getOne("SELECT id FROM organizations WHERE id = ?", [id]);
      if (!org) throw new AppError("Organization not found", 404);

      const now = new Date().toISOString();
      await execute(
        `UPDATE organizations SET
          name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          is_active = COALESCE(?, is_active),
          last_modified_at = ?,
          last_modified_by = ?
         WHERE id = ?`,
        [name || null, slug || null, phone || null, email || null, address || null, isActive !== undefined ? (isActive ? 1 : 0) : null, now, req.user.id, id]
      );

      const updated = await getOne("SELECT * FROM organizations WHERE id = ?", [id]);
      res.json({ success: true, message: "Organization updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      await execute(
        "UPDATE organizations SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [now, req.user.id, id]
      );

      res.json({ success: true, message: "Organization deactivated successfully" });
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------
  // Business Admin Management (Super Admin controls Admins)
  // -------------------------------------------------------------

  static async listBusinessAdmins(req, res, next) {
    try {
      const { organizationId } = req.query;
      let sql = `
        SELECT u.id, u.organization_id, u.phone, u.full_name, u.role, u.is_active, u.created_at,
               o.name as organization_name, o.slug as organization_slug
        FROM users u
        LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.role = 'ADMIN'
      `;
      const params = [];

      if (organizationId) {
        sql += " AND u.organization_id = ?";
        params.push(organizationId);
      }

      sql += " ORDER BY u.created_at DESC";

      const admins = await query(sql, params);
      res.json({ success: true, data: admins });
    } catch (error) {
      next(error);
    }
  }

  static async createBusinessAdmin(req, res, next) {
    try {
      const { organizationId, phone, password, fullName } = req.body;

      if (!organizationId || !phone || !password || !fullName) {
        throw new AppError("organizationId, phone, password, and fullName are required", 400);
      }

      const org = await getOne("SELECT id FROM organizations WHERE id = ?", [organizationId]);
      if (!org) {
        throw new AppError("Target organization does not exist", 404);
      }

      const existingUser = await getOne("SELECT id FROM users WHERE phone = ?", [phone]);
      if (existingUser) {
        throw new AppError("A user with this phone number already exists", 409);
      }

      const id = uuid();
      const passHash = await hashPassword(password);
      const now = new Date().toISOString();

      await execute(
        `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
         VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?, ?, ?)`,
        [id, organizationId, phone, passHash, fullName, now, req.user.id, now, req.user.id]
      );

      const created = await getOne(
        "SELECT id, organization_id, phone, full_name, role, is_active FROM users WHERE id = ?",
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Business Admin created successfully",
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBusinessAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const { phone, fullName, organizationId, isActive } = req.body;

      const user = await getOne("SELECT id, role FROM users WHERE id = ?", [id]);
      if (!user || user.role !== "ADMIN") {
        throw new AppError("Business Admin not found", 404);
      }

      if (organizationId) {
        const org = await getOne("SELECT id FROM organizations WHERE id = ?", [organizationId]);
        if (!org) throw new AppError("Target organization does not exist", 404);
      }

      const now = new Date().toISOString();
      await execute(
        `UPDATE users SET
          phone = COALESCE(?, phone),
          full_name = COALESCE(?, full_name),
          organization_id = COALESCE(?, organization_id),
          is_active = COALESCE(?, is_active),
          last_modified_at = ?,
          last_modified_by = ?
         WHERE id = ?`,
        [phone || null, fullName || null, organizationId || null, isActive !== undefined ? (isActive ? 1 : 0) : null, now, req.user.id, id]
      );

      const updated = await getOne(
        "SELECT id, organization_id, phone, full_name, role, is_active FROM users WHERE id = ?",
        [id]
      );

      res.json({ success: true, message: "Business Admin updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async resetBusinessAdminPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.length < 4) {
        throw new AppError("Password must be at least 4 characters", 400);
      }

      const user = await getOne("SELECT id, role FROM users WHERE id = ?", [id]);
      if (!user || user.role !== "ADMIN") {
        throw new AppError("Business Admin not found", 404);
      }

      const passHash = await hashPassword(password);
      const now = new Date().toISOString();

      await execute(
        "UPDATE users SET password_hash = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [passHash, now, req.user.id, id]
      );

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateBusinessAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      await execute(
        "UPDATE users SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [now, req.user.id, id]
      );

      res.json({ success: true, message: "Business Admin deactivated successfully. Login is now blocked." });
    } catch (error) {
      next(error);
    }
  }
static async activateBusinessAdmin(req, res, next) {
  try {
    const { id } = req.params;

    const user = await getOne(
      "SELECT id, role FROM users WHERE id = ?",
      [id]
    );

    if (!user || user.role !== "ADMIN") {
      throw new AppError("Business Admin not found", 404);
    }

    const now = new Date().toISOString();

    await execute(
      `UPDATE users
       SET is_active = 1,
           last_modified_at = ?,
           last_modified_by = ?
       WHERE id = ?`,
      [now, req.user.id, id]
    );

    res.json({
      success: true,
      message: "Business Admin activated successfully. Login is now allowed.",
    });
  } catch (error) {
    next(error);
  }
}
  static async deleteBusinessAdmin(req, res, next) {
    try {
      const { id } = req.params;

      const user = await getOne("SELECT id, role FROM users WHERE id = ?", [id]);
      if (!user || user.role !== "ADMIN") {
        throw new AppError("Business Admin not found", 404);
      }

      await execute("DELETE FROM users WHERE id = ?", [id]);
      res.json({ success: true, message: "Business Admin deleted permanently" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SuperAdminController;
