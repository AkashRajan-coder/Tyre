const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { hashPassword } = require("../utils/password");

const DB_TYPE = process.env.DB_TYPE || "sqlite";

let dbInstance = null;
let pgPool = null;

function uuid() {
  return crypto.randomUUID();
}

async function initDatabase(forceType = null) {
  const activeDbType = forceType || process.env.DB_TYPE || "sqlite";
  
  if (activeDbType === "postgres" || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"))) {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("sslmode=require"))
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    console.log("Connected to PostgreSQL/Neon database");
    await createTablesPostgres();
  } else if (activeDbType === "pg-mem") {
    const { newDb } = require("pg-mem");
    const memDb = newDb();
    const adapter = memDb.adapters.createPg();
    pgPool = new adapter.Pool();
    console.log("Connected to in-memory PostgreSQL engine (Strict PG mode)");
    await createTablesPostgres();
  } else {
    // Default SQLite for zero-setup local dev & tests
    const sqlite3 = require("sqlite3").verbose();
    const dbPath = path.resolve(__dirname, "../../tyre_saas.db");
    
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening SQLite database:", err);
      } else {
        console.log(`Connected to SQLite database at ${dbPath}`);
        dbInstance.run("PRAGMA foreign_keys = ON;");
      }
    });

    await createTablesSqlite();
  }

  await seedDatabaseIfEmpty();
}

// -------------------------------------------------------------------
// Table Creation (Multi-Tenant SaaS Schema)
// -------------------------------------------------------------------

async function createTablesSqlite() {
  const schema = `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      phone TEXT,
      email TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'EMPLOYEE', -- 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE'
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      created_by TEXT,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_shops (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      assigned_by TEXT,
      UNIQUE(user_id, shop_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_enquiries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      vehicle_model TEXT,
      vehicle_reg TEXT,
      tyre_size TEXT,
      tyre_brand TEXT,
      quantity INTEGER DEFAULT 4,
      estimated_budget REAL,
      follow_up_date TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      remarks TEXT,
      assigned_to_user_id TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_modified_at TEXT NOT NULL,
      last_modified_by TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id),
      FOREIGN KEY(assigned_to_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS enquiry_logs (
      id TEXT PRIMARY KEY,
      enquiry_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      remarks TEXT,
      created_by_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(enquiry_id) REFERENCES customer_enquiries(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(organization_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_org ON customer_enquiries(organization_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_shop_phone ON customer_enquiries(shop_id, customer_phone);
    CREATE INDEX IF NOT EXISTS idx_enquiries_shop_status_date ON customer_enquiries(shop_id, status, follow_up_date);
    CREATE INDEX IF NOT EXISTS idx_logs_enquiry ON enquiry_logs(enquiry_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_shop_phone ON customer_enquiries(shop_id, customer_phone);
    CREATE INDEX IF NOT EXISTS idx_enquiries_shop_status_date ON customer_enquiries(shop_id, status, follow_up_date);
    CREATE INDEX IF NOT EXISTS idx_logs_enquiry ON enquiry_logs(enquiry_id);
  `;

  return new Promise((resolve, reject) => {
    dbInstance.exec(schema, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function createTablesPostgres() {
  const schema = `
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      slug VARCHAR(64) UNIQUE,
      phone VARCHAR(32),
      email VARCHAR(128),
      address TEXT,
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_by VARCHAR(64),
      last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_modified_by VARCHAR(64)
    );

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
      phone VARCHAR(32) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(128) NOT NULL,
      role VARCHAR(32) DEFAULT 'EMPLOYEE',
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_by VARCHAR(64),
      last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_modified_by VARCHAR(64)
    );

    CREATE TABLE IF NOT EXISTS shops (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(64) UNIQUE,
      address TEXT,
      phone VARCHAR(32),
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_by VARCHAR(64),
      last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_modified_by VARCHAR(64)
    );

    CREATE TABLE IF NOT EXISTS user_shops (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id VARCHAR(64) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
      assigned_by VARCHAR(64),
      UNIQUE(user_id, shop_id)
    );

    CREATE TABLE IF NOT EXISTS customer_enquiries (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      shop_id VARCHAR(64) NOT NULL REFERENCES shops(id),
      customer_name VARCHAR(128) NOT NULL,
      customer_phone VARCHAR(32) NOT NULL,
      vehicle_model VARCHAR(128),
      vehicle_reg VARCHAR(64),
      tyre_size VARCHAR(64),
      tyre_brand VARCHAR(64),
      quantity INTEGER DEFAULT 4,
      estimated_budget NUMERIC(10, 2),
      follow_up_date TIMESTAMP WITH TIME ZONE NOT NULL,
      status VARCHAR(32) DEFAULT 'PENDING',
      remarks TEXT,
      assigned_to_user_id VARCHAR(64) REFERENCES users(id),
      is_deleted SMALLINT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_modified_by VARCHAR(64) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiry_logs (
      id VARCHAR(64) PRIMARY KEY,
      enquiry_id VARCHAR(64) NOT NULL REFERENCES customer_enquiries(id) ON DELETE CASCADE,
      action VARCHAR(64) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      remarks TEXT,
      created_by_id VARCHAR(64) NOT NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(organization_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_org ON customer_enquiries(organization_id);
  `;
  await pgPool.query(schema);
}

// -------------------------------------------------------------------
// Query Wrappers
// -------------------------------------------------------------------

function query(sql, params = []) {
  if (pgPool) {
    let pIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${pIndex++}`);
    return pgPool.query(pgSql, params).then((res) => res.rows);
  }

  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function getOne(sql, params = []) {
  return query(sql, params).then((rows) => (rows.length > 0 ? rows[0] : null));
}

function execute(sql, params = []) {
  if (pgPool) {
    let pIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${pIndex++}`);
    return pgPool.query(pgSql, params).then((res) => ({ rowCount: res.rowCount }));
  }

  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// -------------------------------------------------------------------
// Multi-Tenant Seeder
// -------------------------------------------------------------------

async function seedDatabaseIfEmpty() {
  const existingUsers = await getOne("SELECT COUNT(*) as count FROM users");
  const count = existingUsers ? parseInt(existingUsers.count || existingUsers.COUNT || 0, 10) : 0;
  
  if (count > 0) {
    return;
  }

  console.log("Seeding Multi-Tenant SaaS database...");

  const now = new Date().toISOString();
  const superAdminPass = await hashPassword("superadmin123");
  const adminPass = await hashPassword("admin123");
  const empPass = await hashPassword("emp123");

  const superAdminId = uuid();
  const org1Id = uuid();
  const admin1Id = uuid();
  const shop1Id = uuid();
  const shop2Id = uuid();
  const emp1Id = uuid();
  const emp2Id = uuid();

  // 1. Super Admin (SaaS Owner)
  await execute(
    `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, last_modified_at)
     VALUES (?, NULL, ?, ?, ?, 'SUPER_ADMIN', 1, ?, ?)`,
    [superAdminId, "0000000000", superAdminPass, "Platform Super Admin", now, now]
  );

  // 2. Organization 1: Apex Tyre Group
  await execute(
    `INSERT INTO organizations (id, name, slug, phone, email, address, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [org1Id, "Apex Tyre Group", "apex-tyres", "080-11223344", "contact@apextyres.com", "Central Commercial Hub", now, superAdminId, now, superAdminId]
  );

  // 3. Business Admin for Org 1 (Phone 9999999999 for backward compatibility)
  await execute(
    `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?, ?, ?)`,
    [admin1Id, org1Id, "9999999999", adminPass, "Rajesh Mehta (Apex Admin)", now, superAdminId, now, superAdminId]
  );

  // 4. Shops under Org 1
  await execute(
    `INSERT INTO shops (id, organization_id, name, code, address, phone, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [shop1Id, org1Id, "Downtown Tyres & Alignment", "DWT-01", "101 MG Road, Downtown", "080-22334455", now, admin1Id, now, admin1Id]
  );

  await execute(
    `INSERT INTO shops (id, organization_id, name, code, address, phone, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [shop2Id, org1Id, "Highway Hub Tyres & Wheels", "HWH-02", "45 Bypass Express Highway", "080-99887766", now, admin1Id, now, admin1Id]
  );

  // 5. Employees under Org 1
  // Employee 1: Rahul Sharma (Multi-Shop)
  await execute(
    `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, 'EMPLOYEE', 1, ?, ?, ?, ?)`,
    [emp1Id, org1Id, "9811111111", empPass, "Rahul Sharma (Multi-Shop)", now, admin1Id, now, admin1Id]
  );
  await execute(`INSERT INTO user_shops (id, user_id, shop_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?)`, [uuid(), emp1Id, shop1Id, now, admin1Id]);
  await execute(`INSERT INTO user_shops (id, user_id, shop_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?)`, [uuid(), emp1Id, shop2Id, now, admin1Id]);

  // Employee 2: Amit Patel (Single-Shop)
  await execute(
    `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, 'EMPLOYEE', 1, ?, ?, ?, ?)`,
    [emp2Id, org1Id, "9822222222", empPass, "Amit Patel (Single-Shop)", now, admin1Id, now, admin1Id]
  );
  await execute(`INSERT INTO user_shops (id, user_id, shop_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?, ?)`, [uuid(), emp2Id, shop1Id, now, admin1Id]);

  // 6. Sample Enquiries for Org 1
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 2);

  const enquiry1Id = uuid();
  await execute(
    `INSERT INTO customer_enquiries (
      id, organization_id, shop_id, customer_name, customer_phone, vehicle_model, vehicle_reg, tyre_size, tyre_brand,
      quantity, estimated_budget, follow_up_date, status, remarks, assigned_to_user_id, is_deleted,
      created_at, created_by, last_modified_at, last_modified_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, ?, ?, ?, ?)`,
    [
      enquiry1Id,
      org1Id,
      shop1Id,
      "Vikram Malhotra",
      "9870001122",
      "Hyundai Creta SX",
      "KA-01-MJ-4521",
      "215/60 R17",
      "Bridgestone Dueler",
      4,
      38000,
      todayDate.toISOString(),
      "Customer asked about warranty and installment options.",
      emp1Id,
      now,
      emp1Id,
      now,
      emp1Id,
    ]
  );

  await execute(
    `INSERT INTO enquiry_logs (id, enquiry_id, action, new_value, remarks, created_by_id, created_at)
     VALUES (?, ?, 'CREATED', 'Initial enquiry logged', 'Customer wants Bridgestone 215/60 R17', ?, ?)`,
    [uuid(), enquiry1Id, emp1Id, now]
  );

  // Enquiry 2 (Due Tomorrow)
  await execute(
    `INSERT INTO customer_enquiries (
      id, organization_id, shop_id, customer_name, customer_phone, vehicle_model, vehicle_reg, tyre_size, tyre_brand,
      quantity, estimated_budget, follow_up_date, status, remarks, assigned_to_user_id, is_deleted,
      created_at, created_by, last_modified_at, last_modified_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, ?, ?, ?, ?)`,
    [
      uuid(),
      org1Id,
      shop1Id,
      "Pooja Verma",
      "9870003344",
      "Honda City V",
      "KA-05-AA-7890",
      "185/60 R15",
      "Michelin Energy XM2+",
      4,
      28000,
      tomorrowDate.toISOString(),
      "Follow up regarding stock arrival from warehouse.",
      emp1Id,
      now,
      emp1Id,
      now,
      emp1Id,
    ]
  );

  // Enquiry 3 (Overdue)
  await execute(
    `INSERT INTO customer_enquiries (
      id, organization_id, shop_id, customer_name, customer_phone, vehicle_model, vehicle_reg, tyre_size, tyre_brand,
      quantity, estimated_budget, follow_up_date, status, remarks, assigned_to_user_id, is_deleted,
      created_at, created_by, last_modified_at, last_modified_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, ?, ?, ?, ?)`,
    [
      uuid(),
      org1Id,
      shop1Id,
      "Suresh Reddy",
      "9870005566",
      "Maruti Swift Dzire",
      "KA-03-NB-1234",
      "165/80 R14",
      "JK Tyre / CEAT",
      2,
      8500,
      yesterdayDate.toISOString(),
      "Urgent call required - front tyres worn out.",
      emp2Id,
      now,
      emp2Id,
      now,
      emp2Id,
    ]
  );

  // Enquiry 4 (Completed)
  await execute(
    `INSERT INTO customer_enquiries (
      id, organization_id, shop_id, customer_name, customer_phone, vehicle_model, vehicle_reg, tyre_size, tyre_brand,
      quantity, estimated_budget, follow_up_date, status, remarks, assigned_to_user_id, is_deleted,
      created_at, created_by, last_modified_at, last_modified_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, 0, ?, ?, ?, ?)`,
    [
      uuid(),
      org1Id,
      shop1Id,
      "Karan Singh",
      "9870007788",
      "Toyota Fortuner",
      "KA-04-ZZ-9999",
      "265/65 R17",
      "Goodyear Wrangler",
      4,
      62000,
      yesterdayDate.toISOString(),
      "Tyres fitted and alignment completed. Customer very satisfied.",
      emp1Id,
      now,
      emp1Id,
      now,
      emp1Id,
    ]
  );

  // 7. Organization 2 (to verify Cross-Tenant Isolation): Prime Wheels Group
  const org2Id = uuid();
  const admin2Id = uuid();
  const shop3Id = uuid();

  await execute(
    `INSERT INTO organizations (id, name, slug, phone, email, address, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [org2Id, "Prime Wheels Co", "prime-wheels", "080-99001122", "info@primewheels.com", "Industrial Boulevard", now, superAdminId, now, superAdminId]
  );

  await execute(
    `INSERT INTO users (id, organization_id, phone, password_hash, full_name, role, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, ?, ?, ?, ?)`,
    [admin2Id, org2Id, "8888888888", adminPass, "Sunil Sen (Prime Admin)", now, superAdminId, now, superAdminId]
  );

  await execute(
    `INSERT INTO shops (id, organization_id, name, code, address, phone, is_active, created_at, created_by, last_modified_at, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [shop3Id, org2Id, "Prime Wheels West Branch", "PWW-01", "West Industrial Zone", "080-77889900", now, admin2Id, now, admin2Id]
  );

  console.log("Multi-Tenant database successfully initialized & seeded!");
}

async function closeDatabase() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log("PostgreSQL connection pool closed.");
  }
  if (dbInstance) {
    await new Promise((resolve) => dbInstance.close(resolve));
    dbInstance = null;
    console.log("SQLite connection closed.");
  }
}

async function transaction(callback) {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const clientWrapper = {
        query: (sql, params = []) => {
          let pIndex = 1;
          const pgSql = sql.replace(/\?/g, () => `${pIndex++}`);
          return client.query(pgSql, params).then((res) => res.rows);
        },
        execute: (sql, params = []) => {
          let pIndex = 1;
          const pgSql = sql.replace(/\?/g, () => `${pIndex++}`);
          return client.query(pgSql, params).then((res) => ({ rowCount: res.rowCount }));
        },
        getOne: (sql, params = []) => {
          let pIndex = 1;
          const pgSql = sql.replace(/\?/g, () => `${pIndex++}`);
          return client.query(pgSql, params).then((res) => (res.rows.length > 0 ? res.rows[0] : null));
        },
      };
      const result = await callback(clientWrapper);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    await execute("BEGIN TRANSACTION;");
    try {
      const result = await callback({ query, execute, getOne });
      await execute("COMMIT;");
      return result;
    } catch (error) {
      await execute("ROLLBACK;");
      throw error;
    }
  }
}

module.exports = {
  initDatabase,
  closeDatabase,
  transaction,
  query,
  getOne,
  execute,
  uuid,
};
