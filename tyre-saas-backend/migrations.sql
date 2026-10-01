-- ================================================================
-- Neon PostgreSQL Multi-Tenant Schema Migration
-- ================================================================

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) UNIQUE,
  phone VARCHAR(32),
  email VARCHAR(128),
  address TEXT,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 2. Users (Super Admin has NULL organization_id; Business Admin and Employee have organization_id)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE CASCADE,
  phone VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role VARCHAR(32) DEFAULT 'EMPLOYEE', -- 'SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'
  is_active SMALLINT DEFAULT 1,
  is_deleted SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 3. Shops (Scoped to an organization)
CREATE TABLE IF NOT EXISTS shops (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(64) UNIQUE,
  address TEXT,
  phone VARCHAR(32),
  is_active SMALLINT DEFAULT 1,
  is_deleted SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 4. User Shop Assignments (Employee to Shop junction)
CREATE TABLE IF NOT EXISTS user_shops (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id VARCHAR(64) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by VARCHAR(64),
  UNIQUE(user_id, shop_id)
);

-- 5. Tyre Sizes
CREATE TABLE IF NOT EXISTS tyre_sizes (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  size VARCHAR(64) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 6. Tyre Brands
CREATE TABLE IF NOT EXISTS tyre_brands (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 7. Tyre Products
CREATE TABLE IF NOT EXISTS tyre_products (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tyre_size_id VARCHAR(64) NOT NULL REFERENCES tyre_sizes(id) ON DELETE CASCADE,
  tyre_brand_id VARCHAR(64) NOT NULL REFERENCES tyre_brands(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(32) NOT NULL,
  product_name VARCHAR(128),
  price NUMERIC(10, 2) DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 8. Car Brands
CREATE TABLE IF NOT EXISTS car_brands (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 9. Car Models
CREATE TABLE IF NOT EXISTS car_models (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  car_brand_id VARCHAR(64) NOT NULL REFERENCES car_brands(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 10. Customer Enquiries (Scoped to organization & shop)
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
  amount NUMERIC(10, 2),
  follow_up_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(32) DEFAULT 'PENDING',
  remarks TEXT,
  assigned_to_user_id VARCHAR(64) REFERENCES users(id),
  is_deleted SMALLINT DEFAULT 0,
  car_brand_id VARCHAR(64),
  car_model_id VARCHAR(64),
  vehicle_type VARCHAR(32),
  tyre_size_id VARCHAR(64),
  tyre_brand_id VARCHAR(64),
  fit_status VARCHAR(32),
  lead_source VARCHAR(64),
  enquiry_type VARCHAR(64),
  wheel_alignment VARCHAR(64),
  suitable_shop_id VARCHAR(64),
  not_fit_location TEXT,
  outside_shop_name VARCHAR(128),
  outside_shop_location VARCHAR(128),
  outside_shop_address TEXT,
  outside_shop_amount NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64) NOT NULL,
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64) NOT NULL
);

-- 11. Enquiry Activity Audit Logs
CREATE TABLE IF NOT EXISTS enquiry_logs (
  id VARCHAR(64) PRIMARY KEY,
  enquiry_id VARCHAR(64) NOT NULL REFERENCES customer_enquiries(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  remarks TEXT,
  created_by_id VARCHAR(64) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shop_id VARCHAR(64) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  amount NUMERIC(10, 2) DEFAULT 0,
  tyre_customer_quantity INTEGER DEFAULT 0,
  tyre_mechanic_quantity INTEGER DEFAULT 0,
  two_wheeler_enquiry_customer_quantity INTEGER DEFAULT 0,
  two_wheeler_enquiry_mechanic_quantity INTEGER DEFAULT 0,
  two_wheeler_alignment_customer_quantity INTEGER DEFAULT 0,
  two_wheeler_alignment_mechanic_quantity INTEGER DEFAULT 0,
  wheel_alignment_customer_quantity INTEGER DEFAULT 0,
  wheel_alignment_mechanic_quantity INTEGER DEFAULT 0,
  commercial_tyre_customer_quantity INTEGER DEFAULT 0,
  commercial_tyre_mechanic_quantity INTEGER DEFAULT 0,
  ro_water_customer_quantity INTEGER DEFAULT 0,
  ro_water_mechanic_quantity INTEGER DEFAULT 0,
  above_17_inch_customer_quantity INTEGER DEFAULT 0,
  above_17_inch_mechanic_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 13. Monthly Targets
CREATE TABLE IF NOT EXISTS monthly_targets (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shop_id VARCHAR(64) NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  target_year INTEGER NOT NULL,
  target_month INTEGER NOT NULL,
  amount_target NUMERIC(10, 2) DEFAULT 0,
  tyre_target INTEGER DEFAULT 0,
  two_wheeler_enquiry_target INTEGER DEFAULT 0,
  two_wheeler_alignment_target INTEGER DEFAULT 0,
  wheel_alignment_target INTEGER DEFAULT 0,
  commercial_tyre_target INTEGER DEFAULT 0,
  ro_water_target INTEGER DEFAULT 0,
  above_17_inch_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64)
);

-- 14. Enquiry Tyre Options
CREATE TABLE IF NOT EXISTS enquiry_tyre_options (
  id VARCHAR(64) PRIMARY KEY,
  enquiry_id VARCHAR(64) NOT NULL REFERENCES customer_enquiries(id) ON DELETE CASCADE,
  tyre_product_id VARCHAR(64) NOT NULL REFERENCES tyre_products(id) ON DELETE CASCADE,
  option_order INTEGER NOT NULL,
  price_snapshot NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64)
);

-- 15. Login Attempts (Rate limiting / lockout)
CREATE TABLE IF NOT EXISTS login_attempts (
  phone VARCHAR(32) PRIMARY KEY,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  last_attempt_at TIMESTAMP WITH TIME ZONE
);

-- 16. Revoked Tokens (JWT Logout Blacklist)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti VARCHAR(64) PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Guarded column additions for pre-existing databases (PostgreSQL)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted SMALLINT DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_deleted SMALLINT DEFAULT 0;
ALTER TABLE tyre_products ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE tyre_products ADD COLUMN IF NOT EXISTS product_name VARCHAR(128);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(10, 2);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS tyre_size VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS tyre_brand VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS tyre_size_id VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS tyre_brand_id VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS car_brand_id VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS car_model_id VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(32);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS fit_status VARCHAR(32);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS lead_source VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS enquiry_type VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS wheel_alignment VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS suitable_shop_id VARCHAR(64);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS not_fit_location TEXT;
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS outside_shop_name VARCHAR(128);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS outside_shop_location VARCHAR(128);
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS outside_shop_address TEXT;
ALTER TABLE customer_enquiries ADD COLUMN IF NOT EXISTS outside_shop_amount NUMERIC(10, 2);

-- Performance & Isolation Indexes
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(organization_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_org ON customer_enquiries(organization_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_shop_phone ON customer_enquiries(shop_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_enquiries_shop_status_date ON customer_enquiries(shop_id, status, follow_up_date);
CREATE INDEX IF NOT EXISTS idx_logs_enquiry ON enquiry_logs(enquiry_id);
