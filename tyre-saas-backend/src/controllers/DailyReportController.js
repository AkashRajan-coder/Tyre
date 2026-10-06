
const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

function validateQuantity(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new AppError(
      `${fieldName} must be a non-negative whole number`,
      400
    );
  }

  return number;
}

function validateAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(
      "amount must be 0 or greater",
      400
    );
  }

  return amount;
}

/**
 * Resolves shop from:
 * 1. Explicit shopId in body or query (checking tenant organization & employee assignment)
 * 2. Assigned shop from user_shops table
 * 3. Fallback to primary active shop in user's organization (for Admin or unassigned staff)
 */
async function resolveShop(req) {
  const userId = req.user.id;
  const userRole = req.user.role;
  const organizationId = req.user.organizationId;

  const explicitShopId =
    req.body?.shopId ||
    req.body?.shop_id ||
    req.query?.shopId ||
    req.query?.shop_id;

  if (explicitShopId) {
    const shop = await getOne(
      "SELECT id, name, organization_id FROM shops WHERE id = ? AND is_active = 1",
      [explicitShopId]
    );

    if (!shop) {
      throw new AppError("Shop not found or inactive", 404);
    }

    if (userRole !== "SUPER_ADMIN" && shop.organization_id !== organizationId) {
      throw new AppError("Access denied: Shop belongs to another organization", 403);
    }

    if (userRole === "EMPLOYEE") {
      const assignedCount = await getOne(
        "SELECT COUNT(*) as count FROM user_shops WHERE user_id = ?",
        [userId]
      );
      const hasAssignments = Number(assignedCount?.count || 0) > 0;

      if (hasAssignments) {
        const isAssigned = await getOne(
          "SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?",
          [userId, explicitShopId]
        );
        if (!isAssigned) {
          throw new AppError("Access denied: You are not assigned to this shop", 403);
        }
      }
    }

    return shop;
  }

  // Fallback 1: user_shops table
  let shop = await getOne(
    `
    SELECT
      s.id,
      s.name,
      s.organization_id
    FROM user_shops us
    INNER JOIN shops s
      ON s.id = us.shop_id
    WHERE us.user_id = ?
      AND (s.organization_id = ? OR ? IS NULL)
      AND s.is_active = 1
    ORDER BY s.created_at ASC
    LIMIT 1
    `,
    [userId, organizationId, organizationId]
  );

  // Fallback 2: first active shop in organization (e.g. for ADMIN or unassigned staff)
  if (!shop && organizationId) {
    shop = await getOne(
      `
      SELECT
        s.id,
        s.name,
        s.organization_id
      FROM shops s
      WHERE s.organization_id = ?
        AND s.is_active = 1
      ORDER BY s.created_at ASC
      LIMIT 1
      `,
      [organizationId]
    );
  }

  if (!shop) {
    throw new AppError(
      "No active shop found for this organization. Please specify a shopId.",
      404
    );
  }

  return shop;
}

function resolveReportDate(bodyDate) {
  if (bodyDate) {
    if (typeof bodyDate === "string") {
      return bodyDate.split("T")[0];
    }
    if (bodyDate instanceof Date) {
      return bodyDate.toISOString().split("T")[0];
    }
  }
  return new Date().toISOString().split("T")[0];
}

function extractReportPayload(body) {
  const {
    amount,
    totalAmount,
    tyre = {},
    twoWheelerEnquiry = {},
    twoWheelerAlignment = {},
    wheelAlignment = {},
    commercialTyre = {},
    roWater = {},
    above17Inch = {},
  } = body || {};

  const rawAmount = amount !== undefined ? amount : (totalAmount !== undefined ? totalAmount : 0);
  const reportAmount = validateAmount(rawAmount);

  const tyreCustomer = validateQuantity(
    tyre.customer ?? body.tyreCustomerQuantity ?? body.tyre_customer_quantity ?? 0,
    "tyre.customer"
  );
  const tyreMechanic = validateQuantity(
    tyre.mechanic ?? body.tyreMechanicQuantity ?? body.tyre_mechanic_quantity ?? 0,
    "tyre.mechanic"
  );

  const twoWheelerEnquiryCustomer = validateQuantity(
    twoWheelerEnquiry.customer ?? body.twoWheelerEnquiryCustomerQuantity ?? body.two_wheeler_enquiry_customer_quantity ?? 0,
    "twoWheelerEnquiry.customer"
  );
  const twoWheelerEnquiryMechanic = validateQuantity(
    twoWheelerEnquiry.mechanic ?? body.twoWheelerEnquiryMechanicQuantity ?? body.two_wheeler_enquiry_mechanic_quantity ?? 0,
    "twoWheelerEnquiry.mechanic"
  );

  const twoWheelerAlignmentCustomer = validateQuantity(
    twoWheelerAlignment.customer ?? body.twoWheelerAlignmentCustomerQuantity ?? body.two_wheeler_alignment_customer_quantity ?? 0,
    "twoWheelerAlignment.customer"
  );
  const twoWheelerAlignmentMechanic = validateQuantity(
    twoWheelerAlignment.mechanic ?? body.twoWheelerAlignmentMechanicQuantity ?? body.two_wheeler_alignment_mechanic_quantity ?? 0,
    "twoWheelerAlignment.mechanic"
  );

  const wheelAlignmentCustomer = validateQuantity(
    wheelAlignment.customer ?? body.wheelAlignmentCustomerQuantity ?? body.wheel_alignment_customer_quantity ?? 0,
    "wheelAlignment.customer"
  );
  const wheelAlignmentMechanic = validateQuantity(
    wheelAlignment.mechanic ?? body.wheelAlignmentMechanicQuantity ?? body.wheel_alignment_mechanic_quantity ?? 0,
    "wheelAlignment.mechanic"
  );

  const commercialTyreCustomer = validateQuantity(
    commercialTyre.customer ?? body.commercialTyreCustomerQuantity ?? body.commercial_tyre_customer_quantity ?? 0,
    "commercialTyre.customer"
  );
  const commercialTyreMechanic = validateQuantity(
    commercialTyre.mechanic ?? body.commercialTyreMechanicQuantity ?? body.commercial_tyre_mechanic_quantity ?? 0,
    "commercialTyre.mechanic"
  );

  const roWaterCustomer = validateQuantity(
    roWater.customer ?? body.roWaterCustomerQuantity ?? body.ro_water_customer_quantity ?? 0,
    "roWater.customer"
  );
  const roWaterMechanic = validateQuantity(
    roWater.mechanic ?? body.roWaterMechanicQuantity ?? body.ro_water_mechanic_quantity ?? 0,
    "roWater.mechanic"
  );

  const above17InchCustomer = validateQuantity(
    above17Inch.customer ?? body.above17InchCustomerQuantity ?? body.above_17_inch_customer_quantity ?? 0,
    "above17Inch.customer"
  );
  const above17InchMechanic = validateQuantity(
    above17Inch.mechanic ?? body.above17InchMechanicQuantity ?? body.above_17_inch_mechanic_quantity ?? 0,
    "above17Inch.mechanic"
  );

  return {
    reportAmount,
    tyreCustomer,
    tyreMechanic,
    twoWheelerEnquiryCustomer,
    twoWheelerEnquiryMechanic,
    twoWheelerAlignmentCustomer,
    twoWheelerAlignmentMechanic,
    wheelAlignmentCustomer,
    wheelAlignmentMechanic,
    commercialTyreCustomer,
    commercialTyreMechanic,
    roWaterCustomer,
    roWaterMechanic,
    above17InchCustomer,
    above17InchMechanic,
  };
}

async function getExistingReport(shopId, organizationId, reportDate, reportId) {
  if (reportId) {
    const reportById = await getOne(
      `
      SELECT *
      FROM daily_reports
      WHERE id = ? AND (organization_id = ? OR ? IS NULL)
      `,
      [reportId, organizationId, organizationId]
    );
    if (reportById) return reportById;
  }

  const dateStr = String(reportDate || "").split("T")[0];

  return await getOne(
    `
    SELECT *
    FROM daily_reports
    WHERE shop_id = ?
      AND (organization_id = ? OR ? IS NULL)
      AND (
        report_date = ?
        OR SUBSTR(report_date, 1, 10) = ?
        OR report_date LIKE ?
      )
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [shopId, organizationId, organizationId, dateStr, dateStr, `${dateStr}%`]
  );
}

const DailyReportController = {

  // ============================================================
  // CREATE / UPSERT DAILY REPORT
  // ============================================================

  async saveDailyReport(req, res, next) {
    try {
      const userRole = req.user.role;
      const organizationId =
        userRole === "SUPER_ADMIN"
          ? req.body?.organizationId || req.user.organizationId
          : req.user.organizationId;

      if (!organizationId && userRole !== "SUPER_ADMIN") {
        throw new AppError("Organization is required", 400);
      }

      const shop = await resolveShop(req);
      const effectiveOrgId = organizationId || shop.organization_id;
      const reportDate = resolveReportDate(req.body.reportDate || req.body.report_date);
      const payload = extractReportPayload(req.body);

      // Check if report already exists for this shop & date (or matching id)
      const existingReport = await getExistingReport(
        shop.id,
        effectiveOrgId,
        reportDate,
        req.body.id
      );

      const now = new Date().toISOString();

      if (existingReport) {
        // Upsert behavior: update the existing report with latest figures or increment
        const isIncremental = req.body.isIncremental === true || req.body.incremental === true;

        if (isIncremental) {
          await execute(
            `
            UPDATE daily_reports
            SET
              amount = amount + ?,
              tyre_customer_quantity = tyre_customer_quantity + ?,
              tyre_mechanic_quantity = tyre_mechanic_quantity + ?,
              two_wheeler_enquiry_customer_quantity = two_wheeler_enquiry_customer_quantity + ?,
              two_wheeler_enquiry_mechanic_quantity = two_wheeler_enquiry_mechanic_quantity + ?,
              two_wheeler_alignment_customer_quantity = two_wheeler_alignment_customer_quantity + ?,
              two_wheeler_alignment_mechanic_quantity = two_wheeler_alignment_mechanic_quantity + ?,
              wheel_alignment_customer_quantity = wheel_alignment_customer_quantity + ?,
              wheel_alignment_mechanic_quantity = wheel_alignment_mechanic_quantity + ?,
              commercial_tyre_customer_quantity = commercial_tyre_customer_quantity + ?,
              commercial_tyre_mechanic_quantity = commercial_tyre_mechanic_quantity + ?,
              ro_water_customer_quantity = ro_water_customer_quantity + ?,
              ro_water_mechanic_quantity = ro_water_mechanic_quantity + ?,
              above_17_inch_customer_quantity = above_17_inch_customer_quantity + ?,
              above_17_inch_mechanic_quantity = above_17_inch_mechanic_quantity + ?,
              last_modified_at = ?,
              last_modified_by = ?
            WHERE id = ?
            `,
            [
              payload.reportAmount,
              payload.tyreCustomer,
              payload.tyreMechanic,
              payload.twoWheelerEnquiryCustomer,
              payload.twoWheelerEnquiryMechanic,
              payload.twoWheelerAlignmentCustomer,
              payload.twoWheelerAlignmentMechanic,
              payload.wheelAlignmentCustomer,
              payload.wheelAlignmentMechanic,
              payload.commercialTyreCustomer,
              payload.commercialTyreMechanic,
              payload.roWaterCustomer,
              payload.roWaterMechanic,
              payload.above17InchCustomer,
              payload.above17InchMechanic,
              now,
              req.user.id,
              existingReport.id,
            ]
          );
        } else {
          await execute(
            `
            UPDATE daily_reports
            SET
              amount = ?,
              tyre_customer_quantity = ?,
              tyre_mechanic_quantity = ?,
              two_wheeler_enquiry_customer_quantity = ?,
              two_wheeler_enquiry_mechanic_quantity = ?,
              two_wheeler_alignment_customer_quantity = ?,
              two_wheeler_alignment_mechanic_quantity = ?,
              wheel_alignment_customer_quantity = ?,
              wheel_alignment_mechanic_quantity = ?,
              commercial_tyre_customer_quantity = ?,
              commercial_tyre_mechanic_quantity = ?,
              ro_water_customer_quantity = ?,
              ro_water_mechanic_quantity = ?,
              above_17_inch_customer_quantity = ?,
              above_17_inch_mechanic_quantity = ?,
              last_modified_at = ?,
              last_modified_by = ?
            WHERE id = ?
            `,
            [
              payload.reportAmount,
              payload.tyreCustomer,
              payload.tyreMechanic,
              payload.twoWheelerEnquiryCustomer,
              payload.twoWheelerEnquiryMechanic,
              payload.twoWheelerAlignmentCustomer,
              payload.twoWheelerAlignmentMechanic,
              payload.wheelAlignmentCustomer,
              payload.wheelAlignmentMechanic,
              payload.commercialTyreCustomer,
              payload.commercialTyreMechanic,
              payload.roWaterCustomer,
              payload.roWaterMechanic,
              payload.above17InchCustomer,
              payload.above17InchMechanic,
              now,
              req.user.id,
              existingReport.id,
            ]
          );
        }

        const updatedReport = await getOne(
          `
          SELECT
            dr.*,
            s.name AS shop_name
          FROM daily_reports dr
          LEFT JOIN shops s
            ON s.id = dr.shop_id
          WHERE dr.id = ?
          `,
          [existingReport.id]
        );

        return res.status(200).json({
          success: true,
          message: "Daily report updated successfully",
          data: updatedReport,
        });
      }

      // --------------------------------------------------------
      // Create new report
      // --------------------------------------------------------

      const id = req.body.id || uuid();

      await execute(
        `
        INSERT INTO daily_reports (
          id,
          organization_id,
          shop_id,
          report_date,

          amount,

          tyre_customer_quantity,
          tyre_mechanic_quantity,

          two_wheeler_enquiry_customer_quantity,
          two_wheeler_enquiry_mechanic_quantity,

          two_wheeler_alignment_customer_quantity,
          two_wheeler_alignment_mechanic_quantity,

          wheel_alignment_customer_quantity,
          wheel_alignment_mechanic_quantity,

          commercial_tyre_customer_quantity,
          commercial_tyre_mechanic_quantity,

          ro_water_customer_quantity,
          ro_water_mechanic_quantity,

          above_17_inch_customer_quantity,
          above_17_inch_mechanic_quantity,

          created_at,
          created_by,

          last_modified_at,
          last_modified_by
        )
        VALUES (
          ?, ?, ?, ?,

          ?,

          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,

          ?, ?,
          ?, ?
        )
        `,
        [
          id,
          effectiveOrgId,
          shop.id,
          reportDate,

          payload.reportAmount,

          payload.tyreCustomer,
          payload.tyreMechanic,

          payload.twoWheelerEnquiryCustomer,
          payload.twoWheelerEnquiryMechanic,

          payload.twoWheelerAlignmentCustomer,
          payload.twoWheelerAlignmentMechanic,

          payload.wheelAlignmentCustomer,
          payload.wheelAlignmentMechanic,

          payload.commercialTyreCustomer,
          payload.commercialTyreMechanic,

          payload.roWaterCustomer,
          payload.roWaterMechanic,

          payload.above17InchCustomer,
          payload.above17InchMechanic,

          now,
          req.user.id,

          now,
          req.user.id,
        ]
      );

      const report = await getOne(
        `
        SELECT
          dr.*,
          s.name AS shop_name
          FROM daily_reports dr
        LEFT JOIN shops s
          ON s.id = dr.shop_id
        WHERE dr.id = ?
        `,
        [id]
      );

      return res.status(201).json({
        success: true,
        message: "Daily report created successfully",
        data: report,
      });

    } catch (error) {
      next(error);
    }
  },


  // ============================================================
  // UPDATE / PUT DAILY REPORT
  // ============================================================

  async updateDailyReport(req, res, next) {
    try {
      const userRole = req.user.role;
      const organizationId =
        userRole === "SUPER_ADMIN"
          ? req.body?.organizationId || req.user.organizationId
          : req.user.organizationId;

      if (!organizationId && userRole !== "SUPER_ADMIN") {
        throw new AppError("Organization is required", 400);
      }

      const shop = await resolveShop(req);
      const effectiveOrgId = organizationId || shop.organization_id;
      const reportDate = resolveReportDate(req.body.reportDate || req.body.report_date);

      let existingReport = await getExistingReport(
        shop.id,
        effectiveOrgId,
        reportDate,
        req.body.id
      );

      // If report doesn't exist yet, seamlessly create it
      if (!existingReport) {
        return DailyReportController.saveDailyReport(req, res, next);
      }

      // Any assigned employee for this shop, shop admin, or super admin can update
      // Creator restriction removed to allow seamless collaboration and overwrites

      const payload = extractReportPayload(req.body);
      const now = new Date().toISOString();
      const isIncremental = req.body.isIncremental === true || req.body.incremental === true;

      if (isIncremental) {
        // Add quantities incrementally
        await execute(
          `
          UPDATE daily_reports
          SET
            amount = amount + ?,
            tyre_customer_quantity = tyre_customer_quantity + ?,
            tyre_mechanic_quantity = tyre_mechanic_quantity + ?,
            two_wheeler_enquiry_customer_quantity = two_wheeler_enquiry_customer_quantity + ?,
            two_wheeler_enquiry_mechanic_quantity = two_wheeler_enquiry_mechanic_quantity + ?,
            two_wheeler_alignment_customer_quantity = two_wheeler_alignment_customer_quantity + ?,
            two_wheeler_alignment_mechanic_quantity = two_wheeler_alignment_mechanic_quantity + ?,
            wheel_alignment_customer_quantity = wheel_alignment_customer_quantity + ?,
            wheel_alignment_mechanic_quantity = wheel_alignment_mechanic_quantity + ?,
            commercial_tyre_customer_quantity = commercial_tyre_customer_quantity + ?,
            commercial_tyre_mechanic_quantity = commercial_tyre_mechanic_quantity + ?,
            ro_water_customer_quantity = ro_water_customer_quantity + ?,
            ro_water_mechanic_quantity = ro_water_mechanic_quantity + ?,
            above_17_inch_customer_quantity = above_17_inch_customer_quantity + ?,
            above_17_inch_mechanic_quantity = above_17_inch_mechanic_quantity + ?,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
          `,
          [
            payload.reportAmount,
            payload.tyreCustomer,
            payload.tyreMechanic,
            payload.twoWheelerEnquiryCustomer,
            payload.twoWheelerEnquiryMechanic,
            payload.twoWheelerAlignmentCustomer,
            payload.twoWheelerAlignmentMechanic,
            payload.wheelAlignmentCustomer,
            payload.wheelAlignmentMechanic,
            payload.commercialTyreCustomer,
            payload.commercialTyreMechanic,
            payload.roWaterCustomer,
            payload.roWaterMechanic,
            payload.above17InchCustomer,
            payload.above17InchMechanic,
            now,
            req.user.id,
            existingReport.id,
          ]
        );
      } else {
        // Set whole total quantities (standard mobile app save behavior)
        await execute(
          `
          UPDATE daily_reports
          SET
            amount = ?,
            tyre_customer_quantity = ?,
            tyre_mechanic_quantity = ?,
            two_wheeler_enquiry_customer_quantity = ?,
            two_wheeler_enquiry_mechanic_quantity = ?,
            two_wheeler_alignment_customer_quantity = ?,
            two_wheeler_alignment_mechanic_quantity = ?,
            wheel_alignment_customer_quantity = ?,
            wheel_alignment_mechanic_quantity = ?,
            commercial_tyre_customer_quantity = ?,
            commercial_tyre_mechanic_quantity = ?,
            ro_water_customer_quantity = ?,
            ro_water_mechanic_quantity = ?,
            above_17_inch_customer_quantity = ?,
            above_17_inch_mechanic_quantity = ?,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
          `,
          [
            payload.reportAmount,
            payload.tyreCustomer,
            payload.tyreMechanic,
            payload.twoWheelerEnquiryCustomer,
            payload.twoWheelerEnquiryMechanic,
            payload.twoWheelerAlignmentCustomer,
            payload.twoWheelerAlignmentMechanic,
            payload.wheelAlignmentCustomer,
            payload.wheelAlignmentMechanic,
            payload.commercialTyreCustomer,
            payload.commercialTyreMechanic,
            payload.roWaterCustomer,
            payload.roWaterMechanic,
            payload.above17InchCustomer,
            payload.above17InchMechanic,
            now,
            req.user.id,
            existingReport.id,
          ]
        );
      }

      const updatedReport = await getOne(
        `
        SELECT
          dr.*,
          s.name AS shop_name
          FROM daily_reports dr
        LEFT JOIN shops s
          ON s.id = dr.shop_id
        WHERE dr.id = ?
        `,
        [existingReport.id]
      );

      return res.status(200).json({
        success: true,
        message: "Daily report updated successfully",
        data: updatedReport,
      });

    } catch (error) {
      next(error);
    }
  },


  // ============================================================
  // GET DAILY REPORTS (ADMIN & EMPLOYEE)
  // ============================================================

  async getDailyReports(req, res, next) {
    try {
      const userRole = req.user.role;
      const organizationId =
        userRole === "SUPER_ADMIN"
          ? req.query.organizationId || null
          : req.user.organizationId;

      if (!organizationId && userRole !== "SUPER_ADMIN") {
        throw new AppError(
          "Organization is required",
          400
        );
      }

      const {
        shopId,
        from,
        startDate,
        to,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query;

      // Employee shop assignment check
      if (userRole === "EMPLOYEE") {
        const assignedCount = await getOne(
          "SELECT COUNT(*) as count FROM user_shops WHERE user_id = ?",
          [req.user.id]
        );
        const hasAssignments = Number(assignedCount?.count || 0) > 0;

        if (shopId) {
          if (hasAssignments) {
            const isAssigned = await getOne(
              "SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?",
              [req.user.id, shopId]
            );
            if (!isAssigned) {
              throw new AppError(
                "Access denied: You are not assigned to this shop",
                403
              );
            }
          } else {
            const shop = await getOne(
              "SELECT id FROM shops WHERE id = ? AND organization_id = ? AND is_active = 1",
              [shopId, organizationId]
            );
            if (!shop) {
              throw new AppError(
                "Access denied: Shop not found or not in your organization",
                403
              );
            }
          }
        }
      }

      let sql = `
        SELECT
          dr.*,
          s.name AS shop_name
          FROM daily_reports dr
        LEFT JOIN shops s
          ON s.id = dr.shop_id
        WHERE 1 = 1
      `;

      const params = [];

      if (organizationId) {
        sql += ` AND dr.organization_id = ?`;
        params.push(organizationId);
      }

      if (shopId) {
        sql += ` AND dr.shop_id = ?`;
        params.push(shopId);
      } else if (userRole === "EMPLOYEE") {
        const assignedCount = await getOne(
          "SELECT COUNT(*) as count FROM user_shops WHERE user_id = ?",
          [req.user.id]
        );
        const hasAssignments = Number(assignedCount?.count || 0) > 0;
        if (hasAssignments) {
          sql += ` AND dr.shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = ?)`;
          params.push(req.user.id);
        }
      }

      const fromDate = from || startDate;
      if (fromDate) {
        sql += ` AND dr.report_date >= ?`;
        params.push(fromDate);
      }

      const toDate = to || endDate;
      if (toDate) {
        sql += ` AND dr.report_date <= ?`;
        params.push(toDate);
      }

      sql += `
        ORDER BY
          dr.report_date DESC,
          dr.created_at DESC
      `;

      const l = parseInt(limit, 10);
      const o = parseInt(offset, 10);
      const safeLimit = !Number.isNaN(l) && l > 0 ? Math.min(l, 100) : 50;
      const safeOffset = !Number.isNaN(o) && o >= 0 ? o : 0;

      sql += ` LIMIT ? OFFSET ?`;
      params.push(safeLimit, safeOffset);

      const reports = await query(sql, params);

      return res.status(200).json({
        success: true,
        count: reports.length,
        limit: safeLimit,
        offset: safeOffset,
        data: reports,
      });

    } catch (error) {
      next(error);
    }
  },
};

module.exports = DailyReportController;
