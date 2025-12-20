const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;
const DATA_FILE = path.join(BASE_DIR, 'data.json');

// Initialize data.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    try {
        fs.writeFileSync(DATA_FILE, '{}', 'utf8');
    } catch (e) {
        console.error('Error creating data.json:', e);
    }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function safeJoin(base, target) {
  const targetPath = path.posix.normalize(target);
  const joinedPath = path.join(base, targetPath);
  if (!joinedPath.startsWith(base)) {
    return null;
  }
  return joinedPath;
}

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // API Endpoints
    if (pathname === '/api/data') {
        if (req.method === 'GET') {
            fs.readFile(DATA_FILE, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading data file:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Error reading data' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data || '{}');
            });
            return;
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const updateData = JSON.parse(body);
                    // Read current data to merge
                    fs.readFile(DATA_FILE, 'utf8', (err, currentDataStr) => {
                        let currentData = {};
                        if (!err && currentDataStr) {
                            try { currentData = JSON.parse(currentDataStr); } catch (e) {}
                        }
                        
                        // Merge logic: keys in updateData overwrite currentData
                        const newData = { ...currentData, ...updateData };
                        
                        // Write back
                        fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8', (err) => {
                            if (err) {
                                console.error('Error writing data file:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ error: 'Error writing data' }));
                            }
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        });
                    });
                } catch (e) {
                    console.error('Invalid JSON in POST:', e);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // Default to index.html for root or directory paths
    if (!pathname || pathname === '/' || pathname.endsWith('/')) {
      pathname = '/index.html';
    }

    const filePath = safeJoin(BASE_DIR, pathname);
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bad Request');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    console.error('Server Error:', e);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
