const { getOne, query, execute, uuid } = require("../config/db");
const { AppError } = require("../middlewares/error");

async function verifyShopAccess(userId, userRole, userOrgId, shopId) {
  const shop = await getOne(
    "SELECT id, organization_id, name FROM shops WHERE id = ? AND is_active = 1",
    [shopId]
  );

  if (!shop) {
    throw new AppError("Shop not found or inactive", 404);
  }

  if (
    userRole !== "SUPER_ADMIN" &&
    shop.organization_id !== userOrgId
  ) {
    throw new AppError(
      "Access denied: Shop belongs to another organization",
      403
    );
  }

  if (userRole === "EMPLOYEE") {
    const isAssigned = await getOne(
      "SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?",
      [userId, shopId]
    );

    if (!isAssigned) {
      throw new AppError(
        "Access denied: You are not assigned to this shop",
        403
      );
    }
  }

  return shop;
}

class EmployeeController {

  // ============================================================
  // 1. GET SHOPS
  // ============================================================

  static async getShops(req, res, next) {
    try {
      let shops = [];

      if (req.user.role === "SUPER_ADMIN") {
        shops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              code,
              address,
              phone
            FROM shops
            WHERE is_active = 1
            ORDER BY name ASC
          `
        );
      } else if (req.user.role === "ADMIN") {
        shops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              code,
              address,
              phone
            FROM shops
            WHERE organization_id = ?
              AND is_active = 1
            ORDER BY name ASC
          `,
          [req.user.organizationId]
        );
      } else {
        shops = await query(
          `
            SELECT
              s.id,
              s.organization_id,
              s.name,
              s.code,
              s.address,
              s.phone
            FROM shops s
            INNER JOIN user_shops us
              ON us.shop_id = s.id
            WHERE us.user_id = ?
              AND s.is_active = 1
            ORDER BY s.name ASC
          `,
          [req.user.id]
        );
      }

      res.json({
        success: true,
        data: shops,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 2. BANNER SUMMARY
  // ============================================================

  static async getBannerSummary(req, res, next) {
    try {
      const { shopId } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      const shop = await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        shopId
      );

      const now = new Date();

      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();

      const endOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      ).toISOString();

      const startOfTomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      ).toISOString();

      const endOfTomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        23,
        59,
        59,
        999
      ).toISOString();

      const [
        dueTodayRow,
        dueTomorrowRow,
        overdueRow,
        pendingRow,
        unfitRow,
        completedRow,
      ] = await Promise.all([

        // Due Today - FIT only
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND is_deleted = 0
              AND status = 'PENDING'
              AND fit_status = 'FIT'
              AND follow_up_date >= ?
              AND follow_up_date <= ?
          `,
          [
            shopId,
            startOfToday,
            endOfToday,
          ]
        ),

        // Due Tomorrow - FIT only
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND is_deleted = 0
              AND status = 'PENDING'
              AND fit_status = 'FIT'
              AND follow_up_date >= ?
              AND follow_up_date <= ?
          `,
          [
            shopId,
            startOfTomorrow,
            endOfTomorrow,
          ]
        ),

        // Overdue - FIT only
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND is_deleted = 0
              AND status = 'PENDING'
              AND fit_status = 'FIT'
              AND follow_up_date < ?
          `,
          [
            shopId,
            startOfToday,
          ]
        ),

        // Pending = FIT only
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND status = 'PENDING'
              AND fit_status = 'FIT'
              AND is_deleted = 0
          `,
          [shopId]
        ),

        // Unfit = NOT_FIT
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND status = 'PENDING'
              AND fit_status = 'NOT_FIT'
              AND is_deleted = 0
          `,
          [shopId]
        ),

        // Completed
        getOne(
          `
            SELECT COUNT(*) AS c
            FROM customer_enquiries
            WHERE shop_id = ?
              AND is_deleted = 0
              AND status = 'COMPLETED'
          `,
          [shopId]
        ),
      ]);

      const dueToday = parseInt(
        dueTodayRow?.c || 0,
        10
      );

      const dueTomorrow = parseInt(
        dueTomorrowRow?.c || 0,
        10
      );

      const overdue = parseInt(
        overdueRow?.c || 0,
        10
      );

      const pendingTotal = parseInt(
        pendingRow?.c || 0,
        10
      );

      const unfitTotal = parseInt(
        unfitRow?.c || 0,
        10
      );

      const completedTotal = parseInt(
        completedRow?.c || 0,
        10
      );

      res.json({
        success: true,
        data: {
          shopId,
          shopName: shop.name,

          dueToday,
          dueTomorrow,
          overdue,

          pendingTotal,
          unfitTotal,
          completedTotal,

          hasBannerAlert:
            dueToday > 0 ||
            dueTomorrow > 0 ||
            overdue > 0,
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 3. CHECK DUPLICATE PHONE
  // ============================================================

  static async checkDuplicatePhone(req, res, next) {
    try {
      const {
        phone,
        shopId,
        scope = "shop",
      } = req.query;

      if (!phone) {
        throw new AppError(
          "phone query parameter is required",
          400
        );
      }

      if (shopId) {
        await verifyShopAccess(
          req.user.id,
          req.user.role,
          req.user.organizationId,
          shopId
        );
      }

      let sql = `
        SELECT
          ce.id,
          ce.customer_name,
          ce.customer_phone,
          ce.vehicle_model,
          ce.tyre_size,
          ce.status,
          ce.follow_up_date,
          ce.created_at,
          s.id AS shop_id,
          s.name AS shop_name
        FROM customer_enquiries ce
        JOIN shops s
          ON s.id = ce.shop_id
        WHERE ce.customer_phone = ?
          AND ce.is_deleted = 0
      `;

      const params = [phone];

      if (req.user.role !== "SUPER_ADMIN") {
        sql += " AND ce.organization_id = ?";
        params.push(req.user.organizationId);
      }

      if (scope === "shop" && shopId) {
        sql += " AND ce.shop_id = ?";
        params.push(shopId);
      }

      sql += `
        ORDER BY ce.created_at DESC
        LIMIT 5
      `;

      const matches = await query(
        sql,
        params
      );

      res.json({
        success: true,
        data: {
          isDuplicate: matches.length > 0,
          count: matches.length,
          matches,
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 4. CREATE CUSTOMER ENQUIRY
  // ============================================================
// ============================================================
// 4. CREATE CUSTOMER ENQUIRY
// ============================================================

static async createEnquiry(req, res, next) {
  try {
    const {
      shopId,

      customerName,
      customerPhone,

      vehicleModel,
      vehicleReg,

      carBrandId,
      carModelId,

      vehicleType,

      tyreSize,
      tyreBrand,

      quantity = 4,
      estimatedBudget,

      followUpDate,
      remarks,

      fitStatus,

      leadSource,

      enquiryType,

      wheelAlignment,

      suitableShopId,

      notFitLocation,
    } = req.body;

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (
      !shopId ||
      !customerName ||
      !customerPhone ||
      !followUpDate
    ) {
      throw new AppError(
        "shopId, customerName, customerPhone, and followUpDate are required",
        400
      );
    }

    // --------------------------------------------------------
    // Valid FIT status
    // --------------------------------------------------------

    const validFitStatuses = [
      "FIT",
      "NOT_FIT",
    ];

    if (
      fitStatus &&
      !validFitStatuses.includes(fitStatus)
    ) {
      throw new AppError(
        "Invalid fitStatus. Must be FIT or NOT_FIT",
        400
      );
    }

    // --------------------------------------------------------
    // Lead Source
    // --------------------------------------------------------

    const validLeadSources = [
      "DIRECT_WALK_IN",
      "REFERRAL",
      "TELEPHONE",
    ];

    if (
      leadSource &&
      !validLeadSources.includes(leadSource)
    ) {
      throw new AppError(
        "Invalid leadSource. Must be DIRECT_WALK_IN, REFERRAL, or TELEPHONE",
        400
      );
    }

    // --------------------------------------------------------
    // Enquiry Type
    // --------------------------------------------------------

    const validEnquiryTypes = [
      "DIRECT_WALK_IN",
      "REFERRAL",
      "TELEPHONE",
    ];

    if (
      enquiryType &&
      !validEnquiryTypes.includes(enquiryType)
    ) {
      throw new AppError(
        "Invalid enquiryType. Must be DIRECT_WALK_IN, REFERRAL, or TELEPHONE",
        400
      );
    }

    // --------------------------------------------------------
    // Vehicle Type
    // --------------------------------------------------------

    const validVehicleTypes = [
      "TWO_WHEELER",
      "FOUR_WHEELER",
    ];

    if (
      vehicleType &&
      !validVehicleTypes.includes(vehicleType)
    ) {
      throw new AppError(
        "Invalid vehicleType. Must be TWO_WHEELER or FOUR_WHEELER",
        400
      );
    }

    // --------------------------------------------------------
    // Verify shop access
    // --------------------------------------------------------

    const shop = await verifyShopAccess(
      req.user.id,
      req.user.role,
      req.user.organizationId,
      shopId
    );

    // --------------------------------------------------------
    // Car Brand / Car Model validation
    // FOUR_WHEELER only
    // --------------------------------------------------------

    let selectedVehicleModel = vehicleModel || null;

    if (vehicleType === "FOUR_WHEELER") {
      if (!carBrandId || !carModelId) {
        throw new AppError(
          "carBrandId and carModelId are required for FOUR_WHEELER",
          400
        );
      }

      const carModel = await getOne(
        `
          SELECT
            cm.id,
            cm.name,
            cm.car_brand_id,
            cb.name AS brand_name
          FROM car_models cm
          JOIN car_brands cb
            ON cb.id = cm.car_brand_id
          WHERE cm.id = ?
            AND cm.car_brand_id = ?
            AND cm.organization_id = ?
            AND cm.is_active = 1
            AND cb.is_active = 1
        `,
        [
          carModelId,
          carBrandId,
          req.user.organizationId,
        ]
      );

      if (!carModel) {
        throw new AppError(
          "Invalid car brand or car model",
          400
        );
      }

      // Store the master car model name
      // in the existing vehicle_model column.
      selectedVehicleModel = carModel.name;
    }

    // --------------------------------------------------------
    // Verify suitable shop if provided
    // --------------------------------------------------------

    if (suitableShopId) {
      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        suitableShopId
      );
    }

    // --------------------------------------------------------
    // Generate IDs / Dates
    // --------------------------------------------------------

    const id = uuid();

    const now = new Date().toISOString();

    const followUpIso =
      new Date(followUpDate).toISOString();

    // --------------------------------------------------------
    // Insert enquiry
    // --------------------------------------------------------

    await execute(
      `
        INSERT INTO customer_enquiries
        (
          id,
          organization_id,
          shop_id,

          customer_name,
          customer_phone,

          vehicle_model,
          vehicle_reg,

          car_brand_id,
          car_model_id,

          vehicle_type,

          tyre_size,
          tyre_brand,

          quantity,
          estimated_budget,

          follow_up_date,
          status,
          remarks,

          assigned_to_user_id,

          fit_status,
          lead_source,
          enquiry_type,

          wheel_alignment,
          suitable_shop_id,
          not_fit_location,

          is_deleted,

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

          ?,
          ?,

          ?,

          ?,
          ?,

          ?,
          ?,

          ?,
          'PENDING',
          ?,

          ?,

          ?,
          ?,
          ?,

          ?,
          ?,
          ?,

          0,

          ?,
          ?,

          ?,
          ?
        )
      `,
      [
        id,
        shop.organization_id,
        shopId,

        customerName,
        customerPhone,

        selectedVehicleModel,
        vehicleReg || null,

        carBrandId || null,
        carModelId || null,

        vehicleType || null,

        tyreSize || null,
        tyreBrand || null,

        quantity,
        estimatedBudget || null,

        followUpIso,
        remarks || null,

        req.user.id,

        fitStatus || null,
        leadSource || null,
        enquiryType || null,

        wheelAlignment || null,
        suitableShopId || null,
        notFitLocation || null,

        now,
        req.user.id,

        now,
        req.user.id,
      ]
    );

    // --------------------------------------------------------
    // Activity log
    // --------------------------------------------------------

    await execute(
      `
        INSERT INTO enquiry_logs
        (
          id,
          enquiry_id,
          action,
          new_value,
          remarks,
          created_by_id,
          created_at
        )
        VALUES
        (
          ?,
          ?,
          'CREATED',
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        uuid(),
        id,
        `Created enquiry for ${customerName}`,
        remarks || "Initial entry",
        req.user.id,
        now,
      ]
    );

    // --------------------------------------------------------
    // Get created enquiry
    // --------------------------------------------------------

    const created = await getOne(
      `
        SELECT *
        FROM customer_enquiries
        WHERE id = ?
      `,
      [id]
    );

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      message: "Customer enquiry created successfully",
      data: created,
    });

  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // 5. PENDING
  // FIT ONLY
  // ============================================================

  static async getPending(req, res, next) {
    try {
      const {
        shopId,
        page = 1,
        limit = 20,
      } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        shopId
      );

      const p =
        parseInt(page, 10) || 1;

      const l =
        parseInt(limit, 10) || 20;

      const offset =
        (p - 1) * l;

    const items = await query(
  `
    SELECT
      ce.*,
      u.full_name AS assigned_employee_name,

      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', eto.id,
              'tyre_product_id', eto.tyre_product_id,
              'price', eto.price,
              'option_order', eto.option_order
            )
            ORDER BY eto.option_order
          )
          FROM enquiry_tyre_options eto
          WHERE eto.enquiry_id = ce.id
        ),
        '[]'::json
      ) AS tyre_options

    FROM customer_enquiries ce

    LEFT JOIN users u
      ON u.id = ce.assigned_to_user_id

    WHERE ce.shop_id = ?
      AND ce.status = 'PENDING'
      AND ce.is_deleted = 0

    ORDER BY ce.follow_up_date ASC

    LIMIT ?
    OFFSET ?
  `,
  [shopId, l, offset]
);

      const totalRow = await getOne(
        `
          SELECT COUNT(*) AS c
          FROM customer_enquiries
          WHERE shop_id = ?
            AND status = 'PENDING'
            AND is_deleted = 0
        `,
        [shopId]
      );

      const total =
        parseInt(totalRow?.c || 0, 10);

      res.json({
        success: true,
        data: items,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 6. UNFIT
  // NOT_FIT ONLY
  // ============================================================

  static async getUnfit(req, res, next) {
    try {
      const {
        shopId,
        page = 1,
        limit = 20,
      } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        shopId
      );

      const p =
        parseInt(page, 10) || 1;

      const l =
        parseInt(limit, 10) || 20;

      const offset =
        (p - 1) * l;

      const items = await query(
        `
          SELECT
            ce.*,
            u.full_name AS assigned_employee_name
          FROM customer_enquiries ce
          LEFT JOIN users u
            ON u.id = ce.assigned_to_user_id
          WHERE ce.shop_id = ?
            AND ce.status = 'PENDING'
            AND ce.fit_status = 'NOT_FIT'
            AND ce.is_deleted = 0
          ORDER BY ce.follow_up_date ASC
          LIMIT ?
          OFFSET ?
        `,
        [
          shopId,
          l,
          offset,
        ]
      );

      const totalRow = await getOne(
        `
          SELECT COUNT(*) AS c
          FROM customer_enquiries
          WHERE shop_id = ?
            AND status = 'PENDING'
            AND fit_status = 'NOT_FIT'
            AND is_deleted = 0
        `,
        [shopId]
      );

      const total =
        parseInt(totalRow?.c || 0, 10);

      res.json({
        success: true,
        data: items,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 7. COMPLETED
  // ============================================================

  static async getCompleted(req, res, next) {
    try {
      const {
        shopId,
        page = 1,
        limit = 20,
      } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        shopId
      );

      const p =
        parseInt(page, 10) || 1;

      const l =
        parseInt(limit, 10) || 20;

      const offset =
        (p - 1) * l;

      const items = await query(
        `
          SELECT
            ce.*,
            u.full_name AS assigned_employee_name
          FROM customer_enquiries ce
          LEFT JOIN users u
            ON u.id = ce.assigned_to_user_id
          WHERE ce.shop_id = ?
            AND ce.status = 'COMPLETED'
            AND ce.is_deleted = 0
          ORDER BY ce.last_modified_at DESC
          LIMIT ?
          OFFSET ?
        `,
        [
          shopId,
          l,
          offset,
        ]
      );

      const totalRow = await getOne(
        `
          SELECT COUNT(*) AS c
          FROM customer_enquiries
          WHERE shop_id = ?
            AND status = 'COMPLETED'
            AND is_deleted = 0
        `,
        [shopId]
      );

      const total =
        parseInt(totalRow?.c || 0, 10);

      res.json({
        success: true,
        data: items,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l),
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 8. CUSTOMER SEARCH
  // ============================================================

  static async search(req, res, next) {
    try {
      const {
        shopId,
        query: searchTerm = "",
        limit = 30,
      } = req.query;

      if (!shopId) {
        throw new AppError(
          "shopId query parameter is required",
          400
        );
      }

      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        shopId
      );

      if (
        !searchTerm ||
        searchTerm.trim().length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const term =
        `%${searchTerm.trim()}%`;

      const l =
        parseInt(limit, 10) || 30;

      const items = await query(
        `
          SELECT
            ce.*,
            u.full_name AS assigned_employee_name
          FROM customer_enquiries ce
          LEFT JOIN users u
            ON u.id = ce.assigned_to_user_id
          WHERE ce.shop_id = ?
            AND ce.is_deleted = 0
            AND (
              ce.customer_name LIKE ?
              OR ce.customer_phone LIKE ?
              OR ce.tyre_size LIKE ?
              OR ce.tyre_brand LIKE ?
              OR ce.vehicle_model LIKE ?
              OR ce.vehicle_reg LIKE ?
            )
          ORDER BY ce.last_modified_at DESC
          LIMIT ?
        `,
        [
          shopId,
          term,
          term,
          term,
          term,
          term,
          term,
          l,
        ]
      );

      res.json({
        success: true,
        data: items,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 9. GET ENQUIRY BY ID
  // ============================================================

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const { shopId } = req.query;

      const enquiry = await getOne(
        `
          SELECT
            ce.*,
            s.name AS shop_name,
            s.code AS shop_code,
            u.full_name AS assigned_employee_name,
            c.full_name AS creator_name
          FROM customer_enquiries ce
          JOIN shops s
            ON s.id = ce.shop_id
          LEFT JOIN users u
            ON u.id = ce.assigned_to_user_id
          LEFT JOIN users c
            ON c.id = ce.created_by
          WHERE ce.id = ?
        `,
        [id]
      );

      if (!enquiry || enquiry.is_deleted) {
        throw new AppError(
          "Follow-up enquiry not found",
          404
        );
      }

      if (
        req.user.role !== "SUPER_ADMIN" &&
        enquiry.organization_id !==
          req.user.organizationId
      ) {
        throw new AppError(
          "Follow-up enquiry not found",
          404
        );
      }

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

      if (
        shopId &&
        enquiry.shop_id !== shopId
      ) {
        throw new AppError(
          "Enquiry does not belong to this shop",
          403
        );
      }

      const activityLogs = await query(
        `
          SELECT
            el.*,
            u.full_name AS created_by_name
          FROM enquiry_logs el
          LEFT JOIN users u
            ON u.id = el.created_by_id
          WHERE el.enquiry_id = ?
          ORDER BY el.created_at DESC
        `,
        [id]
      );

      enquiry.activityLogs = activityLogs;

      res.json({
        success: true,
        data: enquiry,
      });

    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // 10. UPDATE ENQUIRY
  // ============================================================

 // ============================================================
// UPDATE CUSTOMER ENQUIRY
// ============================================================

static async updateEnquiry(req, res, next) {
  try {
    const { id } = req.params;

    const {
      status,
      followUpDate,
      remarks,

      customerName,
      vehicleModel,
      vehicleReg,

      carBrandId,
      carModelId,

      vehicleType,

      tyreSize,
      tyreBrand,
      quantity,

      estimatedBudget,

      fitStatus,

      leadSource,

      enquiryType,

      wheelAlignment,

      suitableShopId,

      notFitLocation,

      // NEW - outside/local shop details
      outsideShopName,
      outsideShopLocation,
      outsideShopAddress,
      outsideShopAmount,
    } = req.body;

    // --------------------------------------------------------
    // Get existing enquiry
    // --------------------------------------------------------

    const enquiry = await getOne(
      `
        SELECT *
        FROM customer_enquiries
        WHERE id = ?
          AND is_deleted = 0
      `,
      [id]
    );

    if (!enquiry) {
      throw new AppError(
        "Enquiry not found",
        404
      );
    }

    // --------------------------------------------------------
    // Organization check
    // --------------------------------------------------------

    if (
      req.user.role !== "SUPER_ADMIN" &&
      enquiry.organization_id !== req.user.organizationId
    ) {
      throw new AppError(
        "Access denied",
        403
      );
    }

    // --------------------------------------------------------
    // Verify enquiry shop access
    // --------------------------------------------------------

    await verifyShopAccess(
      req.user.id,
      req.user.role,
      req.user.organizationId,
      enquiry.shop_id
    );

    // --------------------------------------------------------
    // Status validation
    // --------------------------------------------------------

    const validStatuses = [
      "PENDING",
      "COMPLETED",
      "CANCELLED",
      "LOST",
    ];

    if (
      status &&
      !validStatuses.includes(status)
    ) {
      throw new AppError(
        "Invalid status. Must be PENDING, COMPLETED, CANCELLED, or LOST",
        400
      );
    }

    // --------------------------------------------------------
    // Fit status validation
    // --------------------------------------------------------

    const validFitStatuses = [
      "FIT",
      "NOT_FIT",
    ];

    if (
      fitStatus &&
      !validFitStatuses.includes(fitStatus)
    ) {
      throw new AppError(
        "Invalid fitStatus. Must be FIT or NOT_FIT",
        400
      );
    }

    // --------------------------------------------------------
    // Lead source validation
    // --------------------------------------------------------

    const validLeadSources = [
      "DIRECT_WALK_IN",
      "REFERRAL",
      "TELEPHONE",
    ];

    if (
      leadSource &&
      !validLeadSources.includes(leadSource)
    ) {
      throw new AppError(
        "Invalid leadSource. Must be DIRECT_WALK_IN, REFERRAL, or TELEPHONE",
        400
      );
    }

    // --------------------------------------------------------
    // Enquiry type validation
    // --------------------------------------------------------

    const validEnquiryTypes = [
      "DIRECT_WALK_IN",
      "REFERRAL",
      "TELEPHONE",
    ];

    if (
      enquiryType &&
      !validEnquiryTypes.includes(enquiryType)
    ) {
      throw new AppError(
        "Invalid enquiryType. Must be DIRECT_WALK_IN, REFERRAL, or TELEPHONE",
        400
      );
    }

    // --------------------------------------------------------
    // Vehicle type validation
    // --------------------------------------------------------

    const validVehicleTypes = [
      "TWO_WHEELER",
      "FOUR_WHEELER",
    ];

    if (
      vehicleType &&
      !validVehicleTypes.includes(vehicleType)
    ) {
      throw new AppError(
        "Invalid vehicleType. Must be TWO_WHEELER or FOUR_WHEELER",
        400
      );
    }

    // --------------------------------------------------------
    // Determine final vehicle type
    // --------------------------------------------------------

    const finalVehicleType =
      vehicleType || enquiry.vehicle_type;

    // --------------------------------------------------------
    // Car Brand / Car Model validation
    // --------------------------------------------------------

    let finalCarBrandId =
      carBrandId !== undefined
        ? carBrandId
        : enquiry.car_brand_id;

    let finalCarModelId =
      carModelId !== undefined
        ? carModelId
        : enquiry.car_model_id;

    let finalVehicleModel =
      vehicleModel !== undefined
        ? vehicleModel
        : enquiry.vehicle_model;

    if (finalVehicleType === "FOUR_WHEELER") {
      if (!finalCarBrandId || !finalCarModelId) {
        throw new AppError(
          "carBrandId and carModelId are required for FOUR_WHEELER",
          400
        );
      }

      const carModel = await getOne(
        `
          SELECT
            cm.id,
            cm.name,
            cm.car_brand_id,
            cb.name AS brand_name
          FROM car_models cm
          JOIN car_brands cb
            ON cb.id = cm.car_brand_id
          WHERE cm.id = ?
            AND cm.car_brand_id = ?
            AND cm.organization_id = ?
            AND cm.is_active = 1
            AND cb.is_active = 1
        `,
        [
          finalCarModelId,
          finalCarBrandId,
          req.user.organizationId,
        ]
      );

      if (!carModel) {
        throw new AppError(
          "Invalid car brand or car model",
          400
        );
      }

      // Store master model name in existing vehicle_model field
      finalVehicleModel = carModel.name;
    }

    // --------------------------------------------------------
    // TWO_WHEELER
    // --------------------------------------------------------

    if (finalVehicleType === "TWO_WHEELER") {
      finalCarBrandId = null;
      finalCarModelId = null;
    }

    // --------------------------------------------------------
    // Verify suitable shop
    // --------------------------------------------------------

    if (suitableShopId) {
      await verifyShopAccess(
        req.user.id,
        req.user.role,
        req.user.organizationId,
        suitableShopId
      );
    }

    // --------------------------------------------------------
    // Dates
    // --------------------------------------------------------

    const finalFollowUpDate =
      followUpDate !== undefined
        ? new Date(followUpDate).toISOString()
        : enquiry.follow_up_date;

    const now = new Date().toISOString();

    // --------------------------------------------------------
    // Update enquiry
    // --------------------------------------------------------

    await execute(
      `
        UPDATE customer_enquiries
        SET
          status = COALESCE(?, status),

          follow_up_date = COALESCE(
            ?,
            follow_up_date
          ),

          remarks = COALESCE(
            ?,
            remarks
          ),

          customer_name = COALESCE(
            ?,
            customer_name
          ),

          vehicle_model = COALESCE(
            ?,
            vehicle_model
          ),

          vehicle_reg = COALESCE(
            ?,
            vehicle_reg
          ),

          car_brand_id = ?,

          car_model_id = ?,

          vehicle_type = COALESCE(
            ?,
            vehicle_type
          ),

          tyre_size = COALESCE(
            ?,
            tyre_size
          ),

          tyre_brand = COALESCE(
            ?,
            tyre_brand
          ),

          quantity = COALESCE(
            ?,
            quantity
          ),

          estimated_budget = COALESCE(
            ?,
            estimated_budget
          ),

          fit_status = COALESCE(
            ?,
            fit_status
          ),

          lead_source = COALESCE(
            ?,
            lead_source
          ),

          enquiry_type = COALESCE(
            ?,
            enquiry_type
          ),

          wheel_alignment = COALESCE(
            ?,
            wheel_alignment
          ),

          suitable_shop_id = COALESCE(
            ?,
            suitable_shop_id
          ),

          not_fit_location = COALESCE(
            ?,
            not_fit_location
          ),

          outside_shop_name = COALESCE(
            ?,
            outside_shop_name
          ),

          outside_shop_location = COALESCE(
            ?,
            outside_shop_location
          ),

          outside_shop_address = COALESCE(
            ?,
            outside_shop_address
          ),

          outside_shop_amount = COALESCE(
            ?,
            outside_shop_amount
          ),

          last_modified_at = ?,
          last_modified_by = ?

        WHERE id = ?
      `,
      [
        status || null,

        finalFollowUpDate,

        remarks !== undefined
          ? remarks
          : null,

        customerName || null,

        finalVehicleModel,

        vehicleReg || null,

        finalCarBrandId,

        finalCarModelId,

        finalVehicleType || null,

        tyreSize || null,

        tyreBrand || null,

        quantity || null,

        estimatedBudget || null,

        fitStatus || null,

        leadSource || null,

        enquiryType || null,

        wheelAlignment || null,

        suitableShopId || null,

        notFitLocation || null,

        // NEW - outside/local shop details
        outsideShopName || null,
        outsideShopLocation || null,
        outsideShopAddress || null,
        outsideShopAmount || null,

        now,
        req.user.id,

        id,
      ]
    );

    // --------------------------------------------------------
    // Get updated enquiry
    // --------------------------------------------------------

    const updated = await getOne(
      `
        SELECT *
        FROM customer_enquiries
        WHERE id = ?
      `,
      [id]
    );

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.json({
      success: true,
      message: "Customer enquiry updated successfully",
      data: updated,
    });

  } catch (error) {
    next(error);
  }
}

  // =========================
// LIST CAR BRANDS
// =========================
static async getCarBrands(req, res, next) {
  try {
    const organizationId = req.user.organizationId;

    const brands = await query(
      `
        SELECT
          id,
          name
        FROM car_brands
        WHERE organization_id = ?
          AND is_active = 1
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
// LIST CAR MODELS
// =========================
static async getCarModels(req, res, next) {
  try {
    const organizationId = req.user.organizationId;
    const { brandId } = req.query;

    if (!brandId) {
      throw new AppError("brandId is required", 400);
    }

    const models = await query(
      `
        SELECT
          cm.id,
          cm.name,
          cm.car_brand_id,
          cb.name AS brand_name
        FROM car_models cm
        JOIN car_brands cb
          ON cb.id = cm.car_brand_id
        WHERE cm.organization_id = ?
          AND cm.car_brand_id = ?
          AND cm.is_active = 1
          AND cb.is_active = 1
        ORDER BY cm.name ASC
      `,
      [organizationId, brandId]
    );

    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    next(error);
  }
}
}

module.exports = EmployeeController;