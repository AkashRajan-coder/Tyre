const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

function getOrgScope(req) {
  if (req.user.role === "SUPER_ADMIN") {
    return req.query.organizationId || null;
  }

  return req.user.organizationId;
}

class TyreProductController {

  // ============================================================
  // CREATE TYRE PRODUCT
  // ============================================================

  static async createTyreProduct(req, res, next) {
    try {
      const orgId = getOrgScope(req);

      if (!orgId) {
        throw new AppError(
          "organizationId is required",
          400
        );
      }

      const {
        tyreSizeId,
        tyreBrandId,
        vehicleType,
        price,
      } = req.body;

      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (!tyreSizeId) {
        throw new AppError(
          "Tyre size is required",
          400
        );
      }

      if (!tyreBrandId) {
        throw new AppError(
          "Tyre brand is required",
          400
        );
      }

      if (!vehicleType) {
        throw new AppError(
          "Vehicle type is required",
          400
        );
      }

      if (
        !["TWO_WHEELER", "FOUR_WHEELER"].includes(
          vehicleType
        )
      ) {
        throw new AppError(
          "Vehicle type must be TWO_WHEELER or FOUR_WHEELER",
          400
        );
      }

      if (
        price === undefined ||
        price === null ||
        price === ""
      ) {
        throw new AppError(
          "Price is required",
          400
        );
      }

      const numericPrice = Number(price);

      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        throw new AppError(
          "Price must be a valid number greater than or equal to 0",
          400
        );
      }

      // --------------------------------------------------------
      // CHECK TYRE SIZE
      // Same organization + active
      // --------------------------------------------------------

      const tyreSize = await getOne(
        `
          SELECT id
          FROM tyre_sizes
          WHERE id = ?
            AND organization_id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [
          tyreSizeId,
          orgId,
        ]
      );

      if (!tyreSize) {
        throw new AppError(
          "Tyre size not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // CHECK TYRE BRAND
      // Same organization + active
      // --------------------------------------------------------

      const tyreBrand = await getOne(
        `
          SELECT id
          FROM tyre_brands
          WHERE id = ?
            AND organization_id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [
          tyreBrandId,
          orgId,
        ]
      );

      if (!tyreBrand) {
        throw new AppError(
          "Tyre brand not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // CHECK DUPLICATE PRODUCT
      // --------------------------------------------------------

      const existingProduct = await getOne(
        `
          SELECT id
          FROM tyre_products
          WHERE organization_id = ?
            AND tyre_size_id = ?
            AND tyre_brand_id = ?
            AND vehicle_type = ?
          LIMIT 1
        `,
        [
          orgId,
          tyreSizeId,
          tyreBrandId,
          vehicleType,
        ]
      );

      if (existingProduct) {
        throw new AppError(
          "This tyre product already exists",
          409
        );
      }

      // --------------------------------------------------------
      // CREATE PRODUCT
      // --------------------------------------------------------

      const id = uuid();
      const now = new Date().toISOString();

      await execute(
        `
          INSERT INTO tyre_products
          (
            id,
            organization_id,
            tyre_size_id,
            tyre_brand_id,
            vehicle_type,
            price,
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
          tyreSizeId,
          tyreBrandId,
          vehicleType,
          numericPrice,
          now,
          req.user.id,
          now,
          req.user.id,
        ]
      );

      // --------------------------------------------------------
      // RETURN CREATED PRODUCT
      // --------------------------------------------------------

      const tyreProduct = await getOne(
        `
          SELECT
            tp.*,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM tyre_products tp
          JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id
          JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id
          WHERE tp.id = ?
        `,
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Tyre product created successfully",
        data: tyreProduct,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // LIST TYRE PRODUCTS
  // Active + Inactive
  // ============================================================

  static async listTyreProducts(req, res, next) {
    try {
      const orgId = getOrgScope(req);

      let sql = `
        SELECT
          tp.*,
          ts.size AS tyre_size,
          tb.name AS tyre_brand
        FROM tyre_products tp
        JOIN tyre_sizes ts
          ON ts.id = tp.tyre_size_id
        JOIN tyre_brands tb
          ON tb.id = tp.tyre_brand_id
        WHERE 1 = 1
      `;

      const params = [];

      if (orgId) {
        sql += `
          AND tp.organization_id = ?
        `;

        params.push(orgId);
      }

      sql += `
        ORDER BY tb.name ASC, ts.size ASC
      `;

      const tyreProducts = await query(
        sql,
        params
      );

      res.json({
        success: true,
        data: tyreProducts,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // UPDATE TYRE PRODUCT
  // ============================================================

  static async updateTyreProduct(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      const {
        tyreSizeId,
        tyreBrandId,
        vehicleType,
        price,
      } = req.body;

      // --------------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------------

      if (!tyreSizeId) {
        throw new AppError(
          "Tyre size is required",
          400
        );
      }

      if (!tyreBrandId) {
        throw new AppError(
          "Tyre brand is required",
          400
        );
      }

      if (!vehicleType) {
        throw new AppError(
          "Vehicle type is required",
          400
        );
      }

      if (
        !["TWO_WHEELER", "FOUR_WHEELER"].includes(
          vehicleType
        )
      ) {
        throw new AppError(
          "Vehicle type must be TWO_WHEELER or FOUR_WHEELER",
          400
        );
      }

      if (
        price === undefined ||
        price === null ||
        price === ""
      ) {
        throw new AppError(
          "Price is required",
          400
        );
      }

      const numericPrice = Number(price);

      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        throw new AppError(
          "Price must be a valid number greater than or equal to 0",
          400
        );
      }

      // --------------------------------------------------------
      // FIND EXISTING PRODUCT
      // --------------------------------------------------------

      let checkSql = `
        SELECT *
        FROM tyre_products
        WHERE id = ?
      `;

      const checkParams = [id];

      if (orgId) {
        checkSql += `
          AND organization_id = ?
        `;

        checkParams.push(orgId);
      }

      const tyreProduct = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreProduct) {
        throw new AppError(
          "Tyre product not found or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // CHECK TYRE SIZE
      // --------------------------------------------------------

      const tyreSize = await getOne(
        `
          SELECT id
          FROM tyre_sizes
          WHERE id = ?
            AND organization_id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [
          tyreSizeId,
          tyreProduct.organization_id,
        ]
      );

      if (!tyreSize) {
        throw new AppError(
          "Tyre size not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // CHECK TYRE BRAND
      // --------------------------------------------------------

      const tyreBrand = await getOne(
        `
          SELECT id
          FROM tyre_brands
          WHERE id = ?
            AND organization_id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [
          tyreBrandId,
          tyreProduct.organization_id,
        ]
      );

      if (!tyreBrand) {
        throw new AppError(
          "Tyre brand not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // CHECK DUPLICATE PRODUCT
      // --------------------------------------------------------

      const duplicateProduct = await getOne(
        `
          SELECT id
          FROM tyre_products
          WHERE organization_id = ?
            AND tyre_size_id = ?
            AND tyre_brand_id = ?
            AND vehicle_type = ?
            AND id != ?
          LIMIT 1
        `,
        [
          tyreProduct.organization_id,
          tyreSizeId,
          tyreBrandId,
          vehicleType,
          id,
        ]
      );

      if (duplicateProduct) {
        throw new AppError(
          "This tyre product already exists",
          409
        );
      }

      // --------------------------------------------------------
      // UPDATE PRODUCT
      // --------------------------------------------------------

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_products
          SET
            tyre_size_id = ?,
            tyre_brand_id = ?,
            vehicle_type = ?,
            price = ?,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
        `,
        [
          tyreSizeId,
          tyreBrandId,
          vehicleType,
          numericPrice,
          now,
          req.user.id,
          id,
        ]
      );

      // --------------------------------------------------------
      // RETURN UPDATED PRODUCT
      // --------------------------------------------------------

      const updatedTyreProduct = await getOne(
        `
          SELECT
            tp.*,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM tyre_products tp
          JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id
          JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id
          WHERE tp.id = ?
        `,
        [id]
      );

      res.json({
        success: true,
        message: "Tyre product updated successfully",
        data: updatedTyreProduct,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // DEACTIVATE TYRE PRODUCT
  // ============================================================

  static async deactivateTyreProduct(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      let checkSql = `
        SELECT id
        FROM tyre_products
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

      const tyreProduct = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreProduct) {
        throw new AppError(
          "Tyre product not found or already inactive",
          404
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_products
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
        message: "Tyre product deactivated successfully",
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // ACTIVATE TYRE PRODUCT
  // ============================================================

  static async activateTyreProduct(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      let checkSql = `
        SELECT id
        FROM tyre_products
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

      const tyreProduct = await getOne(
        checkSql,
        checkParams
      );

      if (!tyreProduct) {
        throw new AppError(
          "Tyre product not found or already active",
          404
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE tyre_products
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
        message: "Tyre product activated successfully",
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
// LIST AVAILABLE TYRE PRODUCTS FOR EMPLOYEE
// Active products only
// ============================================================

static async listAvailableTyreProducts(req, res, next) {
  try {
    const orgId = req.user.organizationId;

    if (!orgId && req.user.role !== "SUPER_ADMIN") {
      throw new AppError(
        "Organization not found",
        400
      );
    }

    const {
      vehicleType,
      tyreSizeId,
      tyreBrandId,
    } = req.query;

    let sql = `
      SELECT
        tp.id,
        tp.organization_id,
        tp.tyre_size_id,
        tp.tyre_brand_id,
        tp.vehicle_type,
        tp.price,
        tp.is_active,

        ts.size AS tyre_size,
        tb.name AS tyre_brand

      FROM tyre_products tp

      JOIN tyre_sizes ts
        ON ts.id = tp.tyre_size_id

      JOIN tyre_brands tb
        ON tb.id = tp.tyre_brand_id

      WHERE tp.is_active = 1
        AND ts.is_active = 1
        AND tb.is_active = 1
    `;

    const params = [];

    // --------------------------------------------------------
    // Organization isolation
    // --------------------------------------------------------

    if (req.user.role !== "SUPER_ADMIN") {
      sql += `
        AND tp.organization_id = ?
      `;

      params.push(orgId);
    } else if (req.query.organizationId) {
      sql += `
        AND tp.organization_id = ?
      `;

      params.push(req.query.organizationId);
    }

    // --------------------------------------------------------
    // Optional vehicle type filter
    // --------------------------------------------------------

    if (vehicleType) {
      if (
        ![
          "TWO_WHEELER",
          "FOUR_WHEELER",
        ].includes(vehicleType)
      ) {
        throw new AppError(
          "vehicleType must be TWO_WHEELER or FOUR_WHEELER",
          400
        );
      }

      sql += `
        AND tp.vehicle_type = ?
      `;

      params.push(vehicleType);
    }

    // --------------------------------------------------------
    // Optional tyre size filter
    // --------------------------------------------------------

    if (tyreSizeId) {
      sql += `
        AND tp.tyre_size_id = ?
      `;

      params.push(tyreSizeId);
    }

    // --------------------------------------------------------
    // Optional tyre brand filter
    // --------------------------------------------------------

    if (tyreBrandId) {
      sql += `
        AND tp.tyre_brand_id = ?
      `;

      params.push(tyreBrandId);
    }

    sql += `
      ORDER BY
        tb.name ASC,
        ts.size ASC
    `;

    const products = await query(
      sql,
      params
    );

    res.json({
      success: true,
      data: products,
    });

  } catch (error) {
    next(error);
  }
}
}

module.exports = TyreProductController;