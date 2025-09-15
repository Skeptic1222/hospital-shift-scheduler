const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'HospitalScheduler',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'ChangeThisStrongPassword!',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false
  }
};

async function fixTable() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);

    // Add min_staff_required column if it doesn't exist
    try {
      await pool.request().query(`
        ALTER TABLE scheduler.departments
        ADD min_staff_required INT DEFAULT 1
      `);
      console.log('✓ Added min_staff_required column');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ min_staff_required column already exists');
      } else {
        console.error('Error adding min_staff_required:', e.message);
      }
    }

    // Add max_staff_allowed column if it doesn't exist
    try {
      await pool.request().query(`
        ALTER TABLE scheduler.departments
        ADD max_staff_allowed INT NULL
      `);
      console.log('✓ Added max_staff_allowed column');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('✓ max_staff_allowed column already exists');
      } else {
        console.error('Error adding max_staff_allowed:', e.message);
      }
    }

    console.log('\nTable structure fixed!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

fixTable().catch(console.error);