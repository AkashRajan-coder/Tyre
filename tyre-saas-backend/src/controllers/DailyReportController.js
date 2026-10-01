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

async function getEmployeeShop(req) {
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  const shop = await getOne(
    `
    SELECT
      s.id,
      s.name,
      s.organization_id
    FROM user_shops us
    INNER JOIN shops s
      ON s.id = us.shop_id
    WHERE us.user_id = ?
      AND s.organization_id = ?
      AND s.is_active = 1
    ORDER BY s.created_at ASC
    LIMIT 1
    `,
    [userId, organizationId]
  );

  if (!shop) {
    throw new AppError(
      "No active shop assigned to this employee",
      404
    );
  }

  return shop;
}
async function getTodayReport(shopId, organizationId, reportDate) {
  return await getOne(
    `
    SELECT *
    FROM daily_reports
    WHERE shop_id = ?
      AND organization_id = ?
      AND report_date = ?
    `,
    [shopId, organizationId, reportDate]
  );
}

const DailyReportController = {

  // ============================================================
  // CREATE DAILY REPORT
  // ============================================================

  async saveDailyReport(req, res, next) {
    try {
      const organizationId = req.user.organizationId;

      if (!organizationId) {
        throw new AppError(
          "Employee organization is required",
          400
        );
      }

      const shop = await getEmployeeShop(req);

      // Today's date
      const reportDate = new Date()
        .toISOString()
        .split("T")[0];

      const {
        amount = 0,

        tyre = {},
        twoWheelerEnquiry = {},
        twoWheelerAlignment = {},
        wheelAlignment = {},
        commercialTyre = {},
        roWater = {},
        above17Inch = {},
      } = req.body;

      // --------------------------------------------------------
      // Validate amount
      // --------------------------------------------------------

      const reportAmount = validateAmount(amount);

      // --------------------------------------------------------
      // Validate all service quantities
      // --------------------------------------------------------

      const tyreCustomer = validateQuantity(
        tyre.customer || 0,
        "tyre.customer"
      );

      const tyreMechanic = validateQuantity(
        tyre.mechanic || 0,
        "tyre.mechanic"
      );

      const twoWheelerEnquiryCustomer = validateQuantity(
        twoWheelerEnquiry.customer || 0,
        "twoWheelerEnquiry.customer"
      );

      const twoWheelerEnquiryMechanic = validateQuantity(
        twoWheelerEnquiry.mechanic || 0,
        "twoWheelerEnquiry.mechanic"
      );

      const twoWheelerAlignmentCustomer = validateQuantity(
        twoWheelerAlignment.customer || 0,
        "twoWheelerAlignment.customer"
      );

      const twoWheelerAlignmentMechanic = validateQuantity(
        twoWheelerAlignment.mechanic || 0,
        "twoWheelerAlignment.mechanic"
      );

      const wheelAlignmentCustomer = validateQuantity(
        wheelAlignment.customer || 0,
        "wheelAlignment.customer"
      );

      const wheelAlignmentMechanic = validateQuantity(
        wheelAlignment.mechanic || 0,
        "wheelAlignment.mechanic"
      );

      const commercialTyreCustomer = validateQuantity(
        commercialTyre.customer || 0,
        "commercialTyre.customer"
      );

      const commercialTyreMechanic = validateQuantity(
        commercialTyre.mechanic || 0,
        "commercialTyre.mechanic"
      );

      const roWaterCustomer = validateQuantity(
        roWater.customer || 0,
        "roWater.customer"
      );

      const roWaterMechanic = validateQuantity(
        roWater.mechanic || 0,
        "roWater.mechanic"
      );

      const above17InchCustomer = validateQuantity(
        above17Inch.customer || 0,
        "above17Inch.customer"
      );

      const above17InchMechanic = validateQuantity(
        above17Inch.mechanic || 0,
        "above17Inch.mechanic"
      );

      // --------------------------------------------------------
      // Check today's report already exists
      // --------------------------------------------------------

      const existingReport = await getTodayReport(
        shop.id,
        organizationId,
        reportDate
      );

      if (existingReport) {
        throw new AppError(
          "Today's daily report already exists. Use PUT to add more quantities.",
          409
        );
      }

      // --------------------------------------------------------
      // Create report
      // --------------------------------------------------------

      const id = uuid();
      const now = new Date().toISOString();

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

          ?, ?,
          ?, ?
        )
        `,
        [
          id,
          organizationId,
          shop.id,
          reportDate,

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
  // UPDATE / ADD TO TODAY'S DAILY REPORT
  // ============================================================

  async updateDailyReport(req, res, next) {
    try {
      const organizationId = req.user.organizationId;

      if (!organizationId) {
        throw new AppError(
          "Employee organization is required",
          400
        );
      }

      const shop = await getEmployeeShop(req);

      const reportDate = new Date()
        .toISOString()
        .split("T")[0];

      const existingReport = await getTodayReport(
        shop.id,
        organizationId,
        reportDate
      );

      if (!existingReport) {
        throw new AppError(
          "Today's daily report does not exist. Use POST first.",
          404
        );
      }

      // Only the employee who created the report can update it
      if (existingReport.created_by !== req.user.id) {
        throw new AppError(
          "Only the employee who created today's report can update it",
          403
        );
      }

      const {
        amount = 0,

        tyre = {},
        twoWheelerEnquiry = {},
        twoWheelerAlignment = {},
        wheelAlignment = {},
        commercialTyre = {},
        roWater = {},
        above17Inch = {},
      } = req.body;

      // --------------------------------------------------------
      // Validate amount
      // --------------------------------------------------------

      const reportAmount = validateAmount(amount);

      // --------------------------------------------------------
      // Validate quantities
      // --------------------------------------------------------

      const tyreCustomer = validateQuantity(
        tyre.customer || 0,
        "tyre.customer"
      );

      const tyreMechanic = validateQuantity(
        tyre.mechanic || 0,
        "tyre.mechanic"
      );

      const twoWheelerEnquiryCustomer = validateQuantity(
        twoWheelerEnquiry.customer || 0,
        "twoWheelerEnquiry.customer"
      );

      const twoWheelerEnquiryMechanic = validateQuantity(
        twoWheelerEnquiry.mechanic || 0,
        "twoWheelerEnquiry.mechanic"
      );

      const twoWheelerAlignmentCustomer = validateQuantity(
        twoWheelerAlignment.customer || 0,
        "twoWheelerAlignment.customer"
      );

      const twoWheelerAlignmentMechanic = validateQuantity(
        twoWheelerAlignment.mechanic || 0,
        "twoWheelerAlignment.mechanic"
      );

      const wheelAlignmentCustomer = validateQuantity(
        wheelAlignment.customer || 0,
        "wheelAlignment.customer"
      );

      const wheelAlignmentMechanic = validateQuantity(
        wheelAlignment.mechanic || 0,
        "wheelAlignment.mechanic"
      );

      const commercialTyreCustomer = validateQuantity(
        commercialTyre.customer || 0,
        "commercialTyre.customer"
      );

      const commercialTyreMechanic = validateQuantity(
        commercialTyre.mechanic || 0,
        "commercialTyre.mechanic"
      );

      const roWaterCustomer = validateQuantity(
        roWater.customer || 0,
        "roWater.customer"
      );

      const roWaterMechanic = validateQuantity(
        roWater.mechanic || 0,
        "roWater.mechanic"
      );

      const above17InchCustomer = validateQuantity(
        above17Inch.customer || 0,
        "above17Inch.customer"
      );

      const above17InchMechanic = validateQuantity(
        above17Inch.mechanic || 0,
        "above17Inch.mechanic"
      );

      const now = new Date().toISOString();

      // --------------------------------------------------------
      // ADD quantities and amount
      // --------------------------------------------------------

      await execute(
        `
        UPDATE daily_reports
        SET
          amount = amount + ?,

          tyre_customer_quantity =
            tyre_customer_quantity + ?,

          tyre_mechanic_quantity =
            tyre_mechanic_quantity + ?,

          two_wheeler_enquiry_customer_quantity =
            two_wheeler_enquiry_customer_quantity + ?,

          two_wheeler_enquiry_mechanic_quantity =
            two_wheeler_enquiry_mechanic_quantity + ?,

          two_wheeler_alignment_customer_quantity =
            two_wheeler_alignment_customer_quantity + ?,

          two_wheeler_alignment_mechanic_quantity =
            two_wheeler_alignment_mechanic_quantity + ?,

          wheel_alignment_customer_quantity =
            wheel_alignment_customer_quantity + ?,

          wheel_alignment_mechanic_quantity =
            wheel_alignment_mechanic_quantity + ?,

          commercial_tyre_customer_quantity =
            commercial_tyre_customer_quantity + ?,

          commercial_tyre_mechanic_quantity =
            commercial_tyre_mechanic_quantity + ?,

          ro_water_customer_quantity =
            ro_water_customer_quantity + ?,

          ro_water_mechanic_quantity =
            ro_water_mechanic_quantity + ?,

          above_17_inch_customer_quantity =
            above_17_inch_customer_quantity + ?,

          above_17_inch_mechanic_quantity =
            above_17_inch_mechanic_quantity + ?,

          last_modified_at = ?,
          last_modified_by = ?

        WHERE id = ?
          AND organization_id = ?
          AND shop_id = ?
          AND report_date = ?
          AND created_by = ?
        `,
        [
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

          now,
          req.user.id,

          existingReport.id,
          organizationId,
          shop.id,
          reportDate,
          req.user.id,
        ]
      );

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
  // ADMIN - GET DAILY REPORTS
  // ============================================================

  async getDailyReports(req, res, next) {
    try {
      const organizationId = req.user.organizationId;

      if (!organizationId) {
        throw new AppError(
          "Organization is required",
          400
        );
      }

      const {
        shopId,
        startDate,
        endDate,
      } = req.query;

      let sql = `
        SELECT
          dr.*,
          s.name AS shop_name
        FROM daily_reports dr
        LEFT JOIN shops s
          ON s.id = dr.shop_id
        WHERE dr.organization_id = ?
      `;

      const params = [organizationId];

      if (shopId) {
        sql += ` AND dr.shop_id = ?`;
        params.push(shopId);
      }

      if (startDate) {
        sql += ` AND dr.report_date >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND dr.report_date <= ?`;
        params.push(endDate);
      }

      sql += `
        ORDER BY
          dr.report_date DESC,
          dr.created_at DESC
      `;

      const reports = await query(sql, params);

      return res.status(200).json({
        success: true,
        count: reports.length,
        data: reports,
      });

    } catch (error) {
      next(error);
    }
  },
};

module.exports = DailyReportController;