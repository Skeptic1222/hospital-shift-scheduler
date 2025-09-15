# Hospital Shift Scheduler - Quick Start Guide

## 🚀 Server is Now Running!

The backend demo server is successfully running on **http://localhost:3001**

## ✅ What’s Working

### Backend (port 3001)
- ✅ Demo/offline mode works (no external dependencies required)
- ✅ Core endpoints available; some routes return demo data when `SKIP_EXTERNALS=true`
- ✅ Demo data loader available (hundreds of shifts + sample staff)

### API Endpoints (high level)
- `GET /api/health` - Server health check
- `GET /api/dashboard/metrics` - Dashboard data
- `GET /api/shifts` - All shifts
- `GET /api/staff` - Staff directory
- `GET /api/queue/status/:id` - Queue status
- `GET /api/users/profile` - User profile
- `POST /api/shifts` - Create new shift
- `POST /api/shifts/assign` - Assign staff to shift
 - `POST /api/queue/open-shift` - FCFS open shift
 - `POST /api/queue/respond` - FCFS respond

## 📱 How to Access the Application

### Option 1: Use React Development Server
```bash
# In a new terminal, run:
cd /mnt/c/inetpub/wwwroot/scheduler
npm start
```
Then open http://localhost:3000 in your browser

### Option 2: Build and Serve Static Files
```bash
# Build the React app
npm run build

# The backend server will serve the built files
# Access at http://localhost:3001
```

### Option 3: Direct API Testing
```bash
# Test the API directly
curl http://localhost:3001/api/health
curl http://localhost:3001/api/dashboard/metrics
```

## 👤 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.hospital.com | Admin123! |
| Supervisor | supervisor@demo.hospital.com | Super123! |
| Nurse 1 | nurse1@demo.hospital.com | Nurse123! |
| Nurse 2 | nurse2@demo.hospital.com | Nurse123! |

## 🎯 Key Features Implemented

### UI Improvements ✅
- **Mobile Navigation**: Bottom nav bar + slide-out drawer
- **Responsive Design**: Works on all screen sizes
- **Standardized Components**: Consistent buttons, loading states, error handling
- **Touch Optimized**: 48px minimum touch targets
- **No Cut-off Elements**: All content properly contained

### Backend Features ✅
- **Demo Mode**: Runs without external dependencies
- **Rich Test Data**: Comprehensive shifts and staff data
- **Real-time Ready**: Socket.io configuration included (polling transport in prod/IIS)
- **Security Defaults**: Helmet, CORS, rate limits, structured logging

### Pages Updated ✅
- **Dashboard**: Full metrics and real-time updates
- **Schedule**: Create and manage shifts
- **Staff Directory**: View all staff with details
- **Admin Panel**: Seed data and manage roles
- **Profile**: User information and time-off requests
- **Shift Queue**: FCFS queue management

## 🛠️ Troubleshooting

### If the frontend doesn't load:
1. Make sure you're in the correct directory: `/mnt/c/inetpub/wwwroot/scheduler`
2. Install dependencies if needed: `npm install`
3. Check that port 3000 is free
4. Try the build option instead of dev server

### If the backend stops:
```bash
# Restart the demo server
node server-demo.js
```

### To see server logs:
The server is running in the background. Check the console where you started it.

## 📝 Development Notes

### File Structure
```
scheduler/
├── server-demo.js        # Demo backend server (RUNNING)
├── src/                  # React frontend
│   ├── pages/           # Updated page components
│   ├── components/      # Reusable components
│   │   ├── common/      # StandardButton, LoadingState, etc.
│   │   └── MobileNavigation.jsx
│   └── hooks/           # useResponsive, etc.
├── demo-data-enhanced.js # Test data generator
└── .env                 # Environment configuration
```

### Recent Improvements
1. Fixed all cut-off buttons
2. Added mobile-responsive navigation
3. Standardized UI components
4. Connected all frontend to backend
5. Added comprehensive error handling
6. Implemented loading states everywhere
7. Created demo server that works without external dependencies

## 🎉 Success!

The application is functional in demo mode with:
- ✅ Consistent, professional UI
- ✅ Mobile-first responsive design
- ✅ Buttons/touch targets standardized
- ✅ Backend server running with demo data
- ✅ Frontend connected to available endpoints
- ✅ Rich test data for demonstration

**Next Step**: Open http://localhost:3000 (after running `npm start`) or http://localhost:3001 (if built) to see the application!
