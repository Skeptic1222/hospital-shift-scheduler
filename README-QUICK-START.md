# Hospital Shift Scheduler - Quick Start Guide

## 🚀 Server is Now Running!

The backend server is accessible via IIS at **http://localhost/scheduler**

## ✅ What’s Working

### Backend
- ✅ Core endpoints available

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
# ⚠️ CRITICAL: NO PORTS IN URLS - See NO-PORT-RULE.md
# IIS proxies /scheduler to internal service
Then open http://localhost/scheduler in your browser

### Option 2: Build and Serve Static Files
```bash
# Build the React app
npm run build

# The backend server will serve the built files
# Access at http://localhost/scheduler
```

### Option 3: Direct API Testing
```bash
# Test the API directly
curl http://localhost/scheduler/api/health
curl http://localhost/scheduler/api/dashboard/metrics
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
- **Live Mode**: Runs with required dependencies (SQL Server, Redis)
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
Start the server again:
```bash
node server.js
```

### To see server logs:
The server is running in the background. Check the console where you started it.

## 📝 Development Notes

### File Structure
```
scheduler/
├── server.js             # Backend server
├── src/                  # React frontend
│   ├── pages/           # Updated page components
│   ├── components/      # Reusable components
│   │   ├── common/      # StandardButton, LoadingState, etc.
│   │   └── MobileNavigation.jsx
│   └── hooks/           # useResponsive, etc.
└── .env                 # Environment configuration
```

### Recent Improvements
1. Fixed all cut-off buttons
2. Added mobile-responsive navigation
3. Standardized UI components
4. Connected all frontend to backend
5. Added comprehensive error handling
6. Implemented loading states everywhere

## 🎉 Success!

The application is functional with:
- ✅ Consistent, professional UI
- ✅ Mobile-first responsive design
- ✅ Buttons/touch targets standardized
- ✅ Backend server running
- ✅ Frontend connected to available endpoints
- ✅ Rich test data for demonstration

**Next Step**: Open http://localhost/scheduler when served behind IIS (or your configured base URL).
