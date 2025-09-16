#!/usr/bin/env node
/**
 * Simple seed script for initial data.
 * - Verifies DB connectivity
 * - Ensures core tables exist
 * - Inserts baseline departments if missing
 */
require('dotenv').config();
const { db, repositories } = require('../db-config');

(async () => {
  try {
    console.log('Connecting to database...');
    await db.connect();

    // Verify required tables exist
    const required = ['departments'];
    for (const table of required) {
      const result = await db.query(
        `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`,
        { schema: 'scheduler', table }
      );
      const exists = Number(result.recordset?.[0]?.count || 0) > 0;
      if (!exists) {
        console.warn(`Table missing: scheduler.${table}. Run migrations first (npm run db:migrate).`);
        console.log('Seeding skipped.');
        await db.close();
        process.exit(0);
      }
    }

    // Seed baseline departments
    const deptRepo = repositories.departments;
    const existing = await deptRepo.findAll();
    const have = new Set(existing.map(d => (d.slug || d.name || '').toString().toLowerCase()));
    const baseline = [
      { name: 'Emergency', slug: 'ed' },
      { name: 'Intensive Care', slug: 'icu' },
      { name: 'General Medicine', slug: 'med' }
    ];

    let inserted = 0;
    for (const d of baseline) {
      if (!have.has((d.slug || d.name).toLowerCase())) {
        await deptRepo.create({ name: d.name, slug: d.slug });
        inserted += 1;
      }
    }

    console.log(`Seed complete. Departments inserted: ${inserted}`);
    await db.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err && err.message ? err.message : err);
    try { await db.close(); } catch (_) {}
    process.exit(1);
  }
})();

