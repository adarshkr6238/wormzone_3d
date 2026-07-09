#!/bin/bash

# Wormzone 3D - Multiplayer Server Start Script

echo "============================================"
echo "  Wormzone 3D - Multiplayer Server"
echo "============================================"
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Error: Deno is not installed!"
    echo ""
    echo "Install Deno first:"
    echo "  curl -fsSL https://deno.land/x/install/install.sh | sh"
    echo ""
    exit 1
fi

echo "✅ Deno is installed!"
echo ""

# Start the multiplayer server
echo "🚀 Starting multiplayer server..."
echo ""
echo "🌐 HTTP Server:   http://localhost:8000"
echo "🔗 WebSocket:     ws://localhost:8080"
echo ""
echo "📝 To play:"
echo "   1. Open: http://localhost:8000/multiplayer.html"
echo "   2. Enter your name"
echo "   3. Share the URL with friends!"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

deno run --allow-all multiplayer-server.ts
