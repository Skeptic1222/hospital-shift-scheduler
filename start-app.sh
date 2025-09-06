#!/bin/bash

echo "Starting Hospital Shift Scheduler..."
echo ""
echo "Backend server is already running on http://localhost:3001"
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

# Set environment variables
export REACT_APP_API_BASE=http://localhost:3001
export REACT_APP_SOCKET_URL=http://localhost:3001
export PORT=3000

# Start React development server
npx react-scripts start