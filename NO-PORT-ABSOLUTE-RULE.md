# ⚠️ CRITICAL: ABSOLUTE NO-PORT RULE FOR ALL PROJECTS ⚠️

## THIS IS A PERMANENT, NON-NEGOTIABLE RULE

### 🚫 NEVER USE PORTS IN URLs - EVER! 🚫

This rule applies to:
- ✅ This project (Hospital Scheduler)
- ✅ ALL other projects
- ✅ Development environments
- ✅ Production environments
- ✅ Test environments
- ✅ Documentation
- ✅ Comments in code
- ✅ Configuration files
- ✅ EVERYWHERE!

## THE RULE

### ❌ NEVER DO THIS (THESE ARE ALL WRONG):
```
http://localhost:3001
http://localhost:3000
http://127.0.0.1:8080
https://example.com:443
http://mysite:5000
ANY_URL:ANY_PORT
```

### ✅ ALWAYS DO THIS (CORRECT):
```
http://localhost
http://localhost/scheduler
https://example.com
http://mysite
/api/endpoint (relative)
```

## WHY THIS RULE EXISTS

1. **IIS/Reverse Proxy Handles Ports**: The web server (IIS, nginx, Apache) manages port routing internally
2. **Security**: Exposing ports reveals infrastructure details
3. **Flexibility**: URLs work regardless of internal port changes
4. **Best Practice**: Industry standard for production applications
5. **User Experience**: Clean URLs without port numbers

## HOW IT WORKS

The server runs on a port internally (e.g., 3001) but:
- IIS/nginx receives requests on standard ports (80/443)
- Reverse proxy forwards to the Node.js application port
- Users NEVER see or use the internal port
- All URLs are clean without port numbers

## ENFORCEMENT

### For Claude Code / AI Assistants:
- **NEVER** suggest URLs with ports
- **NEVER** write code with ports in URLs
- **ALWAYS** use relative paths or portless URLs
- **ALWAYS** remind about this rule when reviewing code

### For Developers:
- Code reviews MUST reject any URL with ports
- Tests MUST fail if ports are detected in URLs
- CI/CD pipelines should scan for port violations

## EXAMPLES IN CODE

### ❌ WRONG - NEVER DO THIS:
```javascript
// WRONG - Has port
const API_URL = 'http://localhost:3001/api';
fetch('http://localhost:3001/api/users');
window.location.href = 'http://localhost:3000';
```

### ✅ CORRECT - ALWAYS DO THIS:
```javascript
// CORRECT - No port
const API_URL = '/api';  // Relative
fetch('/api/users');     // Relative
window.location.href = '/scheduler';  // Relative

// Or with full URL but NO PORT
const API_URL = 'http://localhost/api';
fetch('http://localhost/api/users');
```

## PERMANENT REMINDERS

1. **Before writing ANY URL**: Ask "Does this have a port?" If yes, remove it!
2. **Before suggesting code**: Check for `:3000`, `:3001`, `:8080`, etc.
3. **When reviewing**: Search for `:` followed by numbers in URLs
4. **In documentation**: Never include ports in example URLs

## THIS RULE IS ABSOLUTE

- No exceptions
- No "just for testing"
- No "temporary" port usage
- No ports in development
- No ports in production
- NO PORTS EVER!

---

**Last Updated**: 2025-09-12
**Status**: PERMANENT RULE - NEVER TO BE VIOLATED
**Enforcement Level**: CRITICAL - IMMEDIATE CORRECTION REQUIRED