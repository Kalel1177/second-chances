// Local browser preview only. Supabase and third-party downloads are removed.
// Run: node tests/preview-server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const preview = original
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/[^\"]+"><\/script>/, '')
  .replace(/<link[^>]+https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
  .replace(/SUPABASE_URL:\s*"[^"]*"/, 'SUPABASE_URL:""')
  .replace(/SUPABASE_ANON_KEY:\s*"[^"]*"/, 'SUPABASE_ANON_KEY:""');
const server = http.createServer((req, res) => {
  if(req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(preview);
});
server.listen(43127, '127.0.0.1', () => console.log('Isolated demo preview: http://127.0.0.1:43127 (no Supabase connection)'));
