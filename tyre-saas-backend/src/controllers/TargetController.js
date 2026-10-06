const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

function getOrgScope(req) {
  if (req.user.role === "SUPER_ADMIN") {
    return req.query.organizationId || null;
  }

  return req.user.organizationId;
}

function validateMonthYear(targetMonth, targetYear) {
  if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    throw new AppError("targetMonth must be between 1 and 12", 400);
  }

  if (!Number.isInteger(targetYear) || targetYear < 2000) {
    throw new AppError("Invalid targetYear", 400);
  }
}

function validateTargetType(targetType) {
  const allowedTypes = [
    "TOTAL",
    "TWO_WHEELER",
    "FOUR_WHEELER",
  ];

  if (!allowedTypes.includes(targetType)) {
    throw new AppError(
      "tyreTargetType must be TOTAL, TWO_WHEELER or FOUR_WHEELER",
      400
    );
  }
}

function getMonthRange(year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return {
    startDate,
    nextMonth,
  };
}

// ============================================================
// VERIFY SHOP BELONGS TO ORGANIZATION
// ============================================================

async function verifyShopOrganization(shopId, organizationId) {
  const shop = await getOne(
    `
    SELECT
      id,
      organization_id,
      name
    FROM shops
    WHERE id = ?
      AND organization_id = ?
  `,
    [shopId, organizationId]
  );

  if (!shop) {
    throw new AppError(
      "Shop not found or does not belong to this organization",
      404
    );
  }

  return shop;
}

const TargetController = {
  // ============================================================
  // CREATE TARGET
  // ============================================================
 // ============================================================
// CREATE TARGET
// ============================================================
async createTarget(req, res, next) {
  try {
    const organizationId = getOrgScope(req);

    if (!organizationId) {
      throw new AppError("organizationId is required", 400);
    }

    const {
      shopId,
      targetYear,
      targetMonth,
      amountTarget,
      tyreTarget,
      twoWheelerEnquiryTarget,
      twoWheelerAlignmentTarget,
      wheelAlignmentTarget,
      commercialTyreTarget,
      roWaterTarget,
      above17InchTarget,
    } = req.body;

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (
      !shopId ||
      targetYear === undefined ||
      targetMonth === undefined ||
      amountTarget === undefined ||
      tyreTarget === undefined ||
      twoWheelerEnquiryTarget === undefined ||
      twoWheelerAlignmentTarget === undefined ||
      wheelAlignmentTarget === undefined ||
      commercialTyreTarget === undefined ||
      roWaterTarget === undefined ||
      above17InchTarget === undefined
    ) {
      throw new AppError(
        "shopId, targetYear, targetMonth and all 7 service targets are required",
        400
      );
    }

    // --------------------------------------------------------
    // Verify shop belongs to organization
    // --------------------------------------------------------

    await verifyShopOrganization(
      shopId,
      organizationId
    );

    // --------------------------------------------------------
    // Convert values
    // --------------------------------------------------------

    const year = Number(targetYear);
    const month = Number(targetMonth);

    const amount = Number(amountTarget);

    const tyre = Number(tyreTarget);

    const twoWheelerEnquiry =
      Number(twoWheelerEnquiryTarget);

    const twoWheelerAlignment =
      Number(twoWheelerAlignmentTarget);

    const wheelAlignment =
      Number(wheelAlignmentTarget);

    const commercialTyre =
      Number(commercialTyreTarget);

    const roWater =
      Number(roWaterTarget);

    const above17Inch =
      Number(above17InchTarget);

    // --------------------------------------------------------
    // Validate month/year
    // --------------------------------------------------------

    validateMonthYear(
      month,
      year
    );

    // --------------------------------------------------------
    // Validate amount
    // --------------------------------------------------------

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      throw new AppError(
        "amountTarget must be 0 or greater",
        400
      );
    }

    // --------------------------------------------------------
    // Validate all service targets
    // --------------------------------------------------------

    const serviceTargets = [
      tyre,
      twoWheelerEnquiry,
      twoWheelerAlignment,
      wheelAlignment,
      commercialTyre,
      roWater,
      above17Inch,
    ];

    for (const target of serviceTargets) {
      if (
        !Number.isInteger(target) ||
        target < 0
      ) {
        throw new AppError(
          "All service targets must be non-negative whole numbers",
          400
        );
      }
    }

    // --------------------------------------------------------
    // Check duplicate target
    // Same shop + same month + same year
    // --------------------------------------------------------

    const existingTarget = await getOne(
      `
      SELECT id
      FROM monthly_targets
      WHERE organization_id = ?
        AND shop_id = ?
        AND target_year = ?
        AND target_month = ?
      `,
      [
        organizationId,
        shopId,
        year,
        month,
      ]
    );

    if (existingTarget) {
      throw new AppError(
        "Target already exists for this shop and month",
        409
      );
    }

    // --------------------------------------------------------
    // Create ID
    // --------------------------------------------------------

    const id = uuid();
    const now = new Date().toISOString();

    // --------------------------------------------------------
    // INSERT TARGET
    // --------------------------------------------------------

    await execute(
      `
      INSERT INTO monthly_targets (
        id,
        organization_id,
        shop_id,
        target_year,
        target_month,

        amount_target,

        tyre_target,
        two_wheeler_enquiry_target,
        two_wheeler_alignment_target,
        wheel_alignment_target,
        commercial_tyre_target,
        ro_water_target,
        above_17_inch_target,

        created_at,
        created_by,
        last_modified_at,
        last_modified_by
      )
      VALUES (
        ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      `,
      [
        id,
        organizationId,
        shopId,
        year,
        month,

        amount,

        tyre,
        twoWheelerEnquiry,
        twoWheelerAlignment,
        wheelAlignment,
        commercialTyre,
        roWater,
        above17Inch,

        now,
        req.user.id,
        now,
        req.user.id,
      ]
    );

    // --------------------------------------------------------
    // Get created target
    // --------------------------------------------------------

    const target = await getOne(
      `
      SELECT
        mt.*,
        s.name AS shop_name
      FROM monthly_targets mt
      LEFT JOIN shops s
        ON s.id = mt.shop_id
      WHERE mt.id = ?
      `,
      [id]
    );

    return res.status(201).json({
      success: true,
      message: "Monthly target created successfully",
      data: target,
    });

  } catch (error) {
    next(error);
  }
},

  // ============================================================
  // GET CURRENT TARGET
  // ============================================================
  async getCurrentTarget(req, res, next) {
    try {
      const organizationId = getOrgScope(req);

      if (!organizationId) {
        throw new AppError(
          "organizationId is required",
          400
        );
      }

      const {
        shopId,
      } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      await verifyShopOrganization(
        shopId,
        organizationId
      );

      const now = new Date();

      const year = Number(
        req.query.year || now.getFullYear()
      );

      const month = Number(
        req.query.month || now.getMonth() + 1
      );

      validateMonthYear(month, year);

      // --------------------------------------------------------
      // GET SHOP TARGET
      // --------------------------------------------------------

      const target = await getOne(
        `
        SELECT
          mt.*,
          s.name AS shop_name
        FROM monthly_targets mt
        LEFT JOIN shops s
          ON s.id = mt.shop_id
        WHERE mt.organization_id = ?
          AND mt.shop_id = ?
          AND mt.target_year = ?
          AND mt.target_month = ?
        `,
        [
          organizationId,
          shopId,
          year,
          month,
        ]
      );

      if (!target) {
        throw new AppError(
          "No target found for the selected shop and month",
          404
        );
      }

      return res.json({
        success: true,
        data: target,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================================
  // GET TARGET DASHBOARD
  // ============================================================
async getTargetDashboard(req, res, next) {
  try {
    const organizationId = getOrgScope(req);

    if (!organizationId) {
      throw new AppError("organizationId is required", 400);
    }

    const shopId = req.query.shopId;
    const rawYear = req.query.targetYear !== undefined ? req.query.targetYear : req.query.year;
    const rawMonth = req.query.targetMonth !== undefined ? req.query.targetMonth : req.query.month;

    if (!shopId || rawYear === undefined || rawMonth === undefined) {
      throw new AppError(
        "shopId, targetYear and targetMonth are required",
        400
      );
    }

    const year = Number(rawYear);
    const month = Number(rawMonth);

    validateMonthYear(month, year);

    // Make sure shop belongs to this organization
    const shop = await verifyShopOrganization(
      shopId,
      organizationId
    );

    const { startDate, nextMonth } = getMonthRange(
      year,
      month
    );

    // --------------------------------------------------------
    // GET MONTHLY TARGET
    // --------------------------------------------------------

    const target = await getOne(
      `
      SELECT *
      FROM monthly_targets
      WHERE organization_id = ?
        AND shop_id = ?
        AND target_year = ?
        AND target_month = ?
      `,
      [
        organizationId,
        shopId,
        year,
        month,
      ]
    );

    if (!target) {
      throw new AppError(
        "Monthly target not found for this shop and month",
        404
      );
    }

    // --------------------------------------------------------
    // GET MONTHLY ACHIEVEMENT FROM DAILY REPORTS
    // --------------------------------------------------------

    const achievement = await getOne(
      `
      SELECT

        COALESCE(SUM(amount), 0) AS achieved_amount,

        COALESCE(
          SUM(
            tyre_customer_quantity +
            tyre_mechanic_quantity
          ),
          0
        ) AS achieved_tyre,

        COALESCE(
          SUM(
            two_wheeler_enquiry_customer_quantity +
            two_wheeler_enquiry_mechanic_quantity
          ),
          0
        ) AS achieved_two_wheeler_enquiry,

        COALESCE(
          SUM(
            two_wheeler_alignment_customer_quantity +
            two_wheeler_alignment_mechanic_quantity
          ),
          0
        ) AS achieved_two_wheeler_alignment,

        COALESCE(
          SUM(
            wheel_alignment_customer_quantity +
            wheel_alignment_mechanic_quantity
          ),
          0
        ) AS achieved_wheel_alignment,

        COALESCE(
          SUM(
            commercial_tyre_customer_quantity +
            commercial_tyre_mechanic_quantity
          ),
          0
        ) AS achieved_commercial_tyre,

        COALESCE(
          SUM(
            ro_water_customer_quantity +
            ro_water_mechanic_quantity
          ),
          0
        ) AS achieved_ro_water,

        COALESCE(
          SUM(
            above_17_inch_customer_quantity +
            above_17_inch_mechanic_quantity
          ),
          0
        ) AS achieved_above_17_inch

      FROM daily_reports
      WHERE organization_id = ?
        AND shop_id = ?
        AND report_date >= ?
        AND report_date < ?
      `,
      [
        organizationId,
        shopId,
        startDate,
        nextMonth,
      ]
    );

    // --------------------------------------------------------
    // CONVERT VALUES
    // --------------------------------------------------------

    const achievedAmount =
      Number(achievement.achieved_amount) || 0;

    const achievedTyre =
      Number(achievement.achieved_tyre) || 0;

    const achievedTwoWheelerEnquiry =
      Number(achievement.achieved_two_wheeler_enquiry) || 0;

    const achievedTwoWheelerAlignment =
      Number(achievement.achieved_two_wheeler_alignment) || 0;

    const achievedWheelAlignment =
      Number(achievement.achieved_wheel_alignment) || 0;

    const achievedCommercialTyre =
      Number(achievement.achieved_commercial_tyre) || 0;

    const achievedRoWater =
      Number(achievement.achieved_ro_water) || 0;

    const achievedAbove17Inch =
      Number(achievement.achieved_above_17_inch) || 0;

    // --------------------------------------------------------
    // TARGET VALUES
    // --------------------------------------------------------

    const amountTarget =
      Number(target.amount_target) || 0;

    const tyreTarget =
      Number(target.tyre_target) || 0;

    const twoWheelerEnquiryTarget =
      Number(target.two_wheeler_enquiry_target) || 0;

    const twoWheelerAlignmentTarget =
      Number(target.two_wheeler_alignment_target) || 0;

    const wheelAlignmentTarget =
      Number(target.wheel_alignment_target) || 0;

    const commercialTyreTarget =
      Number(target.commercial_tyre_target) || 0;

    const roWaterTarget =
      Number(target.ro_water_target) || 0;

    const above17InchTarget =
      Number(target.above_17_inch_target) || 0;

    // --------------------------------------------------------
    // REMAINING
    // --------------------------------------------------------

    const remainingAmount = Math.max(
      amountTarget - achievedAmount,
      0
    );

    const remainingTyre = Math.max(
      tyreTarget - achievedTyre,
      0
    );

    const remainingTwoWheelerEnquiry = Math.max(
      twoWheelerEnquiryTarget -
        achievedTwoWheelerEnquiry,
      0
    );

    const remainingTwoWheelerAlignment = Math.max(
      twoWheelerAlignmentTarget -
        achievedTwoWheelerAlignment,
      0
    );

    const remainingWheelAlignment = Math.max(
      wheelAlignmentTarget -
        achievedWheelAlignment,
      0
    );

    const remainingCommercialTyre = Math.max(
      commercialTyreTarget -
        achievedCommercialTyre,
      0
    );

    const remainingRoWater = Math.max(
      roWaterTarget -
        achievedRoWater,
      0
    );

    const remainingAbove17Inch = Math.max(
      above17InchTarget -
        achievedAbove17Inch,
      0
    );

    // --------------------------------------------------------
    // PERCENTAGE
    // --------------------------------------------------------

    const calculatePercentage = (
      achieved,
      targetValue
    ) => {
      if (targetValue <= 0) {
        return 0;
      }

      return Number(
        ((achieved / targetValue) * 100).toFixed(2)
      );
    };

    return res.status(200).json({
      success: true,

      data: {
        period: {
          year,
          month,
        },

        shop: {
          id: shop.id,
          name: shop.name,
        },

        target: {
          amount: amountTarget,
          tyre: tyreTarget,
          twoWheelerEnquiry:
            twoWheelerEnquiryTarget,
          twoWheelerAlignment:
            twoWheelerAlignmentTarget,
          wheelAlignment:
            wheelAlignmentTarget,
          commercialTyre:
            commercialTyreTarget,
          roWater:
            roWaterTarget,
          above17Inch:
            above17InchTarget,
        },

        achieved: {
          amount: achievedAmount,
          tyre: achievedTyre,
          twoWheelerEnquiry:
            achievedTwoWheelerEnquiry,
          twoWheelerAlignment:
            achievedTwoWheelerAlignment,
          wheelAlignment:
            achievedWheelAlignment,
          commercialTyre:
            achievedCommercialTyre,
          roWater:
            achievedRoWater,
          above17Inch:
            achievedAbove17Inch,
        },

        remaining: {
          amount: remainingAmount,
          tyre: remainingTyre,
          twoWheelerEnquiry:
            remainingTwoWheelerEnquiry,
          twoWheelerAlignment:
            remainingTwoWheelerAlignment,
          wheelAlignment:
            remainingWheelAlignment,
          commercialTyre:
            remainingCommercialTyre,
          roWater:
            remainingRoWater,
          above17Inch:
            remainingAbove17Inch,
        },

        achievementPercentage: {
          amount: calculatePercentage(
            achievedAmount,
            amountTarget
          ),

          tyre: calculatePercentage(
            achievedTyre,
            tyreTarget
          ),

          twoWheelerEnquiry:
            calculatePercentage(
              achievedTwoWheelerEnquiry,
              twoWheelerEnquiryTarget
            ),

          twoWheelerAlignment:
            calculatePercentage(
              achievedTwoWheelerAlignment,
              twoWheelerAlignmentTarget
            ),

          wheelAlignment:
            calculatePercentage(
              achievedWheelAlignment,
              wheelAlignmentTarget
            ),

          commercialTyre:
            calculatePercentage(
              achievedCommercialTyre,
              commercialTyreTarget
            ),

          roWater:
            calculatePercentage(
              achievedRoWater,
              roWaterTarget
            ),

          above17Inch:
            calculatePercentage(
              achievedAbove17Inch,
              above17InchTarget
            ),
        },
      },
    });
  } catch (error) {
    next(error);
  }
},

  // ============================================================
  // UPDATE TARGET
  // ============================================================
async updateTarget(req, res, next) {
  try {
    const organizationId = getOrgScope(req);

    if (!organizationId) {
      throw new AppError("organizationId is required", 400);
    }

    const { id } = req.params;

    const {
      amountTarget,
      tyreTarget,
      twoWheelerEnquiryTarget,
      twoWheelerAlignmentTarget,
      wheelAlignmentTarget,
      commercialTyreTarget,
      roWaterTarget,
      above17InchTarget,
    } = req.body;

    const existingTarget = await getOne(
      `
      SELECT *
      FROM monthly_targets
      WHERE id = ?
        AND organization_id = ?
      `,
      [id, organizationId]
    );

    if (!existingTarget) {
      throw new AppError("Target not found", 404);
    }

    const amount =
      amountTarget !== undefined
        ? Number(amountTarget)
        : Number(existingTarget.amount_target);

    const tyre =
      tyreTarget !== undefined
        ? Number(tyreTarget)
        : existingTarget.tyre_target;

    const twoWheelerEnquiry =
      twoWheelerEnquiryTarget !== undefined
        ? Number(twoWheelerEnquiryTarget)
        : existingTarget.two_wheeler_enquiry_target;

    const twoWheelerAlignment =
      twoWheelerAlignmentTarget !== undefined
        ? Number(twoWheelerAlignmentTarget)
        : existingTarget.two_wheeler_alignment_target;

    const wheelAlignment =
      wheelAlignmentTarget !== undefined
        ? Number(wheelAlignmentTarget)
        : existingTarget.wheel_alignment_target;

    const commercialTyre =
      commercialTyreTarget !== undefined
        ? Number(commercialTyreTarget)
        : existingTarget.commercial_tyre_target;

    const roWater =
      roWaterTarget !== undefined
        ? Number(roWaterTarget)
        : existingTarget.ro_water_target;

    const above17Inch =
      above17InchTarget !== undefined
        ? Number(above17InchTarget)
        : existingTarget.above_17_inch_target;

    // Validate amount
    if (!Number.isFinite(amount) || amount < 0) {
      throw new AppError(
        "amountTarget must be 0 or greater",
        400
      );
    }

    // Validate service targets
    const serviceTargets = [
      tyre,
      twoWheelerEnquiry,
      twoWheelerAlignment,
      wheelAlignment,
      commercialTyre,
      roWater,
      above17Inch,
    ];

    for (const target of serviceTargets) {
      if (!Number.isInteger(Number(target)) || Number(target) < 0) {
        throw new AppError(
          "All service targets must be non-negative whole numbers",
          400
        );
      }
    }

    const now = new Date().toISOString();

    await execute(
      `
      UPDATE monthly_targets
      SET
        amount_target = ?,
        tyre_target = ?,
        two_wheeler_enquiry_target = ?,
        two_wheeler_alignment_target = ?,
        wheel_alignment_target = ?,
        commercial_tyre_target = ?,
        ro_water_target = ?,
        above_17_inch_target = ?,
        last_modified_at = ?,
        last_modified_by = ?
      WHERE id = ?
        AND organization_id = ?
      `,
      [
        amount,
        tyre,
        twoWheelerEnquiry,
        twoWheelerAlignment,
        wheelAlignment,
        commercialTyre,
        roWater,
        above17Inch,
        now,
        req.user.id,
        id,
        organizationId,
      ]
    );

    const updatedTarget = await getOne(
      `
      SELECT
        mt.*,
        s.name AS shop_name
      FROM monthly_targets mt
      LEFT JOIN shops s
        ON s.id = mt.shop_id
      WHERE mt.id = ?
        AND mt.organization_id = ?
      `,
      [id, organizationId]
    );

    return res.status(200).json({
      success: true,
      message: "Monthly target updated successfully",
      data: updatedTarget,
    });
  } catch (error) {
    next(error);
  }
},

  // ============================================================
  // TARGET HISTORY
  // ============================================================
  async getTargetHistory(req, res, next) {
    try {
      const organizationId = getOrgScope(req);

      if (!organizationId) {
        throw new AppError(
          "organizationId is required",
          400
        );
      }

      const {
        shopId,
      } = req.query;

      let sql = `
        SELECT
          mt.*,
          s.name AS shop_name
        FROM monthly_targets mt
        LEFT JOIN shops s
          ON s.id = mt.shop_id
        WHERE mt.organization_id = ?
      `;

      const params = [
        organizationId,
      ];

      // --------------------------------------------------------
      // Optional shop filter
      // --------------------------------------------------------

      if (shopId) {
        await verifyShopOrganization(
          shopId,
          organizationId
        );

        sql += `
          AND mt.shop_id = ?
        `;

        params.push(shopId);
      }

      sql += `
        ORDER BY
          mt.target_year DESC,
          mt.target_month DESC
      `;

      const targets = await query(
        sql,
        params
      );

      return res.json({
        success: true,
        data: targets,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = TargetController;