import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Switch,
  Alert,
  Grid,
  Paper,
  Skeleton,
  IconButton,
  Avatar,
  Zoom,
  Divider,
  Tooltip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Collapse,
  FormGroup,
  FormControlLabel
} from '@mui/material';
// Use StandardButton for consistency
import StandardButton from '../components/common/StandardButton';
import {
  AdminPanelSettings as AdminIcon,
  Save as SaveIcon,
  PersonAdd as AddIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Storage as DatabaseIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Cloud as CloudIcon,
  LiveTv as LiveIcon,
  AddCircle as AddShiftIcon
} from '@mui/icons-material';
import { useNotification } from '../contexts/NotificationContext';
import { useResponsive } from '../hooks/useResponsive';
import { apiFetch } from '../utils/api';
import CreateShiftDialog from '../components/CreateShiftDialog';

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { showNotification } = useNotification();
  useResponsive();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // New user form state - Fixed field names
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'user',
    department_id: ''
  });
  const [addingUser, setAddingUser] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Batch updates state
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingChanges, setSavingChanges] = useState(false);

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Create Shift state
  const [createShiftOpen, setCreateShiftOpen] = useState(false);

  // Settings sections expand state
  const [settingsExpanded, setSettingsExpanded] = useState({
    general: true,
    services: true,
    security: false
  });

  // Settings changes
  const [pendingSettings, setPendingSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, settingsRes] = await Promise.all([
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/settings')
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
        setPendingSettings(data || {});
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      showNotification('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userEmail, newRole) => {
    setPendingChanges(prev => ({
      ...prev,
      [userEmail]: newRole
    }));
  };

  const savePendingChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    setSavingChanges(true);
    try {
      const results = await Promise.allSettled(
        Object.entries(pendingChanges).map(async ([userEmail, newRole]) => {
          const res = await apiFetch('/api/admin/users/assign-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, roleName: newRole })
          });

          if (!res.ok) throw new Error(`Failed to update ${userEmail}`);
          return { email: userEmail, role: newRole };
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        setUsers(prev => prev.map(user => {
          const newRole = pendingChanges[user.email];
          return newRole ? { ...user, role: newRole } : user;
        }));
        setPendingChanges({});
        showNotification(`Successfully updated ${successful} user(s)${failed > 0 ? `, ${failed} failed` : ''}`, 
          failed > 0 ? 'warning' : 'success');
      } else {
        showNotification('Failed to update user roles', 'error');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      showNotification('Failed to save changes', 'error');
    } finally {
      setSavingChanges(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    if (users.some(u => u.email === email)) {
      setEmailError('This email is already registered');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleAddUser = async () => {
    if (!newUser.first_name || !newUser.last_name || !newUser.email) {
      showNotification('Please fill in all required fields', 'warning');
      return;
    }

    if (!validateEmail(newUser.email)) {
      return;
    }

    setAddingUser(true);
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (res.ok) {
        const data = await res.json();
        const addedUser = data.user || data;
        
        // Add the new user to the list
        setUsers(prev => [...prev, {
          ...addedUser,
          name: `${newUser.first_name} ${newUser.last_name}`,
          department: newUser.department_id || 'No Department'
        }]);
        
        // Reset form
        setNewUser({ first_name: '', last_name: '', email: '', role: 'user', department_id: '' });
        setNewUserOpen(false);
        showNotification('User added successfully', 'success');
      } else {
        const error = await res.json();
        showNotification(error.error || error.message || 'Failed to add user', 'error');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      showNotification('Failed to add user', 'error');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const res = await apiFetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
        showNotification('User deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        showNotification('Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Failed to delete user', 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingSettings)
      });

      if (res.ok) {
        setSettings(pendingSettings);
        showNotification('Settings saved successfully', 'success');
      } else {
        showNotification('Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };


  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user => 
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.department?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const hasSettingsChanges = JSON.stringify(settings) !== JSON.stringify(pendingSettings);

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Admin Panel
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            icon={<LiveIcon />} 
            label="LIVE MODE" 
            color="success" 
            variant="filled"
          />
        </Box>
      </Box>

      {message && (
        <Zoom in={true}>
          <Alert
            severity="success"
            onClose={() => setMessage('')}
            sx={{ mb: 3 }}
          >
            {message}
          </Alert>
        </Zoom>
      )}

      <Grid container spacing={3}>
        {/* System Settings Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: isSmallScreen ? 2 : 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">System Settings</Typography>
                </Box>
                {hasSettingsChanges && (
                  <StandardButton
                    variant="contained"
                    color="success"
                    startIcon={<SaveIcon />}
                    onClick={saveSettings}
                    disabled={savingSettings}
                    size="small"
                  >
                    Save Settings
                  </StandardButton>
                )}
              </Box>
              
              {/* General Settings */}
              <Box sx={{ mb: 2 }}>
                <ListItem
                  button
                  onClick={() => setSettingsExpanded(prev => ({ ...prev, general: !prev.general }))}
                >
                  <ListItemText primary="General Settings" />
                  {settingsExpanded.general ? <CollapseIcon /> : <ExpandIcon />}
                </ListItem>
                <Collapse in={settingsExpanded.general}>
                  <Box sx={{ pl: 4, pr: 2, py: 2 }}>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={pendingSettings?.maintenance_mode || false}
                            onChange={(e) => setPendingSettings(prev => ({ 
                              ...prev, 
                              maintenance_mode: e.target.checked 
                            }))}
                          />
                        }
                        label="Maintenance Mode"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={pendingSettings?.allow_registration || false}
                            onChange={(e) => setPendingSettings(prev => ({ 
                              ...prev, 
                              allow_registration: e.target.checked 
                            }))}
                          />
                        }
                        label="Allow User Registration"
                      />
                    </FormGroup>
                    
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Total Users</Typography>
                        <Typography variant="h5">{users.length}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Active Sessions</Typography>
                        <Typography variant="h5">{settings?.active_sessions || 0}</Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>
              </Box>

              {/* External Services */}
              <Box sx={{ mb: 2 }}>
                <ListItem
                  button
                  onClick={() => setSettingsExpanded(prev => ({ ...prev, services: !prev.services }))}
                >
                  <ListItemText primary="External Services" />
                  {settingsExpanded.services ? <CollapseIcon /> : <ExpandIcon />}
                </ListItem>
                <Collapse in={settingsExpanded.services}>
                  <Box sx={{ pl: 4, pr: 2, py: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <DatabaseIcon sx={{ mb: 1, color: settings?.database_connected ? 'success.main' : 'text.disabled' }} />
                          <Typography variant="subtitle2">Database</Typography>
                          <Chip 
                            label={settings?.database_connected ? 'Connected' : 'Disconnected'} 
                            color={settings?.database_connected ? 'success' : 'default'} 
                            size="small" 
                          />
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <CloudIcon sx={{ mb: 1, color: settings?.redis_available ? 'success.main' : 'text.disabled' }} />
                          <Typography variant="subtitle2">Redis Cache</Typography>
                          <Chip 
                            label={settings?.redis_available ? 'Available' : 'Not Available'} 
                            color={settings?.redis_available ? 'success' : 'default'} 
                            size="small" 
                          />
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <EmailIcon sx={{ mb: 1, color: settings?.email_configured ? 'success.main' : 'text.disabled' }} />
                          <Typography variant="subtitle2">Email Service</Typography>
                          <Chip 
                            label={settings?.email_configured ? 'Configured' : 'Not Configured'} 
                            color={settings?.email_configured ? 'success' : 'default'} 
                            size="small" 
                          />
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <SmsIcon sx={{ mb: 1, color: settings?.sms_configured ? 'success.main' : 'text.disabled' }} />
                          <Typography variant="subtitle2">SMS Service</Typography>
                          <Chip 
                            label={settings?.sms_configured ? 'Configured' : 'Not Configured'} 
                            color={settings?.sms_configured ? 'success' : 'default'} 
                            size="small" 
                          />
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                </Collapse>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Users Management Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: isSmallScreen ? 2 : 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                mb: 3,
                flexWrap: 'wrap',
                gap: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    Users ({filteredUsers.length})
                  </Typography>
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  flexWrap: 'wrap'
                }}>
                  {hasPendingChanges && (
                    <Chip 
                      label={`${Object.keys(pendingChanges).length} unsaved changes`} 
                      color="warning" 
                      size="small" 
                    />
                  )}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <StandardButton
                      variant="contained"
                      color="success"
                      startIcon={<SaveIcon />}
                      onClick={savePendingChanges}
                      disabled={!hasPendingChanges || savingChanges}
                      size="small"
                    >
                      Save
                    </StandardButton>
                    <StandardButton
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setNewUserOpen(true)}
                      size="small"
                    >
                      Add User
                    </StandardButton>
                    <StandardButton
                      variant="contained"
                      startIcon={<AddShiftIcon />}
                      onClick={() => setCreateShiftOpen(true)}
                      size="small"
                      aria-label="Create Shift"
                      data-testid="create-shift-button"
                    >
                      Create Shift
                    </StandardButton>
                  </Box>
                </Box>
              </Box>

              <TextField
                size="small"
                placeholder="Search users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                fullWidth={isSmallScreen}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: searchTerm && (
                    <IconButton 
                      size="small" 
                      onClick={() => setSearchTerm('')}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )
                }}
                sx={{ 
                  minWidth: isSmallScreen ? '100%' : 250,
                  mb: 2
                }}
              />

              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {filteredUsers.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No users found
                  </Typography>
                ) : (
                  filteredUsers.map(user => {
                    const currentRole = pendingChanges[user.email] || user.role || 'user';
                    const hasPending = pendingChanges[user.email] !== undefined;
                    return (
                      <ListItem 
                        key={user.email}
                        sx={{ 
                          backgroundColor: hasPending ? 'warning.50' : 'transparent',
                          '&:hover': {
                            backgroundColor: hasPending ? 'warning.100' : 'action.hover'
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {(user.name || user.email || 'U')[0].toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={user.name || user.email}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {user.email}
                              </Typography>
                              <Chip 
                                label={user.department || 'No Department'} 
                                size="small" 
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            </Box>
                          }
                        />
                        <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
                          <Select
                            value={currentRole}
                            onChange={e => handleRoleChange(user.email, e.target.value)}
                            disabled={savingChanges}
                          >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="supervisor">Supervisor</MenuItem>
                            <MenuItem value="user">User</MenuItem>
                          </Select>
                        </FormControl>
                        <ListItemSecondaryAction>
                          <Tooltip title="Delete User">
                            <IconButton 
                              edge="end" 
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })
                )}
              </List>

              {/* Add New User Section */}
              {newUserOpen && (
                <Paper elevation={2} sx={{ mt: 3, p: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AddIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Add New User</Typography>
                    </Box>
                    <IconButton onClick={() => setNewUserOpen(false)} size="small">
                      <CloseIcon />
                    </IconButton>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={newUser.first_name}
                        onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                        required
                        size="small"
                        disabled={addingUser}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={newUser.last_name}
                        onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                        required
                        size="small"
                        disabled={addingUser}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={newUser.email}
                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        required
                        size="small"
                        disabled={addingUser}
                        error={!!emailError}
                        helperText={emailError}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small" disabled={addingUser}>
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={newUser.role}
                          onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                          label="Role"
                        >
                          <MenuItem value="user">User</MenuItem>
                          <MenuItem value="supervisor">Supervisor</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Department (optional)"
                        value={newUser.department_id}
                        onChange={e => setNewUser({ ...newUser, department_id: e.target.value })}
                        size="small"
                        disabled={addingUser}
                        placeholder="e.g., ED, ICU, OR"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <StandardButton
                          variant="outlined"
                          onClick={() => setNewUserOpen(false)}
                          disabled={addingUser}
                          priority="normal"
                        >
                          Cancel
                        </StandardButton>
                        <StandardButton
                          variant="contained"
                          color="primary"
                          onClick={handleAddUser}
                          disabled={addingUser}
                          startIcon={addingUser ? null : <SaveIcon />}
                        >
                          {addingUser ? 'Adding...' : 'Add User'}
                        </StandardButton>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the user <strong>{userToDelete?.name || userToDelete?.email}</strong>? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <StandardButton onClick={() => setDeleteDialogOpen(false)} disabled={deletingUser} priority="normal">
            Cancel
          </StandardButton>
          <StandardButton 
            onClick={handleDeleteUser} 
            color="error" 
            variant="contained"
            disabled={deletingUser}
            priority="high"
          >
            {deletingUser ? 'Deleting...' : 'Delete'}
          </StandardButton>
        </DialogActions>
      </Dialog>

      {/* Create Shift Dialog */}
      <CreateShiftDialog
        open={createShiftOpen}
        onClose={() => setCreateShiftOpen(false)}
        onSuccess={() => {
          setCreateShiftOpen(false);
          showNotification('Shift created successfully', 'success');
        }}
      />
    </Box>
  );
};

export default Admin;