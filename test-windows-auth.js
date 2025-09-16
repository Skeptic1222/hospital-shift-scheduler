const sql = require('mssql');
require('dotenv').config();

async function testWindowsAuth() {
  console.log('Testing SQL Server connection with Windows Authentication...\n');

  const config = {
    server: 'localhost\\SQLEXPRESS',
    database: 'HospitalScheduler',
    options: {
      trustedConnection: true,
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  console.log('Connection config:', {
    server: config.server,
    database: config.database,
    trustedConnection: config.options.trustedConnection
  });

  try {
    // Test connection
    const pool = await sql.connect(config);
    console.log('\n✅ Connected to SQL Server successfully with Windows Authentication!\n');

    // Test basic query
    const result = await pool.query('SELECT @@VERSION as version');
    console.log('SQL Server Version:', result.recordset[0].version.split('\n')[0]);

    // Check tables
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'scheduler'
    `);
    console.log(`\nTables in scheduler schema: ${tableCheck.recordset[0].cnt}`);

    // Test shifts table specifically
    const shiftsCheck = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'scheduler'
      AND TABLE_NAME = 'shifts'
    `);
    console.log(`Shifts table exists: ${shiftsCheck.recordset[0].cnt > 0 ? '✅ Yes' : '❌ No'}`);

    // Close connection
    await pool.close();
    console.log('\n✅ Database test completed successfully!');
    console.log('\n✨ The database is ready for use with Windows Authentication!');

  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testWindowsAuth();