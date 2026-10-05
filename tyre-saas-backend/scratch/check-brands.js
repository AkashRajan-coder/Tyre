require('dotenv').config();
const { initDatabase, query } = require('../src/config/db');

async function check() {
  try {
    await initDatabase();
    const cols = await query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tyre_brands';
    `);
    console.log('tyre_brands columns:', cols);

    const fks = await query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE ccu.table_name = 'tyre_brands';
    `);
    console.log('FKs referencing tyre_brands:', fks);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
