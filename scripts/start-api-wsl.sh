#!/usr/bin/env bash
# Starts the Node API from WSL, binding to all interfaces so IIS/Windows can reach it.
# Requires SQL auth to be configured in .env or environment variables.

set -euo pipefail

# Determine Windows host IP from WSL
export WIN_HOST_IP=$(awk '/nameserver/ {print $2; exit}' /etc/resolv.conf)

# Defaults
export PORT="${PORT:-3001}"
export NODE_ENV="${NODE_ENV:-development}"
export USE_WINDOWS_AUTH="false"

# SQL auth recommended from WSL. Ensure DB_USER and DB_PASSWORD are set.
# Point DB_SERVER to Windows host; SQL Server Express listens on 1433 (per audit).
export DB_SERVER="${DB_SERVER:-$WIN_HOST_IP}"
export DB_ENCRYPT="${DB_ENCRYPT:-true}"
export DB_TRUST_SERVER_CERT="${DB_TRUST_SERVER_CERT:-true}"

echo "WIN_HOST_IP=$WIN_HOST_IP"
echo "Starting Node API on :$PORT (host 0.0.0.0) ..."
node server.js

