const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

// ============================================================
// VERIFY ENQUIRY ACCESS
// ============================================================

async function verifyEnquiryAccess(req, enquiryId) {

  const enquiry = await getOne(
    `
      SELECT
        ce.*,
        s.name AS shop_name
      FROM customer_enquiries ce
      INNER JOIN shops s
        ON s.id = ce.shop_id
      WHERE ce.id = ?
        AND ce.is_deleted = 0
    `,
    [enquiryId]
  );

  if (!enquiry) {
    throw new AppError(
      "Enquiry not found",
      404
    );
  }

  // ----------------------------------------------------------
  // Organization isolation
  // ----------------------------------------------------------

  if (
    req.user.role !== "SUPER_ADMIN" &&
    enquiry.organization_id !== req.user.organizationId
  ) {
    throw new AppError(
      "Enquiry not found",
      404
    );
  }

  // ----------------------------------------------------------
  // Employee shop assignment
  // ----------------------------------------------------------

  if (req.user.role === "EMPLOYEE") {

    const isAssigned = await getOne(
      `
        SELECT id
        FROM user_shops
        WHERE user_id = ?
          AND shop_id = ?
      `,
      [
        req.user.id,
        enquiry.shop_id,
      ]
    );

    if (!isAssigned) {
      throw new AppError(
        "Access denied: You are not assigned to this shop",
        403
      );
    }
  }

  return enquiry;
}

class EnquiryTyreOptionController {

  // ============================================================
  // ADD TYRE OPTION
  // ============================================================

  static async createOption(req, res, next) {
    try {

      const { enquiryId } = req.params;

      const {
        tyreProductId,
        optionOrder,
      } = req.body;

      // --------------------------------------------------------
      // Basic validation
      // --------------------------------------------------------

      if (!tyreProductId) {
        throw new AppError(
          "tyreProductId is required",
          400
        );
      }

      if (
        optionOrder === undefined ||
        optionOrder === null
      ) {
        throw new AppError(
          "optionOrder is required",
          400
        );
      }

      const order = Number(optionOrder);

      if (![1, 2, 3].includes(order)) {
        throw new AppError(
          "optionOrder must be 1, 2, or 3",
          400
        );
      }

      // --------------------------------------------------------
      // Verify enquiry access
      // --------------------------------------------------------

      const enquiry = await verifyEnquiryAccess(
        req,
        enquiryId
      );

      // --------------------------------------------------------
      // Check maximum 3 options
      // --------------------------------------------------------

      const optionCount = await getOne(
        `
          SELECT COUNT(*) AS count
          FROM enquiry_tyre_options
          WHERE enquiry_id = ?
        `,
        [enquiryId]
      );

      if (Number(optionCount?.count || 0) >= 3) {
        throw new AppError(
          "An enquiry can have a maximum of 3 tyre options",
          400
        );
      }

      // --------------------------------------------------------
      // Check option order already used
      // --------------------------------------------------------

      const existingOrder = await getOne(
        `
          SELECT id
          FROM enquiry_tyre_options
          WHERE enquiry_id = ?
            AND option_order = ?
          LIMIT 1
        `,
        [
          enquiryId,
          order,
        ]
      );

      if (existingOrder) {
        throw new AppError(
          `Option ${order} is already used for this enquiry`,
          409
        );
      }

      // --------------------------------------------------------
      // Get tyre product
      //
      // Product must belong to same organization
      // and must be active.
      // --------------------------------------------------------

      const tyreProduct = await getOne(
        `
          SELECT
            tp.*,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM tyre_products tp

          INNER JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id

          INNER JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id

          WHERE tp.id = ?
            AND tp.organization_id = ?
            AND tp.is_active = 1
            AND ts.is_active = 1
            AND tb.is_active = 1
          LIMIT 1
        `,
        [
          tyreProductId,
          enquiry.organization_id,
        ]
      );

      if (!tyreProduct) {
        throw new AppError(
          "Tyre product not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // Prevent same product from being added twice
      // --------------------------------------------------------

      const existingProduct = await getOne(
        `
          SELECT id
          FROM enquiry_tyre_options
          WHERE enquiry_id = ?
            AND tyre_product_id = ?
          LIMIT 1
        `,
        [
          enquiryId,
          tyreProductId,
        ]
      );

      if (existingProduct) {
        throw new AppError(
          "This tyre product is already added to the enquiry",
          409
        );
      }

      // --------------------------------------------------------
      // Price snapshot
      // --------------------------------------------------------

      const price = tyreProduct.price;

      const id = uuid();
      const now = new Date().toISOString();

      // --------------------------------------------------------
      // Insert option
      // --------------------------------------------------------

      await execute(
        `
          INSERT INTO enquiry_tyre_options
          (
            id,
            enquiry_id,
            tyre_product_id,
            price,
            option_order,
            created_at,
            created_by
          )
          VALUES
          (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `,
        [
          id,
          enquiryId,
          tyreProductId,
          price,
          order,
          now,
          req.user.id,
        ]
      );

      // --------------------------------------------------------
      // Return created option
      // --------------------------------------------------------

      const createdOption = await getOne(
        `
          SELECT
            eto.*,
            tp.vehicle_type,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM enquiry_tyre_options eto

          INNER JOIN tyre_products tp
            ON tp.id = eto.tyre_product_id

          INNER JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id

          INNER JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id

          WHERE eto.id = ?
        `,
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Tyre option added successfully",
        data: createdOption,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // LIST TYRE OPTIONS
  // ============================================================

  static async listOptions(req, res, next) {
    try {

      const { enquiryId } = req.params;

      await verifyEnquiryAccess(
        req,
        enquiryId
      );

      const options = await query(
        `
          SELECT
            eto.id,
            eto.enquiry_id,
            eto.tyre_product_id,
            eto.price,
            eto.option_order,
            eto.created_at,
            eto.created_by,

            tp.vehicle_type,

            ts.id AS tyre_size_id,
            ts.size AS tyre_size,

            tb.id AS tyre_brand_id,
            tb.name AS tyre_brand

          FROM enquiry_tyre_options eto

          INNER JOIN tyre_products tp
            ON tp.id = eto.tyre_product_id

          INNER JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id

          INNER JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id

          WHERE eto.enquiry_id = ?

          ORDER BY eto.option_order ASC
        `,
        [enquiryId]
      );

      res.json({
        success: true,
        data: options,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // UPDATE TYRE OPTION
  //
  // Can change:
  // - tyre product
  // - option order
  //
  // Price is refreshed from the selected product.
  // ============================================================

  static async updateOption(req, res, next) {
    try {

      const {
        enquiryId,
        id,
      } = req.params;

      const {
        tyreProductId,
        optionOrder,
      } = req.body;

      await verifyEnquiryAccess(
        req,
        enquiryId
      );

      // --------------------------------------------------------
      // Find existing option
      // --------------------------------------------------------

      const existingOption = await getOne(
        `
          SELECT *
          FROM enquiry_tyre_options
          WHERE id = ?
            AND enquiry_id = ?
        `,
        [
          id,
          enquiryId,
        ]
      );

      if (!existingOption) {
        throw new AppError(
          "Tyre option not found",
          404
        );
      }

      const newProductId =
        tyreProductId || existingOption.tyre_product_id;

      const newOrder =
        optionOrder !== undefined
          ? Number(optionOrder)
          : existingOption.option_order;

      if (![1, 2, 3].includes(newOrder)) {
        throw new AppError(
          "optionOrder must be 1, 2, or 3",
          400
        );
      }

      // --------------------------------------------------------
      // Check duplicate option order
      // --------------------------------------------------------

      const duplicateOrder = await getOne(
        `
          SELECT id
          FROM enquiry_tyre_options
          WHERE enquiry_id = ?
            AND option_order = ?
            AND id != ?
          LIMIT 1
        `,
        [
          enquiryId,
          newOrder,
          id,
        ]
      );

      if (duplicateOrder) {
        throw new AppError(
          `Option ${newOrder} is already used for this enquiry`,
          409
        );
      }

      // --------------------------------------------------------
      // Get product
      // --------------------------------------------------------

      const enquiry = await verifyEnquiryAccess(
        req,
        enquiryId
      );

      const tyreProduct = await getOne(
        `
          SELECT
            tp.*,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM tyre_products tp

          INNER JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id

          INNER JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id

          WHERE tp.id = ?
            AND tp.organization_id = ?
            AND tp.is_active = 1
            AND ts.is_active = 1
            AND tb.is_active = 1
          LIMIT 1
        `,
        [
          newProductId,
          enquiry.organization_id,
        ]
      );

      if (!tyreProduct) {
        throw new AppError(
          "Tyre product not found, inactive, or access denied",
          404
        );
      }

      // --------------------------------------------------------
      // Prevent duplicate product
      // --------------------------------------------------------

      const duplicateProduct = await getOne(
        `
          SELECT id
          FROM enquiry_tyre_options
          WHERE enquiry_id = ?
            AND tyre_product_id = ?
            AND id != ?
          LIMIT 1
        `,
        [
          enquiryId,
          newProductId,
          id,
        ]
      );

      if (duplicateProduct) {
        throw new AppError(
          "This tyre product is already added to the enquiry",
          409
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE enquiry_tyre_options
          SET
            tyre_product_id = ?,
            price = ?,
            option_order = ?
          WHERE id = ?
            AND enquiry_id = ?
        `,
        [
          newProductId,
          tyreProduct.price,
          newOrder,
          id,
          enquiryId,
        ]
      );

      const updatedOption = await getOne(
        `
          SELECT
            eto.*,
            tp.vehicle_type,
            ts.size AS tyre_size,
            tb.name AS tyre_brand
          FROM enquiry_tyre_options eto

          INNER JOIN tyre_products tp
            ON tp.id = eto.tyre_product_id

          INNER JOIN tyre_sizes ts
            ON ts.id = tp.tyre_size_id

          INNER JOIN tyre_brands tb
            ON tb.id = tp.tyre_brand_id

          WHERE eto.id = ?
        `,
        [id]
      );

      res.json({
        success: true,
        message: "Tyre option updated successfully",
        data: updatedOption,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // DELETE TYRE OPTION
  // ============================================================

  static async deleteOption(req, res, next) {
    try {

      const {
        enquiryId,
        id,
      } = req.params;

      await verifyEnquiryAccess(
        req,
        enquiryId
      );

      const existingOption = await getOne(
        `
          SELECT id
          FROM enquiry_tyre_options
          WHERE id = ?
            AND enquiry_id = ?
        `,
        [
          id,
          enquiryId,
        ]
      );

      if (!existingOption) {
        throw new AppError(
          "Tyre option not found",
          404
        );
      }

      await execute(
        `
          DELETE FROM enquiry_tyre_options
          WHERE id = ?
            AND enquiry_id = ?
        `,
        [
          id,
          enquiryId,
        ]
      );

      res.json({
        success: true,
        message: "Tyre option removed successfully",
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = EnquiryTyreOptionController;