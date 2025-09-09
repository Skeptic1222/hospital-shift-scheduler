#!/bin/bash

echo "Starting Hospital Shift Scheduler..."
echo ""
echo ""
echo "To access the application:"
echo "1. Open your browser"
echo "2. Navigate to http://localhost:3000"
echo ""
echo "Test accounts:"
echo "  Admin: admin@demo.hospital.com / Admin123!"
echo "  Nurse: nurse1@demo.hospital.com / Nurse123!"
echo ""
echo "Starting React development server..."

# Configure absolute public base for dev so requests avoid ports
# Prefer an explicit PUBLIC_IP env, else try WSL nameserver (Windows host)
PUBLIC_IP=${PUBLIC_IP:-}
if [ -z "$PUBLIC_IP" ] && [ -f /etc/resolv.conf ]; then
  PUBLIC_IP=$(grep -m1 '^nameserver' /etc/resolv.conf | awk '{print $2}')
fi
if [ -n "$PUBLIC_IP" ]; then
  export REACT_APP_PUBLIC_BASE="http://$PUBLIC_IP/scheduler"
  echo "Using REACT_APP_PUBLIC_BASE=$REACT_APP_PUBLIC_BASE"
else
  echo "Could not detect Windows host IP. You can set PUBLIC_IP=xxx.xxx.xxx.xxx before running to force it."
fi

export PORT=3000

# Start React development server
npx react-scripts start
