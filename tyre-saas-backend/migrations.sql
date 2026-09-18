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

-- 5. Customer Enquiries (Scoped to organization & shop)
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64) NOT NULL,
  last_modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(64) NOT NULL
);

-- 6. Enquiry Activity Audit Logs
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

-- Indexes for performance & multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(organization_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_org ON customer_enquiries(organization_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_shop_phone ON customer_enquiries(shop_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_enquiries_shop_status_date ON customer_enquiries(shop_id, status, follow_up_date);

-- Fast lookup for audit logs by enquiry
CREATE INDEX IF NOT EXISTS idx_logs_enquiry ON enquiry_logs(enquiry_id);
