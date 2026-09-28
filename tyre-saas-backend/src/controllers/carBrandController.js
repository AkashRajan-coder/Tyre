const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

class CarBrandController {
  // =========================
  // LIST CAR BRANDS
  // =========================
  static async listCarBrands(req, res, next) {
    try {
      const organizationId = req.user.organizationId;

      const brands = await query(
        `
          SELECT
            id,
            organization_id,
            name,
            is_active,
            created_at,
            last_modified_at
          FROM car_brands
          WHERE organization_id = ?
          ORDER BY name ASC
        `,
        [organizationId]
      );

      res.json({
        success: true,
        data: brands,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // CREATE CAR BRAND
  // =========================
  static async createCarBrand(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw new AppError("Car brand name is required", 400);
      }

      const existingBrand = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE organization_id = ?
            AND LOWER(name) = LOWER(?)
        `,
        [organizationId, name.trim()]
      );

      if (existingBrand) {
        throw new AppError("Car brand already exists", 409);
      }

      const id = uuid();
      const now = new Date();

      await execute(
        `
          INSERT INTO car_brands (
            id,
            organization_id,
            name,
            is_active,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by
          )
          VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          name.trim(),
          now,
          req.user.id,
          now,
          req.user.id,
        ]
      );

      const brand = await getOne(
        `
          SELECT
            id,
            organization_id,
            name,
            is_active,
            created_at,
            last_modified_at
          FROM car_brands
          WHERE id = ?
        `,
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Car brand created successfully",
        data: brand,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // UPDATE CAR BRAND
  // =========================
  static async updateCarBrand(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw new AppError("Car brand name is required", 400);
      }

      const brand = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!brand) {
        throw new AppError("Car brand not found", 404);
      }

      const duplicate = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE organization_id = ?
            AND LOWER(name) = LOWER(?)
            AND id <> ?
        `,
        [organizationId, name.trim(), id]
      );

      if (duplicate) {
        throw new AppError("Car brand already exists", 409);
      }

      const now = new Date();

      await execute(
        `
          UPDATE car_brands
          SET
            name = ?,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
            AND organization_id = ?
        `,
        [
          name.trim(),
          now,
          req.user.id,
          id,
          organizationId,
        ]
      );

      const updatedBrand = await getOne(
        `
          SELECT
            id,
            organization_id,
            name,
            is_active,
            created_at,
            last_modified_at
          FROM car_brands
          WHERE id = ?
        `,
        [id]
      );

      res.json({
        success: true,
        message: "Car brand updated successfully",
        data: updatedBrand,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // DEACTIVATE CAR BRAND
  // =========================
  static async deactivateCarBrand(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;

      const brand = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!brand) {
        throw new AppError("Car brand not found", 404);
      }

      await execute(
        `
          UPDATE car_brands
          SET
            is_active = 0,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
            AND organization_id = ?
        `,
        [
          new Date(),
          req.user.id,
          id,
          organizationId,
        ]
      );

      res.json({
        success: true,
        message: "Car brand deactivated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // ACTIVATE CAR BRAND
  // =========================
  static async activateCarBrand(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;

      const brand = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!brand) {
        throw new AppError("Car brand not found", 404);
      }

      await execute(
        `
          UPDATE car_brands
          SET
            is_active = 1,
            last_modified_at = ?,
            last_modified_by = ?
          WHERE id = ?
            AND organization_id = ?
        `,
        [
          new Date(),
          req.user.id,
          id,
          organizationId,
        ]
      );

      res.json({
        success: true,
        message: "Car brand activated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CarBrandController;