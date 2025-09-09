/**
 * SQL Server Express Configuration
 * Connection management for Windows/IIS deployment
 */

const sql = require('mssql');
const { ConnectionPool } = require('mssql');

// Normalize env flags
const USE_WINDOWS_AUTH = (process.env.USE_WINDOWS_AUTH === 'true') || (process.env.DB_TRUST_CONNECTION === 'true');
const DB_SERVER = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
const DB_NAME = process.env.DB_NAME || 'HospitalScheduler';
const DB_USER = process.env.DB_USER || 'sa';
const DB_PASSWORD = process.env.DB_PASSWORD || 'YourStrong@Passw0rd';
const DB_ENCRYPT = (String(process.env.DB_ENCRYPT || 'true').toLowerCase() === 'true');
const DB_TRUST_SERVER_CERT = (String(process.env.DB_TRUST_SERVER_CERT || process.env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true');

// Parse instance name if provided like HOST\INSTANCE
function parseServer(server) {
    const m = /^(.*)\\([^\\]+)$/.exec(server);
    if (m) return { host: m[1], instanceName: m[2] };
    return { host: server, instanceName: undefined };
}

const parsed = parseServer(DB_SERVER);

// SQL Server configuration (SQL auth)
const config = {
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    server: parsed.host,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: DB_ENCRYPT, // Use encryption
        trustServerCertificate: DB_TRUST_SERVER_CERT, // For local development
        enableArithAbort: true,
        instanceName: parsed.instanceName
    }
};

// Alternative Windows Authentication config
// Windows Authentication config (requires msnodesqlv8 driver)
function getWindowsAuthConfig(dbName) {
    const { host, instanceName } = parseServer(DB_SERVER);
    const cfg = {
        server: host,
        database: dbName,
        driver: 'msnodesqlv8',
        options: {
            trustedConnection: true,
            trustServerCertificate: DB_TRUST_SERVER_CERT,
            enableArithAbort: true
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
    };
    if (instanceName) cfg.options.instanceName = instanceName;
    return cfg;
}

class DatabaseService {
    constructor() {
        this.pool = null;
        this.connected = false;
    }

    /**
     * Initialize database connection pool
     */
    async connect() {
        if (this.connected && this.pool) {
            return this.pool;
        }
        try {
            const useWindowsAuth = USE_WINDOWS_AUTH;
            const dbName = DB_NAME;

            // Step 1: Connect to master to ensure database exists
            const masterConfig = useWindowsAuth
                ? getWindowsAuthConfig('master')
                : { ...config, database: 'master' };

            const serverPool = new ConnectionPool(masterConfig);
            await serverPool.connect();
            await this.ensureDatabaseExists(serverPool, dbName);
            await serverPool.close();

            // Step 2: Connect to target database
            const dbConfig = useWindowsAuth ? getWindowsAuthConfig(dbName) : { ...config, database: dbName };
            this.pool = new ConnectionPool(dbConfig);
            await this.pool.connect();
            this.connected = true;
            console.log(`Connected to SQL Server database: ${dbName}`);

            // Test connection and ensure schemas
            const result = await this.pool.request().query('SELECT @@VERSION as version');
            console.log('SQL Server Version:', result.recordset[0].version);
            await this.ensureSchemas();

            // Initialize repositories
            this.initializeRepositories();

            return this.pool;
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    /**
     * Ensure database and schema exist
     */
    async ensureDatabaseExists(serverPool, dbName) {
        try {
            const req = serverPool.request();
            req.input('dbName', sql.NVarChar, dbName);
            const check = await req.query('SELECT name FROM sys.databases WHERE name = @dbName');
            const exists = Array.isArray(check.recordset) && check.recordset.some(r => r.name === dbName);
            if (!exists) {
                console.log(`Creating database ${dbName}...`);
                await serverPool.request().query(`CREATE DATABASE [${dbName}]`);
            }
        } catch (error) {
            console.error('Error ensuring database exists:', error);
            throw error;
        }
    }

    async ensureSchemas() {
        try {
            await this.pool.request().batch(`
                IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler') EXEC('CREATE SCHEMA scheduler');
                IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'audit') EXEC('CREATE SCHEMA audit');
            `);
            console.log('Schemas verified');
        } catch (error) {
            console.error('Error ensuring schemas:', error);
        }
    }

    /**
     * Get connection from pool
     */
    async getConnection() {
        if (!this.connected) {
            await this.connect();
        }
        return this.pool;
    }

    /**
     * Execute a query with parameters
     */
    async query(queryText, params = {}) {
        try {
            const pool = await this.getConnection();
            const request = pool.request();
            
            // Add parameters
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });
            
            const result = await request.query(queryText);
            return result;
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }

    /**
     * Execute stored procedure
     */
    async executeProc(procName, params = {}) {
        try {
            const pool = await this.getConnection();
            const request = pool.request();
            
            // Add parameters
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });
            
            const result = await request.execute(procName);
            return result;
        } catch (error) {
            console.error('Stored procedure error:', error);
            throw error;
        }
    }

    /**
     * Begin transaction
     */
    async beginTransaction() {
        const pool = await this.getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        return transaction;
    }

    /**
     * Bulk insert data
     */
    async bulkInsert(tableName, data) {
        try {
            const pool = await this.getConnection();
            const table = new sql.Table(tableName);
            
            // Auto-detect columns from first row
            if (data.length > 0) {
                Object.keys(data[0]).forEach(key => {
                    const value = data[0][key];
                    let type = sql.NVarChar(255);
                    
                    if (typeof value === 'number') {
                        type = Number.isInteger(value) ? sql.Int : sql.Decimal(10, 2);
                    } else if (value instanceof Date) {
                        type = sql.DateTime2;
                    } else if (typeof value === 'boolean') {
                        type = sql.Bit;
                    }
                    
                    table.columns.add(key, type);
                });
                
                // Add rows
                data.forEach(row => {
                    table.rows.add(...Object.values(row));
                });
            }
            
            const request = pool.request();
            const result = await request.bulk(table);
            return result;
        } catch (error) {
            console.error('Bulk insert error:', error);
            throw error;
        }
    }

    /**
     * Close connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.close();
            this.connected = false;
            console.log('Database connection closed');
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health');
            return { healthy: true, connected: this.connected };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

// Repository pattern for data access
class Repository {
    constructor(db, tableName, schema = 'scheduler') {
        this.db = db;
        this.tableName = tableName;
        this.schema = schema;
        this.fullTableName = `${schema}.${tableName}`;
    }

    /**
     * Find by ID
     */
    async findById(id) {
        const query = `SELECT * FROM ${this.fullTableName} WHERE id = @id`;
        const result = await this.db.query(query, { id });
        return result.recordset[0];
    }

    /**
     * Find all with optional filtering
     */
    async findAll(filters = {}, options = {}) {
        let query = `SELECT * FROM ${this.fullTableName}`;
        const params = {};
        
        // Build WHERE clause
        const whereConditions = [];
        Object.keys(filters).forEach((key, index) => {
            whereConditions.push(`${key} = @param${index}`);
            params[`param${index}`] = filters[key];
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        // Add ordering
        if (options.orderBy) {
            query += ` ORDER BY ${options.orderBy}`;
        }
        
        // Add pagination
        if (options.limit) {
            query += ` OFFSET ${options.offset || 0} ROWS FETCH NEXT ${options.limit} ROWS ONLY`;
        }
        
        const result = await this.db.query(query, params);
        return result.recordset;
    }

    /**
     * Create new record
     */
    async create(data) {
        const columns = Object.keys(data);
        const values = columns.map((col, index) => `@param${index}`);
        const params = {};
        
        columns.forEach((col, index) => {
            params[`param${index}`] = data[col];
        });
        
        const query = `
            INSERT INTO ${this.fullTableName} (${columns.join(', ')})
            OUTPUT INSERTED.*
            VALUES (${values.join(', ')})
        `;
        
        const result = await this.db.query(query, params);
        return result.recordset[0];
    }

    /**
     * Update record
     */
    async update(id, data) {
        const columns = Object.keys(data);
        const setClause = columns.map((col, index) => `${col} = @param${index}`);
        const params = { id };
        
        columns.forEach((col, index) => {
            params[`param${index}`] = data[col];
        });
        
        const query = `
            UPDATE ${this.fullTableName}
            SET ${setClause.join(', ')}, updated_at = GETUTCDATE()
            OUTPUT INSERTED.*
            WHERE id = @id
        `;
        
        const result = await this.db.query(query, params);
        return result.recordset[0];
    }

    /**
     * Delete record
     */
    async delete(id) {
        const query = `DELETE FROM ${this.fullTableName} WHERE id = @id`;
        const result = await this.db.query(query, { id });
        return result.rowsAffected[0] > 0;
    }

    /**
     * Count records
     */
    async count(filters = {}) {
        let query = `SELECT COUNT(*) as count FROM ${this.fullTableName}`;
        const params = {};
        
        const whereConditions = [];
        Object.keys(filters).forEach((key, index) => {
            whereConditions.push(`${key} = @param${index}`);
            params[`param${index}`] = filters[key];
        });
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        const result = await this.db.query(query, params);
        return result.recordset[0].count;
    }
}

// Export singleton instance
const db = new DatabaseService();

// Export repositories
const repositories = {
    users: null,
    shifts: null,
    departments: null,
    hospitals: null,
    assignments: null,
    notifications: null,
    auditLog: null
};

// Initialize repositories when connected
db.initializeRepositories = function initializeRepositories() {
    repositories.users = new Repository(db, 'users');
    repositories.shifts = new Repository(db, 'shifts');
    repositories.departments = new Repository(db, 'departments');
    repositories.hospitals = new Repository(db, 'hospitals');
    repositories.assignments = new Repository(db, 'shift_assignments');
    repositories.notifications = new Repository(db, 'notifications');
    repositories.auditLog = new Repository(db, 'audit_log', 'audit');
};

module.exports = {
    db,
    repositories,
    Repository,
    sql
};
