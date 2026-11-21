// Stack Viewer local server — zero dependencies (Node 18+).
//   GET /api/stack?id=4015   (or ?id=https://myanimelist.net/stacks/4015)
// Static files come from public/. On Vercel the same API runs as api/stack.js.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getStack, parseStackId } = require('./lib/stack');

const PORT = process.env.PORT || 5177;
const PUBLIC = path.join(__dirname, 'public');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/stack') {
    const sid = parseStackId(url.searchParams.get('id'));
    if (!sid) return json(res, 400, { error: 'Provide a stack id or a myanimelist.net/stacks/<id> URL.' });
    try {
      return json(res, 200, await getStack(sid, url.searchParams.has('refresh')));
    } catch (err) {
      console.error(err);
      return json(res, err.status || 500, { error: err.message });
    }
  }
  // static files
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Stack Viewer → http://localhost:${PORT}/?stack=4015`));
