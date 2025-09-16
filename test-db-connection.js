const sql = require('mssql');
require('dotenv').config();

async function testConnection() {
  console.log('Testing SQL Server connection...\n');

  const config = {
    server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    database: process.env.DB_NAME || 'HospitalScheduler',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
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

  // If no user/password, try Windows auth
  if (!config.user || !config.password) {
    console.log('Using Windows Authentication');
    config.authentication = {
      type: 'ntlm',
      options: {
        domain: process.env.DB_DOMAIN || ''
      }
    };
    delete config.user;
    delete config.password;
  } else {
    console.log('Using SQL Authentication');
  }

  console.log('Connection config:', {
    server: config.server,
    database: config.database,
    user: config.user ? '***' : 'Windows Auth',
    encrypt: config.options.encrypt,
    trustServerCertificate: config.options.trustServerCertificate
  });

  try {
    // Test connection
    const pool = await sql.connect(config);
    console.log('\n✅ Connected to SQL Server successfully!\n');

    // Test basic query
    const result = await pool.query('SELECT @@VERSION as version');
    console.log('SQL Server Version:', result.recordset[0].version.split('\n')[0]);

    // Check if database exists
    const dbCheck = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM sys.databases
      WHERE name = '${config.database}'
    `);
    console.log(`\nDatabase '${config.database}' exists:`, dbCheck.recordset[0].cnt > 0 ? '✅ Yes' : '❌ No');

    // Check if scheduler schema exists
    const schemaCheck = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM INFORMATION_SCHEMA.SCHEMATA
      WHERE SCHEMA_NAME = 'scheduler'
    `);
    console.log(`Schema 'scheduler' exists:`, schemaCheck.recordset[0].cnt > 0 ? '✅ Yes' : '❌ No');

    // Check if shifts table exists
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'scheduler'
      AND TABLE_NAME = 'shifts'
    `);
    console.log(`Table 'scheduler.shifts' exists:`, tableCheck.recordset[0].cnt > 0 ? '✅ Yes' : '❌ No');

    // If table exists, check structure
    if (tableCheck.recordset[0].cnt > 0) {
      const columns = await pool.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'scheduler'
        AND TABLE_NAME = 'shifts'
        ORDER BY ORDINAL_POSITION
      `);
      console.log('\nShifts table columns:');
      columns.recordset.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // Close connection
    await pool.close();
    console.log('\n✅ Database test completed successfully!');

  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error('Error:', error.message);

    if (error.code === 'ELOGIN') {
      console.error('\nPossible causes:');
      console.error('1. SQL Server is not running');
      console.error('2. Authentication mode is incorrect (SQL vs Windows)');
      console.error('3. Username/password is incorrect');
      console.error('4. User does not have access to the database');
    } else if (error.code === 'ETIMEOUT') {
      console.error('\nPossible causes:');
      console.error('1. SQL Server is not running');
      console.error('2. Firewall is blocking the connection');
      console.error('3. SQL Server TCP/IP protocol is disabled');
      console.error('4. Server name is incorrect');
    } else if (error.code === 'EINSTLOOKUP') {
      console.error('\nPossible causes:');
      console.error('1. SQL Server instance name is incorrect');
      console.error('2. SQL Server Browser service is not running');
    }

    process.exit(1);
  }
}

testConnection();