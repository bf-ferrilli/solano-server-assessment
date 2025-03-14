import express from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000; // Declare port only once

// Serve static files from root directory
app.use(express.static(__dirname));

// Serve files from 'dist' explicitly
app.use('/dist', express.static(join(__dirname, 'dist')));

// JSON parsing middleware
app.use(express.json({ limit: '10mb' }));

// Endpoint for fetching servers.json
app.get('/servers.json', async (req, res) => {
  try {
    const data = await fs.readFile(join(__dirname, 'servers.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error fetching servers.json:', error);
    res.status(500).send('Failed to load servers.json');
  }
});

// Start server on port 3000
const portNumber = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
