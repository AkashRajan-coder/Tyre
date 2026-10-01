const request = require("supertest");
const assert = require("assert");
const app = require("../index");
const { initDatabase, closeDatabase, query, execute, getOne } = require("../src/config/db");

async function runTests() {
  console.log("===============================================================");
  console.log("  Running Contract Mismatches & Verification Test Suite        ");
  console.log("===============================================================");

  // Initialize DB in test environment
  process.env.DB_TYPE = "sqlite";
  await initDatabase();

  let adminToken = "";
  let adminOrgId = "";
  let adminShopId = "";
  let adminUserId = "";

  let admin2Token = "";
  let admin2OrgId = "";
  let admin2ShopId = "";

  let employeeToken = "";
  let employeeId = "";

  let sizeId = "";
  let brandId = "";
  let productId = "";

  // -----------------------------------------------------------------
  // 1. Authenticate Test Users
  // -----------------------------------------------------------------
  console.log("\n[Setup] Authenticating test accounts...");

  // Login Admin 1 (Apex Tyre Group)
  const adminRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ phone: "9999999999", password: "admin123" });
  assert.strictEqual(adminRes.status, 200, "Admin 1 login failed");
  adminToken = adminRes.body.data.token;
  adminOrgId = adminRes.body.data.user.organizationId;
  console.log("  ✓ Admin 1 logged in successfully");

  // Login Admin 2 (Prime Wheels Co - Tenant 2)
  const admin2Res = await request(app)
    .post("/api/v1/auth/login")
    .send({ phone: "8888888888", password: "admin123" });
  assert.strictEqual(admin2Res.status, 200, "Admin 2 login failed");
  admin2Token = admin2Res.body.data.token;
  admin2OrgId = admin2Res.body.data.user.organizationId;
  console.log("  ✓ Admin 2 (Tenant 2) logged in successfully");

  // Login Employee 1 (Assigned to Shop 1 and Shop 2 in Org 1)
  const empRes = await request(app)
    .post("/api/v1/auth/login")
    .send({ phone: "9811111111", password: "emp123" });
  assert.strictEqual(empRes.status, 200, "Employee login failed");
  employeeToken = empRes.body.data.token;
  employeeId = empRes.body.data.user.id;
  console.log("  ✓ Employee 1 logged in successfully");

  // Retrieve seed shop IDs
  const shops = await query("SELECT id FROM shops WHERE organization_id = ? ORDER BY name ASC", [adminOrgId]);
  adminShopId = shops[0].id;
  const shops2 = await query("SELECT id FROM shops WHERE organization_id = ?", [admin2OrgId]);
  admin2ShopId = shops2[0].id;

  // Retrieve seed user
  const users = await query("SELECT id FROM users WHERE organization_id = ? AND role = 'EMPLOYEE'", [adminOrgId]);
  adminUserId = users[0].id;

  // Retrieve or seed size, brand, product
  const { uuid } = require("../src/config/db");
  const now = new Date().toISOString();

  let sizeRow = await getOne("SELECT id FROM tyre_sizes WHERE organization_id = ? AND is_active = 1", [adminOrgId]);
  if (!sizeRow) {
    sizeId = uuid();
    await execute(`INSERT INTO tyre_sizes (id, organization_id, size, is_active, created_at, created_by, last_modified_at, last_modified_by) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`, [sizeId, adminOrgId, "215/60 R17", now, adminUserId, now, adminUserId]);
  } else {
    sizeId = sizeRow.id;
  }

  let brandRow = await getOne("SELECT id FROM tyre_brands WHERE organization_id = ? AND is_active = 1", [adminOrgId]);
  if (!brandRow) {
    brandId = uuid();
    await execute(`INSERT INTO tyre_brands (id, organization_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`, [brandId, adminOrgId, "Bridgestone", now, adminUserId, now, adminUserId]);
  } else {
    brandId = brandRow.id;
  }

  let prodRow = await getOne("SELECT id FROM tyre_products WHERE organization_id = ?", [adminOrgId]);
  if (!prodRow) {
    productId = uuid();
    await execute(`INSERT INTO tyre_products (id, organization_id, tyre_size_id, tyre_brand_id, vehicle_type, product_name, price, is_active, created_at, created_by, last_modified_at, last_modified_by) VALUES (?, ?, ?, ?, 'FOUR_WHEELER', 'Bridgestone Turanza', 6500, 1, ?, ?, ?, ?)`, [productId, adminOrgId, sizeId, brandId, now, adminUserId, now, adminUserId]);
  } else {
    productId = prodRow.id;
  }

  let carBrandRow = await getOne("SELECT id FROM car_brands WHERE organization_id = ?", [adminOrgId]);
  if (!carBrandRow) {
    const cbId = uuid();
    await execute(`INSERT INTO car_brands (id, organization_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by) VALUES (?, ?, 'Hyundai', 1, ?, ?, ?, ?)`, [cbId, adminOrgId, now, adminUserId, now, adminUserId]);
    await execute(`INSERT INTO car_models (id, organization_id, car_brand_id, name, is_active, created_at, created_by, last_modified_at, last_modified_by) VALUES (?, ?, ?, 'Creta', 1, ?, ?, ?, ?)`, [uuid(), adminOrgId, cbId, now, adminUserId, now, adminUserId]);
  }

  // -----------------------------------------------------------------
  // 2. Health Check (GET /health)
  // -----------------------------------------------------------------
  console.log("\n[Test] D.3: GET /health (Unauthenticated & outside rate limiter)");
  const healthRes = await request(app).get("/health");
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.body.success, true);
  assert.strictEqual(healthRes.body.status, "ok");
  console.log("  ✓ GET /health returned 200 { success: true, status: 'ok' }");

  // -----------------------------------------------------------------
  // 3. Admin Shop by ID (GET /api/v1/admin/shops/:id)
  // -----------------------------------------------------------------
  console.log("\n[Test] A.1: GET /api/v1/admin/shops/:id");
  // Success inside own organization
  const shopRes = await request(app)
    .get(`/api/v1/admin/shops/${adminShopId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(shopRes.status, 200);
  assert.strictEqual(shopRes.body.success, true);
  assert.strictEqual(shopRes.body.data.id, adminShopId);
  console.log("  ✓ Admin retrieved shop inside own organization (200)");

  // Cross-tenant isolation: Admin 1 trying to read Admin 2's shop
  const crossShopRes = await request(app)
    .get(`/api/v1/admin/shops/${admin2ShopId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(crossShopRes.status, 404);
  console.log("  ✓ Cross-tenant shop access correctly blocked with 404");

  // Non-existent shop ID
  const nonExistShopRes = await request(app)
    .get("/api/v1/admin/shops/non-existent-shop-id")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(nonExistShopRes.status, 404);
  console.log("  ✓ Non-existent shop returned 404");

  // -----------------------------------------------------------------
  // 4. Admin User by ID (GET /api/v1/admin/users/:id)
  // -----------------------------------------------------------------
  console.log("\n[Test] A.2: GET /api/v1/admin/users/:id");
  const userRes = await request(app)
    .get(`/api/v1/admin/users/${adminUserId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(userRes.status, 200);
  assert.strictEqual(userRes.body.success, true);
  assert.strictEqual(userRes.body.data.id, adminUserId);
  assert.strictEqual(userRes.body.data.password_hash, undefined, "password_hash must be excluded");
  assert.ok(Array.isArray(userRes.body.data.shops), "shops array must be present");
  console.log("  ✓ User returned without password_hash and with assigned shops (200)");

  // Cross-tenant user check
  const admin2User = await getOne("SELECT id FROM users WHERE organization_id = ? AND role = 'ADMIN'", [admin2OrgId]);
  const crossUserRes = await request(app)
    .get(`/api/v1/admin/users/${admin2User.id}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(crossUserRes.status, 404);
  console.log("  ✓ Cross-tenant user access correctly blocked with 404");

  // -----------------------------------------------------------------
  // 5. Employee Tyre Sizes & Brands (GET /employee/tyre-sizes, /tyre-brands)
  // -----------------------------------------------------------------
  console.log("\n[Test] A.3: GET /api/v1/employee/tyre-sizes & tyre-brands");
  const sizesRes = await request(app)
    .get("/api/v1/employee/tyre-sizes")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(sizesRes.status, 200);
  assert.strictEqual(sizesRes.body.success, true);
  assert.ok(Array.isArray(sizesRes.body.data));
  assert.ok(sizesRes.body.data.length > 0, "Should return active tyre sizes");
  console.log(`  ✓ Employee retrieved ${sizesRes.body.data.length} active tyre sizes (200)`);

  const brandsRes = await request(app)
    .get("/api/v1/employee/tyre-brands")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(brandsRes.status, 200);
  assert.strictEqual(brandsRes.body.success, true);
  assert.ok(Array.isArray(brandsRes.body.data));
  assert.ok(brandsRes.body.data.length > 0, "Should return active tyre brands");
  console.log(`  ✓ Employee retrieved ${brandsRes.body.data.length} active tyre brands (200)`);

  // Car brands & Car models
  const carBrandsRes = await request(app)
    .get("/api/v1/employee/car-brands")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(carBrandsRes.status, 200);
  assert.strictEqual(carBrandsRes.body.success, true);
  console.log(`  ✓ Employee retrieved ${carBrandsRes.body.data.length} car brands (200)`);

  const carModelsRes = await request(app)
    .get("/api/v1/employee/car-models")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(carModelsRes.status, 200);
  assert.strictEqual(carModelsRes.body.success, true);
  console.log(`  ✓ Employee retrieved ${carModelsRes.body.data.length} car models (200)`);

  // -----------------------------------------------------------------
  // 6. Daily Reports (GET /api/v1/daily-reports)
  // -----------------------------------------------------------------
  console.log("\n[Test] A.4: GET /api/v1/daily-reports");
  // Seed a daily report for adminShopId
  const reportId = uuid();
  await execute(
    `INSERT INTO daily_reports (id, organization_id, shop_id, report_date, amount, created_at, last_modified_at)
     VALUES (?, ?, ?, '2026-10-01', 12500, ?, ?)`,
    [reportId, adminOrgId, adminShopId, new Date().toISOString(), new Date().toISOString()]
  );

  // Admin query
  const adminReportsRes = await request(app)
    .get(`/api/v1/daily-reports?shopId=${adminShopId}&from=2026-10-01&to=2026-10-01`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.strictEqual(adminReportsRes.status, 200);
  assert.strictEqual(adminReportsRes.body.success, true);
  assert.ok(Array.isArray(adminReportsRes.body.data));
  console.log(`  ✓ Admin retrieved ${adminReportsRes.body.data.length} daily reports with date filter (200)`);

  // Employee query for mapped shop
  const empReportsRes = await request(app)
    .get(`/api/v1/daily-reports?shopId=${adminShopId}`)
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(empReportsRes.status, 200);
  assert.strictEqual(empReportsRes.body.success, true);
  console.log("  ✓ Employee retrieved daily reports for mapped shop (200)");

  // Employee query for unmapped shop (admin2ShopId)
  const empDeniedRes = await request(app)
    .get(`/api/v1/daily-reports?shopId=${admin2ShopId}`)
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(empDeniedRes.status, 403);
  console.log("  ✓ Employee access to unmapped shop daily reports blocked with 403");

  // -----------------------------------------------------------------
  // 7. Enquiry Creation - Old Flutter Payload (estimatedBudget + text tyreSize & tyreBrand)
  // -----------------------------------------------------------------
  console.log("\n[Test] B: POST /api/v1/employee/enquiries with OLD Flutter Payload");
  const randomPhone1 = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const oldPayload = {
    shopId: adminShopId,
    customerName: "Ramesh Sharma (Old App)",
    customerPhone: randomPhone1,
    estimatedBudget: 24000,
    tyreSize: "215/60 R17",
    tyreBrand: "Bridgestone",
    vehicleModel: "Creta SX",
    followUpDate: "2026-10-05T10:00:00.000Z",
    remarks: "Customer tested with old flutter contract"
  };

  const oldEnquiryRes = await request(app)
    .post("/api/v1/employee/enquiries")
    .set("Authorization", `Bearer ${employeeToken}`)
    .send(oldPayload);

  assert.strictEqual(oldEnquiryRes.status, 201, `Old payload creation failed: ${JSON.stringify(oldEnquiryRes.body)}`);
  assert.strictEqual(oldEnquiryRes.body.success, true);
  assert.strictEqual(oldEnquiryRes.body.data.estimated_budget, 24000);
  assert.strictEqual(oldEnquiryRes.body.data.amount, 24000);
  assert.strictEqual(oldEnquiryRes.body.data.tyre_size, "215/60 R17");
  assert.strictEqual(oldEnquiryRes.body.data.tyre_brand, "Bridgestone");
  assert.ok(oldEnquiryRes.body.data.tyre_size_id, "Should best-effort match size id");
  assert.ok(oldEnquiryRes.body.data.tyre_brand_id, "Should best-effort match brand id");
  console.log("  ✓ Old payload created enquiry successfully with amount & estimated_budget matched (201)");

  // -----------------------------------------------------------------
  // 8. Enquiry Creation - New Flutter Payload (amount + tyreSizeId & tyreBrandId)
  // -----------------------------------------------------------------
  console.log("\n[Test] B: POST /api/v1/employee/enquiries with NEW Flutter Payload");
  const randomPhone2 = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const newPayload = {
    shopId: adminShopId,
    customerName: "Sneha Reddy (New App)",
    customerPhone: randomPhone2,
    amount: 32000,
    tyreSizeId: sizeId,
    tyreBrandId: brandId,
    followUpDate: "2026-10-06T10:00:00.000Z",
    remarks: "Customer tested with new flutter contract"
  };

  const newEnquiryRes = await request(app)
    .post("/api/v1/employee/enquiries")
    .set("Authorization", `Bearer ${employeeToken}`)
    .send(newPayload);

  assert.strictEqual(newEnquiryRes.status, 201, `New payload creation failed: ${JSON.stringify(newEnquiryRes.body)}`);
  assert.strictEqual(newEnquiryRes.body.success, true);
  assert.strictEqual(newEnquiryRes.body.data.amount, 32000);
  assert.strictEqual(newEnquiryRes.body.data.estimated_budget, 32000);
  assert.strictEqual(newEnquiryRes.body.data.tyre_size_id, sizeId);
  assert.strictEqual(newEnquiryRes.body.data.tyre_brand_id, brandId);
  console.log("  ✓ New payload created enquiry successfully with IDs and text columns populated (201)");

  // -----------------------------------------------------------------
  // 9. Zero-Budget Support in createEnquiry
  // -----------------------------------------------------------------
  console.log("\n[Test] B: POST /api/v1/employee/enquiries with Zero Budget (amount: 0)");
  const randomPhone3 = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const zeroBudgetPayload = {
    shopId: adminShopId,
    customerName: "Kunal Zero Budget",
    customerPhone: randomPhone3,
    amount: 0,
    tyreSizeId: sizeId,
    tyreBrandId: brandId,
    followUpDate: "2026-10-07T10:00:00.000Z",
  };
  const zeroRes = await request(app)
    .post("/api/v1/employee/enquiries")
    .set("Authorization", `Bearer ${employeeToken}`)
    .send(zeroBudgetPayload);
  assert.strictEqual(zeroRes.status, 201, "Zero budget should be allowed");
  assert.strictEqual(zeroRes.body.data.amount, 0);
  console.log("  ✓ amount: 0 is accepted without rejection (201)");

  // Negative amount rejected
  const negRes = await request(app)
    .post("/api/v1/employee/enquiries")
    .set("Authorization", `Bearer ${employeeToken}`)
    .send({ ...zeroBudgetPayload, amount: -500 });
  assert.strictEqual(negRes.status, 400);
  console.log("  ✓ Negative amount rejected with 400");

  // -----------------------------------------------------------------
  // 10. Tyre Product Partial Update (PATCH /admin/tyre-products/:id with only price)
  // -----------------------------------------------------------------
  console.log("\n[Test] C: PATCH /api/v1/admin/tyre-products/:id with only { price }");
  const patchRes = await request(app)
    .patch(`/api/v1/admin/tyre-products/${productId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ price: 7999.50 });

  assert.strictEqual(patchRes.status, 200, `Patch price failed: ${JSON.stringify(patchRes.body)}`);
  assert.strictEqual(patchRes.body.success, true);
  assert.strictEqual(Number(patchRes.body.data.price), 7999.5);
  console.log("  ✓ Partial update with ONLY { price: 7999.50 } succeeded (200)");

  // Verify employee list products reflects updated price
  const empProdsRes = await request(app)
    .get("/api/v1/employee/tyre-products")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(empProdsRes.status, 200);
  const foundProd = empProdsRes.body.data.find((p) => p.id === productId);
  assert.ok(foundProd, "Updated product should be in employee list");
  assert.strictEqual(Number(foundProd.price), 7999.5);
  console.log("  ✓ Employee tyre-products list shows the newly patched price");

  // -----------------------------------------------------------------
  // 11. Role Rules & Tenant Isolation
  // -----------------------------------------------------------------
  console.log("\n[Test] Tenant Isolation & Role RBAC Enforcement");
  // Employee cannot access admin endpoints
  const empForbiddenRes = await request(app)
    .get("/api/v1/admin/shops")
    .set("Authorization", `Bearer ${employeeToken}`);
  assert.strictEqual(empForbiddenRes.status, 403);
  console.log("  ✓ Employee calling admin endpoint returns 403 Forbidden");

  // Admin 1 cannot update Admin 2's tyre product
  const crossProdRes = await request(app)
    .patch(`/api/v1/admin/tyre-products/${productId}`)
    .set("Authorization", `Bearer ${admin2Token}`)
    .send({ price: 9999 });
  assert.strictEqual(crossProdRes.status, 404);
  console.log("  ✓ Admin 2 cannot mutate Admin 1's tyre product (404)");

  console.log("\n===============================================================");
  console.log("  🎉 ALL CONTRACT & MULTI-TENANT TESTS PASSED SUCCESSFULLY!    ");
  console.log("===============================================================\n");

  await closeDatabase();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error("\n❌ Test suite failed with error:\n", err);
  await closeDatabase();
  process.exit(1);
});
