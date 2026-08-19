import 'dotenv/config';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data', 'people');
const PORT = Number(process.env.FACEAUTH_PORT || process.env.PORT || 8000);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.bin': 'application/octet-stream' };

const slug = value => (value || 'persona').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'persona';
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const safeId = id => /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

/* ---- Correo automático (Gmail vía nodemailer) ---- */
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return transporter;
}

async function sendContactEmail({ name, institution, email, message }) {
  const t = getTransporter();
  if (!t) throw new Error('El envío de correos no está configurado en el servidor. Define GMAIL_USER y GMAIL_APP_PASSWORD en el archivo .env (revisa el README).');
  const from = `"FaceAuthEdu" <${process.env.GMAIL_USER}>`;

  await t.sendMail({
    from, to: email, replyTo: process.env.GMAIL_USER,
    subject: 'Gracias por tu interés en FaceAuthEdu',
    text: `Hola ${name}:\n\nGracias por escribirnos${institution ? ' desde ' + institution : ''}. Recibimos tu mensaje:\n"${message}"\n\nFaceAuthEdu es un sistema de verificación biométrica facial que corre en el navegador (face-api.js / TensorFlow.js), con registro y comparación de rostros en tiempo real.\n\nTe contactaremos pronto por este correo. También puedes escribirnos:\n- WhatsApp: https://wa.me/51951175185\n- Instagram: https://instagram.com/faceauthedu\n\n— Equipo FaceAuthEdu`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#e91664;margin-bottom:4px">FaceAuth<span style="color:#111">Edu</span></h2>
      <p>Hola <b>${name}</b>:</p>
      <p>Gracias por escribirnos${institution ? ' desde <b>' + institution + '</b>' : ''}. Este es un resumen de tu mensaje:</p>
      <blockquote style="border-left:3px solid #e91664;margin:12px 0;padding:8px 14px;color:#444;background:#fff6f9">${message}</blockquote>
      <p>Te contactaremos pronto a este correo. También puedes escribirnos directamente:</p>
      <p>
        <a href="https://wa.me/51951175185" style="color:#e91664;font-weight:700;text-decoration:none">WhatsApp</a> ·
        <a href="https://instagram.com/faceauthedu" style="color:#e91664;font-weight:700;text-decoration:none">Instagram</a> ·
        <a href="mailto:faceauthedu@gmail.com" style="color:#e91664;font-weight:700;text-decoration:none">faceauthedu@gmail.com</a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:24px">— Equipo FaceAuthEdu</p>
    </div>`,
  });

  // Copia interna con los datos del lead
  await t.sendMail({
    from, to: process.env.GMAIL_USER, replyTo: email,
    subject: `Nueva solicitud de ${name}${institution ? ' · ' + institution : ''}`,
    text: `Nombre: ${name}\nInstitución: ${institution || '—'}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  });
}


async function folders() { await fs.mkdir(DATA, { recursive: true }); return fs.readdir(DATA, { withFileTypes: true }); }
async function findPerson(id) {
  for (const entry of await folders()) {
    if (!entry.isDirectory() || !entry.name.endsWith(`_${id}`)) continue;
    const dir = path.join(DATA, entry.name);
    try { return { dir, person: await readJson(path.join(dir, 'data.json')) }; } catch { /* corrupted folder is ignored */ }
  }
  return null;
}
function imageFromDataUrl(value) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(value || '');
  return match ? { extension: match[1] === 'jpg' ? 'jpg' : match[1], bytes: Buffer.from(match[2], 'base64') } : null;
}
async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 30 * 1024 * 1024) throw new Error('Las imágenes superan el límite de 30 MB.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function listPeople() {
  const people = [];
  for (const entry of await folders()) {
    if (!entry.isDirectory()) continue;
    try { people.push(await readJson(path.join(DATA, entry.name, 'data.json'))); } catch { /* ignore */ }
  }
  return people.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function api(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (req.method === 'GET' && pathname === '/api/people') return send(res, 200, { people: await listPeople() });
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
  if (req.method === 'POST' && pathname === '/api/people') {
    const incoming = await body(req);
    const name = String(incoming.name || '').trim();
    const samples = Array.isArray(incoming.samples) ? incoming.samples : [];
    if (!name || name.length > 100) return send(res, 400, { error: 'Ingresa un nombre válido.' });
    if (samples.length < 3 || samples.length > 12) return send(res, 400, { error: 'El registro requiere entre 3 y 12 muestras faciales.' });
    const id = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const folder = `${slug(name)}_${id}`; const dir = path.join(DATA, folder); await fs.mkdir(dir, { recursive: true });
    const stored = [];
    for (let i = 0; i < samples.length; i++) {
      const photo = imageFromDataUrl(samples[i].photo);
      const descriptor = samples[i].descriptor;
      if (!photo || !Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every(Number.isFinite)) {
        await fs.rm(dir, { recursive: true, force: true }); return send(res, 400, { error: 'Una muestra facial no tiene un formato válido.' });
      }
      const filename = `foto_${i + 1}.${photo.extension}`;
      await fs.writeFile(path.join(dir, filename), photo.bytes);
      stored.push({ photo: `/data/people/${encodeURIComponent(folder)}/${filename}`, descriptor });
    }
    const person = { id, name, code: String(incoming.code || '').trim().slice(0, 60), career: String(incoming.career || '').trim().slice(0, 100), samples: stored, avatar: stored[0].photo, createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(dir, 'data.json'), JSON.stringify(person, null, 2));
    return send(res, 201, { person });
  }
  const id = safeId(parts[2]);
  if (!id) return send(res, 404, { error: 'Ruta no encontrada.' });
  const found = await findPerson(id);
  if (!found) return send(res, 404, { error: 'No se encontró la persona solicitada.' });
  if (req.method === 'GET' && parts.length === 3) return send(res, 200, { person: found.person });
  if (req.method === 'DELETE' && parts.length === 3) { await fs.rm(found.dir, { recursive: true, force: true }); return send(res, 200, { ok: true }); }
  if (req.method === 'DELETE' && parts[3] === 'samples' && parts.length === 5) {
    const index = Number(parts[4]);
    if (!Number.isInteger(index) || index < 0 || index >= found.person.samples.length) return send(res, 400, { error: 'Muestra inválida.' });
    if (found.person.samples.length <= 3) return send(res, 400, { error: 'Conserva al menos tres muestras para mantener un registro fiable.' });
    const removed = found.person.samples.splice(index, 1)[0];
    const file = path.basename(new URL(removed.photo, 'http://local').pathname);
    await fs.rm(path.join(found.dir, file), { force: true });
    found.person.avatar = found.person.samples[0].photo;
    await fs.writeFile(path.join(found.dir, 'data.json'), JSON.stringify(found.person, null, 2));
    return send(res, 200, { person: found.person });
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
server.listen(PORT, () => console.log(`FaceAuthEdu disponible en http://localhost:${PORT}`));
