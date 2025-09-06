import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Typography,
  Grid,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  RadioGroup,
  Radio,
  TextField,
  Snackbar
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  NotificationsActive as PushIcon,
  DarkMode as DarkModeIcon,
  Language as LanguageIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Palette as PaletteIcon,
  VolumeUp as SoundIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  Vibration as VibrationIcon,
  DoNotDisturb as QuietIcon
} from '@mui/icons-material';
import StandardButton from '../components/common/StandardButton';
import { LoadingSpinner, CardSkeleton } from '../components/common/LoadingState';
import { ErrorMessage } from '../components/common/ErrorState';

const Settings = () => {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true,
      sound: true,
      vibration: true,
      quietHours: false,
      quietStart: '22:00',
      quietEnd: '07:00'
    },
    display: {
      theme: 'light',
      fontSize: 'medium',
      highContrast: false,
      colorBlind: false
    },
    language: 'en',
    timezone: 'America/New_York',
    shifts: {
      autoAccept: false,
      preferredShift: 'day',
      maxConsecutive: 3,
      minRestHours: 8,
      overtimeAlert: true
    },
    privacy: {
      showProfile: true,
      shareSchedule: true,
      locationTracking: false
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      const { apiFetch } = await import('../utils/api');
      const res = await apiFetch('/api/settings');
      const data = await res.json();

      // Merge with defaults
      setSettings(prev => ({
        ...prev,
        ...data.settings
      }));
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError(null);
      const { apiFetch } = await import('../utils/api');
      await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSuccessMessage('Settings saved successfully');
    } catch (err) {
      setError('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const updateNotification = (key, value) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }));
  };

  const updateDisplay = (key, value) => {
    setSettings(prev => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: value
      }
    }));
  };

  const updateShifts = (key, value) => {
    setSettings(prev => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [key]: value
      }
    }));
  };

  const updatePrivacy = (key, value) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }));
  };

  if (loading) {
    return <CardSkeleton count={3} />;
  }

  if (error && !settings) {
    return (
      <ErrorMessage
        title="Unable to load settings"
        message={error}
        onRetry={loadSettings}
      />
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Settings</Typography>

      <Grid container spacing={3}>
        {/* Notifications */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <NotificationIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Notifications</Typography>
              </Box>

              <List>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Notifications"
                    secondary="Receive shift updates via email"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.email}
                      onChange={(e) => updateNotification('email', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <SmsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="SMS Notifications"
                    secondary="Get text messages for urgent shifts"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.sms}
                      onChange={(e) => updateNotification('sms', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <PushIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Push Notifications"
                    secondary="In-app and browser notifications"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.push}
                      onChange={(e) => updateNotification('push', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <VibrationIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Vibration"
                    secondary="Vibrate on mobile devices"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.vibration}
                      onChange={(e) => updateNotification('vibration', e.target.checked)}
                      disabled={!settings.notifications.push}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider sx={{ my: 2 }} />

                <ListItem>
                  <ListItemIcon>
                    <QuietIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Quiet Hours"
                    secondary="Silence non-urgent notifications"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.quietHours}
                      onChange={(e) => updateNotification('quietHours', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                {settings.notifications.quietHours && (
                  <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 2 }}>
                    <TextField
                      label="Start Time"
                      type="time"
                      value={settings.notifications.quietStart}
                      onChange={(e) => updateNotification('quietStart', e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="End Time"
                      type="time"
                      value={settings.notifications.quietEnd}
                      onChange={(e) => updateNotification('quietEnd', e.target.value)}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Display & Accessibility */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PaletteIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Display & Accessibility</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={settings.display.theme}
                  onChange={(e) => updateDisplay('theme', e.target.value)}
                  label="Theme"
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto (System)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Font Size</InputLabel>
                <Select
                  value={settings.display.fontSize}
                  onChange={(e) => updateDisplay('fontSize', e.target.value)}
                  label="Font Size"
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                  <MenuItem value="extra-large">Extra Large</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.display.highContrast}
                    onChange={(e) => updateDisplay('highContrast', e.target.checked)}
                  />
                }
                label="High Contrast Mode"
                sx={{ mb: 1, width: '100%' }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.display.colorBlind}
                    onChange={(e) => updateDisplay('colorBlind', e.target.checked)}
                  />
                }
                label="Color Blind Mode"
                sx={{ width: '100%' }}
              />

              <Divider sx={{ my: 2 }} />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Language</InputLabel>
                <Select
                  value={settings.language}
                  onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                  label="Language"
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="zh">中文</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={settings.timezone}
                  onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  label="Timezone"
                >
                  <MenuItem value="America/New_York">Eastern Time</MenuItem>
                  <MenuItem value="America/Chicago">Central Time</MenuItem>
                  <MenuItem value="America/Denver">Mountain Time</MenuItem>
                  <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Shift Preferences */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Shift Preferences</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Preferred Shift</InputLabel>
                <Select
                  value={settings.shifts.preferredShift}
                  onChange={(e) => updateShifts('preferredShift', e.target.value)}
                  label="Preferred Shift"
                >
                  <MenuItem value="day">Day (7AM - 3PM)</MenuItem>
                  <MenuItem value="evening">Evening (3PM - 11PM)</MenuItem>
                  <MenuItem value="night">Night (11PM - 7AM)</MenuItem>
                  <MenuItem value="rotating">Rotating</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.shifts.autoAccept}
                    onChange={(e) => updateShifts('autoAccept', e.target.checked)}
                  />
                }
                label="Auto-accept preferred shifts"
                sx={{ mb: 2, width: '100%' }}
              />

              <TextField
                fullWidth
                label="Max Consecutive Shifts"
                type="number"
                value={settings.shifts.maxConsecutive}
                onChange={(e) => updateShifts('maxConsecutive', parseInt(e.target.value))}
                inputProps={{ min: 1, max: 7 }}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Minimum Rest Hours"
                type="number"
                value={settings.shifts.minRestHours}
                onChange={(e) => updateShifts('minRestHours', parseInt(e.target.value))}
                inputProps={{ min: 4, max: 16 }}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.shifts.overtimeAlert}
                    onChange={(e) => updateShifts('overtimeAlert', e.target.checked)}
                  />
                }
                label="Alert for overtime opportunities"
                sx={{ width: '100%' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Privacy & Security */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Privacy & Security</Typography>
              </Box>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Profile Visibility"
                    secondary="Allow other staff to view your profile"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.privacy.showProfile}
                      onChange={(e) => updatePrivacy('showProfile', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Share Schedule"
                    secondary="Let colleagues see when you're working"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.privacy.shareSchedule}
                      onChange={(e) => updatePrivacy('shareSchedule', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Location Tracking"
                    secondary="For emergency response coordination"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.privacy.locationTracking}
                      onChange={(e) => updatePrivacy('locationTracking', e.target.checked)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <Alert severity="info" sx={{ mt: 2 }}>
                Your data is protected in compliance with HIPAA regulations
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Paper sx={{ p: 2, mt: 3, position: 'sticky', bottom: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Last saved: {new Date().toLocaleString()}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <StandardButton
              variant="outlined"
              onClick={loadSettings}
              disabled={saving}
            >
              Reset
            </StandardButton>
            <StandardButton
              variant="contained"
              onClick={saveSettings}
              loading={saving}
              priority="primary"
            >
              Save Changes
            </StandardButton>
          </Box>
        </Box>
      </Paper>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;

