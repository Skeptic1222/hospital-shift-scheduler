const express = require('express');

module.exports = function createDepartmentsRouter({ googleAuth, repositories, db }) {
  const router = express.Router();

  router.get('/departments', googleAuth.authenticate(), async (req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      const rows = await repositories.departments.findAll({}, { orderBy: 'name ASC' });
      const departments = (rows || []).map(d => ({
        id: d.id,
        name: d.name,
        department_id: d.id,
        department_name: d.name,
        code: d.code,
        hospital_id: d.hospital_id,
        min_staff: d.min_staff_required || 0,
        max_staff: d.max_staff_allowed || null
      }));
      return res.json({ departments });
    } catch (e) { return res.status(500).json({ error: 'Failed to load departments' }); }
  });

  // Create department
  router.post('/departments', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      const b = req.body || {};
      if (!b.code || !b.name) return res.status(400).json({ error: 'code and name are required' });
      const settings = {
        description: b.description || '',
        manager_id: b.manager_id || null,
        shift_types: b.shift_types || ['Day','Evening','Night'],
        is_active: b.is_active !== false
      };
      const created = await repositories.departments.create({
        code: String(b.code).trim(),
        name: String(b.name).trim(),
        hospital_id: b.hospital_id || null,
        min_staff_required: b.min_staff || 0,
        max_staff_allowed: b.max_staff || null,
        settings: JSON.stringify(settings)
      });
      return res.status(201).json({
        id: created.id,
        code: created.code,
        name: created.name,
        department_id: created.id,
        department_name: created.name,
        min_staff: created.min_staff_required || 0,
        max_staff: created.max_staff_allowed || null
      });
    } catch (e) { return res.status(500).json({ error: 'Failed to create department' }); }
  });

  // Update department
  router.put('/departments/:id', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      const id = req.params.id;
      const existing = await repositories.departments.findById(id);
      if (!existing) return res.status(404).json({ error: 'Department not found' });
      const b = req.body || {};
      const updates = {};
      if (b.code) updates.code = String(b.code).trim();
      if (b.name) updates.name = String(b.name).trim();
      if (b.hospital_id !== undefined) updates.hospital_id = b.hospital_id;
      if (b.min_staff !== undefined) updates.min_staff_required = b.min_staff;
      if (b.max_staff !== undefined) updates.max_staff_allowed = b.max_staff;
      if (b.description !== undefined || b.manager_id !== undefined || b.shift_types !== undefined || b.is_active !== undefined) {
        let settings = {};
        try { settings = JSON.parse(existing.settings || '{}'); } catch (_) { settings = {}; }
        if (b.description !== undefined) settings.description = b.description;
        if (b.manager_id !== undefined) settings.manager_id = b.manager_id;
        if (b.shift_types !== undefined) settings.shift_types = b.shift_types;
        if (b.is_active !== undefined) settings.is_active = b.is_active;
        updates.settings = JSON.stringify(settings);
      }
      const updated = await repositories.departments.update(id, updates);
      return res.json({
        id: updated.id,
        code: updated.code,
        name: updated.name,
        department_id: updated.id,
        department_name: updated.name,
        min_staff: updated.min_staff_required || 0,
        max_staff: updated.max_staff_allowed || null
      });
    } catch (e) { return res.status(500).json({ error: 'Failed to update department' }); }
  });

  // Delete department
  router.delete('/departments/:id', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      const id = req.params.id;
      const ok = await repositories.departments.delete(id);
      if (!ok) return res.status(404).json({ error: 'Department not found' });
      return res.json({ deleted: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to delete department' }); }
  });

  return router;
};
