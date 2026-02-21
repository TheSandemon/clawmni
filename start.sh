#!/bin/bash
echo "=========================================="
echo "Starting Clawmni OS (V2 Architecture)"
echo "=========================================="

echo "Installing dependencies and booting OS..."
npm install && npm run dev

echo "Done! The dashboard should open automatically in your browser shortly..."
echo "Wait a few seconds for Vite to launch the page, or navigate to http://localhost:5173"
