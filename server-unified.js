const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 80; // Port 80 for http://localhost

// Import demo data
const demoData = require('./demo-data-enhanced');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory storage for demo
let shifts = [];
let staff = [];
let queue = [];
let notifications = [];

// Initialize demo data
async function initializeDemoData() {
  console.log('Initializing demo data...');
  const data = await demoData.initializeDemoData();
  shifts = data.shifts || [];
  staff = data.users || [];
  console.log(`Loaded ${shifts.length} shifts and ${staff.length} staff members`);
}

// ======================
// API Routes (at root level for backend compatibility)
// ======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', mode: 'demo', timestamp: new Date() });
});

// Dashboard metrics
app.get('/api/dashboard/metrics', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayShifts = shifts.filter(s => s.date === today);
  const openShifts = shifts.filter(s => s.status === 'open').length;
  const staffOnDuty = staff.filter(s => Math.random() > 0.5).length;
  
  res.json({
    metrics: {
      shiftsToday: todayShifts.length,
      openShifts: openShifts,
      staffOnDuty: staffOnDuty,
      fillRate: Math.floor(Math.random() * 20) + 75,
      avgResponseTime: Math.floor(Math.random() * 10) + 5,
      overtimeHours: Math.floor(Math.random() * 100),
      fatigueAlerts: Math.floor(Math.random() * 5),
      upcomingShifts: shifts.slice(0, 10)
    },
    userStats: {
      hoursThisWeek: 36,
      shiftsCompleted: 4,
      nextShift: shifts[0],
      fatigueScore: 3,
      consecutiveDays: 2
    },
    alerts: [
      { severity: 'warning', message: '2 open shifts need coverage', actionable: true, action: 'viewOpenShifts', actionText: 'View' },
      { severity: 'info', message: 'Schedule published for next week', actionable: false }
    ]
  });
});

// Shifts
app.get('/api/shifts', (req, res) => {
  res.json({ shifts: shifts });
});

app.post('/api/shifts', (req, res) => {
  const newShift = {
    id: Date.now().toString(),
    ...req.body,
    status: 'open',
    created_at: new Date()
  };
  shifts.push(newShift);
  res.json({ shift: newShift });
});

app.post('/api/shifts/assign', (req, res) => {
  const { shift_id, user_id } = req.body;
  const shift = shifts.find(s => s.id === shift_id);
  const user = staff.find(u => u.id === user_id);
  
  if (shift && user) {
    if (!shift.assigned_staff) shift.assigned_staff = [];
    shift.assigned_staff.push({
      user_id: user.id,
      user_name: `${user.first_name} ${user.last_name}`,
      title: user.role || 'Staff'
    });
    shift.status = shift.assigned_staff.length >= shift.required_staff ? 'filled' : 'partial';
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Shift or user not found' });
  }
});

// Staff
app.get('/api/staff', (req, res) => {
  res.json({ staff: staff });
});

// Queue
app.get('/api/queue/status/:id', (req, res) => {
  const mockQueue = [
    {
      id: '1',
      email: 'nurse1@demo.hospital.com',
      user_id: 'demo-nurse-001',
      queue_position: 1,
      window_starts_at: '10:00 AM',
      window_expires_at: '10:15 AM'
    },
    {
      id: '2',
      email: 'nurse2@demo.hospital.com',
      user_id: 'demo-nurse-002',
      queue_position: 2,
      window_starts_at: '10:15 AM',
      window_expires_at: '10:30 AM'
    }
  ];
  
  res.json({
    status: 'active',
    queueSize: mockQueue.length,
    entries: mockQueue
  });
});

app.post('/api/queue/open-shift', (req, res) => {
  res.json({ success: true, message: 'Shift opened in FCFS queue' });
});

app.post('/api/queue/respond', (req, res) => {
  res.json({ success: true, message: 'Response recorded' });
});

// User profile
app.get('/api/users/profile', (req, res) => {
  res.json({
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@hospital.com',
    role: 'nurse',
    department: 'Emergency',
    shift_preference: 'Day',
    picture: null
  });
});

app.post('/api/users/timeoff', (req, res) => {
  res.json({ success: true, message: 'Time off request submitted' });
});

// Admin routes
app.get('/api/admin/roles', (req, res) => {
  res.json({
    roles: [
      { name: 'admin', description: 'System Administrator' },
      { name: 'supervisor', description: 'Department Supervisor' },
      { name: 'user', description: 'Staff Member' }
    ]
  });
});

app.post('/api/admin/roles/seed', (req, res) => {
  res.json({ success: true, message: 'Roles seeded' });
});

app.post('/api/admin/users/assign-role', (req, res) => {
  res.json({ success: true, message: 'Role assigned' });
});

app.post('/api/seed/radtechs', (req, res) => {
  const count = req.body.count || 20;
  console.log(`Seeding ${count} rad techs...`);
  res.json({ success: true, message: `${count} rad techs created` });
});

app.post('/api/seed/shifts', (req, res) => {
  const count = req.body.count || 40;
  console.log(`Seeding ${count} shifts...`);
  res.json({ success: true, message: `${count} shifts created` });
});

// Notifications
app.get('/api/notifications', (req, res) => {
  res.json({
    notifications: [
      { id: 1, message: 'New shift available in Emergency', timestamp: new Date(), type: 'shift' },
      { id: 2, message: 'Your shift swap request was approved', timestamp: new Date(), type: 'approval' }
    ]
  });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json({
    settings: {
      notifications: { email: true, sms: false, push: true },
      theme: 'light',
      language: 'en'
    }
  });
});

// On-call schedule
app.get('/api/oncall', (req, res) => {
  res.json({
    oncall: [
      { department: 'Emergency', primary: 'Dr. Smith', backup: 'Dr. Jones', date: new Date() },
      { department: 'ICU', primary: 'Dr. Wilson', backup: 'Dr. Brown', date: new Date() }
    ]
  });
});

// ======================
// Serve React App at /scheduler
// ======================

// Serve static files from React build
app.use('/scheduler', express.static(path.join(__dirname, 'build')));

// For React Router - serve index.html for all /scheduler/* routes
app.get('/scheduler/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Redirect root to /scheduler
app.get('/', (req, res) => {
  res.redirect('/scheduler');
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
initializeDemoData().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   Hospital Shift Scheduler - Unified Server           ║
║                                                        ║
║   Application URL: http://localhost/scheduler         ║
║   API Base URL: http://localhost/api                  ║
║   Port: ${PORT}                                             ║
║   Mode: Demo (no external dependencies)               ║
║                                                        ║
║   Test accounts:                                      ║
║   - admin@demo.hospital.com / Admin123!               ║
║   - nurse1@demo.hospital.com / Nurse123!              ║
║                                                        ║
║   Note: Build the React app first:                    ║
║   npm run build                                       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize demo data:', err);
  process.exit(1);
});