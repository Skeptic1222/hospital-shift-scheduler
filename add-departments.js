const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'HospitalScheduler',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'ChangeThisStrongPassword!',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false
  }
};

async function addDepartments() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);

    // Check if departments already exist
    const existing = await pool.request()
      .query('SELECT COUNT(*) as count FROM scheduler.departments');

    if (existing.recordset[0].count > 0) {
      console.log(`✓ Found ${existing.recordset[0].count} existing departments`);

      // List existing departments
      const depts = await pool.request()
        .query('SELECT code, name FROM scheduler.departments ORDER BY name');

      console.log('\nExisting departments:');
      depts.recordset.forEach(d => {
        console.log(`  - ${d.code}: ${d.name}`);
      });

      return;
    }

    console.log('Adding departments...');

    // Add real hospital departments
    const departments = [
      { code: 'ED', name: 'Emergency Department', min_staff: 8, max_staff: 15 },
      { code: 'ICU', name: 'Intensive Care Unit', min_staff: 6, max_staff: 12 },
      { code: 'OR', name: 'Operating Room', min_staff: 4, max_staff: 10 },
      { code: 'PACU', name: 'Post-Anesthesia Care Unit', min_staff: 3, max_staff: 8 },
      { code: 'MED', name: 'Medical Floor', min_staff: 5, max_staff: 12 },
      { code: 'SURG', name: 'Surgical Floor', min_staff: 5, max_staff: 12 },
      { code: 'PEDS', name: 'Pediatrics', min_staff: 4, max_staff: 10 },
      { code: 'OB', name: 'Obstetrics', min_staff: 4, max_staff: 10 },
      { code: 'NICU', name: 'Neonatal ICU', min_staff: 6, max_staff: 12 },
      { code: 'TELE', name: 'Telemetry Unit', min_staff: 5, max_staff: 10 },
      { code: 'ONCO', name: 'Oncology', min_staff: 4, max_staff: 8 },
      { code: 'CARD', name: 'Cardiology', min_staff: 5, max_staff: 10 },
      { code: 'ENDO', name: 'Endoscopy', min_staff: 3, max_staff: 6 },
      { code: 'RAD', name: 'Radiology', min_staff: 3, max_staff: 8 },
      { code: 'LAB', name: 'Laboratory', min_staff: 2, max_staff: 6 }
    ];

    for (const dept of departments) {
      const settings = {
        description: `${dept.name} department`,
        shift_types: ['Day', 'Evening', 'Night'],
        is_active: true
      };

      await pool.request()
        .input('code', sql.NVarChar(50), dept.code)
        .input('name', sql.NVarChar(255), dept.name)
        .input('min_staff', sql.Int, dept.min_staff)
        .input('max_staff', sql.Int, dept.max_staff)
        .input('settings', sql.NVarChar(sql.MAX), JSON.stringify(settings))
        .query(`
          INSERT INTO scheduler.departments (
            id, code, name, min_staff_required, max_staff_allowed, settings, created_at, updated_at
          ) VALUES (
            NEWID(), @code, @name, @min_staff, @max_staff, @settings, GETUTCDATE(), GETUTCDATE()
          )
        `);

      console.log(`✓ Added department: ${dept.code} - ${dept.name}`);
    }

    console.log(`\n✅ Successfully added ${departments.length} departments!`);

  } catch (error) {
    console.error('Error adding departments:', error.message);
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the script
addDepartments().catch(console.error);