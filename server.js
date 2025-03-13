// server.js - Node.js Express Server
// This is the SERVER-SIDE code that runs with Node.js

import express from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bodyParser from 'body-parser';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json({ limit: '10mb' }));

// Endpoint to save the JSON file
app.post('/api/save-mappings', async (req, res) => {
  try {
    // Get the JSON data from the request body
    const mappingsData = req.body;
    
    // Write the data to the file - using correct filename with hyphen
    await fs.writeFile(
      join(__dirname, 'server-mappings.json'), 
      JSON.stringify(mappingsData, null, 2)
    );
    
    res.json({ success: true, message: 'Mappings saved successfully' });
  } catch (error) {
    console.error('Error saving mappings:', error);
    res.status(500).json({ success: false, message: 'Failed to save mappings', error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`- Access application at: http://localhost:${port}/`);
  console.log(`- JSON file will be saved as: ${join(__dirname, 'server-mappings.json')}`);
});
