/**
 * SQL Server Express Database Setup Script
 * Creates database and schema for Hospital Scheduler
 */

const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

// Configuration for SQL Server Express
// Using Windows host IP from WSL
const config = {
    server: '172.30.48.1', // Windows host IP from WSL (adjust if needed)
    database: 'master', // Start with master to create database
    options: {
        encrypt: false, // For local SQL Express
        trustServerCertificate: true, // For self-signed certs
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    authentication: {
        type: 'default',
        options: {
            userName: 'sa',
            password: 'YourStrong@Passw0rd'
        }
    }
};

// Try Windows Authentication first, then SQL auth
const configWindowsAuth = {
    ...config,
    authentication: {
        type: 'ntlm',
        options: {
            domain: '',
            userName: '',
            password: ''
        }
    },
    options: {
        ...config.options,
        trustedConnection: true
    }
};

async function setupDatabase() {
    console.log('SQL Server Express Database Setup');
    console.log('==================================\n');

    let pool;
    let useWindowsAuth = false;

    try {
        // First try to find the Windows host IP
        console.log('Finding Windows host IP from WSL...');
        const { execSync } = require('child_process');
        try {
            const hostIp = execSync("ip route | grep default | awk '{print $3}'").toString().trim();
            if (hostIp) {
                config.server = hostIp;
                configWindowsAuth.server = hostIp;
                console.log(`Using Windows host IP: ${hostIp}`);
            }
        } catch (e) {
            console.log('Could not detect Windows host IP, using default: 172.30.48.1');
        }

        // Try connecting with Windows Authentication first
        console.log('\nAttempting connection with Windows Authentication...');
        try {
            pool = await sql.connect(configWindowsAuth);
            useWindowsAuth = true;
            console.log('✅ Connected with Windows Authentication');
        } catch (winAuthError) {
            console.log('Windows Authentication failed:', winAuthError.message);
            console.log('\nAttempting connection with SQL Authentication...');
            
            // Try SQL Authentication
            try {
                pool = await sql.connect(config);
                console.log('✅ Connected with SQL Authentication');
            } catch (sqlAuthError) {
                console.log('SQL Authentication failed:', sqlAuthError.message);
                throw new Error('Could not connect to SQL Server with either authentication method');
            }
        }

        // Check if database exists
        console.log('\nChecking if HospitalScheduler database exists...');
        const dbCheckResult = await pool.request()
            .query("SELECT DB_ID('HospitalScheduler') as dbId");
        
        const dbExists = dbCheckResult.recordset[0].dbId !== null;

        if (!dbExists) {
            console.log('Creating HospitalScheduler database...');
            await pool.request().query('CREATE DATABASE [HospitalScheduler]');
            console.log('✅ Database created successfully');
        } else {
            console.log('✅ Database already exists');
        }

        // Switch to the HospitalScheduler database
        await pool.close();
        
        const dbConfig = useWindowsAuth ? {...configWindowsAuth} : {...config};
        dbConfig.database = 'HospitalScheduler';
        
        pool = await sql.connect(dbConfig);
        console.log('✅ Connected to HospitalScheduler database');

        // Check if scheduler schema exists
        console.log('\nChecking for scheduler schema...');
        const schemaResult = await pool.request()
            .query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'scheduler'");
        
        if (schemaResult.recordset.length === 0) {
            console.log('Creating scheduler schema...');
            await pool.request().query('CREATE SCHEMA [scheduler]');
            console.log('✅ Schema created successfully');
        } else {
            console.log('✅ Schema already exists');
        }

        // Check if schema SQL file exists and run it
        const schemaFile = path.join(__dirname, 'database-schema-sqlserver.sql');
        console.log('\nChecking for schema SQL file...');
        
        try {
            const schemaSQL = await fs.readFile(schemaFile, 'utf8');
            console.log('Found schema file, running SQL commands...');
            
            // Split by GO statements and execute each batch
            const batches = schemaSQL.split(/\nGO\r?\n/i);
            let successCount = 0;
            let errorCount = 0;

            for (const batch of batches) {
                if (batch.trim()) {
                    try {
                        await pool.request().query(batch);
                        successCount++;
                    } catch (err) {
                        if (!err.message.includes('already exists')) {
                            console.log(`Warning: ${err.message}`);
                            errorCount++;
                        }
                    }
                }
            }

            console.log(`✅ Schema SQL executed (${successCount} batches successful, ${errorCount} errors)`);
        } catch (err) {
            console.log('Schema file not found or could not be read:', err.message);
        }

        // Count tables in scheduler schema
        const tableCountResult = await pool.request()
            .query("SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler'");
        
        const tableCount = tableCountResult.recordset[0].count;
        console.log(`\n✅ Setup complete! Found ${tableCount} tables in scheduler schema`);

        // Create .env file with connection details
        console.log('\nCreating .env configuration...');
        const envContent = `# Database Configuration
DB_SERVER=${dbConfig.server}\\SQLEXPRESS
DB_NAME=HospitalScheduler
${useWindowsAuth ? 'DB_TRUST_CONNECTION=true' : `DB_USER=sa
DB_PASSWORD=${config.authentication.options.password}`}
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Demo/offline mode is not supported

# Server Configuration
PORT=3001
NODE_ENV=production
`;

        await fs.writeFile(path.join(__dirname, '.env'), envContent);
        console.log('✅ .env file created/updated');

        // Test the connection
        console.log('\nTesting final connection...');
        const testResult = await pool.request().query('SELECT @@VERSION as version');
        console.log('✅ Connection test successful');
        console.log('SQL Server Version:', testResult.recordset[0].version.split('\n')[0]);

        await pool.close();

        console.log('\n========================================');
        console.log('Database setup completed successfully!');
        console.log('========================================');
        console.log('\nConnection Details:');
        console.log(`  Server: ${dbConfig.server}\\SQLEXPRESS`);
        console.log(`  Database: HospitalScheduler`);
        console.log(`  Authentication: ${useWindowsAuth ? 'Windows' : 'SQL'}`);
        console.log('\nYou can now start the server with:');
        console.log('  npm start');
        console.log('  or');
        console.log('  node server.js');

    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);
        console.error('\nTroubleshooting tips:');
        console.error('1. Ensure SQL Server Express is running');
        console.error('2. Check Windows Firewall allows SQL Server connections');
        console.error('3. Enable TCP/IP in SQL Server Configuration Manager');
        console.error('4. For SQL Auth, enable mixed mode authentication in SQL Server');
        console.error('5. Check the Windows host IP from WSL: ip route | grep default');
        process.exit(1);
    }
}

// Run the setup
setupDatabase().catch(console.error);
