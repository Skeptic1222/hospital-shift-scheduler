#!/usr/bin/env node
/*
 * Executes the SQL Server schema in database-schema-sqlserver.sql
 * Splits on GO batch separators and runs sequentially.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

function splitBatches(sqlText) {
  const lines = sqlText.split(/\r?\n/);
  const batches = [];
  let current = [];
  for (const line of lines) {
    if (/^\s*GO\s*$/i.test(line)) {
      if (current.length) {
        batches.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) batches.push(current.join('\n'));
  return batches.map(s => s.trim()).filter(Boolean);
}

async function run() {
  const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
  const user = process.env.DB_USER || 'sa';
  const password = process.env.DB_PASSWORD || 'YourStrong@Passw0rd';
  const dbName = process.env.DB_NAME || 'HospitalScheduler';

  // Parse instance name if provided like HOST\INSTANCE
  let host = server;
  let instanceName;
  const m = /^(.*)\\([^\\]+)$/.exec(server);
  if (m) { host = m[1]; instanceName = m[2]; }

  const config = {
    server: host,
    user,
    password,
    database: 'master',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      instanceName,
      appName: 'scheduler-migrations'
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
  };

  const sqlPath = path.resolve(process.cwd(), 'database-schema-sqlserver.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Schema file not found:', sqlPath);
    process.exit(1);
  }
  const text = fs.readFileSync(sqlPath, 'utf8');
  const batches = splitBatches(text);
  console.log(`Applying schema to ${server} (target DB: ${dbName})`);
  console.log(`Executing ${batches.length} batches...`);

  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  try {
    const request = pool.request();
    let idx = 0;
    for (const batch of batches) {
      idx += 1;
      try {
        // Replace hard-coded DB name if provided via env
        const sqlToRun = batch.replace(/USE\s+HospitalScheduler\s*;/gi, `USE ${dbName};`);
        await request.batch(sqlToRun);
        if (idx % 10 === 0) console.log(`... batch ${idx} OK`);
      } catch (err) {
        console.error(`Batch ${idx} failed:`, err.message);
        throw err;
      }
    }
    console.log('Schema applied successfully.');
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
