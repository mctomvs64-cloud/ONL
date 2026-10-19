// ============================================================
// SERVIDOR DE TESTE LOCAL — substitui o Netlify CLI
// Roda o site + functions Netlify num unico processo Node
// Uso: node local-dev.js   (http://localhost:8888)
// ============================================================
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8888;

// Carrega .env manualmente
function loadEnv() {
  try {
    const lines = fs.readFileSync('.env', 'utf8').split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const [k, ...rest] = l.split('=');
      if (k) process.env[k.trim()] = rest.join('=').trim();
    }
    console.log('[env] Variáveis carregadas do .env com sucesso');
  } catch(e) { console.warn('[env] .env nao encontrado'); }
}

loadEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.mp4':  'video/mp4',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // ── Functions Netlify dinâmicas ─────────────────────────────
  if (url.startsWith('/.netlify/functions/')) {
    const fnName = url.replace('/.netlify/functions/', '');
    const fnFile = path.join(__dirname, 'netlify', 'functions', `${fnName}.js`);
    
    if (fs.existsSync(fnFile)) {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          delete require.cache[require.resolve(fnFile)];
          const fn = require(fnFile);
          const result = await fn.handler({
            httpMethod: req.method,
            body:       body,
            headers:    req.headers
          }, {});
          res.writeHead(result.statusCode || 200, { 'Content-Type': 'application/json', ...(result.headers || {}) });
          res.end(result.body || '');
        } catch(e) {
          console.error(`[function ${fnName}]`, e);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
  }

  // ── Arquivos estáticos ──────────────────────────────────────
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  if (!path.extname(filePath)) filePath += '.html';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // fallback index.html (SPA)
      fs.readFile(path.join(__dirname, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log('\n  ========================================');
  console.log('  Dev Server Rodando!');
  console.log('  Site:     http://localhost:' + PORT);
  console.log('  Evelyn:   http://localhost:' + PORT + '/evelyn.html');
  console.log('  Admin:    http://localhost:' + PORT + '/adminsupremo.html');
  console.log('  ========================================\n');
});
