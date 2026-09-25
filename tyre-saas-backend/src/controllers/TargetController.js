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

const TargetController = {
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
        targetYear,
        targetMonth,
        amountTarget,
        tyreTarget,
        tyreTargetType = "TOTAL",
      } = req.body;

      if (
        targetYear === undefined ||
        targetMonth === undefined ||
        amountTarget === undefined ||
        tyreTarget === undefined
      ) {
        throw new AppError(
          "targetYear, targetMonth, amountTarget and tyreTarget are required",
          400
        );
      }

      const year = Number(targetYear);
      const month = Number(targetMonth);
      const amount = Number(amountTarget);
      const tyre = Number(tyreTarget);

      validateMonthYear(month, year);
      validateTargetType(tyreTargetType);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new AppError("amountTarget must be 0 or greater", 400);
      }

      if (!Number.isInteger(tyre) || tyre < 0) {
        throw new AppError("tyreTarget must be 0 or greater", 400);
      }

      // Check duplicate target
      const existingTarget = await getOne(
        `
        SELECT id
        FROM monthly_targets
        WHERE organization_id = ?
          AND target_year = ?
          AND target_month = ?
        `,
        [organizationId, year, month]
      );

      if (existingTarget) {
        throw new AppError(
          "Target already exists for this organization and month",
          409
        );
      }

      const id = uuid();
      const now = new Date().toISOString();

      await execute(
        `
        INSERT INTO monthly_targets (
          id,
          organization_id,
          target_year,
          target_month,
          amount_target,
          tyre_target,
          tyre_target_type,
          created_at,
          created_by,
          last_modified_at,
          last_modified_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          year,
          month,
          amount,
          tyre,
          tyreTargetType,
          now,
          req.user.id,
          now,
          req.user.id,
        ]
      );

      const target = await getOne(
        `
        SELECT *
        FROM monthly_targets
        WHERE id = ?
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
        throw new AppError("organizationId is required", 400);
      }

      const now = new Date();

      const year = Number(
        req.query.year || now.getFullYear()
      );

      const month = Number(
        req.query.month || now.getMonth() + 1
      );

      validateMonthYear(month, year);

      const target = await getOne(
        `
        SELECT *
        FROM monthly_targets
        WHERE organization_id = ?
          AND target_year = ?
          AND target_month = ?
        `,
        [organizationId, year, month]
      );

      if (!target) {
        throw new AppError(
          "No target found for the selected month",
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

      const now = new Date();

      const year = Number(
        req.query.year || now.getFullYear()
      );

      const month = Number(
        req.query.month || now.getMonth() + 1
      );

      validateMonthYear(month, year);

      // --------------------------------------------------------
      // GET TARGET
      // --------------------------------------------------------
      const target = await getOne(
        `
        SELECT *
        FROM monthly_targets
        WHERE organization_id = ?
          AND target_year = ?
          AND target_month = ?
        `,
        [organizationId, year, month]
      );

      if (!target) {
        throw new AppError(
          "No target found for the selected month",
          404
        );
      }

      // --------------------------------------------------------
      // DATE RANGE
      // --------------------------------------------------------
      const { startDate, nextMonth } = getMonthRange(
        year,
        month
      );

      // --------------------------------------------------------
      // ACHIEVEMENT
      //
      // SOURCE:
      // customer_enquiries
      //
      // ONLY:
      // status = COMPLETED
      // is_deleted = 0
      // --------------------------------------------------------

      let achievementSql = `
        SELECT
          COALESCE(SUM(estimated_budget), 0) AS achieved_amount,
          COALESCE(SUM(quantity), 0) AS achieved_tyres
        FROM customer_enquiries
        WHERE organization_id = ?
          AND status = 'COMPLETED'
          AND is_deleted = 0
          AND created_at >= ?
          AND created_at < ?
      `;

      const achievementParams = [
        organizationId,
        startDate,
        nextMonth,
      ];

      // Vehicle type filter
      if (target.tyre_target_type === "TWO_WHEELER") {
        achievementSql += `
          AND vehicle_type = ?
        `;

        achievementParams.push("TWO_WHEELER");
      }

      if (target.tyre_target_type === "FOUR_WHEELER") {
        achievementSql += `
          AND vehicle_type = ?
        `;

        achievementParams.push("FOUR_WHEELER");
      }

      const achievement = await getOne(
        achievementSql,
        achievementParams
      );

      const achievedAmount = Number(
        achievement?.achieved_amount || 0
      );

      const achievedTyres = Number(
        achievement?.achieved_tyres || 0
      );

      const amountTarget = Number(
        target.amount_target || 0
      );

      const tyreTarget = Number(
        target.tyre_target || 0
      );

      // --------------------------------------------------------
      // REMAINING / EXCESS
      // --------------------------------------------------------

      const amountRemaining = Math.max(
        amountTarget - achievedAmount,
        0
      );

      const amountExcess = Math.max(
        achievedAmount - amountTarget,
        0
      );

      const tyreRemaining = Math.max(
        tyreTarget - achievedTyres,
        0
      );

      const tyreExcess = Math.max(
        achievedTyres - tyreTarget,
        0
      );

      // --------------------------------------------------------
      // ACHIEVEMENT %
      // --------------------------------------------------------

      const amountAchievementPercentage =
        amountTarget > 0
          ? Number(
              ((achievedAmount / amountTarget) * 100).toFixed(2)
            )
          : 0;

      const tyreAchievementPercentage =
        tyreTarget > 0
          ? Number(
              ((achievedTyres / tyreTarget) * 100).toFixed(2)
            )
          : 0;

      // --------------------------------------------------------
      // STATUS
      // --------------------------------------------------------

      const amountStatus =
        achievedAmount >= amountTarget
          ? "ACHIEVED"
          : "PENDING";

      const tyreStatus =
        achievedTyres >= tyreTarget
          ? "ACHIEVED"
          : "PENDING";

      return res.json({
        success: true,
        data: {
          period: {
            year,
            month,
          },

          target: {
            amount: amountTarget,
            tyres: tyreTarget,
            tyreTargetType: target.tyre_target_type,
          },

          achieved: {
            amount: achievedAmount,
            tyres: achievedTyres,
          },

          remaining: {
            amount: amountRemaining,
            tyres: tyreRemaining,
          },

          excess: {
            amount: amountExcess,
            tyres: tyreExcess,
          },

          achievementPercentage: {
            amount: amountAchievementPercentage,
            tyres: tyreAchievementPercentage,
          },

          status: {
            amount: amountStatus,
            tyres: tyreStatus,
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
      const { id } = req.params;

      if (!organizationId) {
        throw new AppError("organizationId is required", 400);
      }

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

      const {
        amountTarget,
        tyreTarget,
        tyreTargetType,
      } = req.body;

      const amount =
        amountTarget !== undefined
          ? Number(amountTarget)
          : Number(existingTarget.amount_target);

      const tyre =
        tyreTarget !== undefined
          ? Number(tyreTarget)
          : Number(existingTarget.tyre_target);

      const targetType =
        tyreTargetType !== undefined
          ? tyreTargetType
          : existingTarget.tyre_target_type;

      validateTargetType(targetType);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new AppError(
          "amountTarget must be 0 or greater",
          400
        );
      }

      if (!Number.isInteger(tyre) || tyre < 0) {
        throw new AppError(
          "tyreTarget must be 0 or greater",
          400
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
        UPDATE monthly_targets
        SET
          amount_target = ?,
          tyre_target = ?,
          tyre_target_type = ?,
          last_modified_at = ?,
          last_modified_by = ?
        WHERE id = ?
          AND organization_id = ?
        `,
        [
          amount,
          tyre,
          targetType,
          now,
          req.user.id,
          id,
          organizationId,
        ]
      );

      const updatedTarget = await getOne(
        `
        SELECT *
        FROM monthly_targets
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        success: true,
        message: "Target updated successfully",
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
        throw new AppError("organizationId is required", 400);
      }

      const targets = await query(
        `
        SELECT *
        FROM monthly_targets
        WHERE organization_id = ?
        ORDER BY target_year DESC, target_month DESC
        `,
        [organizationId]
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