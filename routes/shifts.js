// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

const express = require('express');
let logger = null;
try { logger = require('../logger-config').logger; } catch (_) { logger = console; }
const fs = require('fs');
const path = require('path');
const debugLogPath = path.join(__dirname, '..', 'logs', 'shift-create-debug.log');
function fileLog(obj) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n';
    fs.appendFileSync(debugLogPath, line);
  } catch (_) {}
}

module.exports = function createShiftsRouter({ googleAuth, repositories, db, cacheService, validate, body, param, ensureUserAndRoles }) {
  const router = express.Router();

  // List shifts
  router.get('/shifts', googleAuth.authenticate(), async (req, res) => {
    try {
      if (!db?.connected || !repositories?.shifts) {
        return res.status(503).json({ error: 'Database unavailable' });
      }
      const { date, department_id, status, assigned_to, page = 1, limit = 50 } = req.query;
      const filters = {};
      if (date) filters.shift_date = date;
      if (department_id) filters.department_id = department_id;
      if (status) filters.status = status;
      const shifts = await repositories.shifts.findAll(filters, { orderBy: 'shift_date DESC, start_datetime ASC', limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) });
      const total = await repositories.shifts.count(filters);
      res.json({ shifts, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
    } catch (error) { res.status(500).json({ error: 'Failed to retrieve shifts' }); }
  });

  // Create shift
  router.post('/shifts', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), validate([
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be HH:mm or HH:mm:ss'),
    body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time must be HH:mm or HH:mm:ss'),
    body('required_staff').optional().isInt({ min: 1 }).withMessage('required_staff must be >= 1')
  ]), async (req, res) => {
    try {
      // Structured audit of incoming request (no PHI)
      const reqMeta = {
        requestId: req.id,
        user: req.user?.email,
        userId: req.user?.id,
        dbConnected: !!db?.connected,
      };
      try { logger.info('Create shift request received', reqMeta); } catch (_) {}
      fileLog({ evt: 'create_shift_received', ...reqMeta });
      if (!db?.connected) {
        try {
          await db.connect();
          reqMeta.dbConnected = !!db?.connected;
        } catch (e) {
          try { logger.error('Create shift aborted - DB connect failed', { ...reqMeta, error: e?.message }); } catch (_) {}
          res.set('X-Error-Code', 'DB_CONNECT_FAILED');
          fileLog({ evt: 'db_connect_failed', ...reqMeta, error: e?.message });
          return res.status(503).json({ error: 'Database unavailable' });
        }
      }
      if (!repositories?.shifts) {
        try { logger.error('Create shift aborted - repositories missing', reqMeta); } catch (_) {}
        res.set('X-Error-Code', 'REPOSITORIES_MISSING');
        fileLog({ evt: 'repositories_missing', ...reqMeta });
        return res.status(503).json({ error: 'Database unavailable' });
      }

      // Ensure schema exists (diags for production)
      try {
        const chk = await db.query("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='scheduler' AND TABLE_NAME='shifts'");
        // Handle different response formats from the database
        let recordCount = null;
        if (chk && chk.recordset && chk.recordset[0] && typeof chk.recordset[0].cnt !== 'undefined') {
          recordCount = parseInt(chk.recordset[0].cnt || 0, 10);
        } else if (chk && Array.isArray(chk) && chk[0] && typeof chk[0].cnt !== 'undefined') {
          recordCount = parseInt(chk[0].cnt || 0, 10);
        } else if (chk && chk.rows && chk.rows[0] && typeof chk.rows[0].cnt !== 'undefined') {
          recordCount = parseInt(chk.rows[0].cnt || 0, 10);
        }

        // Only fail if we definitively know the table is missing
        if (recordCount !== null && recordCount === 0) {
          try { logger.error('Create shift aborted - schema missing', reqMeta); } catch(_) {}
          res.set('X-Error-Code', 'SCHEMA_MISSING');
          fileLog({ evt: 'schema_missing', ...reqMeta });
          return res.status(503).json({ error: 'Database schema missing: scheduler.shifts' });
        }
      } catch (e) {
        try { logger.error('Schema check failed', { ...reqMeta, error: e?.message, stack: e?.stack }); } catch(_) {}
        fileLog({ evt: 'schema_check_failed', ...reqMeta, error: e?.message, details: e?.toString() });
        // Continue without schema check rather than failing
        try { logger.warn('Continuing without schema check due to error', reqMeta); } catch(_) {}
      }
      if (!db?.connected || !repositories?.shifts) {
        return res.status(503).json({ error: 'Database unavailable' });
      }
      // cross-field: if both times provided and equal -> invalid
      const { start_time, end_time } = req.body || {};
      if (start_time && end_time && start_time === end_time) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: [{ field: 'end_time', message: 'end_time must differ from start_time' }] });
      }
      const b = req.body || {};
      const date = b.date || new Date().toISOString().slice(0,10);
      const start = b.start_time || '07:00:00';
      const end = b.end_time || '15:00:00';
      const startDt = new Date(`${date}T${start}`);
      let endDt = new Date(`${date}T${end}`);
      if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
        res.set('X-Error-Code', 'VALIDATION_ERROR');
        fileLog({ evt: 'validation_failed', requestId: req.id, date, start, end });
        return res.status(400).json({ error: 'Invalid date or time format', requestId: req.id });
      }
      if (end <= start) { endDt = new Date(endDt.getTime() + 24*60*60*1000); }
      // Optional relations
      let department_id = b.department_id || b.department || null;
      let hospital_id = b.hospital_id || b.hospital || null;

      // Normalize department: accept GUID, code, or name
      const isGuid = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
      if (department_id) {
        try {
          const dres = await db.query(
            'SELECT TOP 1 id, hospital_id FROM scheduler.departments WHERE ' +
            (isGuid(department_id) ? 'id=@id' : 'code=@code OR name=@name'),
            isGuid(department_id) ? { id: department_id } : { code: department_id, name: department_id }
          );
          if (dres.recordset && dres.recordset[0]) {
            department_id = dres.recordset[0].id;
            if (!hospital_id) hospital_id = dres.recordset[0].hospital_id || null;
          } else {
            // Not found; clear to avoid type conversion errors
            department_id = null;
          }
        } catch (e) {
          try { logger.warn('Department lookup failed', { requestId: req.id, department: department_id, error: e.message }); } catch(_) {}
          department_id = null;
        }
      }

      // Normalize hospital: accept GUID, code, or name
      if (hospital_id) {
        try {
          const hres = await db.query(
            'SELECT TOP 1 id FROM scheduler.hospitals WHERE ' +
            (isGuid(hospital_id) ? 'id=@id' : 'code=@code OR name=@name'),
            isGuid(hospital_id) ? { id: hospital_id } : { code: hospital_id, name: hospital_id }
          );
          if (hres.recordset && hres.recordset[0]) {
            hospital_id = hres.recordset[0].id;
          } else {
            hospital_id = null;
          }
        } catch (e) {
          try { logger.warn('Hospital lookup failed', { requestId: req.id, hospital: hospital_id, error: e.message }); } catch(_) {}
          hospital_id = null;
        }
      }

      // Final guard: ensure IDs are either valid GUIDs or null
      if (department_id && !isGuid(department_id)) department_id = null;
      if (hospital_id && !isGuid(hospital_id)) hospital_id = null;
      try {
        logger.info('Create shift derived values', {
          requestId: req.id,
          user: req.user?.email,
          date,
          start,
          end,
          department_id,
          hospital_id,
          required_staff: parseInt(b.required_staff || 1, 10)
        });
      } catch (_) {}
      fileLog({
        evt: 'create_shift_derived',
        requestId: req.id,
        user: req.user?.email,
        date,
        start,
        end,
        department_id,
        hospital_id,
        required_staff: parseInt(b.required_staff || 1, 10)
      });
      // Explicitly insert with typed parameters for reliability
      const { sql } = require('../db-config');
      const insertSql = `
        INSERT INTO [scheduler].[shifts]
          (shift_date, start_datetime, end_datetime, required_staff, status, department_id, hospital_id, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES
          (CAST(@shift_date AS date), @start_datetime, @end_datetime, @required_staff, @status,
           CAST(@department_id AS uniqueidentifier), CAST(@hospital_id AS uniqueidentifier), SYSDATETIME(), SYSDATETIME())
      `;
      const params = {
        shift_date: { type: sql.NVarChar(20), value: String(date) },
        start_datetime: { type: sql.DateTime2, value: startDt },
        end_datetime: { type: sql.DateTime2, value: endDt },
        required_staff: { type: sql.Int, value: parseInt(b.required_staff || 1, 10) },
        status: { type: sql.NVarChar(50), value: 'open' },
        department_id: { type: sql.NVarChar(64), value: department_id ? String(department_id) : null },
        hospital_id: { type: sql.NVarChar(64), value: hospital_id ? String(hospital_id) : null }
      };

      const pool = await db.getConnection();
      const request = pool.request();
      Object.entries(params).forEach(([k, p]) => request.input(k, p.type, p.value));
      const result = await request.query(insertSql);
      const shift = (result.recordset && result.recordset[0]) || null;
      try { await cacheService.set('shift', { shiftId: shift.id }, shift); } catch (_) {}
      try { await repositories.auditLog.create({ action: 'SHIFT_CREATED', user_id: req.user.id || null, resource_type: 'shift', resource_id: shift.id, additional_data: JSON.stringify(shift) }); } catch (_) {}
      try { logger.info('Create shift succeeded', { requestId: req.id, shiftId: shift.id }); } catch (_) {}
      fileLog({ evt: 'create_shift_succeeded', requestId: req.id, shiftId: shift.id });
      res.set('X-Request-Id', req.id || '');
      res.status(201).json({ id: shift.id, created: true, shift, requestId: req.id });
    } catch (error) {
      const errMeta = {
        message: error?.message,
        code: error?.code,
        number: error?.number,
        name: error?.name,
        stack: error?.stack,
        requestId: req.id
      };
      try { logger.error('Shift create error', errMeta); } catch (_) {}
      fileLog({ evt: 'create_shift_error', ...errMeta });
      res.set('X-Request-Id', req.id || '');
      res.set('X-Error-Code', 'CREATE_SHIFT_FAILED');
      res.status(500).json({ error: 'Failed to create shift', requestId: req.id });
    }
  });

  // Update shift
  router.put('/shifts/:id', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), validate([
    param('id').notEmpty().withMessage('id required'),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be HH:mm or HH:mm:ss'),
    body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time must be HH:mm or HH:mm:ss'),
    body('status').optional().isIn(['open','partial','filled','cancelled']).withMessage('invalid status')
  ]), async (req, res) => {
    try {
      const id = req.params.id;
      const exists = await repositories.shifts.findById(id);
      if (!exists) return res.status(404).json({ error: 'Shift not found' });
      const payload = {};
      const b = req.body || {};
      if (b.date) payload.shift_date = b.date;
      if (b.start_time) payload.start_datetime = new Date(`${b.date || exists.shift_date}T${b.start_time}`);
      if (b.end_time) payload.end_datetime = new Date(`${b.date || exists.shift_date}T${b.end_time}`);
      if (typeof b.required_staff !== 'undefined') payload.required_staff = parseInt(b.required_staff, 10);
      if (b.status) payload.status = b.status;
      const updated = await repositories.shifts.update(id, payload);
      return res.json({ updated: true, shift: updated });
    } catch (e) { return res.status(500).json({ error: 'Failed to update shift' }); }
  });

  // Assign user to shift
  router.post('/shifts/assign', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), validate([
    body('shift_id').notEmpty().withMessage('shift_id required'),
    body('user_id').notEmpty().withMessage('user_id required')
  ]), async (req, res) => {
    try {
      const { shift_id, user_id } = req.body || {};
      const shift = await repositories.shifts.findById(shift_id);
      if (!shift) return res.status(404).json({ error: 'Shift not found' });
      const existing = await db.query('SELECT TOP 1 id FROM scheduler.shift_assignments WHERE shift_id=@shift_id AND user_id=@user_id', { shift_id, user_id });
      if (!existing.recordset || existing.recordset.length === 0) { await repositories.assignments.create({ shift_id, user_id, status: 'assigned' }); }
      const cntRs = await db.query("SELECT COUNT(*) as cnt FROM scheduler.shift_assignments WHERE shift_id=@shift_id AND status IN ('assigned','confirmed')", { shift_id });
      const assignedCount = parseInt(cntRs.recordset?.[0]?.cnt || 0, 10);
      const required = parseInt(shift.required_staff || 1, 10);
      if (assignedCount >= required) { await repositories.shifts.update(shift_id, { status: 'filled' }); }
      return res.json({ assigned: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to assign' }); }
  });

  return router;
};
