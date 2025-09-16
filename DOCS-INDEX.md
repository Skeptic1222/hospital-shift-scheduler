# Hospital Scheduler Documentation Index

## Core Documentation Structure

### 📚 Essential Guides
- **[README.md](README.md)** - Complete project overview, tech stack, and configuration
- **[CLAUDE.md](CLAUDE.md)** - AI assistant configuration and development guidelines
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference with endpoints and examples

### 🚀 Setup & Installation
- **[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)** - Comprehensive setup including IIS, SQL Server, OAuth
- **[README-QUICK-START.md](README-QUICK-START.md)** - Quick start guide for rapid deployment
- **[IIS_SETUP.md](IIS_SETUP.md)** / **[IIS_PROXY_SETUP.md](IIS_PROXY_SETUP.md)** - IIS configuration and proxy setup
- **[SQL_SERVER_SETUP_INSTRUCTIONS.md](SQL_SERVER_SETUP_INSTRUCTIONS.md)** - Database installation and configuration
- **[GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md)** - OAuth authentication setup

### 🧪 Testing & Development
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Complete testing procedures and standards
- **[E2E-TEST-PLAN.md](E2E-TEST-PLAN.md)** - End-to-end test planning and execution
- **[AGENTS.md](AGENTS.md)** - Development agent guidelines and best practices
- **Test Structure**: `src/__tests__/` organized by unit/integration/ui/e2e

### 🔧 Operations & Deployment
- **[OPERATIONS_GUIDE.md](OPERATIONS_GUIDE.md)** - Production deployment, monitoring, maintenance
- **[FINAL_STATUS_REPORT.md](FINAL_STATUS_REPORT.md)** - Current project status and metrics
- **web.config** - Authoritative IIS configuration with proxy rules

### 🏗️ Architecture
- **[SITE-ARCHITECTURE.md](SITE-ARCHITECTURE.md)** - System architecture and design patterns
- **[NO-PORT-ABSOLUTE-RULE.md](NO-PORT-ABSOLUTE-RULE.md)** - Critical: Never use ports in URLs

### 🔒 Security & Compliance
- **[HIPAA_COMPLIANCE_FRAMEWORK.md](HIPAA_COMPLIANCE_FRAMEWORK.md)** - HIPAA requirements and implementation
- **[SECURITY_IMPLEMENTATION_SUMMARY.md](SECURITY_IMPLEMENTATION_SUMMARY.md)** - Security measures and status

## Critical Notes

⚠️ **NO PORTS IN URLs** - All URLs must use `/scheduler` path prefix. IIS handles internal routing.

⚠️ **NO DEMO MODE** - This is a production-only application. Never add mock data or bypass mechanisms.

## Archived Documentation

Historical documentation moved to `docs/archive/`:
- Code review reports
- Implementation summaries
- Debug analyses
- Historical status reports
- Fix documentation

## Quick Navigation by Role

### For New Developers
1. [README.md](README.md) → [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)
2. [TESTING_GUIDE.md](TESTING_GUIDE.md) → [AGENTS.md](AGENTS.md)
3. [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

### For DevOps/Operations
1. [OPERATIONS_GUIDE.md](OPERATIONS_GUIDE.md)
2. [IIS_SETUP.md](IIS_SETUP.md) / [IIS_PROXY_SETUP.md](IIS_PROXY_SETUP.md)
3. [SQL_SERVER_SETUP_INSTRUCTIONS.md](SQL_SERVER_SETUP_INSTRUCTIONS.md)

### For Security/Compliance
1. [HIPAA_COMPLIANCE_FRAMEWORK.md](HIPAA_COMPLIANCE_FRAMEWORK.md)
2. [SECURITY_IMPLEMENTATION_SUMMARY.md](SECURITY_IMPLEMENTATION_SUMMARY.md)

## Maintenance
- Review quarterly for accuracy
- Update after major releases
- Archive outdated content to `docs/archive/`
- Keep this index synchronized with actual files
