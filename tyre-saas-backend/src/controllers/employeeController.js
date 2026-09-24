const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

async function verifyShopAccess(userId, userRole, userOrgId, shopId) {
  const shop = await getOne("SELECT id, organization_id, name FROM shops WHERE id = ? AND is_active = 1", [shopId]);
  if (!shop) {
    throw new AppError("Shop not found or inactive", 404);
  }
  if (userRole !== "SUPER_ADMIN" && shop.organization_id !== userOrgId) {
    throw new AppError("Access denied: Shop belongs to another organization", 403);
  }
  if (userRole === "EMPLOYEE") {
    const isAssigned = await getOne("SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?", [userId, shopId]);
    if (!isAssigned) {
      throw new AppError("Access denied: You are not assigned to this shop", 403);
    }
  }
  return shop;
}

class EmployeeController {
  // 1. Get shops assigned to logged-in employee
  static async getShops(req, res, next) {
    try {
      let shops = [];
      if (req.user.role === "SUPER_ADMIN") {
        shops = await query("SELECT id, organization_id, name, code, address, phone FROM shops WHERE is_active = 1 ORDER BY name ASC");
      } else if (req.user.role === "ADMIN") {
        shops = await query(
          "SELECT id, organization_id, name, code, address, phone FROM shops WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC",
          [req.user.organizationId]
        );
      } else {
        shops = await query(
          `SELECT s.id, s.organization_id, s.name, s.code, s.address, s.phone
           FROM shops s
           INNER JOIN user_shops us ON us.shop_id = s.id
           WHERE us.user_id = ? AND s.is_active = 1
           ORDER BY s.name ASC`,
          [req.user.id]
        );
      }

      res.json({
        success: true,
        data: shops,
      });
    } catch (error) {
      next(error);
    }
  }

  // 2. Banner metrics for active shop (Due Today, Due Tomorrow, Overdue)
  static async getBannerSummary(req, res, next) {
    try {
      const { shopId } = req.query;
      if (!shopId) {
        throw new AppError("shopId query parameter is required", 400);
      }

      const shop = await verifyShopAccess(req.user.id, req.user.role, req.user.organizationId, shopId);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString();
      const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999).toISOString();

      const [dueTodayRow, dueTomorrowRow, overdueRow, pendingRow, completedRow] = await Promise.all([
        getOne(
          `SELECT COUNT(*) as c FROM customer_enquiries
           WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'
           AND follow_up_date >= ? AND follow_up_date <= ?`,
          [shopId, startOfToday, endOfToday]
        ),
        getOne(
          `SELECT COUNT(*) as c FROM customer_enquiries
           WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'
           AND follow_up_date >= ? AND follow_up_date <= ?`,
          [shopId, startOfTomorrow, endOfTomorrow]
        ),
        getOne(
          `SELECT COUNT(*) as c FROM customer_enquiries
           WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'
           AND follow_up_date < ?`,
          [shopId, startOfToday]
        ),
        getOne(
          `SELECT COUNT(*) as c FROM customer_enquiries
           WHERE shop_id = ? AND is_deleted = 0 AND status = 'PENDING'`,
          [shopId]
        ),
        getOne(
          `SELECT COUNT(*) as c FROM customer_enquiries
           WHERE shop_id = ? AND is_deleted = 0 AND status = 'COMPLETED'`,
          [shopId]
        ),
      ]);

      const dueToday = parseInt(dueTodayRow?.c || 0, 10);
      const dueTomorrow = parseInt(dueTomorrowRow?.c || 0, 10);
      const overdue = parseInt(overdueRow?.c || 0, 10);
      const pendingTotal = parseInt(pendingRow?.c || 0, 10);
      const completedTotal = parseInt(completedRow?.c || 0, 10);

      res.json({
        success: true,
        data: {
          shopId,
          shopName: shop.name,
          dueToday,
          dueTomorrow,
          overdue,
          pendingTotal,
          completedTotal,
          hasBannerAlert: dueToday > 0 || dueTomorrow > 0 || overdue > 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 3. Check duplicate phone before save
  static async checkDuplicatePhone(req, res, next) {
    try {
      const { phone, shopId, scope = "shop" } = req.query;
      if (!phone) {
        throw new AppError("phone query parameter is required", 400);
      }

      if (shopId) {
        await verifyShopAccess(req.user.id, req.user.role, req.user.organizationId, shopId);
      }

      let sql = `
        SELECT ce.id, ce.customer_name, ce.customer_phone, ce.vehicle_model,
               ce.tyre_size, ce.status, ce.follow_up_date, ce.created_at,
               s.id as shop_id, s.name as shop_name
        FROM customer_enquiries ce
        JOIN shops s ON s.id = ce.shop_id
        WHERE ce.customer_phone = ? AND ce.is_deleted = 0
      `;
      const params = [phone];

      if (req.user.role !== "SUPER_ADMIN") {
        sql += " AND ce.organization_id = ?";
        params.push(req.user.organizationId);
      }

      if (scope === "shop" && shopId) {
        sql += " AND ce.shop_id = ?";
        params.push(shopId);
      }

      sql += " ORDER BY ce.created_at DESC LIMIT 5";

      const matches = await query(sql, params);

      res.json({
        success: true,
        data: {
          isDuplicate: matches.length > 0,
          count: matches.length,
          matches,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // 4. Tab 1: Add Customer Enquiry
  // RULE: shop_id is set at entry creation and never changes.
  static async createEnquiry(req, res, next) {
  try {
    const {
      shopId,
      customerName,
      customerPhone,
      vehicleModel,
      vehicleReg,
      tyreSize,
      tyreBrand,
      quantity = 4,
      estimatedBudget,
      followUpDate,
      remarks,
      fitStatus,
      leadSource,
    } = req.body;

    if (!shopId || !customerName || !customerPhone || !followUpDate) {
      throw new AppError(
        "shopId, customerName, customerPhone, and followUpDate are required",
        400
      );
    }

    const validFitStatuses = ["FIT", "NOT_FIT"];
    const validLeadSources = ["MOBILE", "INSTAGRAM", "OFFLINE"];

    if (fitStatus && !validFitStatuses.includes(fitStatus)) {
      throw new AppError(
        "Invalid fitStatus. Must be FIT or NOT_FIT",
        400
      );
    }

    if (leadSource && !validLeadSources.includes(leadSource)) {
      throw new AppError(
        "Invalid leadSource. Must be MOBILE, INSTAGRAM, or OFFLINE",
        400
      );
    }

    const shop = await verifyShopAccess(
      req.user.id,
      req.user.role,
      req.user.organizationId,
      shopId
    );

    const id = uuid();
    const now = new Date().toISOString();
    const followUpIso = new Date(followUpDate).toISOString();

    await execute(
      `INSERT INTO customer_enquiries (
        id,
        organization_id,
        shop_id,
        customer_name,
        customer_phone,
        vehicle_model,
        vehicle_reg,
        tyre_size,
        tyre_brand,
        quantity,
        estimated_budget,
        follow_up_date,
        status,
        remarks,
        assigned_to_user_id,
        fit_status,
        lead_source,
        is_deleted,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        id,
        shop.organization_id,
        shopId,
        customerName,
        customerPhone,
        vehicleModel || null,
        vehicleReg || null,
        tyreSize || null,
        tyreBrand || null,
        quantity,
        estimatedBudget || null,
        followUpIso,
        remarks || null,
        req.user.id,
        fitStatus || null,
        leadSource || null,
        now,
        req.user.id,
        now,
        req.user.id,
      ]
    );

    // Create activity log
    await execute(
      `INSERT INTO enquiry_logs (
        id,
        enquiry_id,
        action,
        new_value,
        remarks,
        created_by_id,
        created_at
      )
      VALUES (?, ?, 'CREATED', ?, ?, ?, ?)`,
      [
        uuid(),
        id,
        `Created enquiry for ${customerName}`,
        remarks || "Initial entry",
        req.user.id,
        now,
      ]
    );

    const created = await getOne(
      "SELECT * FROM customer_enquiries WHERE id = ?",
      [id]
    );

    res.status(201).json({
      success: true,
      message: "Customer enquiry created successfully",
      data: created,
    });
  } catch (error) {
    next(error);
  }
}

  // 5. Tab 2: Pending Follow-ups list
  static async getPending(req, res, next) {
    try {
      const { shopId, page = 1, limit = 20 } = req.query;
      if (!shopId) {
        throw new AppError("shopId query parameter is required", 400);
      }

      await verifyShopAccess(req.user.id, req.user.role, req.user.organizationId, shopId);

      const p = parseInt(page, 10) || 1;
      const l = parseInt(limit, 10) || 20;
      const offset = (p - 1) * l;

      const items = await query(
        `SELECT ce.*, u.full_name as assigned_employee_name
         FROM customer_enquiries ce
         LEFT JOIN users u ON u.id = ce.assigned_to_user_id
         WHERE ce.shop_id = ? AND ce.status = 'PENDING' AND ce.is_deleted = 0
         ORDER BY ce.follow_up_date ASC
         LIMIT ? OFFSET ?`,
        [shopId, l, offset]
      );

      const totalRow = await getOne(
        `SELECT COUNT(*) as c FROM customer_enquiries
         WHERE shop_id = ? AND status = 'PENDING' AND is_deleted = 0`,
        [shopId]
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

  // 6. Tab 3: Completed Follow-ups list
  static async getCompleted(req, res, next) {
    try {
      const { shopId, page = 1, limit = 20 } = req.query;
      if (!shopId) {
        throw new AppError("shopId query parameter is required", 400);
      }

      await verifyShopAccess(req.user.id, req.user.role, req.user.organizationId, shopId);

      const p = parseInt(page, 10) || 1;
      const l = parseInt(limit, 10) || 20;
      const offset = (p - 1) * l;

      const items = await query(
        `SELECT ce.*, u.full_name as assigned_employee_name
         FROM customer_enquiries ce
         LEFT JOIN users u ON u.id = ce.assigned_to_user_id
         WHERE ce.shop_id = ? AND ce.status = 'COMPLETED' AND ce.is_deleted = 0
         ORDER BY ce.last_modified_at DESC
         LIMIT ? OFFSET ?`,
        [shopId, l, offset]
      );

      const totalRow = await getOne(
        `SELECT COUNT(*) as c FROM customer_enquiries
         WHERE shop_id = ? AND status = 'COMPLETED' AND is_deleted = 0`,
        [shopId]
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

  // 7. Tab 4: Customer Search
  static async search(req, res, next) {
    try {
      const { shopId, query: searchTerm = "", limit = 30 } = req.query;
      if (!shopId) {
        throw new AppError("shopId query parameter is required", 400);
      }

      await verifyShopAccess(req.user.id, req.user.role, req.user.organizationId, shopId);

      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.json({ success: true, data: [] });
      }

      const term = `%${searchTerm.trim()}%`;
      const l = parseInt(limit, 10) || 30;

      const items = await query(
        `SELECT ce.*, u.full_name as assigned_employee_name
         FROM customer_enquiries ce
         LEFT JOIN users u ON u.id = ce.assigned_to_user_id
         WHERE ce.shop_id = ? AND ce.is_deleted = 0 AND (
           ce.customer_name LIKE ? OR
           ce.customer_phone LIKE ? OR
           ce.tyre_size LIKE ? OR
           ce.tyre_brand LIKE ? OR
           ce.vehicle_model LIKE ? OR
           ce.vehicle_reg LIKE ?
         )
         ORDER BY ce.last_modified_at DESC
         LIMIT ?`,
        [shopId, term, term, term, term, term, term, l]
      );

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  // 8. Follow-up Detail
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const { shopId } = req.query;

      const enquiry = await getOne(
        `SELECT ce.*, s.name as shop_name, s.code as shop_code,
                u.full_name as assigned_employee_name,
                c.full_name as creator_name
         FROM customer_enquiries ce
         JOIN shops s ON s.id = ce.shop_id
         LEFT JOIN users u ON u.id = ce.assigned_to_user_id
         LEFT JOIN users c ON c.id = ce.created_by
         WHERE ce.id = ?`,
        [id]
      );

      if (!enquiry || enquiry.is_deleted) {
        throw new AppError("Follow-up enquiry not found", 404);
      }

      // Organization boundary check
      if (req.user.role !== "SUPER_ADMIN" && enquiry.organization_id !== req.user.organizationId) {
        throw new AppError("Follow-up enquiry not found", 404);
      }

      // Employee shop assignment check
      if (req.user.role === "EMPLOYEE") {
        const isAssigned = await getOne("SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?", [req.user.id, enquiry.shop_id]);
        if (!isAssigned) {
          throw new AppError("Access denied: You are not assigned to this shop", 403);
        }
      }

      if (shopId && enquiry.shop_id !== shopId) {
        throw new AppError("Enquiry does not belong to this shop", 403);
      }

      // Fetch activity logs
      const activityLogs = await query(
        `SELECT el.*, u.full_name as created_by_name
         FROM enquiry_logs el
         LEFT JOIN users u ON u.id = el.created_by_id
         WHERE el.enquiry_id = ?
         ORDER BY el.created_at DESC`,
        [id]
      );

      enquiry.activityLogs = activityLogs;

      res.json({
        success: true,
        data: enquiry,
      });
    } catch (error) {
      next(error);
    }
  }

  // 9. Follow-up Action: update status / reschedule / remarks
  static async updateEnquiry(req, res, next) {
    try {
      const { id } = req.params;
      const { status, followUpDate, remarks, customerName, vehicleModel, tyreSize, tyreBrand, quantity } = req.body;

      const validStatuses = ["PENDING", "COMPLETED", "CANCELLED", "LOST"];
      if (status && !validStatuses.includes(status)) {
        throw new AppError(`Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`, 400);
      }

      const existing = await getOne("SELECT * FROM customer_enquiries WHERE id = ?", [id]);
      if (!existing || existing.is_deleted) {
        throw new AppError("Enquiry not found", 404);
      }

      if (req.user.role !== "SUPER_ADMIN" && existing.organization_id !== req.user.organizationId) {
        throw new AppError("Enquiry not found", 404);
      }

      const shop = await getOne("SELECT is_active FROM shops WHERE id = ?", [existing.shop_id]);
      if (shop && !shop.is_active) {
        throw new AppError("Cannot modify enquiry for a deactivated shop", 400);
      }

      if (req.user.role === "EMPLOYEE") {
        const isAssigned = await getOne("SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?", [req.user.id, existing.shop_id]);
        if (!isAssigned) {
          throw new AppError("Access denied: You are not assigned to this shop", 403);
        }
      }

      const now = new Date().toISOString();
      const logs = [];

      let newStatus = existing.status;
      if (status && status !== existing.status) {
        newStatus = status;
        logs.push({ action: "STATUS_CHANGE", oldVal: existing.status, newVal: status });
      }

      let newDate = existing.follow_up_date;
      if (followUpDate) {
        const parsedDate = new Date(followUpDate).toISOString();
        if (parsedDate !== existing.follow_up_date) {
          newDate = parsedDate;
          logs.push({ action: "RESCHEDULE", oldVal: existing.follow_up_date, newVal: parsedDate });
        }
      }

      let newRemarks = existing.remarks;
      if (remarks !== undefined) {
        newRemarks = remarks;
        logs.push({ action: "NOTE_UPDATED", oldVal: existing.remarks, newVal: remarks, remarks });
      }

      await execute(
        `UPDATE customer_enquiries SET
          status = ?,
          follow_up_date = ?,
          remarks = ?,
          customer_name = COALESCE(?, customer_name),
          vehicle_model = COALESCE(?, vehicle_model),
          tyre_size = COALESCE(?, tyre_size),
          tyre_brand = COALESCE(?, tyre_brand),
          quantity = COALESCE(?, quantity),
          last_modified_at = ?,
          last_modified_by = ?
         WHERE id = ?`,
        [
          newStatus,
          newDate,
          newRemarks,
          customerName || null,
          vehicleModel || null,
          tyreSize || null,
          tyreBrand || null,
          quantity || null,
          now,
          req.user.id,
          id,
        ]
      );

      for (const log of logs) {
        await execute(
          `INSERT INTO enquiry_logs (id, enquiry_id, action, old_value, new_value, remarks, created_by_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuid(), id, log.action, log.oldVal || null, log.newVal || null, log.remarks || null, req.user.id, now]
        );
      }

      const updated = await getOne("SELECT * FROM customer_enquiries WHERE id = ?", [id]);

      res.json({
        success: true,
        message: "Enquiry updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EmployeeController;
