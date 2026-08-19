import nodemailer from 'nodemailer';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return transporter;
}

export const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

export async function sendContactEmail({ name, institution, email, message }) {
  const t = getTransporter();
  if (!t) throw new Error('El envío de correos no está configurado. Define GMAIL_USER y GMAIL_APP_PASSWORD (revisa el README).');
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
