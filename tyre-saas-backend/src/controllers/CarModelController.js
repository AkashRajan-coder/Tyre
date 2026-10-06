const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

class CarModelController {
  // =========================
  // LIST CAR MODELS
  // =========================
  static async listCarModels(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { brandId } = req.query;

      let sql = `
        SELECT
          cm.id,
          cm.organization_id,
          cm.car_brand_id,
          cb.name AS brand_name,
          cm.name,
          cm.is_active,
          cm.created_at,
          cm.last_modified_at
        FROM car_models cm
        JOIN car_brands cb
          ON cb.id = cm.car_brand_id
        WHERE (cm.organization_id = ? OR cm.organization_id IS NULL)
      `;

      const params = [organizationId];

      if (brandId) {
        sql += ` AND cm.car_brand_id = ?`;
        params.push(brandId);
      }

      sql += ` ORDER BY cb.name ASC, cm.name ASC`;

      const models = await query(sql, params);

      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // CREATE CAR MODEL
  // =========================
  static async createCarModel(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { brandId, name } = req.body;

      if (!brandId) {
        throw new AppError("Car brand is required", 400);
      }

      if (!name || !name.trim()) {
        throw new AppError("Car model name is required", 400);
      }

      const brand = await getOne(
        `
          SELECT id
          FROM car_brands
          WHERE id = ?
            AND organization_id = ?
            AND is_active = 1
        `,
        [brandId, organizationId]
      );

      if (!brand) {
        throw new AppError("Car brand not found or inactive", 404);
      }

      const existingModel = await getOne(
        `
          SELECT id
          FROM car_models
          WHERE car_brand_id = ?
            AND LOWER(name) = LOWER(?)
        `,
        [brandId, name.trim()]
      );

      if (existingModel) {
        throw new AppError("Car model already exists for this brand", 409);
      }

      const id = uuid();
      const now = new Date();

      await execute(
        `
          INSERT INTO car_models (
            id,
            organization_id,
            car_brand_id,
            name,
            is_active,
            created_at,
            created_by,
            last_modified_at,
            last_modified_by
          )
          VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
        `,
        [
          id,
          organizationId,
          brandId,
          name.trim(),
          now,
          req.user.id,
          now,
          req.user.id,
        ]
      );

      const model = await getOne(
        `
          SELECT
            cm.id,
            cm.organization_id,
            cm.car_brand_id,
            cb.name AS brand_name,
            cm.name,
            cm.is_active,
            cm.created_at,
            cm.last_modified_at
          FROM car_models cm
          JOIN car_brands cb
            ON cb.id = cm.car_brand_id
          WHERE cm.id = ?
        `,
        [id]
      );

      res.status(201).json({
        success: true,
        message: "Car model created successfully",
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // UPDATE CAR MODEL
  // =========================
  static async updateCarModel(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;
      const { name } = req.body;

      if (!name || !name.trim()) {
        throw new AppError("Car model name is required", 400);
      }

      const model = await getOne(
        `
          SELECT id, car_brand_id
          FROM car_models
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!model) {
        throw new AppError("Car model not found", 404);
      }

      const duplicate = await getOne(
        `
          SELECT id
          FROM car_models
          WHERE car_brand_id = ?
            AND LOWER(name) = LOWER(?)
            AND id <> ?
        `,
        [model.car_brand_id, name.trim(), id]
      );

      if (duplicate) {
        throw new AppError("Car model already exists for this brand", 409);
      }

      const now = new Date();

      await execute(
        `
          UPDATE car_models
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

      const updatedModel = await getOne(
        `
          SELECT
            cm.id,
            cm.organization_id,
            cm.car_brand_id,
            cb.name AS brand_name,
            cm.name,
            cm.is_active,
            cm.created_at,
            cm.last_modified_at
          FROM car_models cm
          JOIN car_brands cb
            ON cb.id = cm.car_brand_id
          WHERE cm.id = ?
        `,
        [id]
      );

      res.json({
        success: true,
        message: "Car model updated successfully",
        data: updatedModel,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // DEACTIVATE CAR MODEL
  // =========================
  static async deactivateCarModel(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;

      const model = await getOne(
        `
          SELECT id
          FROM car_models
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!model) {
        throw new AppError("Car model not found", 404);
      }

      await execute(
        `
          UPDATE car_models
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
        message: "Car model deactivated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================
  // ACTIVATE CAR MODEL
  // =========================
  static async activateCarModel(req, res, next) {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;

      const model = await getOne(
        `
          SELECT id
          FROM car_models
          WHERE id = ?
            AND organization_id = ?
        `,
        [id, organizationId]
      );

      if (!model) {
        throw new AppError("Car model not found", 404);
      }

      await execute(
        `
          UPDATE car_models
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
        message: "Car model activated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CarModelController;