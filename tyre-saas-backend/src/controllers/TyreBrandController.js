const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

function getOrgScope(req) {
  if (req.user.role === "SUPER_ADMIN") {
    return req.query.organizationId || null;
  }

  return req.user.organizationId;
}

class TyreBrandController {

  // ============================================================
  // CREATE TYRE BRAND
  // ============================================================

  static async createTyreBrand(req, res, next) {
    try {
      const orgId = getOrgScope(req);

      if (!orgId) {
        throw new AppError(
          "organizationId is required",
          400
        );
      }

      const { name } = req.body;

      if (!name || !name.trim()) {
        throw new AppError(
          "Tyre brand name is required",
          400
        );
      }

      const normalizedName = name.trim();

      // --------------------------------------------------------
      // Check duplicate within same organization
      // --------------------------------------------------------

      const existingBrand = await getOne(
        `
          SELECT id
          FROM tyre_brands
          WHERE organization_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
            AND is_active = 1
          LIMIT 1
        `,
        [
          orgId,
          normalizedName,
        ]
      );

      if (existingBrand) {
        throw new AppError(
          "This tyre brand already exists",
          409
        );
      }

      // --------------------------------------------------------
      // Create brand
      // --------------------------------------------------------

      const id = uuid();
      const now = new Date().toISOString();

      await execute(
        `
          INSERT INTO tyre_brands
          (
            id,
            organization_id,
            name,
            is_active,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by
          )
          VALUES
          (
            ?,
            ?,
            ?,
            1,
            ?,
            ?,
            ?,
            ?
          )
        `,
        [
          id,
          orgId,
          normalizedName,
          now,
          req.user.id,
          now,
          req.user.id,
        ]
      );

      // --------------------------------------------------------
      // Get created brand
      // --------------------------------------------------------

      const tyreBrand = await getOne(
        `
          SELECT *
          FROM tyre_brands
          WHERE id = ?
        `,
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Tyre brand created successfully",
        data: tyreBrand,
      });

    } catch (error) {
      next(error);
    }
  }


  // ============================================================
  // LIST TYRE BRANDS
  // Active + Inactive
  // ============================================================

  static async listTyreBrands(req, res, next) {
    try {
      const orgId = getOrgScope(req);

      let sql = `
        SELECT *
        FROM tyre_brands
        WHERE 1 = 1
      `;

      const params = [];

      if (orgId) {
        sql += `
          AND organization_id = ?
        `;

        params.push(orgId);
      }

      sql += `
        ORDER BY name ASC
      `;

      const tyreBrands = await query(
        sql,
        params
      );

      res.json({
        success: true,
        data: tyreBrands,
      });

    } catch (error) {
      next(error);
    }
  }


  // ============================================================
  // UPDATE TYRE BRAND
  // ============================================================

  static async updateTyreBrand(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw new AppError(
          "Tyre brand name is required",
          400
        );
      }

      const normalizedName = name.trim();

      // --------------------------------------------------------
      // Find existing brand
      // --------------------------------------------------------

      let checkSql = `
        SELECT *
        FROM tyre_brands
        WHERE id = ?
      `;

      const checkParams = [id];

      if (orgId) {
        checkSql += `
          AND organization_id = ?
        `;

        checkParams.push(orgId);
      }

      const tyreBrand = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreBrand) {
        throw new AppError(
          "Tyre brand not found or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // Check duplicate
      // --------------------------------------------------------

      const duplicateBrand = await getOne(
        `
          SELECT id
          FROM tyre_brands
          WHERE organization_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
            AND id != ?
            AND is_active = 1
          LIMIT 1
        `,
        [
          tyreBrand.organization_id,
          normalizedName,
          id,
        ]
      );

      if (duplicateBrand) {
        throw new AppError(
          "This tyre brand already exists",
          409
        );
      }

      // --------------------------------------------------------
      // Update brand
      // --------------------------------------------------------

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_brands
          SET
            name = ?,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
        `,
        [
          normalizedName,
          now,
          req.user.id,
          id,
        ]
      );

      // --------------------------------------------------------
      // Get updated brand
      // --------------------------------------------------------

      const updatedTyreBrand = await getOne(
        `
          SELECT *
          FROM tyre_brands
          WHERE id = ?
        `,
        [id]
      );

      res.json({
        success: true,
        message: "Tyre brand updated successfully",
        data: updatedTyreBrand,
      });

    } catch (error) {
      next(error);
    }
  }


  // ============================================================
  // DEACTIVATE TYRE BRAND
  // ============================================================

  static async deactivateTyreBrand(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      let checkSql = `
        SELECT id
        FROM tyre_brands
        WHERE id = ?
          AND is_active = 1
      `;

      const checkParams = [id];

      if (orgId) {
        checkSql += `
          AND organization_id = ?
        `;

        checkParams.push(orgId);
      }

      const tyreBrand = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreBrand) {
        throw new AppError(
          "Tyre brand not found or already inactive",
          404
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_brands
          SET
            is_active = 0,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
        `,
        [
          now,
          req.user.id,
          id,
        ]
      );

      res.json({
        success: true,
        message: "Tyre brand deactivated successfully",
      });

    } catch (error) {
      next(error);
    }
  }


  // ============================================================
  // ACTIVATE TYRE BRAND
  // ============================================================

  static async activateTyreBrand(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      let checkSql = `
        SELECT id
        FROM tyre_brands
        WHERE id = ?
          AND is_active = 0
      `;

      const checkParams = [id];

      if (orgId) {
        checkSql += `
          AND organization_id = ?
        `;

        checkParams.push(orgId);
      }

      const tyreBrand = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreBrand) {
        throw new AppError(
          "Tyre brand not found or already active",
          404
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_brands
          SET
            is_active = 1,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
        `,
        [
          now,
          req.user.id,
          id,
        ]
      );

      res.json({
        success: true,
        message: "Tyre brand activated successfully",
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = TyreBrandController;