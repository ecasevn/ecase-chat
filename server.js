import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const dataDir = join(rootDir, 'data');
const dataFile = join(dataDir, 'messages.json');
const distDir = join(rootDir, 'dist');
const host = '0.0.0.0';
const port = Number(process.env.PORT || 3001);

mkdirSync(dataDir, { recursive: true });
let messages = readMessages();

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === '/api/messages') {
    if (request.method === 'GET') {
      sendJson(response, 200, messages);
      return;
    }

    if (request.method === 'POST') {
      await addMessage(request, response);
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  serveFrontend(requestUrl.pathname, response);
});

server.listen(port, host, () => {
  console.log(`Chat API listening on http://${host}:${port}`);
});

async function addMessage(request, response) {
  try {
    const body = await readRequestBody(request);
    const payload = JSON.parse(body || '{}');
    const name = cleanName(payload.name) || 'Khách';
    const text = cleanText(payload.text);

    if (!text) {
      sendJson(response, 400, { error: 'Message text is required' });
      return;
    }

    const message = {
      id: randomUUID(),
      name,
      text,
      at: Date.now(),
    };
    messages.push(message);
    saveMessages();
    sendJson(response, 201, message);
  } catch (error) {
    console.error(error);
    sendJson(response, 400, { error: 'Invalid request' });
  }
}

function readMessages() {
  if (!existsSync(dataFile)) return [];
  try {
    const parsed = JSON.parse(readFileSync(dataFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages() {
  writeFileSync(dataFile, `${JSON.stringify(messages, null, 2)}\n`, 'utf8');
}

function readRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('Request body too large'));
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

function serveFrontend(pathname, response) {
  if (!existsSync(distDir)) {
    sendJson(response, 503, { error: 'Run npm run build before npm start' });
    return;
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(distDir, requestedPath));
  if (!filePath.startsWith(`${distDir}/`) || !existsSync(filePath)) {
    sendFile(join(distDir, 'index.html'), response);
    return;
  }
  sendFile(filePath, response);
}

function sendFile(filePath, response) {
  try {
    const contentType = {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
    }[extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(readFileSync(filePath));
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function cleanName(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function cleanText(value) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, 1000);
}
