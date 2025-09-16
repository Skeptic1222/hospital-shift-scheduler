import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, addHours } from 'date-fns';
import { apiFetch } from '../utils/api';

const CreateShiftDialog = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  
  const [formData, setFormData] = useState({
    date: new Date(),
    startTime: new Date(),
    endTime: addHours(new Date(), 8),
    department_id: '',
    hospital_id: '',
    required_staff: 1,
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchDepartments();
      fetchHospitals();
    }
  }, [open]);

  const fetchDepartments = async () => {
    try {
      const response = await apiFetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const fetchHospitals = async () => {
    try {
      const response = await apiFetch('/api/hospitals');
      if (response.ok) {
        const data = await response.json();
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      console.error('Failed to fetch hospitals:', err);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Format the date and times
      const shiftDate = format(formData.date, 'yyyy-MM-dd');
      const startDateTime = new Date(formData.date);
      startDateTime.setHours(formData.startTime.getHours(), formData.startTime.getMinutes());
      
      const endDateTime = new Date(formData.date);
      endDateTime.setHours(formData.endTime.getHours(), formData.endTime.getMinutes());

      const payload = {
        date: shiftDate,
        start_time: format(startDateTime, 'HH:mm'),
        end_time: format(endDateTime, 'HH:mm'),
        department_id: formData.department_id || null,
        hospital_id: formData.hospital_id || null,
        required_staff: parseInt(formData.required_staff, 10),
        notes: formData.notes
      };

      const response = await apiFetch('/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create shift');
      }

      onSuccess && onSuccess(data);
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to create shift');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      date: new Date(),
      startTime: new Date(),
      endTime: addHours(new Date(), 8),
      department_id: '',
      hospital_id: '',
      required_staff: 1,
      notes: ''
    });
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Shift</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <DatePicker
              label="Shift Date"
              value={formData.date}
              onChange={(newValue) => setFormData({ ...formData, date: newValue })}
              renderInput={(params) => <TextField {...params} fullWidth />}
              minDate={new Date()}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TimePicker
                label="Start Time"
                value={formData.startTime}
                onChange={(newValue) => setFormData({ ...formData, startTime: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              <TimePicker
                label="End Time"
                value={formData.endTime}
                onChange={(newValue) => setFormData({ ...formData, endTime: newValue })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Box>

            <TextField
              select
              label="Department"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">No specific department</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.department_id} value={dept.department_id}>
                  {dept.department_name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Hospital"
              value={formData.hospital_id}
              onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">No specific hospital</MenuItem>
              {hospitals.map((hospital) => (
                <MenuItem key={hospital.hospital_id} value={hospital.hospital_id}>
                  {hospital.hospital_name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="number"
              label="Required Staff"
              value={formData.required_staff}
              onChange={(e) => setFormData({ ...formData, required_staff: e.target.value })}
              fullWidth
              inputProps={{ min: 1, max: 50 }}
            />

            <TextField
              label="Notes (Optional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Creating...' : 'Create Shift'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateShiftDialog;