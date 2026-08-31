#!/bin/bash
# Starts both the backend (port 4000) and frontend (port 5173) and opens the browser.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ -z "$NODE_VERSION" ]; then
  echo "ERROR: Node.js is not installed or not on your PATH."
  echo "Install Node.js 22.5.0 or newer from https://nodejs.org and try again."
  exit 1
fi
echo "Found Node.js $NODE_VERSION"

echo ""
echo "Starting backend on http://localhost:4000 ..."
cd "$DIR/backend" && node server.js &
BACKEND_PID=$!

sleep 1

echo "Starting frontend on http://localhost:5173 ..."
cd "$DIR/frontend" && node serve.js &
FRONTEND_PID=$!

sleep 1

echo ""
echo "=========================================="
echo " Nimbus is running:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:4000"
echo ""
echo " Admin login -> admin@demo.local / Admin123!"
echo ""
echo " Press Ctrl+C to stop both servers."
echo "=========================================="

# Try to open the browser automatically
if command -v open >/dev/null 2>&1; then
  open http://localhost:5173
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5173
fi

# Stop both processes when this script is interrupted
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
