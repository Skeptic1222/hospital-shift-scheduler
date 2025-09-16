const sql = require('mssql');
require('dotenv').config();

async function testNamedPipes() {
  console.log('Testing SQL Server connection with Named Pipes...\n');

  // Try different connection configurations
  const configs = [
    {
      name: 'Named Pipes with Instance',
      config: {
        server: '\\\\.\pipe\\MSSQL$SQLEXPRESS\\sql\\query',
        database: 'HospitalScheduler',
        user: 'sa',
        password: 'ChangeThisStrongPassword!',
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      }
    },
    {
      name: 'Localhost with Instance',
      config: {
        server: 'localhost',
        database: 'HospitalScheduler',
        user: 'sa',
        password: 'ChangeThisStrongPassword!',
        options: {
          instanceName: 'SQLEXPRESS',
          encrypt: false,
          trustServerCertificate: true
        }
      }
    },
    {
      name: 'Computer Name with Instance',
      config: {
        server: 'Gaming01\\SQLEXPRESS',
        database: 'HospitalScheduler',
        user: 'sa',
        password: 'ChangeThisStrongPassword!',
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      }
    },
    {
      name: 'Localhost with Port',
      config: {
        server: 'localhost',
        port: 1433,
        database: 'HospitalScheduler',
        user: 'sa',
        password: 'ChangeThisStrongPassword!',
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      }
    }
  ];

  for (const test of configs) {
    console.log(`\nTrying: ${test.name}`);
    console.log('Config:', JSON.stringify(test.config.server));

    try {
      const pool = await sql.connect(test.config);
      console.log(`✅ SUCCESS! Connected using ${test.name}`);

      // Test query
      const result = await pool.query('SELECT @@SERVERNAME as server, DB_NAME() as db_name');
      console.log('Connected to:', result.recordset[0]);

      // Check tables
      const tables = await pool.query(`
        SELECT COUNT(*) as cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'scheduler'
      `);
      console.log(`Tables in scheduler schema: ${tables.recordset[0].cnt}`);

      await pool.close();

      console.log('\n✨ Connection successful! Use this configuration.');
      console.log('\nUpdate your .env file with:');
      console.log(`DB_SERVER=${test.config.server}`);
      if (test.config.port) {
        console.log(`DB_PORT=${test.config.port}`);
      }
      break;

    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

testNamedPipes();