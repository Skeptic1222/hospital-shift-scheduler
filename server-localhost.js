const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 80; // Use port 80 for http://localhost/scheduler

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import demo data
const demoData = require('./demo-data-enhanced');

// Simple in-memory storage for demo
let shifts = [];
let staff = [];

// Initialize demo data
async function initializeDemoData() {
  console.log('Initializing demo data...');
  const data = await demoData.initializeDemoData();
  shifts = data.shifts || [];
  staff = data.users || [];
  console.log(`Loaded ${shifts.length} shifts and ${staff.length} staff members`);
}

// Redirect root to /scheduler
app.get('/', (req, res) => {
  res.redirect('/scheduler');
});

// Serve the React development server via proxy at /scheduler
app.use('/scheduler', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/scheduler': ''  // Remove /scheduler from the path when proxying
  },
  ws: true, // Enable WebSocket support for hot reload
  onError: (err, req, res) => {
    // If React dev server is not running, show instructions
    res.status(502).send(`
      <html>
        <head>
          <title>Hospital Shift Scheduler</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1 { color: #333; }
            pre { background: #f0f0f0; padding: 15px; border-radius: 4px; overflow-x: auto; }
            .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
            .running { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🏥 Hospital Shift Scheduler</h1>
            <div class="status error">
              ⚠️ React development server is not running
            </div>
            <p>Please start the React development server:</p>
            <pre>cd /mnt/c/inetpub/wwwroot/scheduler
npm start</pre>
            <p>Then refresh this page.</p>
            <hr>
            <div class="status running">
              ✅ API Server is running at http://localhost/api
            </div>
            <p>Test API: <a href="/api/health">/api/health</a></p>
          </div>
        </body>
      </html>
    `);
  }
}));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', mode: 'demo', timestamp: new Date() });
});

app.get('/api/dashboard/metrics', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayShifts = shifts.filter(s => s.date === today);
  
  res.json({
    metrics: {
      shiftsToday: todayShifts.length,
      openShifts: shifts.filter(s => s.status === 'open').length,
      staffOnDuty: Math.floor(Math.random() * 10) + 5,
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
    alerts: []
  });
});

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
  res.json({ success: true });
});

app.get('/api/staff', (req, res) => {
  res.json({ staff: staff });
});

app.get('/api/queue/status/:id', (req, res) => {
  res.json({
    status: 'active',
    queueSize: 2,
    entries: [
      {
        id: '1',
        email: 'nurse1@demo.hospital.com',
        user_id: 'demo-nurse-001',
        queue_position: 1,
        window_starts_at: '10:00 AM',
        window_expires_at: '10:15 AM'
      }
    ]
  });
});

app.post('/api/queue/open-shift', (req, res) => {
  res.json({ success: true, message: 'Shift opened in FCFS queue' });
});

app.post('/api/queue/respond', (req, res) => {
  res.json({ success: true, message: 'Response recorded' });
});

app.get('/api/users/profile', (req, res) => {
  res.json({
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@hospital.com',
    role: 'nurse',
    department: 'Emergency',
    shift_preference: 'Day'
  });
});

app.post('/api/users/timeoff', (req, res) => {
  res.json({ success: true, message: 'Time off request submitted' });
});

app.get('/api/admin/roles', (req, res) => {
  res.json({ roles: [
    { name: 'admin', description: 'System Administrator' },
    { name: 'supervisor', description: 'Department Supervisor' },
    { name: 'user', description: 'Staff Member' }
  ]});
});

app.post('/api/admin/roles/seed', (req, res) => {
  res.json({ success: true });
});

app.post('/api/admin/users/assign-role', (req, res) => {
  res.json({ success: true });
});

app.post('/api/seed/radtechs', (req, res) => {
  res.json({ success: true });
});

app.post('/api/seed/shifts', (req, res) => {
  res.json({ success: true });
});

app.get('/api/notifications', (req, res) => {
  res.json({ notifications: [] });
});

app.get('/api/settings', (req, res) => {
  res.json({ settings: {} });
});

app.get('/api/oncall', (req, res) => {
  res.json({ oncall: [] });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
initializeDemoData().then(() => {
  // Check if we need http-proxy-middleware
  try {
    require.resolve('http-proxy-middleware');
  } catch(e) {
    console.log('Installing http-proxy-middleware...');
    require('child_process').execSync('npm install http-proxy-middleware', { stdio: 'inherit' });
  }
  
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏥 Hospital Shift Scheduler - Localhost Server         ║
║                                                           ║
║   Main URL: http://localhost/scheduler                   ║
║   API URL:  http://localhost/api                         ║
║   Port: ${PORT}                                                ║
║                                                           ║
║   ⚠️  IMPORTANT: You need to run this with sudo:         ║
║   sudo node server-localhost.js                          ║
║                                                           ║
║   Also start React dev server in another terminal:       ║
║   npm start                                              ║
║                                                           ║
║   Test accounts:                                         ║
║   - admin@demo.hospital.com / Admin123!                  ║
║   - nurse1@demo.hospital.com / Nurse123!                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});