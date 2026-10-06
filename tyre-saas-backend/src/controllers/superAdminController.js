const { getOne, query, execute, uuid } = require("../config/db");
const { hashPassword } = require("../utils/password");
const { AppError } = require("../middlewares/error");

class SuperAdminController {
  // 1. Global SaaS Dashboard Overview
  static async getPlatformDashboard(req, res, next) {
    try {
      const [orgsCount, shopsCount, adminsCount, employeesCount, enquiriesCount, sizesCount, brandsCount, carsCount, carBrandsCount] = await Promise.all([
        getOne("SELECT COUNT(*) as c FROM organizations WHERE is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM shops WHERE is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM users WHERE role = 'ADMIN' AND is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM users WHERE role = 'EMPLOYEE' AND is_active = 1"),
        getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE is_deleted = 0"),
        getOne("SELECT COUNT(*) as c FROM tyre_sizes"),
        getOne("SELECT COUNT(*) as c FROM tyre_brands"),
        getOne("SELECT COUNT(*) as c FROM car_models"),
        getOne("SELECT COUNT(*) as c FROM car_brands"),
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
            totalTyreSizes: parseInt(sizesCount?.c || 0, 10),
            totalTyreBrands: parseInt(brandsCount?.c || 0, 10),
            totalCars: parseInt(carsCount?.c || 0, 10),
            totalCarBrands: parseInt(carBrandsCount?.c || 0, 10),
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

  // -------------------------------------------------------------
  // Global Master Tyre Sizes Management
  // -------------------------------------------------------------

  static async listTyreSizes(req, res, next) {
    try {
      const { organizationId } = req.query;

      let sql = `
        SELECT ts.id, ts.size, ts.organization_id, ts.is_active, ts.created_at,
               o.name as organization_name, o.slug as organization_slug
        FROM tyre_sizes ts
        LEFT JOIN organizations o ON o.id = ts.organization_id
        WHERE 1 = 1
      `;
      const params = [];

      if (organizationId === "GLOBAL") {
        sql += " AND ts.organization_id IS NULL";
      } else if (organizationId) {
        sql += " AND ts.organization_id = ?";
        params.push(organizationId);
      }

      sql += " ORDER BY ts.size ASC";

      const sizes = await query(sql, params);
      res.json({ success: true, data: sizes });
    } catch (error) {
      next(error);
    }
  }

  static async bulkCreateTyreSizes(req, res, next) {
    try {
      const { rawInput, sizes: inputSizes, organizationId } = req.body;

      let candidateSizes = [];

      if (Array.isArray(inputSizes)) {
        candidateSizes = inputSizes;
      } else if (typeof rawInput === "string" && rawInput.trim()) {
        // Split by lines or commas or semicolons
        const lines = rawInput.split(/[\r\n,;]+/);
        for (const line of lines) {
          // Strip numbering, bullets (e.g. "1. ", "2) ", "- ", "* ")
          let cleaned = line.replace(/^\s*(?:\d+[\.\)\-\:]|[-*•])\s*/i, "").trim();
          // Normalize internal whitespace
          cleaned = cleaned.replace(/\s+/g, " ");
          if (cleaned.length >= 2) {
            candidateSizes.push(cleaned);
          }
        }
      }

      if (!candidateSizes.length) {
        throw new AppError("No valid tyre sizes provided. Please enter at least one tyre size.", 400);
      }

      // Deduplicate case-insensitively
      const uniqueMap = new Map();
      for (const item of candidateSizes) {
        const key = item.toLowerCase().replace(/\s+/g, "");
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());
      const now = new Date().toISOString();
      const targetOrgId = organizationId || null;

      // Fetch existing sizes for this scope
      const existingRows = targetOrgId
        ? await query("SELECT size FROM tyre_sizes WHERE organization_id = ?", [targetOrgId])
        : await query("SELECT size FROM tyre_sizes WHERE organization_id IS NULL");

      const existingSet = new Set(
        existingRows.map((r) => (r.size || "").toLowerCase().replace(/\s+/g, ""))
      );

      const inserted = [];
      const skipped = [];

      for (const sizeText of deduplicated) {
        const key = sizeText.toLowerCase().replace(/\s+/g, "");
        if (existingSet.has(key)) {
          skipped.push(sizeText);
          continue;
        }

        const id = uuid();
        await execute(
          `INSERT INTO tyre_sizes (id, organization_id, size, is_active, created_at, created_by, last_modified_at, last_modified_by)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
          [id, targetOrgId, sizeText, now, req.user.id, now, req.user.id]
        );

        existingSet.add(key);
        inserted.push({ id, size: sizeText, organizationId: targetOrgId });
      }

      res.status(201).json({
        success: true,
        message: `Processed ${deduplicated.length} tyre sizes: ${inserted.length} added successfully, ${skipped.length} already existed.`,
        data: {
          totalProcessed: deduplicated.length,
          insertedCount: inserted.length,
          skippedCount: skipped.length,
          inserted,
          skipped,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleTyreSizeStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const size = await getOne("SELECT id, size, is_active FROM tyre_sizes WHERE id = ?", [id]);
      if (!size) {
        throw new AppError("Tyre size not found", 404);
      }

      const newStatus = isActive !== undefined ? (isActive ? 1 : 0) : (size.is_active ? 0 : 1);
      const now = new Date().toISOString();

      await execute(
        "UPDATE tyre_sizes SET is_active = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [newStatus, now, req.user.id, id]
      );

      res.json({
        success: true,
        message: `Tyre size "${size.size}" is now ${newStatus ? "active" : "inactive"}.`,
        data: { id, isActive: newStatus === 1 },
      });
    } catch (error) {
      next(error);
    }
  }

  static async permanentDeleteTyreSizeIds(sizeIds) {
    if (!Array.isArray(sizeIds) || !sizeIds.length) return;

    for (const sizeId of sizeIds) {
      // 1. Safely unlink from customer_enquiries
      await execute("UPDATE customer_enquiries SET tyre_size_id = NULL WHERE tyre_size_id = ?", [sizeId]);

      // 2. Find all products associated with this size and clean their dependent foreign keys
      const products = await query("SELECT id FROM tyre_products WHERE tyre_size_id = ?", [sizeId]);
      for (const prod of products) {
        // Unlink sale_items (nullable foreign key)
        await execute("UPDATE sale_items SET tyre_product_id = NULL WHERE tyre_product_id = ?", [prod.id]);
        // Remove enquiry tyre options
        await execute("DELETE FROM enquiry_tyre_options WHERE tyre_product_id = ?", [prod.id]);
        // Delete product
        await execute("DELETE FROM tyre_products WHERE id = ?", [prod.id]);
      }

      // Cleanup any remaining products
      await execute("DELETE FROM tyre_products WHERE tyre_size_id = ?", [sizeId]);

      // 3. Permanently delete the tyre size itself
      await execute("DELETE FROM tyre_sizes WHERE id = ?", [sizeId]);
    }
  }

  static async deleteTyreSize(req, res, next) {
    try {
      const { id } = req.params;
      const isForce = req.query.unlinkAndForceDelete === "true" || req.query.force === "true";

      const size = await getOne("SELECT id, size FROM tyre_sizes WHERE id = ?", [id]);
      if (!size) {
        throw new AppError("Tyre size not found", 404);
      }

      // Check if size is in use by enquiries or products
      const [inUseEnquiry, inUseProduct] = await Promise.all([
        getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE tyre_size_id = ?", [id]),
        getOne("SELECT COUNT(*) as c FROM tyre_products WHERE tyre_size_id = ?", [id]),
      ]);

      const enquiryCount = parseInt(inUseEnquiry?.c || 0, 10);
      const productCount = parseInt(inUseProduct?.c || 0, 10);

      const now = new Date().toISOString();

      const targetSizeId = req.query.targetSizeId || req.body?.targetSizeId;
      if (targetSizeId) {
        const target = await getOne("SELECT id, size FROM tyre_sizes WHERE id = ?", [targetSizeId]);
        if (!target) throw new AppError("Target tyre size for reassignment not found", 404);

        await execute("UPDATE customer_enquiries SET tyre_size_id = ? WHERE tyre_size_id = ?", [targetSizeId, id]);
        await SuperAdminController.permanentDeleteTyreSizeIds([id]);

        return res.json({
          success: true,
          action: "reassigned_and_deleted",
          message: `Tyre size "${size.size}" deleted. All ${enquiryCount} enquiry references migrated to "${target.size}".`
        });
      }

      if (isForce) {
        await SuperAdminController.permanentDeleteTyreSizeIds([id]);

        return res.json({
          success: true,
          action: "deleted_forced",
          message: `Tyre size "${size.size}" permanently deleted from database (unlinked from ${enquiryCount} enquiries).`
        });
      }

      if (enquiryCount > 0 || productCount > 0) {
        // Safe soft-deactivation to preserve foreign key integrity
        await execute(
          "UPDATE tyre_sizes SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
          [now, req.user.id, id]
        );

        return res.json({
          success: true,
          action: "deactivated",
          message: `Tyre size "${size.size}" is linked to existing enquiries/products. It has been deactivated (hidden from new selections) to protect your historical records.`
        });
      }

      // Not in use, safe to delete permanently
      await SuperAdminController.permanentDeleteTyreSizeIds([id]);
      res.json({
        success: true,
        action: "deleted",
        message: `Tyre size "${size.size}" deleted permanently.`
      });
    } catch (error) {
      next(error);
    }
  }

  static async cleanupUnusedTyreSizes(req, res, next) {
    try {
      const unused = await query(`
        SELECT ts.id, ts.size
        FROM tyre_sizes ts
        WHERE NOT EXISTS (SELECT 1 FROM customer_enquiries ce WHERE ce.tyre_size_id = ts.id)
          AND NOT EXISTS (SELECT 1 FROM tyre_products tp WHERE tp.tyre_size_id = ts.id)
      `);

      if (!unused.length) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: "No unused tyre sizes found. All catalogue sizes are actively referenced."
        });
      }

      const ids = unused.map(u => u.id);
      await SuperAdminController.permanentDeleteTyreSizeIds(ids);

      res.json({
        success: true,
        deletedCount: ids.length,
        message: `Cleaned up ${ids.length} unused tyre size(s) successfully.`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkActionTyreSizes(req, res, next) {
    try {
      const { ids, action } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        throw new AppError("No tyre sizes selected", 400);
      }

      const now = new Date().toISOString();

      if (action === "force_delete") {
        await SuperAdminController.permanentDeleteTyreSizeIds(ids);
        return res.json({
          success: true,
          action: "force_delete",
          message: `Successfully force-deleted ${ids.length} tyre size(s) permanently.`
        });
      }

      if (action === "deactivate") {
        for (const id of ids) {
          await execute(
            "UPDATE tyre_sizes SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
            [now, req.user.id, id]
          );
        }
        return res.json({
          success: true,
          action: "deactivate",
          message: `Successfully deactivated ${ids.length} tyre size(s).`
        });
      }

      if (action === "activate") {
        for (const id of ids) {
          await execute(
            "UPDATE tyre_sizes SET is_active = 1, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
            [now, req.user.id, id]
          );
        }
        return res.json({
          success: true,
          action: "activate",
          message: `Successfully activated ${ids.length} tyre size(s).`
        });
      }

      throw new AppError("Invalid bulk action. Allowed: force_delete, deactivate, activate", 400);
    } catch (error) {
      next(error);
    }
  }

  static async deleteOrganizationTyreSizes(req, res, next) {
    try {
      const { organizationId } = req.params;

      let orgName = "Global Master (All Orgs)";
      let sizes = [];

      if (!organizationId || organizationId === "global" || organizationId === "GLOBAL" || organizationId === "null") {
        sizes = await query("SELECT id, size FROM tyre_sizes WHERE organization_id IS NULL");
      } else {
        const org = await getOne("SELECT id, name FROM organizations WHERE id = ?", [organizationId]);
        if (!org) {
          throw new AppError("Organization not found", 404);
        }
        orgName = org.name;
        sizes = await query("SELECT id, size FROM tyre_sizes WHERE organization_id = ?", [organizationId]);
      }

      if (!sizes.length) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: `No tyre sizes found for "${orgName}".`
        });
      }

      const sizeIds = sizes.map((s) => s.id);
      await SuperAdminController.permanentDeleteTyreSizeIds(sizeIds);

      res.json({
        success: true,
        deletedCount: sizes.length,
        organizationName: orgName,
        message: `Successfully deleted all ${sizes.length} tyre size(s) for organization "${orgName}".`
      });
    } catch (error) {
      next(error);
    }
  }

  // -------------------------------------------------------------
  // Tyre Brands Master Catalog (Global & Organization-Specific)
  // -------------------------------------------------------------

  static async permanentDeleteTyreBrandIds(brandIds) {
    if (!Array.isArray(brandIds) || !brandIds.length) return;

    for (const brandId of brandIds) {
      // 1. Safely unlink from customer_enquiries
      await execute("UPDATE customer_enquiries SET tyre_brand_id = NULL WHERE tyre_brand_id = ?", [brandId]);

      // 2. Find linked tyre_products
      const products = await query("SELECT id FROM tyre_products WHERE tyre_brand_id = ?", [brandId]);
      for (const prod of products) {
        // Unlink sale_items (nullable foreign key)
        await execute("UPDATE sale_items SET tyre_product_id = NULL WHERE tyre_product_id = ?", [prod.id]);
        // Remove enquiry tyre options
        await execute("DELETE FROM enquiry_tyre_options WHERE tyre_product_id = ?", [prod.id]);
        // Delete tyre product
        await execute("DELETE FROM tyre_products WHERE id = ?", [prod.id]);
      }

      // Cleanup any remaining products for this brand
      await execute("DELETE FROM tyre_products WHERE tyre_brand_id = ?", [brandId]);

      // 3. Delete the tyre brand itself
      await execute("DELETE FROM tyre_brands WHERE id = ?", [brandId]);
    }
  }

  static async listTyreBrands(req, res, next) {
    try {
      const { organizationId, scope } = req.query;

      let sql = `
        SELECT tb.id, tb.organization_id, tb.name, tb.is_active, tb.created_at,
               o.name as organization_name, o.slug as organization_slug
        FROM tyre_brands tb
        LEFT JOIN organizations o ON o.id = tb.organization_id
        WHERE 1 = 1
      `;
      const params = [];

      if (scope === "global") {
        sql += " AND tb.organization_id IS NULL";
      } else if (scope === "org" && organizationId) {
        sql += " AND tb.organization_id = ?";
        params.push(organizationId);
      } else if (organizationId) {
        sql += " AND (tb.organization_id = ? OR tb.organization_id IS NULL)";
        params.push(organizationId);
      }

      sql += " ORDER BY tb.name ASC";

      const rows = await query(sql, params);
      res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
      next(error);
    }
  }

  static async bulkCreateTyreBrands(req, res, next) {
    try {
      const { rawInput, brands: inputBrands, organizationId } = req.body;

      let candidateBrands = [];

      if (Array.isArray(inputBrands)) {
        candidateBrands = inputBrands;
      } else if (typeof rawInput === "string" && rawInput.trim()) {
        const lines = rawInput.split(/[\r\n,;]+/);
        for (const line of lines) {
          let cleaned = line.replace(/^\s*(?:\d+[\.\)\-\:]|[-*•])\s*/i, "").trim();
          cleaned = cleaned.replace(/\s+/g, " ");
          if (cleaned.length >= 2) {
            candidateBrands.push(cleaned);
          }
        }
      }

      if (!candidateBrands.length) {
        throw new AppError("No valid tyre brands provided. Please enter at least one brand name.", 400);
      }

      // Deduplicate case-insensitively
      const uniqueMap = new Map();
      for (const item of candidateBrands) {
        const key = item.toLowerCase().replace(/\s+/g, "");
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());
      const now = new Date().toISOString();
      const targetOrgId = organizationId || null;

      const existingRows = targetOrgId
        ? await query("SELECT name FROM tyre_brands WHERE organization_id = ?", [targetOrgId])
        : await query("SELECT name FROM tyre_brands WHERE organization_id IS NULL");

      const existingSet = new Set(
        existingRows.map((r) => (r.name || "").toLowerCase().replace(/\s+/g, ""))
      );

      const inserted = [];
      const skipped = [];

      for (const brandText of deduplicated) {
        const key = brandText.toLowerCase().replace(/\s+/g, "");
        if (existingSet.has(key)) {
          skipped.push(brandText);
          continue;
        }

        const id = uuid();
        await execute(
          `INSERT INTO tyre_brands (id, organization_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
          [id, targetOrgId, brandText, now, req.user.id, now, req.user.id]
        );

        existingSet.add(key);
        inserted.push({ id, name: brandText, organizationId: targetOrgId });
      }

      res.status(201).json({
        success: true,
        message: `Processed ${deduplicated.length} tyre brands: ${inserted.length} added successfully, ${skipped.length} already existed.`,
        data: {
          totalProcessed: deduplicated.length,
          insertedCount: inserted.length,
          skippedCount: skipped.length,
          inserted,
          skipped,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleTyreBrandStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const brand = await getOne("SELECT id, name, is_active FROM tyre_brands WHERE id = ?", [id]);
      if (!brand) {
        throw new AppError("Tyre brand not found", 404);
      }

      const newStatus = isActive !== undefined ? (isActive ? 1 : 0) : (brand.is_active ? 0 : 1);
      const now = new Date().toISOString();

      await execute(
        "UPDATE tyre_brands SET is_active = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [newStatus, now, req.user.id, id]
      );

      res.json({
        success: true,
        message: `Tyre brand "${brand.name}" is now ${newStatus ? "active" : "inactive"}.`,
        data: { id, isActive: newStatus === 1 },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTyreBrand(req, res, next) {
    try {
      const { id } = req.params;
      const isForce = req.query.unlinkAndForceDelete === "true" || req.query.force === "true";

      const brand = await getOne("SELECT id, name FROM tyre_brands WHERE id = ?", [id]);
      if (!brand) {
        throw new AppError("Tyre brand not found", 404);
      }

      const [inUseEnquiry, inUseProduct] = await Promise.all([
        getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE tyre_brand_id = ?", [id]),
        getOne("SELECT COUNT(*) as c FROM tyre_products WHERE tyre_brand_id = ?", [id]),
      ]);

      const enquiryCount = parseInt(inUseEnquiry?.c || 0, 10);
      const productCount = parseInt(inUseProduct?.c || 0, 10);
      const now = new Date().toISOString();

      const targetBrandId = req.query.targetBrandId || req.body?.targetBrandId;
      if (targetBrandId) {
        const target = await getOne("SELECT id, name FROM tyre_brands WHERE id = ?", [targetBrandId]);
        if (!target) throw new AppError("Target tyre brand for reassignment not found", 404);

        await execute("UPDATE customer_enquiries SET tyre_brand_id = ? WHERE tyre_brand_id = ?", [targetBrandId, id]);
        await SuperAdminController.permanentDeleteTyreBrandIds([id]);

        return res.json({
          success: true,
          action: "reassigned_and_deleted",
          message: `Tyre brand "${brand.name}" deleted. All ${enquiryCount} enquiry references migrated to "${target.name}".`
        });
      }

      if (isForce) {
        await SuperAdminController.permanentDeleteTyreBrandIds([id]);

        return res.json({
          success: true,
          action: "deleted_forced",
          message: `Tyre brand "${brand.name}" permanently deleted from database (unlinked from ${enquiryCount} enquiries).`
        });
      }

      if (enquiryCount > 0 || productCount > 0) {
        await execute(
          "UPDATE tyre_brands SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
          [now, req.user.id, id]
        );

        return res.json({
          success: true,
          action: "deactivated",
          message: `Tyre brand "${brand.name}" is linked to existing enquiries/products. It has been deactivated (hidden from new selections) to protect your historical records.`
        });
      }

      // Not in use, safe to delete permanently
      await SuperAdminController.permanentDeleteTyreBrandIds([id]);
      res.json({
        success: true,
        action: "deleted",
        message: `Tyre brand "${brand.name}" deleted permanently.`
      });
    } catch (error) {
      next(error);
    }
  }

  static async cleanupUnusedTyreBrands(req, res, next) {
    try {
      const unused = await query(`
        SELECT tb.id, tb.name
        FROM tyre_brands tb
        WHERE NOT EXISTS (SELECT 1 FROM customer_enquiries ce WHERE ce.tyre_brand_id = tb.id)
          AND NOT EXISTS (SELECT 1 FROM tyre_products tp WHERE tp.tyre_brand_id = tb.id)
      `);

      if (!unused.length) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: "No unused tyre brands found. All catalogue brands are actively referenced."
        });
      }

      const ids = unused.map(u => u.id);
      await SuperAdminController.permanentDeleteTyreBrandIds(ids);

      res.json({
        success: true,
        deletedCount: ids.length,
        message: `Cleaned up ${ids.length} unused tyre brand(s) successfully.`
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkActionTyreBrands(req, res, next) {
    try {
      const { ids, action } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        throw new AppError("No tyre brands selected", 400);
      }

      const now = new Date().toISOString();

      if (action === "force_delete") {
        await SuperAdminController.permanentDeleteTyreBrandIds(ids);
        return res.json({
          success: true,
          action: "force_delete",
          message: `Successfully force-deleted ${ids.length} tyre brand(s) permanently.`
        });
      }

      if (action === "deactivate") {
        for (const id of ids) {
          await execute(
            "UPDATE tyre_brands SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
            [now, req.user.id, id]
          );
        }
        return res.json({
          success: true,
          action: "deactivate",
          message: `Successfully deactivated ${ids.length} tyre brand(s).`
        });
      }

      if (action === "activate") {
        for (const id of ids) {
          await execute(
            "UPDATE tyre_brands SET is_active = 1, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
            [now, req.user.id, id]
          );
        }
        return res.json({
          success: true,
          action: "activate",
          message: `Successfully activated ${ids.length} tyre brand(s).`
        });
      }

      throw new AppError("Invalid bulk action. Allowed: force_delete, deactivate, activate", 400);
    } catch (error) {
      next(error);
    }
  }

  static async deleteOrganizationTyreBrands(req, res, next) {
    try {
      const { organizationId } = req.params;

      let orgName = "Global Master (All Orgs)";
      let brands = [];

      if (!organizationId || organizationId === "global" || organizationId === "GLOBAL" || organizationId === "null") {
        brands = await query("SELECT id, name FROM tyre_brands WHERE organization_id IS NULL");
      } else {
        const org = await getOne("SELECT id, name FROM organizations WHERE id = ?", [organizationId]);
        if (!org) {
          throw new AppError("Organization not found", 404);
        }
        orgName = org.name;
        brands = await query("SELECT id, name FROM tyre_brands WHERE organization_id = ?", [organizationId]);
      }

      if (!brands.length) {
        return res.json({
          success: true,
          deletedCount: 0,
          message: `No tyre brands found for "${orgName}".`
        });
      }

      const brandIds = brands.map((b) => b.id);
      await SuperAdminController.permanentDeleteTyreBrandIds(brandIds);

      res.json({
        success: true,
        deletedCount: brands.length,
        organizationName: orgName,
        message: `Successfully deleted all ${brands.length} tyre brand(s) for organization "${orgName}".`
      });
    } catch (error) {
      next(error);
    }
  }

  // =============================================================
  // CAR MASTER CATALOG MANAGEMENT (BRANDS & MODELS)
  // =============================================================

  static async listCars(req, res, next) {
    try {
      const { organizationId, scope, brandId, search } = req.query;

      let sql = `
        SELECT
          cm.id,
          cm.organization_id,
          cm.car_brand_id,
          cb.name AS brand_name,
          cm.name,
          cm.is_active,
          cm.created_at,
          cm.last_modified_at,
          o.name as organization_name,
          o.slug as organization_slug
        FROM car_models cm
        JOIN car_brands cb ON cb.id = cm.car_brand_id
        LEFT JOIN organizations o ON o.id = cm.organization_id
        WHERE 1 = 1
      `;
      const params = [];

      if (scope === "global") {
        sql += " AND cm.organization_id IS NULL";
      } else if (scope === "org" && organizationId) {
        sql += " AND cm.organization_id = ?";
        params.push(organizationId);
      } else if (organizationId) {
        sql += " AND (cm.organization_id = ? OR cm.organization_id IS NULL)";
        params.push(organizationId);
      }

      if (brandId) {
        sql += " AND cm.car_brand_id = ?";
        params.push(brandId);
      }

      if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        sql += " AND (cm.name LIKE ? OR cb.name LIKE ?)";
        params.push(s, s);
      }

      sql += " ORDER BY cb.name ASC, cm.name ASC";

      const rows = await query(sql, params);
      res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
      next(error);
    }
  }

  static async listCarBrands(req, res, next) {
    try {
      const { organizationId, scope } = req.query;

      let sql = `
        SELECT
          cb.id,
          cb.organization_id,
          cb.name,
          cb.is_active,
          cb.created_at,
          o.name as organization_name,
          o.slug as organization_slug,
          (SELECT COUNT(*) FROM car_models cm WHERE cm.car_brand_id = cb.id) as models_count
        FROM car_brands cb
        LEFT JOIN organizations o ON o.id = cb.organization_id
        WHERE 1 = 1
      `;
      const params = [];

      if (scope === "global") {
        sql += " AND cb.organization_id IS NULL";
      } else if (scope === "org" && organizationId) {
        sql += " AND cb.organization_id = ?";
        params.push(organizationId);
      } else if (organizationId) {
        sql += " AND (cb.organization_id = ? OR cb.organization_id IS NULL)";
        params.push(organizationId);
      }

      sql += " ORDER BY cb.name ASC";

      const rows = await query(sql, params);
      res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
      next(error);
    }
  }

  static async bulkCreateCars(req, res, next) {
    try {
      const { rawInput, cars: inputCars, organizationId, scope } = req.body;

      let candidatePairs = [];

      if (Array.isArray(inputCars)) {
        for (const item of inputCars) {
          if (item && item.brand && item.model) {
            candidatePairs.push({
              brand: String(item.brand).trim(),
              model: String(item.model).trim(),
            });
          }
        }
      } else if (typeof rawInput === "string" && rawInput.trim()) {
        const lines = rawInput.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Clean list numbering like "1. ", "- "
          const cleaned = trimmed.replace(/^\s*(?:\d+[\.\)\-\:]|[-*•])\s*/i, "").trim();
          if (!cleaned) continue;

          // Split by comma, pipe, tab, or dash
          let parts = cleaned.split(/[,|\t]+/);
          if (parts.length < 2 && cleaned.includes(" - ")) {
            parts = cleaned.split(/\s+-\s+/);
          }

          if (parts.length >= 2) {
            const b = parts[0].trim();
            const m = parts.slice(1).join(" ").trim();
            // Skip header lines like "Brand, Model"
            if (b.toLowerCase() === "brand" && m.toLowerCase() === "model") continue;
            if (b.length >= 1 && m.length >= 1) {
              candidatePairs.push({ brand: b, model: m });
            }
          }
        }
      }

      if (!candidatePairs.length) {
        throw new AppError("No valid car brand and model pairs provided. Format: Brand, Model (e.g. 'Hyundai, Creta').", 400);
      }

      // Determine scope: GLOBAL by default unless a specific organization is requested
      const targetOrgId = (scope === "global" || !organizationId || organizationId === "global") ? null : organizationId;
      const now = new Date().toISOString();

      // Deduplicate candidate pairs case-insensitively
      const uniqueMap = new Map();
      for (const pair of candidatePairs) {
        const key = `${pair.brand.toLowerCase()}:::${pair.model.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, pair);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());

      // Fetch or create brands
      const existingBrands = targetOrgId
        ? await query("SELECT id, name FROM car_brands WHERE organization_id = ?", [targetOrgId])
        : await query("SELECT id, name FROM car_brands WHERE organization_id IS NULL");

      const brandMap = new Map();
      for (const b of existingBrands) {
        brandMap.set(b.name.toLowerCase().trim(), b.id);
      }

      let insertedBrandsCount = 0;
      let insertedModelsCount = 0;
      let skippedModelsCount = 0;
      const inserted = [];

      for (const item of deduplicated) {
        const brandKey = item.brand.toLowerCase().trim();
        let brandId = brandMap.get(brandKey);

        if (!brandId) {
          brandId = uuid();
          await execute(
            `INSERT INTO car_brands (id, organization_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by)
             VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
            [brandId, targetOrgId, item.brand, now, req.user.id, now, req.user.id]
          );
          brandMap.set(brandKey, brandId);
          insertedBrandsCount++;
        }

        // Check if model already exists for this brand and scope
        const existingModel = targetOrgId
          ? await getOne("SELECT id FROM car_models WHERE car_brand_id = ? AND LOWER(name) = LOWER(?) AND organization_id = ?", [brandId, item.model.trim(), targetOrgId])
          : await getOne("SELECT id FROM car_models WHERE car_brand_id = ? AND LOWER(name) = LOWER(?) AND organization_id IS NULL", [brandId, item.model.trim()]);

        if (existingModel) {
          skippedModelsCount++;
          continue;
        }

        const modelId = uuid();
        await execute(
          `INSERT INTO car_models (id, organization_id, car_brand_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [modelId, targetOrgId, brandId, item.model.trim(), now, req.user.id, now, req.user.id]
        );

        insertedModelsCount++;
        inserted.push({ id: modelId, brand: item.brand, model: item.model, organizationId: targetOrgId });
      }

      const scopeText = targetOrgId ? "organization catalog" : "Global Master Catalog";
      res.status(201).json({
        success: true,
        message: `Processed ${deduplicated.length} cars for ${scopeText}: ${insertedModelsCount} models added, ${insertedBrandsCount} new brands created, ${skippedModelsCount} already existed.`,
        data: {
          totalProcessed: deduplicated.length,
          insertedBrandsCount,
          insertedModelsCount,
          skippedModelsCount,
          inserted,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCar(req, res, next) {
    try {
      const { brandName, modelName, brandId: inputBrandId, organizationId, scope } = req.body;

      if (!modelName || !modelName.trim()) {
        throw new AppError("Car model name is required", 400);
      }

      const targetOrgId = (scope === "global" || !organizationId || organizationId === "global") ? null : organizationId;
      const now = new Date().toISOString();

      let brandId = inputBrandId;

      if (!brandId) {
        if (!brandName || !brandName.trim()) {
          throw new AppError("Car brand name or brandId is required", 400);
        }

        const existingBrand = targetOrgId
          ? await getOne("SELECT id FROM car_brands WHERE LOWER(name) = LOWER(?) AND organization_id = ?", [brandName.trim(), targetOrgId])
          : await getOne("SELECT id FROM car_brands WHERE LOWER(name) = LOWER(?) AND organization_id IS NULL", [brandName.trim()]);

        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          brandId = uuid();
          await execute(
            `INSERT INTO car_brands (id, organization_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by)
             VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
            [brandId, targetOrgId, brandName.trim(), now, req.user.id, now, req.user.id]
          );
        }
      }

      const existingModel = targetOrgId
        ? await getOne("SELECT id FROM car_models WHERE car_brand_id = ? AND LOWER(name) = LOWER(?) AND organization_id = ?", [brandId, modelName.trim(), targetOrgId])
        : await getOne("SELECT id FROM car_models WHERE car_brand_id = ? AND LOWER(name) = LOWER(?) AND organization_id IS NULL", [brandId, modelName.trim()]);

      if (existingModel) {
        throw new AppError("Car model already exists for this brand", 409);
      }

      const modelId = uuid();
      await execute(
        `INSERT INTO car_models (id, organization_id, car_brand_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [modelId, targetOrgId, brandId, modelName.trim(), now, req.user.id, now, req.user.id]
      );

      const created = await getOne(
        `SELECT cm.id, cm.name, cm.organization_id, cm.is_active, cm.created_at, cb.name as brand_name
         FROM car_models cm JOIN car_brands cb ON cb.id = cm.car_brand_id WHERE cm.id = ?`,
        [modelId]
      );

      res.status(201).json({
        success: true,
        message: "Car model created successfully",
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleCarStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const val = isActive ? 1 : 0;
      await execute("UPDATE car_models SET is_active = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?", [val, new Date().toISOString(), req.user.id, id]);
      res.json({ success: true, message: `Car model status updated to ${val === 1 ? 'active' : 'inactive'}.` });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCar(req, res, next) {
    try {
      const { id } = req.params;
      const model = await getOne("SELECT name FROM car_models WHERE id = ?", [id]);
      if (!model) throw new AppError("Car model not found", 404);
      await execute("DELETE FROM car_models WHERE id = ?", [id]);
      res.json({ success: true, message: `Car model "${model.name}" deleted successfully.` });
    } catch (error) {
      next(error);
    }
  }

  static async toggleCarBrandStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const val = isActive ? 1 : 0;
      await execute("UPDATE car_brands SET is_active = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?", [val, new Date().toISOString(), req.user.id, id]);
      res.json({ success: true, message: `Car brand status updated to ${val === 1 ? 'active' : 'inactive'}.` });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCarBrand(req, res, next) {
    try {
      const { id } = req.params;
      const brand = await getOne("SELECT name FROM car_brands WHERE id = ?", [id]);
      if (!brand) throw new AppError("Car brand not found", 404);
      await execute("DELETE FROM car_models WHERE car_brand_id = ?", [id]);
      await execute("DELETE FROM car_brands WHERE id = ?", [id]);
      res.json({ success: true, message: `Car brand "${brand.name}" and associated models deleted successfully.` });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SuperAdminController;
