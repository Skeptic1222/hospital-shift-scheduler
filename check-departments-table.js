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

async function checkTable() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);

    // Check table columns
    const columns = await pool.request()
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'departments'
        ORDER BY ORDINAL_POSITION
      `);

    console.log('\nDepartments table columns:');
    columns.recordset.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
    });

    // If settings column is missing, add it
    const hasSettings = columns.recordset.some(col => col.COLUMN_NAME === 'settings');
    if (!hasSettings) {
      console.log('\nAdding missing settings column...');
      await pool.request().query(`
        ALTER TABLE scheduler.departments
        ADD settings NVARCHAR(MAX) DEFAULT '{}'
      `);
      console.log('✓ Added settings column');
    }

    // Check if updated_at column exists
    const hasUpdatedAt = columns.recordset.some(col => col.COLUMN_NAME === 'updated_at');
    if (!hasUpdatedAt) {
      console.log('\nAdding missing updated_at column...');
      await pool.request().query(`
        ALTER TABLE scheduler.departments
        ADD updated_at DATETIME2 DEFAULT GETUTCDATE()
      `);
      console.log('✓ Added updated_at column');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkTable().catch(console.error);