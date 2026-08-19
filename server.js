import 'dotenv/config';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendContactEmail, isEmail } from './lib/mailer.js';

// Este servidor es SOLO para desarrollo local (lo abre Iniciar-FaceAuthEdu.bat).
// Sirve los archivos estáticos por http:// (necesario para que la cámara
// funcione) y expone /api/contact localmente para poder probar el correo
// antes de subir el proyecto. En Vercel esto NO se ejecuta: los archivos
// estáticos se sirven solos y /api/contact.js corre como función serverless.
// El registro de personas ya no vive en el servidor — se guarda en el
// navegador (IndexedDB), así que aquí no hace falta ninguna ruta para eso.

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.FACEAUTH_PORT || process.env.PORT || 8000);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.bin': 'application/octet-stream' };

const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('Mensaje demasiado grande.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function api(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/contact') {
    const incoming = await body(req);
    const name = String(incoming.name || '').trim().slice(0, 100);
    const institution = String(incoming.institution || '').trim().slice(0, 120);
    const email = String(incoming.email || '').trim().slice(0, 160);
    const message = String(incoming.message || '').trim().slice(0, 500);
    if (!name || !message) return send(res, 400, { error: 'Completa tu nombre y un mensaje.' });
    if (!isEmail(email)) return send(res, 400, { error: 'Ingresa un correo válido.' });
    try { await sendContactEmail({ name, institution, email, message }); return send(res, 200, { ok: true }); }
    catch (error) { return send(res, 502, { error: error.message }); }
  }
  return send(res, 404, { error: 'Ruta no encontrada.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname);
    const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filename = path.resolve(ROOT, `.${requested}`);
    if (!filename.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Acceso denegado.' });
    const data = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream' }); res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, { error: 'Archivo no encontrado.' });
    console.error(error); return send(res, 500, { error: error.message || 'Error interno.' });
  }
});
server.listen(PORT, () => console.log(`FaceAuthEdu (modo local) disponible en http://localhost:${PORT}`));
