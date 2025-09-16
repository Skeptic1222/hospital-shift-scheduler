/**
 * Test SQL Server Express Connection
 * Verifies that we can connect to SQL Express without Azure dependencies
 */

const sql = require('mssql');
require('dotenv').config();

// Configuration for SQL Server Express
const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
    database: process.env.DB_NAME || 'HospitalScheduler',
    server: process.env.DB_SERVER?.split('\\')[0] || 'localhost',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false, // For local SQL Express
        trustServerCertificate: true, // For self-signed certs
        enableArithAbort: true,
        instanceName: process.env.DB_SERVER?.split('\\')[1] || 'SQLEXPRESS'
    }
};

async function testConnection() {
    console.log('Testing SQL Server Express Connection...');
    console.log('Configuration:');
    console.log(`  Server: ${config.server}\\${config.options.instanceName}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Encrypt: ${config.options.encrypt}`);
    console.log('');

    

    try {
        // Attempt connection
        console.log('Attempting to connect...');
        const pool = await sql.connect(config);
        
        console.log('✅ Connected successfully to SQL Server Express!');
        
        // Test query
        const result = await pool.request().query('SELECT @@VERSION as version, @@SERVERNAME as server');
        console.log('\nServer Info:');
        console.log('  Version:', result.recordset[0].version.split('\n')[0]);
        console.log('  Server Name:', result.recordset[0].server);
        
        // Check if our database exists
        const dbCheck = await pool.request()
            .input('dbname', sql.NVarChar, config.database)
            .query('SELECT name FROM sys.databases WHERE name = @dbname');
        
        if (dbCheck.recordset.length > 0) {
            console.log(`\n✅ Database '${config.database}' exists`);
            
            // Check for scheduler schema
            const schemaCheck = await pool.request()
                .query(`SELECT name FROM ${config.database}.sys.schemas WHERE name = 'scheduler'`);
            
            if (schemaCheck.recordset.length > 0) {
                console.log('✅ Schema "scheduler" exists');
                
                // Count tables in scheduler schema
                const tableCount = await pool.request()
                    .query(`
                        SELECT COUNT(*) as count 
                        FROM ${config.database}.INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA = 'scheduler'
                    `);
                console.log(`✅ Found ${tableCount.recordset[0].count} tables in scheduler schema`);
            } else {
                console.log('⚠️  Schema "scheduler" does not exist - run migrations');
            }
        } else {
            console.log(`⚠️  Database '${config.database}' does not exist - needs to be created`);
        }
        
        // Close connection
        await pool.close();
        console.log('\n✅ Connection test completed successfully');
        console.log('✅ SQL Server Express is properly configured');
        console.log('✅ No Azure dependencies required');
        
    } catch (err) {
        console.error('\n❌ Connection failed:', err.message);
        
        if (err.message.includes('ENOTFOUND')) {
            console.log('\nTroubleshooting:');
            console.log('1. Ensure SQL Server Express is installed');
            console.log('2. Check that SQL Server service is running');
            console.log('3. Verify instance name (usually SQLEXPRESS)');
        } else if (err.message.includes('Login failed')) {
            console.log('\nTroubleshooting:');
            console.log('1. Verify username and password');
            console.log('2. Ensure SQL authentication is enabled');
            console.log('3. Check user permissions');
        } else if (err.message.includes('Cannot open database')) {
            console.log('\nTroubleshooting:');
            console.log('1. Database may not exist yet');
            console.log('2. Run database creation script');
            console.log('3. Check user has CREATE DATABASE permission');
        }
        
        process.exit(1);
    }
}

// Run test
testConnection().catch(console.error);
