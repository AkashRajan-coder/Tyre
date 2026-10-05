require('dotenv').config();
const { initDatabase, query } = require('../src/config/db');

async function check() {
  try {
    await initDatabase();
    await query(`
      ALTER TABLE enquiry_tyre_options DROP CONSTRAINT IF EXISTS fk_enquiry_tyre_options_product;
      ALTER TABLE enquiry_tyre_options ADD CONSTRAINT fk_enquiry_tyre_options_product FOREIGN KEY (tyre_product_id) REFERENCES tyre_products(id) ON DELETE CASCADE;
    `);
    console.log('Successfully updated fk_enquiry_tyre_options_product constraint to ON DELETE CASCADE!');
    process.exit(0);
  } catch (err) {
    console.error('Migration test error:', err);
    process.exit(1);
  }
}

check();
