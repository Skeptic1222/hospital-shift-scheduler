const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('build'));

// Mock auth endpoint for testing
app.post('/api/auth/google', (req, res) => {
  res.json({
    success: true,
    user: {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['admin', 'supervisor']
    },
    token: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token'
  });
});

// Mock shifts endpoints
app.get('/api/shifts', (req, res) => {
  res.json({
    shifts: [],
    pagination: { page: 1, limit: 50, total: 0 }
  });
});

app.post('/api/shifts', (req, res) => {
  console.log('POST /api/shifts called with:', req.body);
  
  // Return success response
  res.status(201).json({
    id: 'shift-' + Date.now(),
    created: true,
    shift: {
      id: 'shift-' + Date.now(),
      shift_date: req.body.date || new Date().toISOString().slice(0,10),
      start_datetime: new Date(),
      end_datetime: new Date(),
      required_staff: req.body.required_staff || 1,
      status: 'open',
      department_id: req.body.department_id || null,
      hospital_id: req.body.hospital_id || null
    }
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Mock API endpoints ready');
});