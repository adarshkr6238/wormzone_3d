// Wormzone 3D - Deno Server
// Static file server for the 3D Snake game
// Deploy this to Deno Deploy

import { serveDir } from "https://deno.land/std/http/file_server.ts";

const PORT = parseInt(Deno.env.get("PORT") || "3000");
const HOST = "0.0.0.0";

console.log(`
🚀 Snake 3D (Wormzone) is starting on Deno...
----------------------------------------
Local:   http://localhost:${PORT}
Network: http://${HOST}:${PORT}

Press Ctrl+C to stop.
`);

// Serve static files from the public directory
await serveDir({
  fsRoot: "./public",
  port: PORT,
  hostname: HOST,
});
