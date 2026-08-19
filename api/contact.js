import { sendContactEmail, isEmail } from '../lib/mailer.js';

// Función serverless de Vercel: cada archivo en /api es un endpoint propio.
// Esta reemplaza a la ruta /api/contact que antes vivía dentro de server.js
// (ese servidor "de toda la vida" no corre en Vercel; aquí cada función se
// ejecuta bajo demanda, sin estado ni disco persistente entre llamadas).
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido.' }); }

  let incoming = req.body;
  if (!incoming || typeof incoming === 'string') {
    try { incoming = JSON.parse(incoming || '{}'); } catch { incoming = {}; }
  }

  const name = String(incoming.name || '').trim().slice(0, 100);
  const institution = String(incoming.institution || '').trim().slice(0, 120);
  const email = String(incoming.email || '').trim().slice(0, 160);
  const message = String(incoming.message || '').trim().slice(0, 500);

  if (!name || !message) return res.status(400).json({ error: 'Completa tu nombre y un mensaje.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Ingresa un correo válido.' });

  try {
    await sendContactEmail({ name, institution, email, message });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
