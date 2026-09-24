const { getOne, query, execute, uuid } = require("../config/db");
const { hashPassword } = require("../utils/password");
const { AppError } = require("../middlewares/error");

function getOrgScope(req) {
  if (req.user.role === "SUPER_ADMIN") {
    return req.query.organizationId || null;
  }

  return req.user.organizationId;
}

class AdminController {
static async getDashboard(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    // ============================================================
    // Active Shops
    // shops.is_active = SMALLINT
    // ============================================================

    let shopSql = `
      SELECT id, name
      FROM shops
      WHERE is_active = 1
    `;

    const shopParams = [];

    if (orgId) {
      shopSql += " AND organization_id = ?";
      shopParams.push(orgId);
    }

    shopSql += " ORDER BY name ASC";

    const shops = await query(shopSql, shopParams);

    // ============================================================
    // Overall Counters
    // ============================================================

    let totalEnquiries = 0;
    let pendingEnquiries = 0;
    let completedEnquiries = 0;
    let dueToday = 0;
    let overdue = 0;

    const today = new Date().toISOString().split("T")[0];

    const shopMetrics = [];

    // ============================================================
    // Shop-wise Enquiry Metrics
    // ============================================================

    for (const shop of shops) {
      let enquirySql = `
        SELECT
          COUNT(*) AS total,

          SUM(
            CASE
              WHEN status IN ('PENDING', 'NEW', 'ASSIGNED')
              THEN 1
              ELSE 0
            END
          ) AS pending,

          SUM(
            CASE
              WHEN status IN ('COMPLETED', 'CLOSED')
              THEN 1
              ELSE 0
            END
          ) AS completed,

          SUM(
            CASE
              WHEN DATE(follow_up_date) = ?
                AND status NOT IN ('COMPLETED', 'CLOSED')
              THEN 1
              ELSE 0
            END
          ) AS dueToday,

          SUM(
            CASE
              WHEN DATE(follow_up_date) < ?
                AND status NOT IN ('COMPLETED', 'CLOSED')
              THEN 1
              ELSE 0
            END
          ) AS overdue

        FROM customer_enquiries

        WHERE shop_id = ?
          AND is_deleted = 0
      `;

      const enquiryParams = [
        today,
        today,
        shop.id,
      ];

      if (orgId) {
        enquirySql += " AND organization_id = ?";
        enquiryParams.push(orgId);
      }

      const metrics = await getOne(
        enquirySql,
        enquiryParams
      );

      const total = Number(metrics?.total || 0);
      const pending = Number(metrics?.pending || 0);
      const completed = Number(metrics?.completed || 0);
      const shopDueToday = Number(metrics?.duetoday || 0);
      const shopOverdue = Number(metrics?.overdue || 0);

      totalEnquiries += total;
      pendingEnquiries += pending;
      completedEnquiries += completed;
      dueToday += shopDueToday;
      overdue += shopOverdue;

      // ==========================================================
      // Shop Conversion Rate
      // ==========================================================

      const conversionRate =
        total > 0
          ? Number(((completed / total) * 100).toFixed(2))
          : 0;

      shopMetrics.push({
        shopId: shop.id,
        shopName: shop.name,
        totalEnquiries: total,
        pendingEnquiries: pending,
        completedEnquiries: completed,
        dueToday: shopDueToday,
        overdue: shopOverdue,
        conversionRate,
      });
    }

    // ============================================================
    // Active Users
    // users.is_active = SMALLINT
    // ============================================================

    let activeUsersSql = `
      SELECT COUNT(*) AS count
      FROM users
      WHERE role != 'SUPER_ADMIN'
        AND is_active = 1
    `;

    const activeUsersParams = [];

    if (orgId) {
      activeUsersSql += " AND organization_id = ?";
      activeUsersParams.push(orgId);
    }

    const activeUsersResult = await getOne(
      activeUsersSql,
      activeUsersParams
    );

    const activeUsers = Number(
      activeUsersResult?.count || 0
    );

    // ============================================================
    // Overall Conversion Rate
    // ============================================================

    const conversionRate =
      totalEnquiries > 0
        ? Number(
            (
              (completedEnquiries / totalEnquiries) *
              100
            ).toFixed(2)
          )
        : 0;

    // ============================================================
    // Final Dashboard Response
    // ============================================================

    res.json({
      success: true,
      data: {
        totalEnquiries,
        pendingEnquiries,
        completedEnquiries,
        dueToday,
        overdue,
        conversionRate,
        activeShops: shops.length,
        activeUsers,
        shops: shopMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
}
  // ============================================================
  // GET ALL ENQUIRIES
  // ============================================================

  static async getAllEnquiries(req, res, next) {
    try {
      const orgId = getOrgScope(req);

      const {
        shopId,
        status,
        assignedToUserId,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      let sql = `
        SELECT
          ce.*,
          s.name AS shop_name,
          u.full_name AS assigned_user_name
        FROM customer_enquiries ce

        LEFT JOIN shops s
          ON s.id = ce.shop_id

        LEFT JOIN users u
          ON u.id = ce.assigned_to_user_id

        WHERE ce.is_deleted = 0
      `;

      const params = [];

      if (orgId) {
        sql += " AND ce.organization_id = ?";
        params.push(orgId);
      }

      if (shopId) {
        sql += " AND ce.shop_id = ?";
        params.push(shopId);
      }

      if (status) {
        sql += " AND ce.status = ?";
        params.push(status);
      }

      if (assignedToUserId) {
        sql += " AND ce.assigned_to_user_id = ?";
        params.push(assignedToUserId);
      }

      if (search) {
        sql += `
          AND (
            ce.customer_name LIKE ?
            OR ce.phone LIKE ?
            OR ce.vehicle_number LIKE ?
          )
        `;

        const searchValue = `%${search}%`;

        params.push(
          searchValue,
          searchValue,
          searchValue
        );
      }

      if (startDate) {
        sql += " AND DATE(ce.created_at) >= ?";
        params.push(startDate);
      }

      if (endDate) {
        sql += " AND DATE(ce.created_at) <= ?";
        params.push(endDate);
      }

      sql += `
        ORDER BY ce.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const pageNumber = Number(page);
      const limitNumber = Number(limit);
      const offset = (pageNumber - 1) * limitNumber;

      params.push(limitNumber, offset);

      const enquiries = await query(sql, params);

      res.json({
        success: true,
        data: enquiries,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // REASSIGN ENQUIRY
  // ONLY EMPLOYEE FROM SAME SHOP
  // ============================================================

static async reassignEnquiry(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;
    const { assignedToUserId, remarks } = req.body;

    if (!assignedToUserId) {
      throw new AppError("assignedToUserId is required", 400);
    }

    // 1. Find the enquiry
    let enquirySql = `
      SELECT *
      FROM customer_enquiries
      WHERE id = ?
        AND is_deleted = 0
    `;

    const enquiryParams = [id];

    if (orgId) {
      enquirySql += ` AND organization_id = ?`;
      enquiryParams.push(orgId);
    }

    const enquiry = await getOne(
      enquirySql,
      enquiryParams
    );

    if (!enquiry) {
      throw new AppError(
        "Enquiry not found or access denied",
        404
      );
    }

    // 2. Check employee belongs to the enquiry's shop
    let targetSql = `
      SELECT
        u.id,
        u.full_name
      FROM users u
      INNER JOIN user_shops us
        ON us.user_id = u.id
      INNER JOIN shops s
        ON s.id = us.shop_id
      WHERE u.id = ?
        AND u.role = 'EMPLOYEE'
        AND u.is_active = 1
        AND u.is_deleted = FALSE
        AND us.shop_id = ?
        AND s.is_active = 1
        AND s.is_deleted = FALSE
    `;

    const targetParams = [
      assignedToUserId,
      enquiry.shop_id,
    ];

    if (orgId) {
      targetSql += ` AND u.organization_id = ?`;
      targetParams.push(orgId);
    }

    const targetUser = await getOne(
      targetSql,
      targetParams
    );

    if (!targetUser) {
      throw new AppError(
        "Target employee is not active or is not assigned to this shop",
        400
      );
    }

    // 3. Reassign enquiry
    const now = new Date().toISOString();

    await execute(
      `
      UPDATE customer_enquiries
      SET
        assigned_to_user_id = ?,
        last_modified_at = ?,
        last_modified_by = ?
      WHERE id = ?
        AND is_deleted = 0
      `,
      [
        assignedToUserId,
        now,
        req.user.id,
        id,
      ]
    );

    // 4. Create enquiry log
    await execute(
      `
      INSERT INTO enquiry_logs (
        id,
        enquiry_id,
        action,
        new_value,
        remarks,
        created_by_id,
        created_at
      )
      VALUES (?, ?, 'REASSIGNED', ?, ?, ?, ?)
      `,
      [
        uuid(),
        id,
        `Reassigned to: ${targetUser.full_name}`,
        remarks || "Reassigned by Admin",
        req.user.id,
        now,
      ]
    );

    res.json({
      success: true,
      message: "Enquiry reassigned successfully",
    });

  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // SOFT DELETE ENQUIRY
  // ============================================================

  static async softDeleteEnquiry(req, res, next) {
    try {
      const orgId = getOrgScope(req);
      const { id } = req.params;

      let checkSql = `
        SELECT id
        FROM customer_enquiries
        WHERE id = ?
          AND is_deleted = 0
      `;

      const checkParams = [id];

      if (orgId) {
        checkSql += `
          AND organization_id = ?
        `;

        checkParams.push(orgId);
      }

      const enquiry = await getOne(
        checkSql,
        checkParams
      );

      if (!enquiry) {
        throw new AppError(
          "Enquiry not found or access denied",
          404
        );
      }

      const now = new Date().toISOString();

      await execute(
        `
          UPDATE customer_enquiries

          SET
            is_deleted = 1,
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

      await execute(
        `
          INSERT INTO enquiry_logs
          (
            id,
            enquiry_id,
            action,
            remarks,
            created_by_id,
            created_at
          )

          VALUES
          (
            ?,
            ?,
            'SOFT_DELETED',
            ?,
            ?,
            ?
          )
        `,
        [
          uuid(),
          id,
          "Enquiry soft deleted by Admin",
          req.user.id,
          now,
        ]
      );

      res.json({
        success: true,
        message: "Enquiry deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // LIST SHOPS
  // ACTIVE + DEACTIVATED
  // SOFT DELETED HIDDEN
  // ============================================================

 static async listShops(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    let sql = `
      SELECT *
      FROM shops
      WHERE is_deleted = FALSE
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

    const shops = await query(
      sql,
      params
    );

    res.json({
      success: true,
      data: shops,
    });
  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // CREATE SHOP
  // ============================================================

static async createShop(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    if (!orgId) {
      throw new AppError(
        "organizationId is required",
        400
      );
    }

    const {
      name,
      address,
      phone,
      gstNumber,
    } = req.body;

    if (!name) {
      throw new AppError(
        "Shop name is required",
        400
      );
    }

    const existingShop = await getOne(
      `
        SELECT id
        FROM shops
        WHERE organization_id = ?
          AND LOWER(TRIM(name)) = LOWER(TRIM(?))
          AND is_deleted = false
        LIMIT 1
      `,
      [orgId, name]
    );

    if (existingShop) {
      throw new AppError(
        "A shop with this name already exists in this organization",
        409
      );
    }

    const id = uuid();
    const now = new Date().toISOString();

    await execute(
      `
        INSERT INTO shops
        (
          id,
          organization_id,
          name,
          address,
          phone,
          gst_number,
          is_active,
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
          1,
          false,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        orgId,
        name,
        address || null,
        phone || null,
        gstNumber || null,
        now,
        req.user.id,
        now,
        req.user.id,
      ]
    );

    const shop = await getOne(
      `
        SELECT *
        FROM shops
        WHERE id = ?
      `,
      [id]
    );

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: shop,
    });

  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // UPDATE SHOP
  // ============================================================
static async updateShop(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    const {
      name,
      address,
      phone,
      gstNumber,
      isActive,
    } = req.body;

    let checkSql = `
      SELECT *
      FROM shops
      WHERE id = ?
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const shop = await getOne(
      checkSql,
      checkParams
    );

    if (!shop) {
      throw new AppError(
        "Shop not found or already deleted",
        404
      );
    }

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE shops
        SET
          name = ?,
          address = ?,
          phone = ?,
          gst_number = ?,
          is_active = ?,
          last_modified_at = ?,
          last_modified_by = ?
        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        name ?? shop.name,
        address ?? shop.address,
        phone ?? shop.phone,
        gstNumber ?? shop.gst_number,

        typeof isActive === "boolean"
          ? (isActive ? 1 : 0)
          : shop.is_active,

        now,
        req.user.id,
        id,
      ]
    );

    const updatedShop = await getOne(
      `
        SELECT *
        FROM shops
        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [id]
    );

    res.json({
      success: true,
      message: "Shop updated successfully",
      data: updatedShop,
    });

  } catch (error) {
    next(error);
  }
}
// ============================================================
// DEACTIVATE SHOP
// Keeps shop visible
// is_active = 0
// is_deleted = FALSE
// ============================================================

static async deactivateShop(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    // --------------------------------------------------------
    // Find shop
    // --------------------------------------------------------

    let checkSql = `
      SELECT
        id,
        is_active,
        is_deleted

      FROM shops

      WHERE id = ?
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const shop = await getOne(
      checkSql,
      checkParams
    );

    if (!shop) {
      throw new AppError(
        "Shop not found or already deleted",
        404
      );
    }

    // --------------------------------------------------------
    // Deactivate shop
    // --------------------------------------------------------

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE shops

        SET
          is_active = 0,
          last_modified_at = ?,
          last_modified_by = ?

        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        now,
        req.user.id,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Shop deactivated successfully.",
    });
  } catch (error) {
    next(error);
  }
}
  // ============================================================
  // SOFT DELETE SHOP
  // ============================================================

 static async softDeleteShop(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    let checkSql = `
      SELECT id
      FROM shops
      WHERE id = ?
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const shop = await getOne(
      checkSql,
      checkParams
    );

    if (!shop) {
      throw new AppError(
        "Shop not found or already deleted",
        404
      );
    }

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE shops
        SET
          is_active = 0,
          is_deleted = TRUE,
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
      message: "Shop soft-deleted successfully",
    });

  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // LIST USERS
  //
  // Normal:
  // Active + Deactivated
  // Soft deleted hidden
  //
  // With shopId:
  // Only active employees assigned to that shop
  // ============================================================

static async listUsers(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { shopId } = req.query;

    let sql = `
      SELECT
        id,
        organization_id,
        phone,
        full_name,
        role,
        is_active,
        is_deleted,
        created_at,
        last_modified_at
      FROM users
      WHERE role IN ('EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const params = [];

    // --------------------------------------------------------
    // Organization isolation
    // --------------------------------------------------------

    if (orgId) {
      sql += `
        AND organization_id = ?
      `;

      params.push(orgId);
    }

    // --------------------------------------------------------
    // Reassign employee list
    // If shopId is provided, return only employees
    // assigned to that shop
    // --------------------------------------------------------

    if (shopId) {
      sql += `
        AND role = 'EMPLOYEE'
        AND is_active = 1

        AND EXISTS (
          SELECT 1
          FROM user_shops us

          INNER JOIN shops s
            ON s.id = us.shop_id

          WHERE us.user_id = users.id
            AND us.shop_id = ?
            AND s.is_active = 1
            AND s.is_deleted = FALSE
        )
      `;

      params.push(shopId);
    }

    sql += `
      ORDER BY full_name ASC
    `;

    const users = await query(sql, params);

    // --------------------------------------------------------
    // Attach assigned shops
    // Active + deactivated shops are shown
    // Soft-deleted shops are hidden
    // --------------------------------------------------------

    for (const user of users) {
      const shops = await query(
        `
          SELECT
            s.id,
            s.name,
            s.is_active,
            s.is_deleted

          FROM shops s

          INNER JOIN user_shops us
            ON us.shop_id = s.id

          WHERE us.user_id = ?
            AND s.is_deleted = FALSE

          ORDER BY s.name ASC
        `,
        [user.id]
      );

      user.shops = shops;
    }

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // CREATE USER
  // ============================================================

static async createUser(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    if (!orgId) {
      throw new AppError(
        "organizationId is required",
        400
      );
    }

    const {
      phone,
      fullName,
      role,
      password,
      shopIds = [],
    } = req.body;

    if (
      !phone ||
      !fullName ||
      !role ||
      !password
    ) {
      throw new AppError(
        "phone, fullName, role and password are required",
        400
      );
    }

    if (!["ADMIN", "EMPLOYEE"].includes(role)) {
      throw new AppError(
        "Only ADMIN and EMPLOYEE users can be created here",
        400
      );
    }

    // --------------------------------------------------------
    // Check existing user
    // --------------------------------------------------------

    const existingUser = await getOne(
      `
        SELECT id
        FROM users
        WHERE phone = ?
          AND is_deleted = FALSE
      `,
      [phone]
    );

    if (existingUser) {
      throw new AppError(
        "User with this phone already exists",
        409
      );
    }

    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    const id = uuid();
    const now = new Date().toISOString();

    const hashedPassword = await hashPassword(password);

    await execute(
      `
        INSERT INTO users
        (
          id,
          organization_id,
          phone,
          full_name,
          role,
          password_hash,
          is_active,
          is_deleted,
          created_at,
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
          FALSE,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        orgId,
        phone,
        fullName,
        role,
        hashedPassword,
        now,
        now,
        req.user.id,
      ]
    );

    // --------------------------------------------------------
    // Assign shops
    // --------------------------------------------------------

    if (Array.isArray(shopIds)) {
      for (const shopId of shopIds) {

        const shop = await getOne(
          `
            SELECT id
            FROM shops
            WHERE id = ?
              AND organization_id = ?
              AND is_deleted = FALSE
          `,
          [
            shopId,
            orgId,
          ]
        );

        if (!shop) {
          continue;
        }

        // Create employee/admin -> shop relationship
        await execute(
          `
            INSERT INTO user_shops
            (
              id,
              user_id,
              shop_id,
              assigned_at,
              assigned_by
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `,
          [
            uuid(),
            id,
            shopId,
            now,
            req.user.id,
          ]
        );
      }
    }

    // --------------------------------------------------------
    // Get created user
    // --------------------------------------------------------

    const user = await getOne(
      `
        SELECT
          id,
          organization_id,
          phone,
          full_name,
          role,
          is_active,
          is_deleted,
          created_at,
          last_modified_at

        FROM users

        WHERE id = ?
      `,
      [id]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });

  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // UPDATE USER
  // ============================================================

static async updateUser(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    const {
      phone,
      fullName,
      role,
      isActive,
      shopIds,
    } = req.body;

    // --------------------------------------------------------
    // Find user
    // --------------------------------------------------------

    let checkSql = `
      SELECT *
      FROM users
      WHERE id = ?
        AND role IN ('ADMIN', 'EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const user = await getOne(
      checkSql,
      checkParams
    );

    if (!user) {
      throw new AppError(
        "User not found or already deleted",
        404
      );
    }

    // --------------------------------------------------------
    // Validate role
    // --------------------------------------------------------

    if (
      role !== undefined &&
      !["ADMIN", "EMPLOYEE"].includes(role)
    ) {
      throw new AppError(
        "Only ADMIN and EMPLOYEE roles are allowed",
        400
      );
    }

    const now = new Date().toISOString();

    // --------------------------------------------------------
    // Update user
    // --------------------------------------------------------

    await execute(
      `
        UPDATE users
        SET
          phone = ?,
          full_name = ?,
          role = ?,
          is_active = ?,
          last_modified_at = ?,
          last_modified_by = ?

        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        phone ?? user.phone,
        fullName ?? user.full_name,
        role ?? user.role,

        typeof isActive === "boolean"
          ? (isActive ? 1 : 0)
          : user.is_active,

        now,
        req.user.id,
        id,
      ]
    );

    // --------------------------------------------------------
    // Update shop assignments
    // Only when shopIds is provided
    // --------------------------------------------------------

    if (Array.isArray(shopIds)) {
      await execute(
        `
          DELETE FROM user_shops
          WHERE user_id = ?
        `,
        [id]
      );

      for (const shopId of shopIds) {
        const shop = await getOne(
          `
            SELECT id
            FROM shops
            WHERE id = ?
              AND organization_id = ?
              AND is_deleted = FALSE
          `,
          [
            shopId,
            orgId,
          ]
        );

        if (!shop) {
          continue;
        }

        await execute(
          `
            INSERT INTO user_shops
            (
              id,
              user_id,
              shop_id
            )
            VALUES
            (
              ?,
              ?,
              ?
            )
          `,
          [
            uuid(),
            id,
            shopId,
          ]
        );
      }
    }

    // --------------------------------------------------------
    // Get updated user
    // --------------------------------------------------------

    const updatedUser = await getOne(
      `
        SELECT
          id,
          organization_id,
          phone,
          full_name,
          role,
          is_active,
          is_deleted,
          created_at,
          last_modified_at

        FROM users

        WHERE id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // RESET PASSWORD
  // ============================================================

static async resetPassword(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      throw new AppError(
        "Password is required",
        400
      );
    }

    let checkSql = `
      SELECT id
      FROM users

      WHERE id = ?
        AND role IN ('ADMIN', 'EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const user = await getOne(
      checkSql,
      checkParams
    );

    if (!user) {
      throw new AppError(
        "User not found or already deleted",
        404
      );
    }

    const hashedPassword =
      await hashPassword(password);

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE users

        SET
          password_hash = ?,
          last_modified_at = ?,
          last_modified_by = ?

        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        hashedPassword,
        now,
        req.user.id,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // SOFT DELETE USER / EMPLOYEE
  // ============================================================

 static async softDeleteUser(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    let checkSql = `
      SELECT
        id,
        role,
        is_active,
        is_deleted

      FROM users

      WHERE id = ?
        AND role IN ('ADMIN', 'EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const user = await getOne(
      checkSql,
      checkParams
    );

    if (!user) {
      throw new AppError(
        "User not found or already deleted",
        404
      );
    }

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE users

        SET
          is_active = 0,
          is_deleted = TRUE,
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
      message: "User soft-deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

  // ============================================================
  // DEACTIVATE USER
  // Keeps user visible
  // ============================================================

static async deactivateUser(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    // --------------------------------------------------------
    // Find user
    // --------------------------------------------------------

    let checkSql = `
      SELECT
        id,
        role
      FROM users
      WHERE id = ?
        AND role IN ('ADMIN', 'EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;

      checkParams.push(orgId);
    }

    const user = await getOne(
      checkSql,
      checkParams
    );

    if (!user) {
      throw new AppError(
        "User not found in your organization",
        404
      );
    }

    // --------------------------------------------------------
    // Deactivate user
    // --------------------------------------------------------

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE users
        SET
          is_active = 0,
          last_modified_at = ?,
          last_modified_by = ?
        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        now,
        req.user.id,
        id,
      ]
    );

    res.json({
      success: true,
      message:
        "User deactivated successfully. Login is now blocked.",
    });
  } catch (error) {
    next(error);
  }
}


  static async exportCsv(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    let sql = `
      SELECT
        ce.id,
        ce.customer_name,
        ce.phone,
        ce.vehicle_number,
        ce.vehicle_model,
        ce.tyre_size,
        ce.budget,
        ce.follow_up,
        ce.status,
        ce.created_at
      FROM customer_enquiries ce
      WHERE ce.is_deleted = 0
    `;

    const params = [];

    if (orgId) {
      sql += " AND ce.organization_id = ?";
      params.push(orgId);
    }

    sql += " ORDER BY ce.created_at DESC";

    const enquiries = await query(sql, params);

    const headers = [
      "ID",
      "Customer Name",
      "Phone",
      "Vehicle Number",
      "Vehicle Model",
      "Tyre Size",
      "Budget",
      "Follow Up",
      "Status",
      "Created At",
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      const stringValue = String(value);

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csvRows = enquiries.map((enquiry) =>
      [
        enquiry.id,
        enquiry.customer_name,
        enquiry.phone,
        enquiry.vehicle_number,
        enquiry.vehicle_model,
        enquiry.tyre_size,
        enquiry.budget,
        enquiry.follow_up,
        enquiry.status,
        enquiry.created_at,
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="enquiries-${Date.now()}.csv"`
    );

    res.send(csv);
  } catch (error) {
    next(error);
  }
}

static async activateShop(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    let checkSql = `
      SELECT
        id,
        is_active,
        is_deleted
      FROM shops
      WHERE id = ?
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;
      checkParams.push(orgId);
    }

    const shop = await getOne(checkSql, checkParams);

    if (!shop) {
      throw new AppError(
        "Shop not found or already deleted",
        404
      );
    }

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE shops
        SET
          is_active = 1,
          last_modified_at = ?,
          last_modified_by = ?
        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        now,
        req.user.id,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Shop activated successfully.",
    });
  } catch (error) {
    next(error);
  }
}

static async activateUser(req, res, next) {
  try {
    const orgId = getOrgScope(req);
    const { id } = req.params;

    let checkSql = `
      SELECT
        id,
        role,
        is_active,
        is_deleted
      FROM users
      WHERE id = ?
        AND role IN ('EMPLOYEE')
        AND is_deleted = FALSE
    `;

    const checkParams = [id];

    if (orgId) {
      checkSql += `
        AND organization_id = ?
      `;
      checkParams.push(orgId);
    }

    const user = await getOne(
      checkSql,
      checkParams
    );

    if (!user) {
      throw new AppError(
        "User not found or already deleted",
        404
      );
    }

    const now = new Date().toISOString();

    await execute(
      `
        UPDATE users
        SET
          is_active = 1,
          last_modified_at = ?,
          last_modified_by = ?
        WHERE id = ?
          AND is_deleted = FALSE
      `,
      [
        now,
        req.user.id,
        id,
      ]
    );

    res.json({
      success: true,
      message: "User activated successfully.",
    });
  } catch (error) {
    next(error);
  }
}


  // ============================================================
  // LIST ALL SHOPS WITH EMPLOYEES
  //
  // Active + Deactivated shops
  // Soft deleted shops hidden
  //
  // Each shop includes:
  // - Employee count
  // - Employee details
  // ============================================================

 // ============================================================
// LIST ALL SHOPS WITH EMPLOYEES
//
// Active + Deactivated shops
// Soft deleted shops hidden
//
// Each shop includes:
// - Employee count
// - Employee details
// ============================================================

static async getShopsWithEmployees(req, res, next) {
  try {
    const orgId = getOrgScope(req);

    // --------------------------------------------------------
    // Get shops
    // --------------------------------------------------------

    let shopSql = `
      SELECT
        id,
        organization_id,
        name,
        address,
        phone,
        gst_number,
        is_active,
        is_deleted,
        created_at,
        created_by,
        last_modified_at,
        last_modified_by
      FROM shops
      WHERE is_deleted = FALSE
    `;

    const shopParams = [];

    if (orgId) {
      shopSql += `
        AND organization_id = ?
      `;

      shopParams.push(orgId);
    }

    shopSql += `
      ORDER BY name ASC
    `;

    const shops = await query(
      shopSql,
      shopParams
    );

    // --------------------------------------------------------
    // Attach employees to each shop
    // --------------------------------------------------------

    for (const shop of shops) {
      const employees = await query(
        `
          SELECT
            u.id,
            u.organization_id,
            u.phone,
            u.full_name,
            u.role,
            u.is_active,
            u.is_deleted,
            u.created_at,
            u.last_modified_at

          FROM users u

          INNER JOIN user_shops us
            ON us.user_id = u.id

          WHERE us.shop_id = ?
            AND u.role = 'EMPLOYEE'
            AND u.is_deleted = FALSE
            AND u.organization_id = ?

          ORDER BY u.full_name ASC
        `,
        [
          shop.id,
          shop.organization_id,
        ]
      );

      shop.employeeCount = employees.length;
      shop.employees = employees;
    }

    res.json({
      success: true,
      data: shops,
    });
  } catch (error) {
    next(error);
  }
}
}

module.exports = AdminController;