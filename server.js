const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Snake 3D is running!
-----------------------
Local:   http://localhost:${PORT}
Network: http://<your-phone-ip>:${PORT} (Use this on your phone's browser)

Press Ctrl+C to stop.
    `);
});
