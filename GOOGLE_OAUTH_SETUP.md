# Google OAuth Setup Guide

## Problem: Error 401: invalid_client

This error occurs when the Google Client ID is not properly configured in Google Cloud Console.

## Complete Setup Instructions

### Step 1: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - App name: Hospital Scheduler
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users if in testing mode

### Step 3: Create OAuth 2.0 Client ID

1. Go back to **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Select **Web application**
4. Configure:
   - Name: Hospital Scheduler Web Client
   - Authorized JavaScript origins:
     ```
     http://localhost
     http://localhost/scheduler
     http://YOUR_DOMAIN
     ```
   - Authorized redirect URIs (not needed for implicit flow but add anyway):
     ```
     http://localhost/scheduler
     http://YOUR_DOMAIN
     ```
5. Click **CREATE**
6. Copy the Client ID

### Step 4: Update Application Configuration

1. Edit `.env` file:
   ```bash
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   REACT_APP_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
   ```

2. Set authentication mode:
   ```bash
   # For production with real Google OAuth
   # Demo mode not supported
   
   # For development/testing without Google
   # Demo mode not supported
   ```

### Step 5: Common Issues and Solutions

#### Issue: "Error 401: invalid_client"
**Causes:**
- Client ID doesn't exist
- Wrong Client ID copied
- JavaScript origins not configured
- OAuth consent screen not configured

**Solution:**
1. Verify Client ID matches exactly
2. Check all origins are added
3. Wait 5-10 minutes for Google to propagate changes
4. Clear browser cache

#### Issue: "Access blocked: This app's request is invalid"
**Cause:** Redirect URI mismatch
**Solution:** Add exact URL including port to authorized redirect URIs

#### Issue: "Sign in with Google temporarily disabled for this app"
**Cause:** OAuth consent screen not verified
**Solution:** Add test users or publish app (requires review)

### Step 6: Testing

1. With real Google OAuth:
   ```bash
   # Set in .env
   SKIP_EXTERNALS=false
   DEMO_MODE=false
   
   # Restart server
   npm start
   ```

2. With demo mode (no Google required):
   ```bash
   # Set in .env
   SKIP_EXTERNALS=true
   DEMO_MODE=true
   
   # Restart server
   npm start
   ```

### Step 7: Production Deployment

1. Add production domain to authorized origins
2. Update `.env` with production values
3. Consider using environment-specific configs
4. Enable API restrictions for security

## Quick Fix for Development

If you just want to get the app working without Google OAuth:

```bash
# Edit .env
SKIP_EXTERNALS=true
DEMO_MODE=true

# Restart server
npm start
```

Demo mode is not supported. Use real authentication and dependencies.

## Security Considerations

1. **Never commit** `.env` file with real credentials
2. **Restrict API key** to specific domains in production
3. **Use HTTPS** in production for OAuth
4. **Rotate credentials** regularly
5. **Monitor usage** in Google Cloud Console

## Verification Script

Run this to verify your setup:

```bash
# Check if environment variables are set
grep "GOOGLE_CLIENT_ID" .env

# Test Google OAuth endpoint
curl -I "https://accounts.google.com/gsi/client"

# Verify client ID format (should be NUMBER-STRING.apps.googleusercontent.com)
echo $GOOGLE_CLIENT_ID | grep -E "^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$"
```
