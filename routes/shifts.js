const express = require('express');

module.exports = function createShiftsRouter({ googleAuth, repositories, db, cacheService, demo, validate, body, param, ensureUserAndRoles, isDemo }) {
  const router = express.Router();

  // List shifts
  router.get('/shifts', googleAuth.authenticate(), async (req, res) => {
    try {
      if (isDemo && isDemo()) {
        demo.ensureSeeded();
        const date = req.query.date || new Date().toISOString().slice(0,10);
        const dept = req.query.department_id;
        const list = demo.listShifts({ date, department_id: dept });
        return res.json({ shifts: list, pagination: { page: 1, limit: list.length, total: list.length } });
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
      // cross-field: if both times provided and equal -> invalid
      const { start_time, end_time } = req.body || {};
      if (start_time && end_time && start_time === end_time) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: [{ field: 'end_time', message: 'end_time must differ from start_time' }] });
      }
      if (isDemo && isDemo()) {
        const created = demo.createShift(req.body || {});
        return res.status(201).json({ id: created.id, created: true, shift: created });
      }
      const b = req.body || {};
      const date = b.date || new Date().toISOString().slice(0,10);
      const start = b.start_time || '07:00:00';
      const end = b.end_time || '15:00:00';
      const startDt = new Date(`${date}T${start}`);
      let endDt = new Date(`${date}T${end}`);
      if (end <= start) { endDt = new Date(endDt.getTime() + 24*60*60*1000); }
      const shift = await repositories.shifts.create({ shift_date: date, start_datetime: startDt, end_datetime: endDt, required_staff: parseInt(b.required_staff || 1, 10), status: 'open' });
      try { await cacheService.set('shift', { shiftId: shift.id }, shift); } catch (_) {}
      await repositories.auditLog.create({ action: 'SHIFT_CREATED', user_id: req.user.sub, resource_type: 'shift', resource_id: shift.id, additional_data: JSON.stringify(shift) });
      res.status(201).json({ id: shift.id, created: true, shift });
    } catch (error) { res.status(500).json({ error: 'Failed to create shift' }); }
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
      if (isDemo && isDemo()) {
        const updated = demo.updateShift(id, req.body || {});
        if (!updated) return res.status(404).json({ error: 'Shift not found' });
        return res.json({ updated: true, shift: updated });
      }
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
      if (process.env.SKIP_EXTERNALS === 'true') { const ok = demo.assignToShift(shift_id, user_id); return res.json({ assigned: ok }); }
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
