# 🚨 CRITICAL: NO PORTS IN URLS - ENFORCEMENT RULE 🚨

## ⛔ ABSOLUTE RULE: NEVER USE PORTS IN URLS ⛔

**THIS IS THE 20TH VIOLATION - THIS RULE IS NOW MANDATORY**

## URLs MUST BE:
- ✅ Windows: `http://localhost/scheduler` 
- ✅ WSL/Playwright: `http://[internal-ip]/scheduler`
- ❌ NEVER: `http://localhost:3001/scheduler`
- ❌ NEVER: `http://localhost:3000/scheduler`
- ❌ NEVER: Any URL with `:PORT` format

## WHY THIS MATTERS:
1. **IIS Proxy Configuration**: The app runs behind IIS which handles port routing
2. **Production Parity**: Production NEVER uses ports in URLs
3. **Security**: Exposing ports breaks the security model
4. **Consistency**: Mixed port/no-port URLs cause routing failures

## TECHNICAL IMPLEMENTATION:

### Server Configuration (server.js)
```javascript
// ⚠️ CRITICAL: NO PORTS IN URLS - DO NOT MODIFY
// The server listens on PORT 3001 internally
// But ALL URLs must use /scheduler WITHOUT port
// IIS proxies localhost/scheduler -> localhost:3001
```

### Frontend API Calls
```javascript
// ✅ CORRECT - NO PORT
const API_BASE = '/scheduler/api';

// ❌ WRONG - NEVER DO THIS
const API_BASE = 'http://localhost:3001/api';
```

### Environment Variables
```bash
# ✅ CORRECT
REACT_APP_API_BASE_URL=/scheduler/api
PUBLIC_URL=/scheduler

# ❌ WRONG - NEVER USE PORTS
REACT_APP_API_BASE_URL=http://localhost:3001/api
```

## VALIDATION CHECKLIST:
- [ ] No `:3000` anywhere in the codebase
- [ ] No `:3001` anywhere in the codebase  
- [ ] No `:PORT` patterns in any URL
- [ ] All API calls use relative paths `/scheduler/api`
- [ ] Environment variables contain NO ports
- [ ] Test scripts use NO ports

## TESTING:
```bash
# This command MUST return 0 results:
grep -r "localhost:[0-9]" --exclude-dir=node_modules .

# Validate no ports in built files:
grep -r ":[0-9][0-9][0-9][0-9]" build/
```

## CONSEQUENCES OF VIOLATION:
1. Application will fail in production
2. IIS proxy will not route correctly
3. CORS errors will occur
4. Authentication will fail
5. WebSocket connections will break

## REMEMBER:
**🔴 IF YOU SEE A PORT NUMBER IN A URL, STOP AND REMOVE IT 🔴**

---
Last Updated: 2025-09-12
Violations Count: 20
Status: MANDATORY ENFORCEMENT