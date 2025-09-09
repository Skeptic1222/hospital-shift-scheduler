#!/usr/bin/env node
require('dotenv').config();
const { db } = require('../db-config');

(async () => {
  try {
    await db.connect();
    const hc = await db.healthCheck();
    console.log('DB connection OK:', hc);
    await db.close();
    process.exit(0);
  } catch (e) {
    console.error('DB connection FAILED:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

