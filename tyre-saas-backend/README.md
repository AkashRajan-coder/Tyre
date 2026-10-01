# Tyre Shop Follow-Up App — Multi-Tenant SaaS Backend

Production-ready **Node.js (JavaScript)** multi-tenant backend built with **Express** and SQL storage (Neon PostgreSQL + SQLite local fallback) to power Flutter apps and administrative web dashboards.

---

## 🏗️ 4-Tier SaaS Hierarchy

```
Super Admin (SaaS Platform Owner)
   └── Business Admin / Organization (Tenant)
         └── Shops (Branches)
               └── Employees (Staff)
```

---

## 🌟 Key Architecture Capabilities

1. **Role-Based Authorization (RBAC)**:
   - `SUPER_ADMIN`: Main platform owner. Can create, manage, deactivate, and view all organizations and business admins.
   - `ADMIN` (Business Admin): Belongs to one organization. Access is strictly jailed to their organization's shops, employees, and enquiries.
   - `EMPLOYEE`: Access is restricted to their explicitly assigned shops.
2. **Strict Data Isolation**:
   - Organization-level boundary: Admins cannot query, edit, or delete shops/users/enquiries belonging to other organizations (returns 404 / access denied).
   - Shop-level boundary: Employees cannot query or create entries for shops they are not assigned to (returns 403 Forbidden).
3. **Database Flexibility (Neon PostgreSQL + SQLite)**:
   - **Neon PostgreSQL**: Fully supported with connection pooling and SSL mode (`rejectUnauthorized: false`).
   - **SQLite**: Local file database (`./tyre_saas.db`) enabling zero-setup offline development and automated testing.
   - Standalone DDL migration script provided in `migrations.sql`.
4. **Interactive Swagger UI**:
   - Access at `http://localhost:5000/api/docs` with Bearer JWT authorize support for all 3 roles.
5. **Audit Trail & Soft Deletes**:
   - All tables stamp `created_by`, `created_at`, `last_modified_by`, and `last_modified_at`.
   - Deletions are soft (`is_deleted = 1`, `is_active = 0`).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=5000
NODE_ENV=development

# Database options:
# 1. SQLite (Default local setup):
DB_TYPE=sqlite
DATABASE_URL=file:./tyre_saas.db

# 2. Neon PostgreSQL (Production):
# DB_TYPE=postgres
# DATABASE_URL=postgresql://neondb_owner:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require

JWT_SECRET=tyre_shop_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Automated Multi-Tenant Integration Tests
```bash
npm test
```

---

## 🔑 Pre-Seeded Test Accounts

| Role | Phone | Password | Organization | Access Scope |
|---|---|---|---|---|
| **Super Admin** | `0000000000` | `superadmin123` | *Platform-wide* | Full access to all organizations, shops, and admins |
| **Business Admin 1** | `9999999999` | `admin123` | Apex Tyre Group | Scoped strictly to Apex Tyre Group |
| **Business Admin 2** | `8888888888` | `admin123` | Prime Wheels Co | Scoped strictly to Prime Wheels Co |
| **Employee 1 (Multi-Shop)** | `9811111111` | `emp123` | Apex Tyre Group | Downtown & Highway Hub branches (Shop Picker) |
| **Employee 2 (Single-Shop)** | `9822222222` | `emp123` | Apex Tyre Group | Downtown branch only (Auto-selected) |

---

## 📡 API Endpoint Overview

### 👑 Super Admin (`/api/v1/super-admin`) — Protected by `SUPER_ADMIN`
- `GET /dashboard` — Global platform metrics across all tenant organizations
- `GET /organizations` — List all organizations with shop & user counts
- `POST /organizations` — Create organization & optional initial Business Admin
- `GET /organizations/:id` — Organization details with shops & staff
- `PATCH /organizations/:id` — Update organization details
- `DELETE /organizations/:id` — Deactivate organization (suspends all tenant users)
- `GET /business-admins` — List all Business Admins across all organizations
- `POST /business-admins` — Create a Business Admin for an organization
- `PATCH /business-admins/:id` — Update Business Admin
- `POST /business-admins/:id/reset-password` — Reset Business Admin password
- `DELETE /business-admins/:id` — Delete Business Admin

### 🏢 Business Admin (`/api/v1/admin`) — Protected by `ADMIN` (Scoped to Organization)
- `GET /dashboard` — Organization dashboard with per-shop conversion rates
- `GET /enquiries` — Organization-wide enquiries with multi-shop filters
- `PATCH /enquiries/:id/reassign` — Reassign enquiry between employees
- `DELETE /enquiries/:id` — Soft-delete enquiry (`is_deleted = 1`)
- `GET /shops`, `POST /shops`, `PATCH /shops/:id`, `DELETE /shops/:id` — Manage organization shops
- `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password`, `DELETE /users/:id` — Manage organization staff
- `GET /export/csv` — Export organization enquiries as CSV

### 👷 Employee (`/api/v1/employee`) — Protected by `EMPLOYEE` (Scoped to Assigned Shops)
- `GET /shops` — List assigned active shops
- `GET /banner-summary?shopId=...` — In-app banner: Due today, tomorrow, overdue
- `GET /check-duplicate?phone=...&shopId=...` — Duplicate customer phone check
- `POST /enquiries` — Tab 1: Add customer enquiry (auto-stamps shop & organization)
- `GET /pending?shopId=...` — Tab 2: Pending follow-ups
- `GET /completed?shopId=...` — Tab 3: Completed follow-ups
- `GET /search?shopId=...&query=...` — Tab 4: Fast search (name, phone, tyre size, vehicle)
- `GET /enquiries/:id` — Detail view with audit activity logs
- `PATCH /enquiries/:id` — Update status, reschedule, remarks


---

## 🗄️ Render & Neon PostgreSQL Production Deployment

### Render Environment Variables Checklist
Configure these in your Render Dashboard under **Environment**:

| Variable | Value Description | Example |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | Injected automatically by Render (do not override) | `10000` |
| `DATABASE_URL` | Neon PostgreSQL connection string (SSL required) | `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Secret key used for signing JWT tokens | `strong_random_secret_at_least_32_characters` |
| `CORS_ORIGIN` | Comma-separated list of web origins (Flutter mobile apps require no Origin and are always allowed) | `*` or `https://admin.yourdomain.com` |

### 1. Automatic Zero-Touch Migrations on Render Startup
Because Render provides no interactive shell in standard web service deploys, the backend runs **automated, idempotent database migrations on every server startup**:
- Runs `CREATE TABLE IF NOT EXISTS` for all 14 SaaS schema tables.
- Runs guarded `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for all incremental columns (`is_deleted`, `price`, `customer_enquiries` fields).
- Multi-tenant initial accounts and master data are seeded automatically if the database is fresh.
- If migrations fail in production, the server logs a fatal diagnostic message and exits immediately to prevent corrupted runtime state.

### 2. Health Check & Cold-Start Wake-up
- `GET /health` is unauthenticated and resides outside the rate limiter.
- Returns `{ "success": true, "status": "ok" }`.
- Use `https://<your-render-service>.onrender.com/health` in Render Health Check path and in Flutter client on app startup to wake up free/starter instances.

### 2. Backup Procedures
1. **Neon Serverless Branching (Instant Zero-Downtime Backup)**:
   - In the Neon Console, create a branch from `main` before running large schema migrations.
   - Neon snapshots storage instantly without copying bytes.
2. **Standard pg_dump CLI Backup**:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --file=tyre_saas_backup_$(date +%Y%m%d_%H%M%S).dump
   ```

### 3. Restore Procedures
1. **Restore using psql/pg_restore**:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" tyre_saas_backup_YYYYMMDD_HHMMSS.dump
   ```
2. **Neon Point-in-Time Restore (PITR)**:
   - In Neon Console -> Project -> Restore to a point in time (available up to 30 days on Launch/Scale tiers).

---

## 🛡️ Production Security Checklist
- [x] **Helmet Security Headers**: Automatically applies CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.
- [x] **Rate Limiting**: Brute-force protection on `/api/v1/auth/login` and general DDoS throttling on `/api/v1`.
- [x] **Strict Parameterization**: Zero dynamic string interpolation in SQL queries.
- [x] **Graceful Shutdown**: Drains connection pool on `SIGTERM` / `SIGINT`.
- [x] **Tenant & Shop Isolation**: All multi-tenant barriers verified in automated test suites.
