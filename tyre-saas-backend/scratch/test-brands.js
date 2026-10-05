const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('1. Logging in as Super Admin...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone: '0000000000', password: 'superadmin123' });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes);
    process.exit(1);
  }

  const token = loginRes.data.data.token;
  console.log('Logged in successfully!');

  console.log('2. Fetching Tyre Brands list...');
  const listRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/super-admin/tyre-brands',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Fetched ${listRes.data.data.length} brands.`);

  console.log('3. Bulk inserting sample brands (Global Master)...');
  const bulkRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/super-admin/tyre-brands/bulk',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    brands: ['TestBrandAlpha', 'TestBrandBeta'],
    organizationId: null
  });
  console.log('Bulk insert result:', bulkRes.data);

  console.log('4. Finding inserted test brand...');
  const list2Res = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/super-admin/tyre-brands',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const testBrand = list2Res.data.data.find(b => b.name === 'TestBrandAlpha');
  console.log('Found test brand:', testBrand ? testBrand.id : 'not found');

  if (testBrand) {
    console.log('5. Testing Force Delete on test brand...');
    const delRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/v1/super-admin/tyre-brands/${testBrand.id}?force=true`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Delete result:', delRes.data);
  }

  const testBrandBeta = list2Res.data.data.find(b => b.name === 'TestBrandBeta');
  if (testBrandBeta) {
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/v1/super-admin/tyre-brands/${testBrandBeta.id}?force=true`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Cleaned up TestBrandBeta.');
  }

  console.log('All backend checks passed smoothly!');
}

run().catch(console.error);
