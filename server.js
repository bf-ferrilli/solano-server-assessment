import express from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use('/dist', express.static(join(__dirname, 'dist')));
app.use(express.json({ limit: '10mb' }));

let apiCache = {
  'windows-server': { data: null, timestamp: 0 },
  'rhel': { data: null, timestamp: 0 },
  'ubuntu': { data: null, timestamp: 0 },
  'oracle-linux': { data: null, timestamp: 0 }
};
const CACHE_TTL = 24 * 60 * 60 * 1000;

app.get('/servers.json', async (req, res) => {
  try {
    const data = await fs.readFile(join(__dirname, 'servers.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error fetching servers.json:', error);
    res.status(500).send('Failed to load servers.json');
  }
});

app.get('/api/lifecycle/:os', async (req, res) => {
  const os = req.params.os;
  
  try {
    if (apiCache[os] && apiCache[os].data && 
        (Date.now() - apiCache[os].timestamp < CACHE_TTL)) {
      return res.json(apiCache[os].data);
    }
    
    const response = await fetch(`https://endoflife.date/api/${os}.json`);
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    apiCache[os] = {
      data,
      timestamp: Date.now()
    };
    
    res.json(data);
  } catch (error) {
    console.error(`Error fetching lifecycle data for ${os}:`, error);
    res.status(500).json({ error: 'Failed to fetch lifecycle data' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
