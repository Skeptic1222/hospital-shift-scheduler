import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  IconButton,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalHospital as DepartmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { apiFetch } from '../utils/api';
import StandardButton from '../components/common/StandardButton';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);
  const { showNotification } = useNotification();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    manager_id: '',
    min_staff: 1,
    max_staff: 10,
    shift_types: ['Day', 'Evening', 'Night'],
    is_active: true
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/departments');
      
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      } else {
        // NO DEMO DATA - Database connection required
        setDepartments([]);
        showNotification('Failed to load departments. Database connection required.', 'error');
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      showNotification('Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      showNotification('Department code and name are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const newDept = await res.json();
        setDepartments(prev => [...prev, newDept]);
        setCreateDialogOpen(false);
        resetForm();
        showNotification('Department created successfully', 'success');
      } else {
        const error = await res.json();
        showNotification(error.message || 'Failed to create department', 'error');
      }
    } catch (error) {
      console.error('Error creating department:', error);
      showNotification('Failed to create department', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.code || !formData.name) {
      showNotification('Department code and name are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/departments/${selectedDept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const updatedDept = await res.json();
        setDepartments(prev => prev.map(d => 
          d.id === selectedDept.id ? updatedDept : d
        ));
        setEditDialogOpen(false);
        resetForm();
        showNotification('Department updated successfully', 'success');
      } else {
        showNotification('Failed to update department', 'error');
      }
    } catch (error) {
      console.error('Error updating department:', error);
      showNotification('Failed to update department', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/departments/${selectedDept.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setDepartments(prev => prev.filter(d => d.id !== selectedDept.id));
        setDeleteDialogOpen(false);
        setSelectedDept(null);
        showNotification('Department deleted successfully', 'success');
      } else {
        showNotification('Failed to delete department', 'error');
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      showNotification('Failed to delete department', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = (dept) => {
    setSelectedDept(dept);
    setFormData({
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      manager_id: dept.manager_id || '',
      min_staff: dept.min_staff || 1,
      max_staff: dept.max_staff || 10,
      shift_types: dept.shift_types || ['Day', 'Evening', 'Night'],
      is_active: dept.is_active !== false
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (dept) => {
    setSelectedDept(dept);
    setDeleteDialogOpen(true);
  };

  const openSettingsDialog = (dept) => {
    setSelectedDept(dept);
    setSettingsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      manager_id: '',
      min_staff: 1,
      max_staff: 10,
      shift_types: ['Day', 'Evening', 'Night'],
      is_active: true
    });
    setSelectedDept(null);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DepartmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Department Management
          </Typography>
        </Box>
        <StandardButton
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add Department
        </StandardButton>
      </Box>

      <Grid container spacing={3}>
        {departments.map(dept => (
          <Grid item xs={12} sm={6} md={4} key={dept.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DepartmentIcon color="primary" />
                    <Box>
                      <Typography variant="h6">{dept.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Code: {dept.code}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip 
                    label={dept.is_active ? 'Active' : 'Inactive'} 
                    color={dept.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Staff Count
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {dept.staff_count || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Min/Max Staff
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {dept.min_staff || 1} - {dept.max_staff || 10}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Tooltip title="Edit Department">
                    <IconButton 
                      size="small" 
                      onClick={() => openEditDialog(dept)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Department Settings">
                    <IconButton 
                      size="small" 
                      onClick={() => openSettingsDialog(dept)}
                    >
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Department">
                    <IconButton 
                      size="small" 
                      onClick={() => openDeleteDialog(dept)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Department Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Create New Department
            <IconButton onClick={() => setCreateDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Department Code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                placeholder="e.g., ICU, ED, OR"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Department Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Staff"
                type="number"
                value={formData.min_staff}
                onChange={e => setFormData({ ...formData, min_staff: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Staff"
                type="number"
                value={formData.max_staff}
                onChange={e => setFormData({ ...formData, max_staff: parseInt(e.target.value) || 10 })}
                inputProps={{ min: 1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <StandardButton
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            startIcon={saving ? null : <SaveIcon />}
          >
            {saving ? 'Creating...' : 'Create'}
          </StandardButton>
        </DialogActions>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Edit Department
            <IconButton onClick={() => setEditDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Department Code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Department Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Staff"
                type="number"
                value={formData.min_staff}
                onChange={e => setFormData({ ...formData, min_staff: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Staff"
                type="number"
                value={formData.max_staff}
                onChange={e => setFormData({ ...formData, max_staff: parseInt(e.target.value) || 10 })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.is_active ? 'active' : 'inactive'}
                  onChange={e => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <StandardButton
            variant="contained"
            onClick={handleEdit}
            disabled={saving}
            startIcon={saving ? null : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </StandardButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete the department <strong>{selectedDept?.name}</strong>?
          </Typography>
          {selectedDept?.staff_count > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              This department has {selectedDept.staff_count} staff members assigned. 
              They will need to be reassigned before deletion.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={deleting || (selectedDept?.staff_count > 0)}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Department Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Department Settings - {selectedDept?.name}
            <IconButton onClick={() => setSettingsDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6" gutterBottom>Coverage Requirements</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary">Day Shift</Typography>
                <Typography variant="h5">{selectedDept?.min_staff || 5} - {selectedDept?.max_staff || 10}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary">Evening Shift</Typography>
                <Typography variant="h5">{Math.max(1, (selectedDept?.min_staff || 5) - 1)} - {Math.max(2, (selectedDept?.max_staff || 10) - 2)}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="text.secondary">Night Shift</Typography>
                <Typography variant="h5">{Math.max(1, (selectedDept?.min_staff || 5) - 2)} - {Math.max(2, (selectedDept?.max_staff || 10) - 3)}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom>Shift Types</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {['Day', 'Evening', 'Night', '12-Hour Day', '12-Hour Night'].map(shift => (
              <Chip key={shift} label={shift} variant="outlined" />
            ))}
          </Box>

          <Typography variant="h6" gutterBottom>Required Skills</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['Basic Life Support', 'Department Specific Training', 'Emergency Response'].map(skill => (
              <Chip key={skill} label={skill} size="small" />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Departments;