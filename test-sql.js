const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'qwerty',
    server: '172.17.48.1',
    port: 1433,
    database: 'master',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function testConnection() {
    try {
        console.log('Attempting to connect to SQL Server...');
        console.log('Config:', JSON.stringify(config, null, 2));
        
        const pool = await sql.connect(config);
        console.log('✓ Connected successfully!');
        
        // Test query
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log('SQL Server Version:', result.recordset[0].version.substring(0, 50) + '...');
        
        // Check if database exists
        const dbCheck = await pool.request()
            .input('dbName', sql.NVarChar, 'HospitalScheduler')
            .query('SELECT name FROM sys.databases WHERE name = @dbName');
        
        if (dbCheck.recordset.length > 0) {
            console.log('✓ HospitalScheduler database exists');
        } else {
            console.log('× HospitalScheduler database does not exist, creating...');
            await pool.request().query('CREATE DATABASE HospitalScheduler');
            console.log('✓ Database created');
        }
        
        await pool.close();
        console.log('Connection test successful!');
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.log('\nPossible solutions:');
            console.log('1. Ensure SQL Server TCP/IP is enabled');
            console.log('2. Check Windows Firewall allows port 1433');
            console.log('3. Verify SQL Server is running');
            console.log('4. Run enable-sql.ps1 script in PowerShell as Administrator');
        }
        process.exit(1);
    }
}

testConnection();