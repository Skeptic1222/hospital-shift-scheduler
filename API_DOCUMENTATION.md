# Hospital Shift Scheduler API Documentation

## Base URL
```
Production: https://api.hospital-scheduler.com
Development: http://localhost:3001
```

## Authentication
All API requests require authentication via JWT Bearer token from Auth0.

### Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
X-Hospital-ID: <hospital-uuid>
```

## Rate Limiting
- 100 requests per minute for standard endpoints
- 10 requests per minute for resource-intensive operations
- 429 status code when limit exceeded

## API Endpoints

### Authentication

#### POST /api/auth/login
```javascript
// Request
{
  "email": "user@hospital.com",
  "password": "SecurePassword123!",
  "mfa_token": "123456" // Required after initial auth
}

// Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "rtk_...",
  "expires_in": 900,
  "user": {
    "id": "uuid",
    "email": "user@hospital.com",
    "role": "nurse",
    "hospitalId": "uuid",
    "departmentId": "uuid"
  }
}
```

#### POST /api/auth/refresh
```javascript
// Request
{
  "refresh_token": "rtk_..."
}

// Response
{
  "access_token": "eyJhbGc...",
  "expires_in": 900
}
```

#### POST /api/auth/logout
```javascript
// Request
{
  "everywhere": false // Optional: logout from all devices
}

// Response
{
  "success": true
}
```

### Shifts

#### GET /api/shifts
Get shifts with filtering options.

```javascript
// Query Parameters
?date=2024-01-15
&department_id=uuid
&status=open|filled|cancelled
&assigned_to=user_uuid
&page=1
&limit=50

// Response
{
  "shifts": [{
    "id": "uuid",
    "date": "2024-01-15",
    "start_time": "07:00:00",
    "end_time": "19:00:00",
    "department": {
      "id": "uuid",
      "name": "Emergency"
    },
    "status": "open",
    "required_staff": 5,
    "assigned_staff": 3,
    "assignments": [{
      "user_id": "uuid",
      "name": "Jane Doe",
      "status": "confirmed"
    }]
  }],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 120
  }
}
```

#### POST /api/shifts
Create a new shift.

```javascript
// Request
{
  "template_id": "uuid", // Optional
  "department_id": "uuid",
  "date": "2024-01-15",
  "start_time": "07:00:00",
  "end_time": "19:00:00",
  "required_staff": 5,
  "required_skills": ["ACLS", "PALS"],
  "notes": "Holiday coverage needed"
}

// Response
{
  "id": "uuid",
  "created": true,
  "shift": { /* shift object */ }
}
```

#### PUT /api/shifts/:id
Update shift details.

```javascript
// Request
{
  "required_staff": 6,
  "notes": "Updated requirements"
}

// Response
{
  "updated": true,
  "shift": { /* updated shift object */ }
}
```

#### DELETE /api/shifts/:id
Cancel a shift (soft delete).

```javascript
// Response
{
  "cancelled": true,
  "notifications_sent": 5
}
```

### FCFS Queue System

#### POST /api/queue/open-shift
Post a shift for FCFS distribution.

```javascript
// Request
{
  "shift_id": "uuid",
  "reason": "Staff called out sick",
  "urgency_level": 4, // 1-5
  "expires_in_hours": 24
}

// Response
{
  "success": true,
  "open_shift_id": "uuid",
  "queue_size": 15,
  "first_window_start": "2024-01-15T10:00:00Z"
}
```

#### POST /api/queue/respond
Respond to a shift offer.

```javascript
// Request
{
  "queue_entry_id": "uuid",
  "response": "accepted" // or "declined"
}

// Response
{
  "success": true,
  "shift_assigned": true,
  "confirmation": {
    "shift_id": "uuid",
    "start_time": "2024-01-15T07:00:00Z",
    "department": "Emergency"
  }
}
```

#### GET /api/queue/status/:openShiftId
Get current queue status.

```javascript
// Response
{
  "queue_size": 15,
  "current_window": {
    "user": "Jane Doe",
    "position": 3,
    "expires_at": "2024-01-15T10:15:00Z"
  },
  "your_position": 5, // null if not in queue
  "estimated_wait": 60 // minutes
}
```

### Notifications

#### GET /api/notifications
Get user notifications.

```javascript
// Query Parameters
?status=unread|read|all
&type=shift|alert|message
&limit=20
&offset=0

// Response
{
  "notifications": [{
    "id": "uuid",
    "type": "shift_available",
    "priority": 5,
    "subject": "Urgent: Open Shift Available",
    "body": "Emergency Department needs coverage",
    "data": {
      "shift_id": "uuid",
      "action_url": "/shifts/respond/uuid"
    },
    "created_at": "2024-01-15T10:00:00Z",
    "read_at": null
  }],
  "unread_count": 3
}
```

#### PUT /api/notifications/:id/read
Mark notification as read.

```javascript
// Response
{
  "marked_read": true
}
```

#### POST /api/notifications/subscribe
Subscribe to push notifications.

```javascript
// Request
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "types": ["shift_available", "schedule_change"]
}

// Response
{
  "subscribed": true
}
```

### Schedule Management

#### GET /api/schedule
Get schedule view.

```javascript
// Query Parameters
?start_date=2024-01-15
&end_date=2024-01-21
&department_id=uuid
&user_id=uuid
&view=week|month|day

// Response
{
  "schedule": {
    "2024-01-15": [{
      "shift_id": "uuid",
      "start": "07:00",
      "end": "19:00",
      "department": "ICU",
      "staff": ["uuid1", "uuid2"]
    }],
    "2024-01-16": [/* shifts */]
  },
  "stats": {
    "total_hours": 120,
    "overtime_hours": 8,
    "coverage_percentage": 95
  }
}
```

#### POST /api/schedule/swap
Request shift swap.

```javascript
// Request
{
  "my_shift_id": "uuid",
  "target_shift_id": "uuid",
  "reason": "Family emergency"
}

// Response
{
  "swap_request_id": "uuid",
  "status": "pending",
  "requires_approval": true
}
```

### User Management

#### GET /api/users/profile
Get current user profile.

```javascript
// Response
{
  "id": "uuid",
  "email": "nurse@hospital.com",
  "name": "Jane Doe",
  "role": "nurse",
  "department": {
    "id": "uuid",
    "name": "ICU"
  },
  "certifications": ["BLS", "ACLS"],
  "preferences": {
    "preferred_shifts": ["morning"],
    "max_hours_per_week": 40,
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    }
  },
  "stats": {
    "hours_this_week": 32,
    "fatigue_score": 45,
    "consecutive_days": 3
  }
}
```

#### PUT /api/users/preferences
Update user preferences.

```javascript
// Request
{
  "preferred_shifts": ["evening", "night"],
  "notifications": {
    "email": false,
    "push": true
  }
}

// Response
{
  "updated": true
}
```

### Analytics & Reporting

#### GET /api/analytics/dashboard
Get dashboard metrics.

```javascript
// Response
{
  "metrics": {
    "shifts_today": 45,
    "open_shifts": 3,
    "staff_on_duty": 120,
    "fill_rate": 97.5,
    "avg_response_time": 8.5, // minutes
    "overtime_hours": 145
  },
  "trends": {
    "fill_rate_7d": [95, 96, 97, 98, 97, 96, 97.5],
    "overtime_7d": [120, 130, 125, 140, 135, 150, 145]
  },
  "alerts": [{
    "type": "high_fatigue",
    "count": 3,
    "department": "Emergency"
  }]
}
```

#### GET /api/analytics/reports
Generate reports.

```javascript
// Query Parameters
?type=staffing|overtime|compliance|fatigue
&start_date=2024-01-01
&end_date=2024-01-31
&department_id=uuid
&format=json|csv|pdf

// Response (JSON format)
{
  "report": {
    "type": "staffing",
    "period": "2024-01-01 to 2024-01-31",
    "data": {
      "total_shifts": 1200,
      "filled_shifts": 1170,
      "fill_rate": 97.5,
      "by_department": {
        "Emergency": { /* stats */ },
        "ICU": { /* stats */ }
      }
    }
  }
}
```

### WebSocket Events

Connect to WebSocket for real-time updates:
```javascript
const socket = io('wss://api.hospital-scheduler.com', {
  auth: { token: 'Bearer <token>' }
});

// Listen for events
socket.on('shift:new', (data) => {
  // New shift available
});

socket.on('shift:filled', (data) => {
  // Shift has been filled
});

socket.on('notification', (data) => {
  // New notification
});

socket.on('metrics:update', (data) => {
  // Real-time metrics update
});

socket.on('presence:update', (data) => {
  // User presence update
});
```

## Error Responses

### Standard Error Format
```javascript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [{
      "field": "email",
      "message": "Invalid email format"
    }],
    "request_id": "req_123456"
  }
}
```

### Error Codes
- `400` - Bad Request
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `409` - Conflict (e.g., shift already assigned)
- `422` - Unprocessable Entity (validation error)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

## Integration Endpoints

### Webhook Configuration
Configure webhooks for external system integration:

```javascript
POST /api/integrations/webhooks
{
  "url": "https://your-system.com/webhook",
  "events": ["shift.created", "shift.filled", "shift.cancelled"],
  "secret": "webhook_secret_key"
}
```

### Bulk Import
Import data from existing systems:

```javascript
POST /api/integrations/import
{
  "type": "users|shifts|schedules",
  "format": "csv|json",
  "data": "base64_encoded_data"
}
```

### Export Data
Export data for backup or migration:

```javascript
GET /api/integrations/export
?type=full|incremental
&from_date=2024-01-01
&format=json|csv
```

## HIPAA Compliance Notes

1. All endpoints log access to audit trail
2. PHI is never included in URLs
3. All responses are encrypted with TLS 1.3
4. Session timeout after 15 minutes of inactivity
5. MFA required for all user accounts
6. Rate limiting prevents brute force attacks
7. All timestamps in UTC ISO 8601 format

## SDK Examples

### JavaScript/Node.js
```javascript
const SchedulerAPI = require('@hospital-scheduler/sdk');

const api = new SchedulerAPI({
  apiKey: process.env.API_KEY,
  hospitalId: process.env.HOSPITAL_ID
});

// Get open shifts
const shifts = await api.shifts.list({ status: 'open' });

// Accept shift offer
const result = await api.queue.respond({
  queueEntryId: 'uuid',
  response: 'accepted'
});
```

### Python
```python
from hospital_scheduler import SchedulerAPI

api = SchedulerAPI(
    api_key=os.environ['API_KEY'],
    hospital_id=os.environ['HOSPITAL_ID']
)

# Get schedule
schedule = api.schedule.get(
    start_date='2024-01-15',
    end_date='2024-01-21'
)

# Post open shift
result = api.queue.post_open_shift(
    shift_id='uuid',
    urgency_level=4
)
```

## Support

- API Status: https://status.hospital-scheduler.com
- Documentation: https://docs.hospital-scheduler.com
- Support Email: api-support@hospital-scheduler.com
- Rate Limit Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset