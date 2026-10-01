const { getOne, query, execute } = require("../config/db");
const { comparePassword } = require("../utils/password");
const { generateToken, verifyToken } = require("../utils/jwt");
const { AppError } = require("../middlewares/error");

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

/**
 * Check whether this phone number is currently locked.
 */
async function checkLoginLock(phone) {
  const attempt = await getOne(
    `
      SELECT
        failed_attempts,
        locked_until
      FROM login_attempts
      WHERE phone = ?
    `,
    [phone]
  );

  if (!attempt) {
    return;
  }

  if (
    attempt.locked_until &&
    new Date(attempt.locked_until) > new Date()
  ) {
    throw new AppError(
      "Too many failed login attempts. Please try again later.",
      429
    );
  }

  // Lock period expired
  if (
    attempt.locked_until &&
    new Date(attempt.locked_until) <= new Date()
  ) {
    await execute(
      `
        UPDATE login_attempts
        SET
          failed_attempts = 0,
          locked_until = NULL,
          last_attempt_at = ?
        WHERE phone = ?
      `,
      [new Date().toISOString(), phone]
    );
  }
}

/**
 * Record failed login attempt.
 */
async function recordFailedLogin(phone) {
  const attempt = await getOne(
    `
      SELECT failed_attempts
      FROM login_attempts
      WHERE phone = ?
    `,
    [phone]
  );

  const now = new Date().toISOString();

  // First failed attempt
  if (!attempt) {
    await execute(
      `
        INSERT INTO login_attempts
        (
          phone,
          failed_attempts,
          locked_until,
          last_attempt_at
        )
        VALUES (?, ?, ?, ?)
      `,
      [phone, 1, null, now]
    );

    return;
  }

  const failedAttempts =
    Number(attempt.failed_attempts || 0) + 1;

  const lockedUntil =
    failedAttempts >= MAX_LOGIN_ATTEMPTS
      ? new Date(
          Date.now() +
            LOGIN_LOCK_MINUTES * 60 * 1000
        ).toISOString()
      : null;

  await execute(
    `
      UPDATE login_attempts
      SET
        failed_attempts = ?,
        locked_until = ?,
        last_attempt_at = ?
      WHERE phone = ?
    `,
    [
      failedAttempts,
      lockedUntil,
      now,
      phone,
    ]
  );
}

/**
 * Reset failed login attempts after successful login.
 */
async function resetLoginAttempts(phone) {
  await execute(
    `
      DELETE FROM login_attempts
      WHERE phone = ?
    `,
    [phone]
  );
}

class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        throw new AppError(
          "Phone and password are required",
          400
        );
      }

      const loginPhone = String(phone).trim();

      // 1. Check brute-force lock
      await checkLoginLock(loginPhone);

      // 2. Find user
      const user = await getOne(
        `
          SELECT
            id,
            organization_id,
            phone,
            password_hash,
            full_name,
            role,
            is_active
          FROM users
          WHERE phone = ?
        `,
        [loginPhone]
      );

      // 3. User not found
      if (!user) {
        await recordFailedLogin(loginPhone);

        throw new AppError(
          "Invalid phone number or password",
          401
        );
      }

      // 4. Check password
      const isMatch = await comparePassword(
        password,
        user.password_hash
      );

      // 5. Wrong password
      if (!isMatch) {
        await recordFailedLogin(loginPhone);

        throw new AppError(
          "Invalid phone number or password",
          401
        );
      }

      // 6. Correct password -> reset failed attempts
      await resetLoginAttempts(loginPhone);

      // 7. Check user active status
      if (!user.is_active) {
        throw new AppError(
          "Account is deactivated. Please contact administrator.",
          403
        );
      }

      // 8. Check organization status
      let organization = null;

      if (user.organization_id) {
        organization = await getOne(
          `
            SELECT
              id,
              name,
              slug,
              is_active
            FROM organizations
            WHERE id = ?
          `,
          [user.organization_id]
        );

        if (
          organization &&
          !organization.is_active
        ) {
          throw new AppError(
            "Organization account is deactivated. Please contact platform support.",
            403
          );
        }
      }

      // 9. Fetch active assigned shops
      let assignedShops = [];

      if (user.role === "SUPER_ADMIN") {
        assignedShops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              address,
              phone
            FROM shops
            WHERE is_active = 1
          `
        );
      } else if (user.role === "ADMIN") {
        assignedShops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              address,
              phone
            FROM shops
            WHERE organization_id = ?
              AND is_active = 1
          `,
          [user.organization_id]
        );
      } else {
        assignedShops = await query(
          `
            SELECT
              s.id,
              s.organization_id,
              s.name,
              s.address,
              s.phone
            FROM shops s
            INNER JOIN user_shops us
              ON us.shop_id = s.id
            WHERE us.user_id = ?
              AND s.is_active = 1
          `,
          [user.id]
        );
      }

      // 10. Generate JWT
      const token = generateToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
        organizationId: user.organization_id,
      });

      // 11. Response
      res.json({
        success: true,
        message: "Login successful",
        data: {
          token,

          user: {
            id: user.id,
            organizationId: user.organization_id,
            organizationName: organization
              ? organization.name
              : null,
            phone: user.phone,
            fullName: user.full_name,
            role: user.role,
          },

          assignedShops,

          hasMultipleShops:
            assignedShops.length > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req, res, next) {
    try {
      const user = await getOne(
        `
          SELECT
            id,
            organization_id,
            phone,
            full_name,
            role,
            is_active
          FROM users
          WHERE id = ?
        `,
        [req.user.id]
      );

      if (!user) {
        throw new AppError(
          "User not found",
          404
        );
      }

      let assignedShops = [];

      if (user.role === "SUPER_ADMIN") {
        assignedShops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              address,
              phone
            FROM shops
            WHERE is_active = 1
          `
        );
      } else if (user.role === "ADMIN") {
        assignedShops = await query(
          `
            SELECT
              id,
              organization_id,
              name,
              address,
              phone
            FROM shops
            WHERE organization_id = ?
              AND is_active = 1
          `,
          [user.organization_id]
        );
      } else {
        assignedShops = await query(
          `
            SELECT
              s.id,
              s.organization_id,
              s.name,
              s.address,
              s.phone
            FROM shops s
            INNER JOIN user_shops us
              ON us.shop_id = s.id
            WHERE us.user_id = ?
              AND s.is_active = 1
          `,
          [user.id]
        );
      }

      res.json({
        success: true,

        data: {
          user: {
            id: user.id,
            organizationId:
              user.organization_id,
            phone: user.phone,
            fullName: user.full_name,
            role: user.role,
          },

          assignedShops,

          hasMultipleShops:
            assignedShops.length > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(
        "Authorization token required",
        401
      );
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token);

    if (!decoded.jti || !decoded.exp) {
      throw new AppError(
        "Invalid token",
        401
      );
    }

    const expiresAt = new Date(
      decoded.exp * 1000
    ).toISOString();

    await execute(
      `
        INSERT INTO revoked_tokens
        (
          jti,
          expires_at
        )
        VALUES (?, ?)
        ON CONFLICT (jti)
        DO NOTHING
      `,
      [
        decoded.jti,
        expiresAt,
      ]
    );

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
}
}

module.exports = AuthController;