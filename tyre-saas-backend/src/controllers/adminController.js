const { getOne, query, execute, uuid } = require("../config/db");
const { hashPassword } = require("../utils/password");
const { AppError } = require("../middlewares/error");

// Helper to determine the target organization boundary
function getOrgScope(req) {
  if (req.user.role === "SUPER_ADMIN") {
    // Super Admin can view all or specify organizationId in query
    return req.query.organizationId || null;
  }
  return req.user.organizationId;
}

class AdminController {
  // 1. Dashboard: Per-shop counts & grand totals (Scoped to organization)
  static async getDashboard(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      
      let shopSql = "SELECT id, name, code, organization_id FROM shops WHERE is_active = 1";
      const shopParams = [];
      if (orgId) {
        shopSql += " AND organization_id = ?";
        shopParams.push(orgId);
      }

      const shops = await query(shopSql, shopParams);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const perShopMetrics = await Promise.all(
        shops.map(async (shop) => {
          const [totRow, pendRow, compRow, todayRow, overRow] = await Promise.all([
            getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE shop_id = ? AND is_deleted = 0", [shop.id]),
            getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'", [shop.id]),
            getOne("SELECT COUNT(*) as c FROM customer_enquiries WHERE shop_id = ? AND is_deleted = 0 AND status = 'COMPLETED'", [shop.id]),
            getOne(
              `SELECT COUNT(*) as c FROM customer_enquiries
               WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'
               AND follow_up_date >= ? AND follow_up_date <= ?`,
              [shop.id, startOfToday, endOfToday]
            ),
            getOne(
              `SELECT COUNT(*) as c FROM customer_enquiries
               WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'
               AND follow_up_date < ?`,
              [shop.id, startOfToday]
            ),
          ]);

          const total = parseInt(totRow?.c || 0, 10);
          const pending = parseInt(pendRow?.c || 0, 10);
          const completed = parseInt(compRow?.c || 0, 10);
          const dueToday = parseInt(todayRow?.c || 0, 10);
          const overdue = parseInt(overRow?.c || 0, 10);

          return {
            shopId: shop.id,
            shopName: shop.name,
            shopCode: shop.code,
            organizationId: shop.organization_id,
            total,
            pending,
            completed,
            dueToday,
            overdue,
            conversionRate: total > 0 ? ((completed / total) * 100).toFixed(1) + "%" : "0%",
          };
        })
      );

      let grandTotSql = "SELECT COUNT(*) as c FROM customer_enquiries WHERE is_deleted = 0";
      let grandPendSql = "SELECT COUNT(*) as c FROM customer_enquiries WHERE is_deleted = 0 AND status = 'PENDING'";
      let grandCompSql = "SELECT COUNT(*) as c FROM customer_enquiries WHERE is_deleted = 0 AND status = 'COMPLETED'";
      let activeShopsSql = "SELECT COUNT(*) as c FROM shops WHERE is_active = 1";
      let activeUsersSql = "SELECT COUNT(*) as c FROM users WHERE is_active = 1 AND role != 'SUPER_ADMIN'";
      const orgParams = [];

      if (orgId) {
        grandTotSql += " AND organization_id = ?";
        grandPendSql += " AND organization_id = ?";
        grandCompSql += " AND organization_id = ?";
        activeShopsSql += " AND organization_id = ?";
        activeUsersSql += " AND organization_id = ?";
        orgParams.push(orgId);
      }

      const [grandTot, grandPend, grandComp, activeShops, activeUsers] = await Promise.all([
        getOne(grandTotSql, orgParams),
        getOne(grandPendSql, orgParams),
        getOne(grandCompSql, orgParams),
        getOne(activeShopsSql, orgParams),
        getOne(activeUsersSql, orgParams),
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            organizationId: orgId,
            totalEnquiries: parseInt(grandTot?.c || 0, 10),
            pendingEnquiries: parseInt(grandPend?.c || 0, 10),
            completedEnquiries: parseInt(grandComp?.c || 0, 10),
            activeShops: parseInt(activeShops?.c || 0, 10),
            activeUsers: parseInt(activeUsers?.c || 0, 10),
          },
          perShopMetrics,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. All entries view (Multi-Shop, Scoped to organization)
  static async getAllEnquiries(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { shopId, status, assignedToUserId, search, startDate, endDate, page = 1, limit = 25 } = req.query;

      const p = parseInt(page, 10) || 1;
      const l = parseInt(limit, 10) || 25;
      const offset = (p - 1) * l;

      let whereConditions = ["ce.is_deleted = 0"];
      let params = [];

      if (orgId) {
        whereConditions.push("ce.organization_id = ?");
        params.push(orgId);
      }
      if (shopId) {
        whereConditions.push("ce.shop_id = ?");
        params.push(shopId);
      }
      if (status) {
        whereConditions.push("ce.status = ?");
        params.push(status);
      }
      if (assignedToUserId) {
        whereConditions.push("ce.assigned_to_user_id = ?");
        params.push(assignedToUserId);
      }
      if (startDate) {
        whereConditions.push("ce.follow_up_date >= ?");
        params.push(new Date(startDate).toISOString());
      }
      if (endDate) {
        whereConditions.push("ce.follow_up_date <= ?");
        params.push(new Date(endDate).toISOString());
      }
      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        whereConditions.push(`(
          ce.customer_name LIKE ? OR
          ce.customer_phone LIKE ? OR
          ce.tyre_size LIKE ? OR
          ce.tyre_brand LIKE ? OR
          ce.vehicle_model LIKE ? OR
          ce.vehicle_reg LIKE ?
        )`);
        params.push(term, term, term, term, term, term);
      }

      const whereClause = whereConditions.join(" AND ");

      const items = await query(
        `SELECT ce.*, s.name as shop_name, s.code as shop_code,
                u.full_name as assigned_employee_name,
                c.full_name as creator_name
         FROM customer_enquiries ce
         JOIN shops s ON s.id = ce.shop_id
         LEFT JOIN users u ON u.id = ce.assigned_to_user_id
         LEFT JOIN users c ON c.id = ce.created_by
         WHERE ${whereClause}
         ORDER BY ce.follow_up_date ASC
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      const totalRow = await getOne(
        `SELECT COUNT(*) as c FROM customer_enquiries ce WHERE ${whereClause}`,
        params
      );
      const total = parseInt(totalRow?.c || 0, 10);

      res.json({
        success: true,
        data: items,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. Reassign Enquiry (Scoped)
  static async reassignEnquiry(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { assignedToUserId, remarks } = req.body;

      if (!assignedToUserId) {
        throw new AppError("assignedToUserId is required", 400);
      }

      let enquirySql = "SELECT * FROM customer_enquiries WHERE id = ? AND is_deleted = 0";
      const enquiryParams = [id];
      if (orgId) {
        enquirySql += " AND organization_id = ?";
        enquiryParams.push(orgId);
      }

      const enquiry = await getOne(enquirySql, enquiryParams);
      if (!enquiry) {
        throw new AppError("Enquiry not found or access denied", 404);
      }

      let targetSql = "SELECT id, full_name FROM users WHERE id = ? AND is_active = 1";
      const targetParams = [assignedToUserId];
      if (orgId) {
        targetSql += " AND organization_id = ?";
        targetParams.push(orgId);
      }

      const targetUser = await getOne(targetSql, targetParams);
      if (!targetUser) {
        throw new AppError("Target user not found or does not belong to your organization", 400);
      }

      const now = new Date().toISOString();
      await execute(
        `UPDATE customer_enquiries SET assigned_to_user_id = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?`,
        [assignedToUserId, now, req.user.id, id]
      );

      await execute(
        `INSERT INTO enquiry_logs (id, enquiry_id, action, new_value, remarks, created_by_id, created_at)
         VALUES (?, ?, 'REASSIGNED', ?, ?, ?, ?)`,
        [uuid(), id, `Reassigned to: ${targetUser.full_name}`, remarks || "Reassigned by Admin", req.user.id, now]
      );

      res.json({
        success: true,
        message: "Enquiry reassigned successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. Soft Delete Entry (Scoped)
  static async softDeleteEnquiry(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { reason } = req.body;

      let enquirySql = "SELECT id, is_deleted FROM customer_enquiries WHERE id = ?";
      const enquiryParams = [id];
      if (orgId) {
        enquirySql += " AND organization_id = ?";
        enquiryParams.push(orgId);
      }

      const enquiry = await getOne(enquirySql, enquiryParams);
      if (!enquiry || enquiry.is_deleted) {
        throw new AppError("Enquiry not found or already deleted", 404);
      }

      const now = new Date().toISOString();
      await execute(
        `UPDATE customer_enquiries SET is_deleted = 1, last_modified_at = ?, last_modified_by = ? WHERE id = ?`,
        [now, req.user.id, id]
      );

      await execute(
        `INSERT INTO enquiry_logs (id, enquiry_id, action, old_value, new_value, remarks, created_by_id, created_at)
         VALUES (?, ?, 'SOFT_DELETED', 'Active', 'Deleted', ?, ?, ?)`,
        [uuid(), id, reason || "Soft deleted by Admin", req.user.id, now]
      );

      res.json({
        success: true,
        message: "Enquiry successfully soft-deleted",
      });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------
  // Shop Management (Scoped to Organization)
  // ---------------------------------------------------------------

  static async listShops(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const includeInactive = req.query.includeInactive === "true";

      let sql = "SELECT * FROM shops WHERE 1=1";
      const params = [];

      if (orgId) {
        sql += " AND organization_id = ?";
        params.push(orgId);
      }
      if (!includeInactive) {
        sql += " AND is_active = 1";
      }

      sql += " ORDER BY name ASC";

      const shops = await query(sql, params);
      res.json({ success: true, data: shops });
    } catch (error) {
      next(error);
    }
  }

  static async createShop(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      if (!orgId) {
        throw new AppError("Organization ID is required to create a shop", 400);
      }

      const { name, code, address, phone } = req.body;
      if (!name) throw new AppError("Shop name is required", 400);

      const id = uuid();
      const now = new Date().toISOString();

      await execute(
        `INSERT INTO shops (id, organization_id, name, code, address, phone, is_active, created_at, created_by, last_modified_at, last_modified_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [id, orgId, name, code || null, address || null, phone || null, now, req.user.id, now, req.user.id]
      );

      const shop = await getOne("SELECT * FROM shops WHERE id = ?", [id]);
      res.status(201).json({ success: true, message: "Shop created successfully", data: shop });
    } catch (error) {
      next(error);
    }
  }

  static async updateShop(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { name, code, address, phone, isActive } = req.body;

      let checkSql = "SELECT id FROM shops WHERE id = ?";
      const checkParams = [id];
      if (orgId) {
        checkSql += " AND organization_id = ?";
        checkParams.push(orgId);
      }

      const shop = await getOne(checkSql, checkParams);
      if (!shop) throw new AppError("Shop not found in your organization", 404);

      const now = new Date().toISOString();
      await execute(
        `UPDATE shops SET
          name = COALESCE(?, name),
          code = COALESCE(?, code),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          is_active = COALESCE(?, is_active),
          last_modified_at = ?,
          last_modified_by = ?
         WHERE id = ?`,
        [name || null, code || null, address || null, phone || null, isActive !== undefined ? (isActive ? 1 : 0) : null, now, req.user.id, id]
      );

      const updated = await getOne("SELECT * FROM shops WHERE id = ?", [id]);
      res.json({ success: true, message: "Shop updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateShop(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const now = new Date().toISOString();

      let checkSql = "SELECT id FROM shops WHERE id = ?";
      const checkParams = [id];
      if (orgId) {
        checkSql += " AND organization_id = ?";
        checkParams.push(orgId);
      }

      const shop = await getOne(checkSql, checkParams);
      if (!shop) throw new AppError("Shop not found in your organization", 404);

      await execute(
        "UPDATE shops SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [now, req.user.id, id]
      );

      res.json({ success: true, message: "Shop deactivated successfully" });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------
  // User Management (Scoped to Organization)
  // ---------------------------------------------------------------

  static async listUsers(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const includeInactive = req.query.includeInactive === "true";

      let sql = "SELECT id, organization_id, phone, full_name, role, is_active, created_at, last_modified_at FROM users WHERE role != 'SUPER_ADMIN'";
      const params = [];

      if (orgId) {
        sql += " AND organization_id = ?";
        params.push(orgId);
      }
      if (!includeInactive) {
        sql += " AND is_active = 1";
      }

      sql += " ORDER BY full_name ASC";

      const users = await query(sql, params);

      // Attach shops for each user
      for (const u of users) {
        const shops = await query(
          `SELECT s.id, s.name, s.code FROM shops s
           JOIN user_shops us ON us.shop_id = s.id
           WHERE us.user_id = ? AND s.is_active = 1`,
          [u.id]
        );
        u.shops = shops;
      }

      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      if (!orgId) {
        throw new AppError("Organization ID is required to create a user", 400);
      }

      const { phone, password, fullName, role = "EMPLOYEE", shopIds = [] } = req.body;
      if (!phone || !password || !fullName) {
        throw new AppError("Phone, password, and fullName are required", 400);
      }

      // Security: Business Admin cannot create Super Admin
      if (role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
        throw new AppError("Cannot assign SUPER_ADMIN role", 403);
      }

      const existing = await getOne("SELECT id FROM users WHERE phone = ?", [phone]);
      if (existing) {
        throw new AppError("A user with this phone number already exists", 409);
      }

      const id = uuid();
      const passHash = await hashPassword(password);
      const now = new Date().toISOString();

      await execute(
        `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [id, orgId, phone, passHash, fullName, role, now, req.user.id, now, req.user.id]
      );

      if (Array.isArray(shopIds) && shopIds.length > 0) {
        for (const sId of shopIds) {
          // Verify shop belongs to organization
          const validShop = await getOne("SELECT id FROM shops WHERE id = ? AND organization_id = ?", [sId, orgId]);
          if (validShop) {
            await execute(
              "INSERT INTO user_shops (id, user_id, shop_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?)",
              [uuid(), id, sId, now, req.user.id]
            );
          }
        }
      }

      const created = await getOne(
        "SELECT id, organization_id, phone, full_name, role, is_active FROM users WHERE id = ?",
        [id]
      );

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { phone, fullName, role, isActive, shopIds } = req.body;

      let checkSql = "SELECT id, role FROM users WHERE id = ?";
      const checkParams = [id];
      if (orgId) {
        checkSql += " AND organization_id = ?";
        checkParams.push(orgId);
      }

      const user = await getOne(checkSql, checkParams);
      if (!user) throw new AppError("User not found in your organization", 404);

      if (role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
        throw new AppError("Unauthorized role escalation", 403);
      }

      const now = new Date().toISOString();
      await execute(
        `UPDATE users SET
          phone = COALESCE(?, phone),
          full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          is_active = COALESCE(?, is_active),
          last_modified_at = ?,
          last_modified_by = ?
         WHERE id = ?`,
        [phone || null, fullName || null, role || null, isActive !== undefined ? (isActive ? 1 : 0) : null, now, req.user.id, id]
      );

      if (Array.isArray(shopIds)) {
        await execute("DELETE FROM user_shops WHERE user_id = ?", [id]);
        for (const sId of shopIds) {
          const validShop = orgId
            ? await getOne("SELECT id FROM shops WHERE id = ? AND organization_id = ?", [sId, orgId])
            : await getOne("SELECT id FROM shops WHERE id = ?", [sId]);

          if (validShop) {
            await execute(
              "INSERT INTO user_shops (id, user_id, shop_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?)",
              [uuid(), id, sId, now, req.user.id]
            );
          }
        }
      }

      const updated = await getOne(
        "SELECT id, organization_id, phone, full_name, role, is_active FROM users WHERE id = ?",
        [id]
      );

      res.json({ success: true, message: "User updated successfully", data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { password } = req.body;
      if (!password || password.length < 4) {
        throw new AppError("Password must be at least 4 characters", 400);
      }

      let checkSql = "SELECT id FROM users WHERE id = ?";
      const checkParams = [id];
      if (orgId) {
        checkSql += " AND organization_id = ?";
        checkParams.push(orgId);
      }

      const user = await getOne(checkSql, checkParams);
      if (!user) throw new AppError("User not found in your organization", 404);

      const passHash = await hashPassword(password);
      const now = new Date().toISOString();

      await execute(
        "UPDATE users SET password_hash = ?, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [passHash, now, req.user.id, id]
      );

      res.json({ success: true, message: "User password reset successfully" });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateUser(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const now = new Date().toISOString();

      let checkSql = "SELECT id FROM users WHERE id = ?";
      const checkParams = [id];
      if (orgId) {
        checkSql += " AND organization_id = ?";
        checkParams.push(orgId);
      }

      const user = await getOne(checkSql, checkParams);
      if (!user) throw new AppError("User not found in your organization", 404);

      await execute(
        "UPDATE users SET is_active = 0, last_modified_at = ?, last_modified_by = ? WHERE id = ?",
        [now, req.user.id, id]
      );

      res.json({ success: true, message: "User deactivated successfully. Login is now blocked." });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------
  // CSV Export for Admin (Scoped to Organization)
  // ---------------------------------------------------------------

  static async exportCsv(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { shopId, status } = req.query;

      let sql = `
        SELECT ce.*, s.name as shop_name, u.full_name as assigned_employee_name
        FROM customer_enquiries ce
        JOIN shops s ON s.id = ce.shop_id
        LEFT JOIN users u ON u.id = ce.assigned_to_user_id
        WHERE ce.is_deleted = 0
      `;
      const params = [];

      if (orgId) {
        sql += " AND ce.organization_id = ?";
        params.push(orgId);
      }
      if (shopId) {
        sql += " AND ce.shop_id = ?";
        params.push(shopId);
      }
      if (status) {
        sql += " AND ce.status = ?";
        params.push(status);
      }

      sql += " ORDER BY ce.follow_up_date ASC";

      const rows = await query(sql, params);

      const headers = [
        "ID",
        "Shop Name",
        "Customer Name",
        "Customer Phone",
        "Vehicle Model",
        "Vehicle Reg",
        "Tyre Size",
        "Tyre Brand",
        "Quantity",
        "Estimated Budget",
        "Status",
        "Follow-up Date",
        "Assigned To",
        "Remarks",
        "Created At",
      ];

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return "";
        const text = String(val).replace(/"/g, '""');
        return `"${text}"`;
      };

      const formatDateStr = (val) => {
        if (!val) return "";
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        return String(val).slice(0, 10);
      };

      const formatDateTimeStr = (val) => {
        if (!val) return "";
        if (val instanceof Date) return val.toISOString();
        return String(val);
      };

      const csvLines = rows.map((r) => [
        escapeCsv(r.id),
        escapeCsv(r.shop_name),
        escapeCsv(r.customer_name),
        escapeCsv(r.customer_phone),
        escapeCsv(r.vehicle_model),
        escapeCsv(r.vehicle_reg),
        escapeCsv(r.tyre_size),
        escapeCsv(r.tyre_brand),
        r.quantity,
        r.estimated_budget || "",
        escapeCsv(r.status),
        escapeCsv(formatDateStr(r.follow_up_date)),
        escapeCsv(r.assigned_employee_name || "Unassigned"),
        escapeCsv(r.remarks),
        escapeCsv(formatDateTimeStr(r.created_at)),
      ]);

      const csvContent = [headers.join(","), ...csvLines.map((l) => l.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tyre_enquiries_${new Date().toISOString().slice(0, 10)}.csv"`
      );
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
