# Create Shift Feature - Setup Guide

## ✅ Current Status

The Create Shift button and dialog have been successfully added to the Admin page. However, to use this feature, proper authentication and authorization must be configured.

## 🔑 Authentication Requirements

This application **REQUIRES**:
1. **Google OAuth authentication** - Users must sign in with Google
2. **Database role assignment** - Users must have admin/supervisor role in the database
3. **Live database connection** - No demo/mock modes are allowed per client requirements

## 📝 Setup Instructions

### 1. Database Role Configuration

Run the provided SQL script to set up admin roles:

```bash
# Using SQL Server Management Studio or sqlcmd:
sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -i fix-admin-role.sql
```

This script will:
- Create admin and supervisor roles if they don't exist
- Create an admin user with email `admin@hospital.com`
- Create a supervisor user with email `supervisor@hospital.com`

### 2. Google OAuth Configuration

Ensure the following environment variables are set:

```bash
# In .env file:
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. User Role Assignment

To grant a specific Google user admin privileges:

```sql
USE HospitalScheduler;

-- Find or create user
DECLARE @UserId UNIQUEIDENTIFIER;
SELECT @UserId = id FROM scheduler.users WHERE email = 'user@gmail.com';

IF @UserId IS NULL
BEGIN
    INSERT INTO scheduler.users (id, employee_id, email, first_name, last_name, is_active)
    VALUES (NEWID(), 'EMP###', 'user@gmail.com', 'First', 'Last', 1);
    SELECT @UserId = id FROM scheduler.users WHERE email = 'user@gmail.com';
END

-- Assign admin role
DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT @AdminRoleId = id FROM scheduler.roles WHERE name = 'admin';

UPDATE scheduler.users
SET role_id = @AdminRoleId
WHERE id = @UserId;
```

## 🚀 How It Works

1. **UI Layer** (Admin.jsx):
   - Shows "Create Shift" button for authorized users
   - Opens CreateShiftDialog when clicked

2. **Dialog Component** (CreateShiftDialog.jsx):
   - Collects shift details (date, time, department, staff count)
   - Uses `apiFetch` for unified API communication
   - Sends POST request to `/api/shifts`

3. **API Layer** (routes/shifts.js):
   - Validates Google OAuth token
   - Checks user has admin/supervisor role in database
   - Creates shift record if authorized

## 🔍 Troubleshooting

### Button Appears But Nothing Happens

**Issue**: The Create Shift button is visible but clicking does nothing.

**Cause**: Frontend shows button based on local role hints, but server rejects the request.

**Solution**:
1. Check browser DevTools Network tab for `/api/shifts` request
2. Look at response status:
   - **401**: Google authentication failed
   - **403**: User lacks admin/supervisor role in database
   - **503**: Database not connected

### Common Error Codes

| Status | X-Error-Code | Meaning | Solution |
|--------|--------------|---------|----------|
| 401 | - | Unauthorized | Sign in with Google |
| 403 | - | Forbidden | Assign admin/supervisor role in DB |
| 503 | REPOSITORIES_MISSING | DB not ready | Check SQL Server connection |
| 404 | - | Route not found | Check IIS proxy configuration |

## 🔒 Security Notes

- **NO DEMO MODE**: Per client requirements, this application does not support demo/mock authentication
- **Production Only**: The app requires real Google OAuth and database authentication
- **Role-Based Access**: Only users with admin/supervisor roles in the database can create shifts

## 📊 Code Changes Summary

### Files Modified:
1. **src/pages/Admin.jsx**:
   - Added Create Shift button with icon
   - Integrated CreateShiftDialog component
   - Added state management for dialog

2. **src/pages/Schedule.jsx**:
   - Updated to trust only server authorization in production
   - Prevents showing unusable buttons

3. **src/components/CreateShiftDialog.jsx**:
   - Updated to use `apiFetch` instead of raw fetch
   - Properly integrates with Google OAuth

### Database Script:
- **fix-admin-role.sql**: Sets up roles and admin users

## ✨ Next Steps

1. **For Development**:
   - Ensure SQL Server Express is running
   - Run the admin role setup script
   - Configure Google OAuth credentials
   - Sign in with a Google account that has admin role in DB

2. **For Production**:
   - Deploy to IIS with proper web.config
   - Ensure production database has roles configured
   - Verify Google OAuth is set up for production domain
   - Assign appropriate roles to authorized users

## 📚 References

- ChatGPT's analysis correctly identified the root cause
- The solution implements all three recommended fixes:
  - A. Database role assignment (SQL script)
  - B. UI authorization trust (Schedule.jsx update)
  - C. Unified API calls (CreateShiftDialog update)