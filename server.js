const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    return;
  }

  // Serve static files (images for stamps)
  if (req.method === 'GET' && req.url.match(/\.(png|jpg|jpeg)$/i)) {
    const filePath = path.join(__dirname, req.url);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(req.url).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // Generate PDF
  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let tmpDir;
      try {
        const { tex, filename, images } = JSON.parse(body);
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gongmun-'));
        const texFile = path.join(tmpDir, 'document.tex');
        
        // Write tex file
        fs.writeFileSync(texFile, tex);
        
        // Write uploaded images to temp dir
        if (images) {
          for (const [name, base64] of Object.entries(images)) {
            if (base64) fs.writeFileSync(path.join(tmpDir, name), Buffer.from(base64, 'base64'));
          }
        }

        // Compile with xelatex (better Korean support)
        try {
          execSync(`cd "${tmpDir}" && xelatex -interaction=nonstopmode document.tex`, {
            timeout: 30000,
            stdio: 'pipe'
          });
        } catch (e) {
          // Try pdflatex as fallback
          execSync(`cd "${tmpDir}" && pdflatex -interaction=nonstopmode document.tex`, {
            timeout: 30000,
            stdio: 'pipe'
          });
        }

        const pdfPath = path.join(tmpDir, 'document.pdf');
        if (fs.existsSync(pdfPath)) {
          const pdf = fs.readFileSync(pdfPath);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename || 'gongmun.pdf'}"`
          });
          res.end(pdf);
          
          // Cleanup
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } else {
          throw new Error('PDF generation failed');
        }
      } catch (err) {
        // Read LaTeX log for detailed error
        if (tmpDir) {
          const logPath = path.join(tmpDir, 'document.log');
          if (fs.existsSync(logPath)) {
            console.error('LaTeX log:\n', fs.readFileSync(logPath, 'utf8').slice(-2000));
          }
        }
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
