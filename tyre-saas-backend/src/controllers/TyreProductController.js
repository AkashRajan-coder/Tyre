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
        productName,
        price = 0,
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

      if (price !== undefined && price !== null && (Number.isNaN(Number(price)) || Number(price) < 0)) {
        throw new AppError("price must be a valid non-negative number", 400);
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
            AND (organization_id = ? OR organization_id IS NULL)
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
            AND (organization_id = ? OR organization_id IS NULL)
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
            product_name,
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
          productName ? productName.trim() : null,
          Number(price) || 0,
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
        productName,
        price,
        isActive,
      } = req.body;

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
      // PARTIAL VALIDATION - Validate only provided fields
      // --------------------------------------------------------

      if (tyreSizeId !== undefined) {
        const tyreSize = await getOne(
          `
            SELECT id
            FROM tyre_sizes
            WHERE id = ?
              AND (organization_id = ? OR organization_id IS NULL)
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
      }

      if (tyreBrandId !== undefined) {
        const tyreBrand = await getOne(
          `
            SELECT id
            FROM tyre_brands
            WHERE id = ?
              AND (organization_id = ? OR organization_id IS NULL)
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
      }

      if (vehicleType !== undefined) {
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
      }

      if (price !== undefined) {
        if (price === null || Number.isNaN(Number(price)) || Number(price) < 0) {
          throw new AppError(
            "price must be a valid non-negative number",
            400
          );
        }
      }

      // --------------------------------------------------------
      // CHECK DUPLICATE PRODUCT (if size, brand, or vehicle type changed)
      // --------------------------------------------------------

      const targetSizeId = tyreSizeId !== undefined ? tyreSizeId : tyreProduct.tyre_size_id;
      const targetBrandId = tyreBrandId !== undefined ? tyreBrandId : tyreProduct.tyre_brand_id;
      const targetVehicleType = vehicleType !== undefined ? vehicleType : tyreProduct.vehicle_type;

      if (
        tyreSizeId !== undefined ||
        tyreBrandId !== undefined ||
        vehicleType !== undefined
      ) {
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
            targetSizeId,
            targetBrandId,
            targetVehicleType,
            id,
          ]
        );

        if (duplicateProduct) {
          throw new AppError(
            "This tyre product already exists",
            409
          );
        }
      }

      // --------------------------------------------------------
      // DYNAMIC UPDATE PRODUCT
      // --------------------------------------------------------

      const updateFields = [];
      const updateParams = [];

      if (tyreSizeId !== undefined) {
        updateFields.push("tyre_size_id = ?");
        updateParams.push(tyreSizeId);
      }

      if (tyreBrandId !== undefined) {
        updateFields.push("tyre_brand_id = ?");
        updateParams.push(tyreBrandId);
      }

      if (vehicleType !== undefined) {
        updateFields.push("vehicle_type = ?");
        updateParams.push(vehicleType);
      }

      if (productName !== undefined) {
        updateFields.push("product_name = ?");
        updateParams.push(productName ? productName.trim() : null);
      }

      if (price !== undefined) {
        updateFields.push("price = ?");
        updateParams.push(Number(price));
      }

      if (isActive !== undefined) {
        updateFields.push("is_active = ?");
        updateParams.push(
          isActive === true || isActive === 1 || isActive === "1" ? 1 : 0
        );
      }

      const now = new Date().toISOString();
      updateFields.push("last_modified_at = ?");
      updateParams.push(now);

      updateFields.push("last_modified_by = ?");
      updateParams.push(req.user.id);

      updateParams.push(id);

      await execute(
        `
          UPDATE tyre_products
          SET ${updateFields.join(", ")}
          WHERE id = ?
        `,
        updateParams
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
        tp.product_name,
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