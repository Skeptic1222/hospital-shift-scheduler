# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
HIPAA-compliant hospital shift scheduling system with FCFS (First-Come, First-Served) distribution using 15-minute response windows. Deployed on Windows/IIS with SQL Server Express backend.

## Architecture

### Core Stack
- **Backend**: Node.js Express server with Socket.io for real-time updates
- **Database**: SQL Server Express (Windows authentication or SQL auth)
- **Cache**: Redis for session management and queue operations
- **Frontend**: React with Material-UI, Redux state management
- **Authentication**: Auth0 with MFA, JWT tokens
- **Deployment**: IIS with iisnode module on Windows Server

### Key Services
- **FCFSScheduler**: Implements fair shift distribution with weighted priority queue
- **RealtimeNotificationSystem**: Multi-channel notifications (email, SMS, push, in-app)
- **RedisCacheService**: Encrypted cache layer for HIPAA compliance
- **Auth0Service**: Identity management with role-based access control

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run production server
npm start

# Run tests
npm test

# Run linting
npm run lint

# Database migrations
npm run db:migrate

# Seed database
npm run db:seed

# Build React frontend
npm run build
```

## Database Configuration

The system uses SQL Server Express with two connection modes:

1. **SQL Authentication** (default):
   - Server: `localhost\SQLEXPRESS`
   - Database: `HospitalScheduler`
   - User/Password: Configured in environment variables

2. **Windows Authentication**:
   - Trusted connection enabled
   - No username/password required

## IIS Deployment

Deploy using PowerShell script (requires Administrator):
```powershell
.\deploy.ps1 -Environment production -SqlServer ".\SQLEXPRESS" -IISAppName "HospitalScheduler" -Port 3001
```

The deployment script:
- Installs IIS and IISNode if missing
- Configures application pool with proper identity
- Sets up URL rewriting and WebSocket support
- Applies HIPAA-compliant security headers
- Creates SQL Server database and schemas

## Environment Variables

Required environment variables (set in `.env` or IIS configuration):

```
# Auth0
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=

# Database
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=HospitalScheduler
DB_USER=sa
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
JWT_SECRET=
ENCRYPTION_KEY=

# Notifications
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## HIPAA Compliance

The system implements comprehensive HIPAA safeguards:

### Technical Controls
- AES-256 encryption for data at rest and in transit
- Automatic session timeout (15 minutes)
- Comprehensive audit logging (7-year retention)
- Role-based access control with Auth0 MFA

### Database Security
- Row-level security in SQL Server
- Encrypted columns for PHI data
- Stored procedures for all data operations
- Audit schema tracking all access events

### API Security
- JWT bearer token authentication
- Rate limiting (100 req/min standard, 10 req/min for intensive ops)
- HTTPS-only with HSTS headers
- Input validation and sanitization

## FCFS Algorithm

The shift distribution system uses weighted priorities:
- **Seniority**: 30% weight
- **Last Shift Worked**: 20% weight
- **Skill Match**: 25% weight
- **Availability**: 25% weight

15-minute response windows ensure fair distribution with automatic queue progression.

## Testing Strategy

```bash
# Run all tests with coverage
npm test

# Run specific test file
npm test -- server.test.js

# Run integration tests
npm test -- --testPathPattern=integration

# Generate coverage report
npm test -- --coverage --coverageReporters=html
```

## WebSocket Events

Real-time events handled by Socket.io:
- `shift:posted` - New shift available
- `shift:claimed` - Shift assigned
- `queue:updated` - Position changes
- `notification:new` - System notifications
- `metrics:updated` - Dashboard updates

## Critical Files

- **server.js**: Main Express application with middleware configuration
- **fcfs-algorithm.js**: Core scheduling logic with queue management
- **db-config.js**: SQL Server connection pooling and repositories
- **realtime-notifications.js**: Multi-channel notification dispatch
- **web.config**: IIS configuration with security headers and rewrite rules
- **deploy.ps1**: Windows deployment automation script
- **database-schema-sqlserver.sql**: Complete database schema with audit tables

## Performance Considerations

- Connection pooling configured for 10 concurrent database connections
- Redis cache reduces database load for frequently accessed data
- React build optimized with code splitting and lazy loading
- IIS configured with dynamic compression for API responses
- WebSocket connections managed with automatic reconnection

## Security Notes

- Never commit `.env` files or expose API keys
- Use Windows authentication for SQL Server in production when possible
- Regular security updates required for Auth0 and dependencies
- Audit logs must be reviewed weekly per HIPAA requirements
- PHI data must never be logged in plain text

## 🚀 ENHANCEMENT ROADMAP - Mobile-First Healthcare UX

### 📱 Critical Mobile-First Improvements

#### 1. **Responsive Touch-Optimized Interface**
- **ISSUE**: Current Material-UI implementation lacks mobile-specific optimizations
- **SOLUTION**: 
  - Implement touch gestures (swipe to claim/decline shifts)
  - Increase tap targets to 48x48px minimum (WCAG AAA)
  - Add haptic feedback for critical actions
  - Implement pull-to-refresh for shift lists
  - Bottom navigation bar for thumb-friendly access

#### 2. **Progressive Web App Enhancements**
- **ISSUE**: Basic PWA implementation without offline capabilities
- **SOLUTION**:
  - Implement comprehensive service worker caching strategies
  - Queue actions when offline (shift claims, responses)
  - Background sync for automatic retry
  - Push notifications with action buttons
  - App shortcuts for quick actions (claim shift, check schedule)

#### 3. **Healthcare Worker-Specific QOL Features**
- **Quick Actions Widget**: 
  - One-tap sick call reporting
  - Emergency shift coverage request
  - Fatigue level reporting with auto-recommendations
- **Smart Notifications**:
  - Quiet hours based on shift patterns
  - Priority-based notification sounds
  - Critical vs non-critical visual differentiation
- **Voice Commands**: "Hey scheduler, show my next shift"
- **Dark Mode**: Auto-switch based on shift time (night shift = dark mode)

### 🎨 UX/UI Refinements

#### Mobile-Specific Enhancements
```jsx
// Mobile-optimized shift card component
<SwipeableShiftCard
  onSwipeRight={claimShift}
  onSwipeLeft={declineShift}
  onLongPress={viewDetails}
  hapticFeedback={true}
/>

// Bottom sheet for quick actions
<BottomSheet snapPoints={['25%', '50%', '90%']}>
  <QuickActions />
</BottomSheet>

// Floating action button with speed dial
<SpeedDial
  actions={[
    { icon: <EmergencyIcon />, name: 'Emergency Coverage' },
    { icon: <SwapIcon />, name: 'Request Swap' },
    { icon: <SickIcon />, name: 'Report Sick' },
  ]}
/>
```

#### Desktop Enhancements
- **Multi-panel view**: Schedule | Queue | Notifications side-by-side
- **Keyboard shortcuts**: Vim-style navigation (j/k for up/down)
- **Advanced filtering**: Multi-criteria shift search
- **Bulk operations**: Select multiple shifts for batch actions

### 🏥 Healthcare-Specific Features

#### 1. **Fatigue Management System**
- Track consecutive hours worked
- Alert supervisors when fatigue thresholds exceeded
- Auto-suggest rest periods
- Integration with fitness trackers for sleep data

#### 2. **Skill-Based Smart Matching**
- ML-powered shift recommendations
- Certification expiry warnings
- Training opportunity notifications
- Cross-department coverage suggestions

#### 3. **Team Communication Hub**
- Shift handoff notes with voice recordings
- Encrypted messaging for PHI discussions
- Team availability heat map
- Department-wide announcements with read receipts

### 🔧 Technical Architecture Improvements

#### Performance Optimizations
```javascript
// Implement React Query for intelligent caching
import { useQuery, useMutation } from '@tanstack/react-query';

// Virtual scrolling for large shift lists
import { FixedSizeList } from 'react-window';

// Web Workers for heavy computations
const fcfsWorker = new Worker('fcfs-algorithm.worker.js');

// IndexedDB for offline data persistence
const db = await openDB('ShiftScheduler', 1, {
  upgrade(db) {
    db.createObjectStore('pendingActions');
    db.createObjectStore('cachedShifts');
  }
});
```

#### Mobile Performance
- Implement code splitting per route
- Lazy load non-critical components
- Use Intersection Observer for infinite scroll
- Optimize images with WebP/AVIF formats
- Implement skeleton screens during loading

### 📊 Analytics & Insights Dashboard

#### Staff Metrics
- Average response time to shift offers
- Shift acceptance rate patterns
- Fatigue score trends
- Skills utilization heat map

#### Department Metrics
- Coverage gaps prediction
- Overtime cost projections
- Staff satisfaction scores
- Turnover risk indicators

### 🔒 Enhanced Security Features

#### Biometric Authentication
```javascript
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: "Hospital Scheduler" },
    user: {
      id: userId,
      name: userEmail,
      displayName: userName
    },
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required"
    }
  }
});
```

#### Zero-Trust Architecture
- Session-based encryption keys
- Device trust scoring
- Anomaly detection for access patterns
- Automatic session termination on suspicious activity

### 🌐 Accessibility Improvements

#### WCAG AAA Compliance
- Screen reader optimized navigation
- High contrast mode toggle
- Keyboard-only navigation support
- Focus indicators for all interactive elements
- ARIA live regions for real-time updates

#### Internationalization
```javascript
// Multi-language support
import i18n from 'i18next';

i18n.init({
  resources: {
    en: { translation: require('./locales/en.json') },
    es: { translation: require('./locales/es.json') },
    fr: { translation: require('./locales/fr.json') },
    zh: { translation: require('./locales/zh.json') }
  }
});
```

### 📱 Platform-Specific Optimizations

#### iOS Optimizations
- Safe area insets for notched devices
- Smooth scrolling with -webkit-overflow-scrolling
- Home screen icon with splash screens
- Siri shortcuts integration

#### Android Optimizations
- Material You dynamic theming
- Widget for home screen
- Android Auto integration for commute notifications
- Wear OS companion app

### 🚨 Critical Issues to Address

1. **No Mobile Testing Framework**: Implement Detox or Appium
2. **Missing Error Recovery**: Add retry mechanisms and fallbacks
3. **No Rate Limiting on Frontend**: Implement request debouncing
4. **Lack of Data Validation**: Add Zod or Yup schemas
5. **No Performance Monitoring**: Integrate Sentry or DataDog
6. **Missing A/B Testing**: Implement feature flags system
7. **No User Feedback Loop**: Add in-app feedback widget

### 🎯 Implementation Priority

#### Phase 1 (Week 1-2): Mobile Foundation
- [ ] Responsive design audit and fixes
- [ ] Touch gesture implementation
- [ ] PWA offline capabilities
- [ ] Bottom navigation for mobile

#### Phase 2 (Week 3-4): Core QOL Features
- [ ] Quick actions widget
- [ ] Smart notifications
- [ ] Dark mode with auto-switching
- [ ] Fatigue management system

#### Phase 3 (Week 5-6): Advanced Features
- [ ] Voice commands
- [ ] Biometric authentication
- [ ] Team communication hub
- [ ] Analytics dashboard

#### Phase 4 (Week 7-8): Polish & Optimization
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Platform-specific features
- [ ] Comprehensive testing

### 📈 Success Metrics

- **Mobile Usage**: Target 70% of interactions on mobile
- **Response Time**: <2s for shift claim on 3G
- **Offline Capability**: 100% core features available offline
- **User Satisfaction**: >4.5 star rating
- **Shift Fill Rate**: 15% improvement in coverage
- **Fatigue Incidents**: 30% reduction
- **Accessibility Score**: WCAG AAA compliance

### 🔄 Continuous Improvement

#### User Feedback Integration
```javascript
// In-app feedback widget
const FeedbackWidget = () => {
  const [feedback, setFeedback] = useState('');
  const [sentiment, setSentiment] = useState(null);
  
  return (
    <FloatingActionButton>
      <FeedbackForm
        onSubmit={async (data) => {
          await api.submitFeedback({
            ...data,
            context: getCurrentContext(),
            deviceInfo: getDeviceInfo()
          });
        }}
      />
    </FloatingActionButton>
  );
};
```

#### A/B Testing Framework
```javascript
// Feature flag system
const features = {
  newShiftCard: useFeatureFlag('new-shift-card'),
  voiceCommands: useFeatureFlag('voice-commands'),
  advancedAnalytics: useFeatureFlag('advanced-analytics')
};

// Usage
{features.newShiftCard ? <NewShiftCard /> : <LegacyShiftCard />}
```

### 🎨 Design System Updates

#### Mobile-First Component Library
```javascript
// Responsive design tokens
const breakpoints = {
  mobile: '320px',
  phablet: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px'
};

const spacing = {
  touch: '48px', // Minimum touch target
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px'
};
```

### 💡 Innovation Opportunities

1. **AI-Powered Scheduling**: Predictive analytics for optimal coverage
2. **Blockchain Audit Trail**: Immutable HIPAA compliance records
3. **AR Wayfinding**: Navigate to assigned units in hospital
4. **Wearable Integration**: Apple Watch/Fitbit fatigue monitoring
5. **Natural Language Processing**: "Show me all night shifts next week"
6. **Computer Vision**: Badge scanning for quick clock-in
7. **IoT Integration**: Smart badge location tracking for emergency response

## 📝 Demo Accounts & Test Data

### Test User Credentials

The system includes comprehensive demo data with the following test accounts:

| Role | Email | Password | Name | Access Level |
|------|-------|----------|------|-------------|
| **Admin** | admin@demo.hospital.com | Admin123! | Sarah Johnson | Full system access |
| **Supervisor** | supervisor@demo.hospital.com | Super123! | Michael Chen | ED department management |
| **Nurse 1** | nurse1@demo.hospital.com | Nurse123! | Emily Rodriguez | Night shift, ED |
| **Nurse 2** | nurse2@demo.hospital.com | Nurse123! | James Wilson | Day shift, ICU |
| **Tech 1** | tech1@demo.hospital.com | Tech123! | Lisa Martinez | Evening shift, X-Ray |
| **Tech 2** | tech2@demo.hospital.com | Tech123! | David Kim | Rotating, CT |
| **Part-Time** | parttime@demo.hospital.com | Part123! | Amanda Thompson | Weekends only |
| **Float Pool** | float@demo.hospital.com | Float123! | Robert Davis | Any department |

### Demo Data Features

#### 📅 Comprehensive Schedule Data
- **14 days** of pre-populated shifts with staff assignments
- **Staff names displayed** on all shifts (previously missing)
- **Multiple departments**: ED, ICU, OR, Lab, Pharmacy, etc.
- **Shift differentials**: Night (15%), Evening (10%), Mid (5%)
- **Weekend staffing** adjustments

#### 📞 On-Call Schedules
- **30-day** on-call rotation for critical departments
- **Primary and backup** on-call assignments
- **Contact information** for each on-call staff
- **Department coverage**: ED, ICU, OR, Lab, Pharmacy

#### 🏖️ Vacation & PTO Tracking
- **Christmas vacation**: Emily Rodriguez (12/23-12/27)
- **Thanksgiving**: James Wilson (11/28-11/29)
- **New Year**: Robert Davis (12/31-1/2)
- **Personal time**: Lisa Martinez (11/15-11/17)
- **Automatic exclusion** from shift assignments during PTO

#### 😴 Fatigue Management Data
- **Real-time fatigue scores** for all clinical staff
- **Consecutive hours** tracking
- **Weekly/monthly** hour accumulation
- **Risk levels**: High (>16hr), Medium (12-16hr), Low (<12hr)
- **Break tracking**: Time since last break

#### 🔄 Shift Swap Requests
- **Pending swaps** between staff members
- **Approval workflow** with supervisor oversight
- **Reason tracking** for audit purposes

#### 🎨 Skills Matrix
- **Specialized certifications**: ECMO, Trauma, CCRN
- **Cross-training** documentation
- **Department float** capabilities
- **Preceptor** qualifications

### 🔧 Using Demo Data

#### Enable Demo Mode
```javascript
// In server.js or .env file
process.env.DEMO_MODE = 'true';
process.env.SKIP_EXTERNALS = 'true'; // Skip Auth0/Redis
```

#### Load Enhanced Demo Data
```javascript
// Use the enhanced demo data generator
const demoData = require('./demo-data-enhanced');

// Initialize all demo data
const data = await demoData.initializeDemoData();

// Access specific features
const onCall = demoData.getOnCallStaff('2024-11-10', 'ED');
const isOnVacation = demoData.isUserOnVacation('demo-nurse-001', '2024-12-25');
```

#### Demo API Endpoints
When in demo mode, the following endpoints return rich test data:
- `GET /api/shifts` - Returns shifts with assigned staff names
- `GET /api/oncall/:date` - Returns on-call schedule for date
- `GET /api/staff/vacations` - Returns vacation schedules
- `GET /api/staff/fatigue` - Returns fatigue metrics
- `GET /api/swaps` - Returns shift swap requests

### 🔍 Critical Issues Found

1. **Missing Staff Names**: Schedule view wasn't showing assigned staff names - **NOW FIXED**
2. **No On-Call Display**: On-call schedules exist but no UI component
3. **Vacation Conflicts**: No validation preventing shift assignment during PTO
4. **Fatigue Alerts**: Data exists but no notification system
5. **Swap Request UI**: Backend ready but frontend missing

### 🚀 Quick Demo Setup

```bash
# 1. Install dependencies
npm install

# 2. Set demo environment
export DEMO_MODE=true
export SKIP_EXTERNALS=true

# 3. Start with demo data
npm run demo

# 4. Login with any test account
# Email: admin@demo.hospital.com
# Password: Admin123!
```

### 📊 Demo Metrics

- **8 test users** with different roles and permissions
- **14 departments** with realistic staffing patterns
- **200+ shifts** pre-populated over 2 weeks
- **30-day** on-call schedule
- **Fatigue tracking** for all clinical staff
- **Vacation requests** with approval workflow
- **Shift swaps** with pending/approved states

## ⚠️ CRITICAL ARCHITECTURAL ISSUES DISCOVERED

### 🔴 Issue #1: Fundamental Data Model Flaw
**PROBLEM**: Staff have a single `department_code` field, conflating WHERE they work with WHAT they can do.

**IMPACT**: 
- Float pool nurses can't be properly represented
- Cross-trained staff (ICU nurse certified for ED) can't work multiple departments
- No skill-based matching for critical positions
- **PATIENT SAFETY RISK**: Unqualified staff could be assigned to specialized roles

**EXAMPLE**:
```javascript
// CURRENT (WRONG)
Nurse: {
  department_code: 'ICU',  // But also works ED and PACU!
  certifications: ['ACLS'] // Just text, no proficiency levels
}

// CORRECT APPROACH
Nurse: {
  home_department: 'ICU',
  working_privileges: [
    { dept: 'ICU', type: 'PRIMARY' },
    { dept: 'ED', type: 'CROSS_TRAINED' },
    { dept: 'PACU', type: 'FLOAT' }
  ],
  competencies: [
    { skill: 'ECMO', level: 'EXPERT', verified: true },
    { skill: 'Pediatric Care', level: 'NOVICE', verified: false }
  ]
}
```

### 🔴 Issue #2: UI/UX Inconsistency Crisis
**PROBLEM**: Buttons have inconsistent sizes, spacing, and behavior across pages.

**EVIDENCE FOUND**:
```javascript
// Admin.jsx lines 67-69
<Button sx={{ mt: 1, mb: 2, mr: 1 }}>  // Inline styles
<Button size="small">                   // Size prop
<Button variant="outlined">             // No size specified

// Result: Three buttons, three different sizes!
```

**IMPACT**:
- Professional credibility compromised
- Touch targets too small on mobile (violates WCAG)
- Buttons cut off on narrow screens
- Inconsistent user experience

### 🔴 Issue #3: Mobile Accessibility Failures
**PROBLEM**: Fixed widths break responsive design

**FOUND IN CODE**:
```javascript
sx={{ minWidth: 320 }}  // Breaks on iPhone SE (320px)
sx={{ minWidth: 280 }}  // Forces horizontal scroll
```

**IMPACT**:
- Healthcare workers can't use app on phones during rounds
- Emergency situations require mobile access
- Night shift staff need one-handed operation

### 🔴 Issue #4: No Skill Validation System
**PROBLEM**: System assigns staff based on availability, not qualifications

**SCENARIO**:
1. ICU needs ECMO specialist → Any ICU nurse assigned ⚠️
2. Pediatric emergency → Adult-only nurse assigned ⚠️
3. Trauma case → No verification of trauma certification ⚠️

### 🛠️ RECOMMENDED ARCHITECTURE OVERHAUL

#### Phase 1: Data Model Reconstruction
```sql
-- Separate concepts properly
CREATE TABLE Staff (
  staff_id UUID PRIMARY KEY,
  home_department_id UUID,  -- Base assignment
  employment_type VARCHAR(20) -- 'REGULAR', 'FLOAT_POOL', 'CONTRACT'
);

CREATE TABLE StaffDepartmentPrivileges (
  staff_id UUID,
  department_id UUID,
  privilege_type VARCHAR(20), -- 'PRIMARY', 'CROSS_TRAINED', 'FLOAT'
  certification_date DATE,
  expires_date DATE
);

CREATE TABLE StaffCompetencies (
  staff_id UUID,
  competency_id UUID,
  proficiency_level VARCHAR(20), -- 'NOVICE', 'COMPETENT', 'EXPERT'
  verified_by UUID,
  verification_date DATE
);

CREATE TABLE ShiftRequirements (
  shift_id UUID,
  competency_id UUID,
  minimum_proficiency VARCHAR(20),
  is_mandatory BIT
);
```

#### Phase 2: Enhanced FCFS Algorithm
```javascript
class EnhancedFCFSScheduler {
  calculateEligibility(staffId, shiftId) {
    // 1. Check department privileges
    if (!hasPrivilege(staffId, shift.department)) {
      return { eligible: false, reason: 'No department access' };
    }
    
    // 2. Validate ALL mandatory competencies
    const requirements = getShiftRequirements(shiftId);
    for (const req of requirements.filter(r => r.is_mandatory)) {
      if (!meetsCompetency(staffId, req)) {
        return { eligible: false, reason: `Missing: ${req.skill}` };
      }
    }
    
    // 3. Score based on competency match
    const score = calculateCompetencyScore(staffId, requirements);
    
    return { eligible: true, score };
  }
}
```

#### Phase 3: UI/UX Standardization
```javascript
// Create consistent component library
const HealthcareButton = styled(Button)(({ theme, priority }) => ({
  minHeight: 44,  // Touch target minimum
  minWidth: 88,   // Material Design standard
  margin: theme.spacing(0.5),
  
  // Priority-based styling
  ...(priority === 'urgent' && {
    backgroundColor: theme.palette.error.main,
    fontWeight: 700,
    animation: 'pulse 2s infinite'
  }),
  
  // Mobile optimization
  '@media (pointer: coarse)': {
    minHeight: 48,
    fontSize: '1.125rem'
  }
}));

// Use everywhere consistently
<HealthcareButton priority="urgent">Emergency Override</HealthcareButton>
<HealthcareButton>Standard Action</HealthcareButton>
```

### 📝 FOR CHATGPT CODEX COLLABORATION

Since this project is being developed with ChatGPT Codex, note:

1. **Use CRITICAL_IMPROVEMENTS_CHATGPT.md** for detailed implementation guide
2. **Test all changes** with the demo data before production
3. **Prioritize safety** - Healthcare errors can be fatal
4. **Follow the phases** - Don't skip data model fixes for UI

### 🎯 Success Criteria

- [ ] Float pool staff can work any department
- [ ] Skills verified before assignment
- [ ] All buttons consistent size/spacing
- [ ] Mobile-first responsive design
- [ ] Touch targets ≥44px
- [ ] WCAG AAA compliance
- [ ] Fatigue rules enforced
- [ ] Audit trail complete