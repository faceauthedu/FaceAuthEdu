const app = document.getElementById('app');
let currentStream = null;
let cameraLoop = 0;
let enrollState = null;
let verifyRunning = false;
let sessionLog = [];

const e = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const initials = name => name.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
function icon(name, size = 20) {
  const paths = {
    shield: '<path d="M12 3 4.5 6v5.4c0 4.6 3.2 8 7.5 9.6 4.3-1.6 7.5-5 7.5-9.6V6L12 3Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/>',
    camera: '<path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z"/><circle cx="12" cy="12.5" r="3.1"/>',
    scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 12h8M12 8v8"/>',
    users: '<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17.5 10.5a3 3 0 1 0-1.2-5.75M20 20v-1.5a4.5 4.5 0 0 0-2.75-4.15"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-6"/>',
    check: '<path d="m5 12 4.2 4.2L19 6.5"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    trash: '<path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    arrow: '<path d="M5 12h14M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.4 3.2-5.2 7-5.2s6.2 1.8 7 5.2"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    bolt: '<path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/>',
    dots: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    whatsapp: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.55 7.48L3.5 20.5l1.42-4.14A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M9.2 7.7c.17-.4.35-.44.66-.44h.5c.18 0 .34.03.43.25l.78 1.84c.1.23.07.47-.07.66l-.48.62c-.12.15-.1.35.02.49.38.43.86.89 1.46 1.25.62.37 1.2.6 1.73.71.19.04.37-.03.49-.18l.52-.68c.15-.2.4-.26.62-.16l1.75.8c.22.1.33.29.3.52-.1.8-.47 1.42-1.08 1.7-.48.22-1.1.22-1.77.05-1.07-.26-2.2-.85-3.27-1.82-1.05-.95-1.8-2.05-2.17-3.1-.22-.67-.25-1.3.02-1.82.18-.36.46-.62.76-.78Z" fill="currentColor" stroke="none"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
    mail: '<path d="M3.5 6.25v11.5h17V6.25"/><path d="m3.5 6.25 8.5 6.5 8.5-6.5"/><path d="m3.5 17.75 6.4-5.45M20.5 17.75l-6.4-5.45"/><path d="M3.5 17.75h17"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    userSearch: '<circle cx="10" cy="8" r="3.5"/><path d="M4 20c.6-3 2.9-4.6 6-4.6"/><circle cx="17" cy="16.5" r="3"/><path d="m20.5 20-1.6-1.6"/>',
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
function stopCamera() {
  cameraLoop++;
  if (currentStream) currentStream.getTracks().forEach(track => track.stop());
  currentStream = null;
}
function toast(message, type = '') {
  document.querySelector('.toast')?.remove();
  const notice = document.createElement('div'); notice.className = `toast ${type}`; notice.textContent = message;
  document.body.append(notice); setTimeout(() => notice.remove(), 3400);
}
function goHome(section) { location.hash = '#/'; setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' }), 50); }
function restartVerification(id) { location.hash = '#/verify/' + id; renderVerify(id); }
function restartIdentify() { location.hash = '#/identify'; renderIdentify(); }

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', async () => { route(); Engine.loadModels().catch(() => toast('No se pudieron cargar los modelos de reconocimiento.', 'error')); });
async function route() {
  stopCamera(); verifyRunning = false;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page, id] = parts;
  if (!page) await renderLanding();
  else if (page === 'panel') await renderPanel();
  else if (page === 'enroll') renderEnroll();
  else if (page === 'identify') await renderIdentify();
  else if (page === 'person' && id) await renderPerson(id);
  else if (page === 'verify' && id) await renderVerify(id);
  else await renderLanding();
  window.scrollTo(0, 0);
}

function nav(back = false) {
  if (back) return `<header class="nav"><a class="brand" href="#/">FaceAuth<span>Edu</span></a><a class="nav-back" href="#/panel">${icon('arrow', 17)} Volver al panel</a></header>`;
  return `<header class="nav"><a class="brand" href="#/">FaceAuth<span>Edu</span></a><nav><button onclick="goHome('inicio')">Inicio</button><button onclick="goHome('caracteristicas')">Características</button><button onclick="goHome('estadisticas')">Estadísticas</button><button onclick="goHome('contacto')">Contacto</button></nav><button class="button dark nav-cta" onclick="location.hash='#/panel'">Acceder al Panel</button></header>`;
}
function avatar(person, className = 'avatar') { return person.avatar ? `<img class="${className}" src="${e(person.avatar)}" alt="">` : `<span class="${className} avatar-fallback">${e(initials(person.name))}</span>`; }
function footer() { return `<footer><div class="footer-main"><div><a class="footer-brand" href="#/">FaceAuth<span>Edu</span></a><p>Tecnología de reconocimiento facial para pruebas, admisiones y procesos académicos con consentimiento informado.</p><div class="socials"><a href="https://wa.me/51951175185" target="_blank" rel="noreferrer" title="WhatsApp" class="social-btn wa"><img src="assets/whatsapp.png" alt="WhatsApp"></a><a href="https://instagram.com/faceauthedu" target="_blank" rel="noreferrer" title="Instagram" class="social-btn ig">${icon('instagram',18)}</a><a href="mailto:faceauthedu@gmail.com" title="Correo" class="social-btn mail"><img src="assets/gmail.png" alt="Gmail"></a></div></div><div><h4>PRODUCTO</h4><a href="#/enroll">Registro biométrico</a><a href="#/panel">Verificación facial</a><a href="#/identify">Identificar persona</a></div><div><h4>RECURSOS</h4><a href="#caracteristicas" onclick="goHome('caracteristicas')">Cómo funciona</a><a href="#contacto" onclick="goHome('contacto')">Solicitar información</a><a href="https://github.com/justadudewhohacks/face-api.js" target="_blank" rel="noreferrer">Tecnología base</a></div><div><h4>PRIVACIDAD</h4><p>Las fotos y vectores se guardan en esta instalación local, dentro de <code>data/people</code>.</p></div></div><div class="footer-bottom">© 2026 FaceAuth Edu · Proyecto demostrativo de autenticación facial</div></footer>`; }

function buildMetricsSection(people, log) {
  // 1) Actividad por sesión: últimos intentos reales de esta sesión (verificar/identificar)
  const recent = log.slice(-6);
  const bars = recent.length
    ? recent.map(entry => `<i style="--h:${Math.max(10, Math.round(entry.confidence))}%" class="${entry.match ? 'ok' : 'no'}" title="${entry.match ? 'Coincidencia' : 'Sin coincidencia'} · ${Math.round(entry.confidence)}%"></i>`).join('')
    : Array.from({ length: 5 }).map(() => `<i style="--h:8%" class="empty"></i>`).join('');
  const barsCaption = recent.length ? `${recent.length} intento(s) en esta sesión` : 'Aún sin actividad — prueba una verificación';

  // 2) Coincidencias: proporción real de aciertos en la sesión (dona animada con conic-gradient)
  const matches = log.filter(l => l.match).length;
  const donutPct = log.length ? Math.round((matches / log.length) * 100) : 0;
  const donutLabel = log.length ? `${matches}/${log.length}` : '—';

  // 3) Por grupo: distribución real de personas registradas por carrera/rol
  const groups = {};
  people.forEach(p => { const key = (p.career || 'Sin grupo').trim() || 'Sin grupo'; groups[key] = (groups[key] || 0) + 1; });
  const groupEntries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxGroup = Math.max(1, ...groupEntries.map(g => g[1]));
  const groupRows = groupEntries.length
    ? groupEntries.map(([label, count]) => `<div class="group-row"><span>${e(label)}</span><i style="--w:${Math.round((count / maxGroup) * 100)}%"></i><b>${count}</b></div>`).join('')
    : `<p class="metric-empty">Registra tu primera identidad para ver esto.</p>`;

  // 4) Seguridad: garantías reales del proyecto (no un dato inventado)
  const checklist = ['Comparación 100% local', 'Sin envío de fotos a terceros', 'Fotos en data/people']
    .map((text, i) => `<li style="--d:${i * 140}ms">${icon('check', 13)}<span>${text}</span></li>`).join('');

  return `<div class="metric-grid">
    <div class="metric-card" data-tip="Actividad por sesión: verificaciones e identificaciones hechas en este navegador desde que se abrió la página."><small>EN VIVO</small><div class="metric-visual"><div class="session-bars">${bars}</div></div><h3>Por sesión</h3><p>${barsCaption}</p></div>
    <div class="metric-card" data-tip="Coincidencias: proporción de intentos de esta sesión que superaron el umbral biométrico."><small>RESULTADOS</small><div class="metric-visual"><div class="match-donut" data-pct="${donutPct}" style="--pct:0"><b>${donutLabel}</b></div></div><h3>Coincidencias</h3><p>${log.length ? donutPct + '% de aciertos' : 'Sin datos aún'}</p></div>
    <div class="metric-card" data-tip="Por grupo: cuántas identidades registradas hay por carrera/rol, calculado de tus registros reales."><small>REGISTROS</small><div class="metric-visual"><div class="group-bars">${groupRows}</div></div><h3>Por grupo</h3><p>Organización local</p></div>
    <div class="metric-card" data-tip="Seguridad: garantías de esta instalación, no una métrica simulada."><small>SEGURIDAD</small><div class="metric-visual"><ul class="security-list">${checklist}</ul></div><h3>Garantías</h3><p>Sin servicios externos</p></div>
  </div>`;
}

async function renderLanding() {
  let people = [], log = sessionLog;
  try { people = await Store.all(); } catch { people = []; }
  app.innerHTML = `${nav()}
  <section class="hero" id="inicio"><div class="hero-orb one"></div><div class="hero-orb two"></div><div class="hero-content"><div class="pill">${icon('shield', 15)} Biométrica local y verificable</div><h1>Autenticación <i>biométrica facial</i><br>para la integridad académica</h1><p>Una experiencia de verificación clara, rápida y con datos alojados en tu propio proyecto. Diseñada para demostraciones académicas y uso responsable.</p><div class="hero-actions"><button class="button dark" onclick="location.hash='#/enroll'">Registrar identidad ${icon('arrow', 17)}</button><button class="button light" onclick="location.hash='#/panel'">Probar verificación</button><button class="button ghost" onclick="location.hash='#/identify'">${icon('userSearch', 17)} ¿Quién es?</button></div><div class="hero-trust"><div class="mini-avatars"><b>F</b><b>M</b><b>A</b><b>+</b></div><span><strong>Reconocimiento 1:1</strong><br>comparación contra un registro real</span></div></div><div class="hero-visual"><div class="scan-card"><div class="scan-top"><span>VERIFICACIÓN EN VIVO</span><i></i></div><div class="face-frame"><div class="face-shape"></div><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span><div class="scan-beam"></div></div><div class="scan-user"><div class="tiny-face">AB</div><div><b>Identidad protegida</b><small>Vector biométrico cifrado localmente</small></div>${icon('check', 18)}</div></div></div></section>
  <section class="confidence wrap" id="estadisticas"><div><p class="eyebrow">CONFIANZA RESPALDADA POR DATOS</p><h2>La seguridad académica<br>que merece tu institución</h2><div class="stat-row"><div><strong>128<span>-D</span></strong><p>Rasgos por muestra</p></div><div><strong>3<span>+</span></strong><p>Fotos por registro</p></div><div><strong>1:1</strong><p>Verificación precisa</p></div></div></div><div class="identity-art landmark-art"><svg class="landmark-svg" viewBox="0 0 300 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="150" cy="118" rx="76" ry="96" class="mesh-face"/><g class="mesh-lines"><line x1="115" y1="92" x2="150" y2="120"/><line x1="185" y1="92" x2="150" y2="120"/><line x1="150" y1="120" x2="130" y2="162"/><line x1="150" y1="120" x2="170" y2="162"/><line x1="130" y1="162" x2="170" y2="162"/><line x1="98" y1="86" x2="115" y2="92"/><line x1="202" y1="86" x2="185" y2="92"/><line x1="98" y1="86" x2="130" y2="162"/><line x1="202" y1="86" x2="170" y2="162"/><line x1="130" y1="162" x2="150" y2="200"/><line x1="170" y1="162" x2="150" y2="200"/><line x1="115" y1="92" x2="185" y2="92"/></g><g class="mesh-points"><circle cx="115" cy="92" r="4"/><circle cx="185" cy="92" r="4"/><circle cx="98" cy="86" r="3.5"/><circle cx="202" cy="86" r="3.5"/><circle cx="150" cy="120" r="4.5"/><circle cx="130" cy="162" r="4"/><circle cx="170" cy="162" r="4"/><circle cx="150" cy="200" r="3.5"/></g></svg><span class="art-label">${icon('scan',14)} 128 puntos faciales únicos</span></div></section>
  <section class="features wrap" id="caracteristicas"><div class="section-title"><div><p class="eyebrow">UNA EXPERIENCIA COMPLETA</p><h2>Así funciona <span>FaceAuth Edu</span></h2></div><p>Tres momentos que dan trazabilidad a cada proceso de registro y verificación.</p></div><div class="feature-grid"><article class="feature-card"><div class="feature-art enrollment-art"><div class="laptop"><div></div></div><span class="badge-card">${icon('camera', 15)} Registro guiado</span></div><div class="feature-copy"><span>01</span><h3>Registro biométrico</h3><p>Captura o carga varias muestras. El sistema acepta una sola cara por imagen y compara la consistencia entre muestras.</p></div></article><article class="feature-card"><div class="feature-art verify-art"><div class="match-circle">96<small>%</small></div><div class="match-line one"></div><div class="match-line two"></div><span class="badge-card">${icon('scan', 15)} En vivo</span></div><div class="feature-copy"><span>02</span><h3>Verificación en tiempo real</h3><p>La cámara extrae rasgos de varias tomas estables y contrasta el resultado contra la identidad elegida.</p></div></article><article class="feature-card"><div class="feature-art panel-art"><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div><div class="line-chart"></div><span class="badge-card">${icon('chart', 15)} Panel local</span></div><div class="feature-copy"><span>03</span><h3>Panel institucional</h3><p>Revisa personas, muestras registradas y ejecuta verificaciones sin perder control de los archivos.</p></div></article></div></section>
  <section class="metrics"><div class="wrap"><div class="section-title"><div><p class="eyebrow">PANEL DE MÉTRICAS</p><h2>Visibilidad en <span>tiempo real</span></h2></div><p>El panel organiza registros locales y ofrece una base segura para una demostración funcional.</p></div>${buildMetricsSection(people, log)}</div></section>
  <section class="testimonials wrap"><p class="eyebrow">PARA DEMOSTRACIONES RESPONSABLES</p><h2>Una plataforma pensada<br>para que el uso sea claro</h2><div class="testimonial-carousel" id="testimonialCarousel"><div class="carousel-viewport"><div class="testimonial-track" id="testimonialTrack"><article class="testimonial-slide"><span class="quote-mark">“</span><p>El flujo deja claro cuándo se registró una cara, qué muestras se usan y por qué una identidad no coincide.</p><div class="slide-author"><div class="quote-avatar pink">MF</div><div><b>María Fernández</b><span>Coordinación académica</span></div></div></article><article class="testimonial-slide"><span class="quote-mark">“</span><p>La validación evita mezclar fotografías de distintas personas antes de que se guarde un registro.</p><div class="slide-author"><div class="quote-avatar lilac">AT</div><div><b>Andrea Torres</b><span>Gestión de pruebas</span></div></div></article><article class="testimonial-slide"><span class="quote-mark">“</span><p>El panel permite eliminar muestras de forma controlada y mantener una base de datos de ejemplo ordenada.</p><div class="slide-author"><div class="quote-avatar blue">LG</div><div><b>Laura Gómez</b><span>Docencia y tecnología</span></div></div></article><article class="testimonial-slide"><span class="quote-mark">“</span><p>Poder identificar a alguien sin elegirlo antes, y que avise si se parece a otra persona registrada, se siente serio de verdad.</p><div class="slide-author"><div class="quote-avatar pink">CR</div><div><b>Carlos Ramírez</b><span>Soporte técnico académico</span></div></div></article></div></div><div class="carousel-controls"><button class="carousel-arrow prev" id="carouselPrev" aria-label="Anterior">${icon('arrow',17)}</button><div class="carousel-dots" id="testimonialDots"></div><button class="carousel-arrow next" id="carouselNext" aria-label="Siguiente">${icon('arrow',17)}</button></div></div></section>
  <section class="contact" id="contacto"><div class="contact-inner"><p class="eyebrow">SOLICITA INFORMACIÓN</p><h2>¿Tu institución necesita<br><span>más seguridad?</span></h2><p>Déjanos tus datos y te escribimos automáticamente al correo que nos dejes.</p><form class="contact-form" id="contactForm" onsubmit="sendContact(event)"><label>Nombre completo<input id="contactName" required placeholder="Dr. Juan Pérez"></label><label>Institución<input id="contactInstitution" placeholder="Universidad / Colegio"></label><label>Correo<input id="contactEmail" type="email" required placeholder="tucorreo@ejemplo.com"></label><label>Mensaje<textarea id="contactMessage" required maxlength="500" placeholder="Cuéntanos sobre las necesidades de tu institución…"></textarea></label><button class="button dark full" type="submit" id="contactSubmit">Enviar y recibir por correo ${icon('mail',17)}</button></form><div class="contact-alternatives"><a href="https://wa.me/51951175185" target="_blank" rel="noreferrer">${icon('whatsapp',14)} WhatsApp</a><a href="mailto:faceauthedu@gmail.com">${icon('mail',14)} faceauthedu@gmail.com</a><a href="https://instagram.com/faceauthedu" target="_blank" rel="noreferrer">${icon('instagram',14)} @faceauthedu</a></div><small>${icon('lock',14)} Las imágenes biométricas nunca se incluyen en este formulario.</small></div></section>${footer()}`;
  document.querySelectorAll('.metric-card').forEach(card => card.onclick = () => toast(card.dataset.tip));
  initTestimonialCarousel();
  initRevealAnimations();
  initMetricAnimations();
}
async function sendContact(event) {
  event.preventDefault();
  const submit = document.getElementById('contactSubmit');
  const payload = {
    name: contactName.value.trim(),
    institution: contactInstitution.value.trim(),
    email: contactEmail.value.trim(),
    message: contactMessage.value.trim(),
  };
  submit.disabled = true; submit.textContent = 'Enviando…';
  try {
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'No se pudo enviar el correo.');
    toast(`Listo, revisa ${payload.email} — te escribimos con la información.`);
    document.getElementById('contactForm').reset();
    submit.textContent = `Enviado ${icon('check', 15)}`;
    setTimeout(() => { submit.disabled = false; submit.innerHTML = `Enviar y recibir por correo ${icon('mail',17)}`; }, 2600);
  } catch (error) {
    toast(error.message + ' Puedes escribirnos por WhatsApp mientras tanto.', 'error');
    submit.disabled = false; submit.innerHTML = `Enviar y recibir por correo ${icon('mail',17)}`;
  }
}

function initTestimonialCarousel() {
  const track = document.getElementById('testimonialTrack');
  const dotsWrap = document.getElementById('testimonialDots');
  if (!track || !dotsWrap) return;
  const slides = [...track.children];
  let index = 0, timer = null;
  dotsWrap.innerHTML = slides.map((_, i) => `<button data-i="${i}" aria-label="Testimonio ${i + 1}"></button>`).join('');
  const dots = [...dotsWrap.children];
  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, d) => dot.classList.toggle('active', d === index));
  }
  function autoplay() { timer = setInterval(() => go(index + 1), 5200); }
  function stop() { clearInterval(timer); }
  dots.forEach(dot => dot.onclick = () => { go(Number(dot.dataset.i)); stop(); autoplay(); });
  document.getElementById('carouselPrev').onclick = () => { go(index - 1); stop(); autoplay(); };
  document.getElementById('carouselNext').onclick = () => { go(index + 1); stop(); autoplay(); };
  const carousel = document.getElementById('testimonialCarousel');
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', autoplay);
  let touchX = null;
  carousel.addEventListener('touchstart', ev => { touchX = ev.touches[0].clientX; stop(); }, { passive: true });
  carousel.addEventListener('touchend', ev => { if (touchX === null) return; const delta = ev.changedTouches[0].clientX - touchX; if (delta > 40) go(index - 1); else if (delta < -40) go(index + 1); touchX = null; autoplay(); });
  go(0); autoplay();
}
function initRevealAnimations() {
  const targets = document.querySelectorAll('.feature-card, .metric-card, .stat-row > div, .testimonial-carousel, .contact-inner');
  if (!('IntersectionObserver' in window)) return targets.forEach(t => t.classList.add('in-view'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: 0.15 });
  targets.forEach(t => observer.observe(t));
  document.querySelectorAll('.stat-row strong').forEach(node => {
    const text = node.textContent.trim(); const num = parseFloat(text); if (Number.isNaN(num)) return;
    const suffix = text.replace(/^[\d.]+/, ''); let current = 0; const step = Math.max(1, Math.round(num / 30));
    const counter = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return; counter.unobserve(node);
      const tick = () => { current = Math.min(num, current + step); node.textContent = current + suffix; if (current < num) requestAnimationFrame(tick); else node.textContent = text; };
      tick();
    }), { threshold: 0.4 });
    counter.observe(node);
  });
}
function initMetricAnimations() {
  const grid = document.querySelector('.metric-grid');
  if (!grid) return;
  const donut = grid.querySelector('.match-donut');
  const targetPct = donut ? Number(donut.dataset.pct || 0) : 0;
  if (donut) donut.style.setProperty('--pct', 0);
  const run = () => {
    grid.classList.add('animate');
    if (donut && targetPct > 0) {
      const start = performance.now(), duration = 900;
      const tick = now => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        donut.style.setProperty('--pct', (targetPct * eased).toFixed(1));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };
  if (!('IntersectionObserver' in window)) return run();
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { run(); observer.disconnect(); } }), { threshold: 0.35 });
  observer.observe(grid);
}

async function renderPanel() {
  app.innerHTML = `${nav()}<main class="workspace"><div class="workspace-heading"><div><p class="eyebrow">PANEL INSTITUCIONAL</p><h1>Identidades registradas</h1><p>Gestiona registros biométricos y ejecuta una verificación en vivo.</p></div><button class="button dark" onclick="location.hash='#/enroll'">${icon('plus', 17)} Registrar persona</button></div><div class="loading-card">Cargando base local…</div></main>`;
  try {
    const people = await Store.all(); const sampleCount = people.reduce((sum, person) => sum + person.samples.length, 0);
    app.innerHTML = `${nav()}<main class="workspace"><div class="workspace-heading"><div><p class="eyebrow">PANEL INSTITUCIONAL</p><h1>Identidades registradas</h1><p>Gestiona registros biométricos y ejecuta una verificación en vivo.</p></div><div class="heading-actions"><button class="button light" onclick="location.hash='#/identify'">${icon('userSearch', 17)} Identificar a alguien</button><button class="button dark" onclick="location.hash='#/enroll'">${icon('plus', 17)} Registrar persona</button></div></div><div class="panel-summary"><div>${icon('users', 19)}<strong>${people.length}</strong><span>personas</span></div><div>${icon('camera', 19)}<strong>${sampleCount}</strong><span>muestras guardadas</span></div><div>${icon('shield', 19)}<strong>Local</strong><span>base de datos</span></div></div><section class="people-section"><div class="list-title"><h2>Directorio</h2><span>${people.length ? `${people.length} registro${people.length === 1 ? '' : 's'}` : 'Sin registros'}</span></div><div class="people-grid">${people.length ? people.map(personCard).join('') : emptyState()}</div></section></main>`;
  } catch (error) { renderServerError(error); }
}
function emptyState() { return `<div class="empty-state"><div>${icon('users', 32)}</div><h2>Aún no hay identidades</h2><p>Comienza registrando fotos de una persona real con su consentimiento.</p><button class="button dark" onclick="location.hash='#/enroll'">Registrar primera identidad</button></div>`; }
function personCard(person) { return `<article class="person-card"><button class="person-main" onclick="location.hash='#/person/${e(person.id)}'">${avatar(person)}<span><b>${e(person.name)}</b><small>${e(person.code || 'Sin código')} · ${e(person.career || 'Sin grupo')}</small><em>${person.samples.length} muestras</em></span></button><button class="verify-shortcut" title="Verificar identidad" onclick="location.hash='#/verify/${e(person.id)}'">${icon('scan', 19)}</button></article>`; }
function renderServerError(error) { app.innerHTML = `${nav()}<main class="workspace"><div class="error-state"><div>${icon('close', 30)}</div><h1>No se pudo leer la base local</h1><p>${e(error.message)} Asegúrate de iniciar la aplicación con <code>node server.js</code>.</p><button class="button dark" onclick="route()">Reintentar</button></div></main>`; }

function renderEnroll() {
  enrollState = { mode: 'camera', samples: [], stage: 0, turn: 0, loading: false };
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><div class="page-heading"><div class="heading-icon">${icon('person', 25)}</div><p class="eyebrow">REGISTRO BIOMÉTRICO</p><h1>Crear nueva identidad</h1><p>Usa fotografías de una única persona, siempre con su consentimiento.</p></div><section class="form-card"><div class="form-grid"><label>Nombre completo<input id="fName" autocomplete="name" placeholder="Ej. Andrea Salas"></label><label>Código / ID<input id="fCode" placeholder="Ej. ID-0001"></label></div><label>Carrera, grupo o rol<input id="fCareer" placeholder="Ej. Ingeniería, Administración, Staff…"></label><div class="notice">${icon('shield', 17)}<span><b>Control de identidad activo.</b> Cada muestra se compara con las anteriores; las fotos de otra persona se rechazan antes de guardar.</span></div><div class="capture-tabs"><button id="cameraTab" class="active" onclick="switchEnroll('camera')">${icon('camera', 17)} Cámara guiada</button><button id="uploadTab" onclick="switchEnroll('upload')">${icon('plus', 17)} Subir fotografías</button></div><div id="captureArea"></div></section></main>`;
  switchEnroll('camera');
}
function switchEnroll(mode) {
  stopCamera(); enrollState.mode = mode; enrollState.samples = []; enrollState.stage = 0; enrollState.turn = 0;
  document.getElementById('cameraTab').classList.toggle('active', mode === 'camera'); document.getElementById('uploadTab').classList.toggle('active', mode === 'upload');
  const area = document.getElementById('captureArea');
  if (mode === 'camera') {
    area.innerHTML = `<div class="liveness"><span>${icon('bolt', 16)} Prueba de presencia guiada</span><b id="challengeText">Mira de frente a la cámara</b><small>Haz los cuatro movimientos para crear muestras variadas. Esta comprobación reduce registros accidentales; no sustituye un detector profesional anti-suplantación.</small></div><div class="camera-shell"><video id="video" autoplay muted playsinline></video><canvas id="overlay"></canvas><div class="face-guide" id="faceGuide"><i></i><i></i><i></i><i></i></div></div><p class="camera-status" id="cameraStatus">Preparando cámara y modelo…</p><div class="sample-strip" id="sampleStrip"></div><button class="button pink full" id="captureButton" onclick="captureCameraSample()">${icon('camera', 18)} Capturar muestra 1 de 4</button><button class="button dark full save-button" id="saveButton" onclick="saveEnrollment()" disabled>Guardar identidad</button>`;
    startEnrollCamera();
  } else {
    area.innerHTML = `<div class="upload-zone"><input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple><div>${icon('plus', 26)}</div><b>Selecciona fotografías</b><span>JPEG, PNG o WebP · al menos 3 fotos claras</span></div><p class="upload-status" id="uploadStatus">Cada archivo se analiza y se compara con la primera identidad aceptada.</p><div class="sample-strip" id="sampleStrip"></div><button class="button dark full save-button" id="saveButton" onclick="saveEnrollment()" disabled>Guardar identidad</button>`;
    document.getElementById('fileInput').onchange = processUploads;
  }
}
function challenge() { return ['Mira de frente a la cámara', 'Gira ligeramente hacia un lado', 'Gira hacia el lado contrario', 'Vuelve a mirar de frente'][enrollState.stage] || 'Muestras completadas'; }
function pose(result) {
  const p = result.landmarks.positions; const mean = indices => indices.reduce((sum, i) => sum + p[i].x, 0) / indices.length;
  const left = mean([36, 37, 38, 39, 40, 41]); const right = mean([42, 43, 44, 45, 46, 47]);
  return (p[30].x - ((left + right) / 2)) / Math.max(right - left, 1);
}
function validPose(result) {
  const value = pose(result); const front = Math.abs(value) < 0.14;
  if (enrollState.stage === 0 || enrollState.stage === 3) return front;
  if (enrollState.stage === 1 && Math.abs(value) > 0.055) { enrollState.turn = Math.sign(value); return true; }
  return enrollState.stage === 2 && Math.sign(value) === -enrollState.turn && Math.abs(value) > 0.055;
}
async function startEnrollCamera() {
  const status = document.getElementById('cameraStatus'); const loopId = ++cameraLoop;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no admite acceso a cámara.');
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    const video = document.getElementById('video'); if (!video || loopId !== cameraLoop) return;
    video.srcObject = currentStream; await video.play(); await Engine.loadModels(); status.textContent = 'Cámara lista. ' + challenge(); drawEnrollLoop(loopId);
  } catch (error) { status.innerHTML = `<b>No pudimos activar la cámara.</b> ${e(cameraMessage(error))}`; document.getElementById('captureButton').disabled = true; }
}
function cameraMessage(error) { if (error.name === 'NotAllowedError') return 'Autoriza el permiso de cámara y vuelve a intentarlo.'; if (error.name === 'NotFoundError') return 'No encontramos una cámara disponible.'; return error.message || 'Revisa que estés en http://localhost:8000.'; }
async function drawEnrollLoop(loopId) {
  const video = document.getElementById('video'), canvas = document.getElementById('overlay'), guide = document.getElementById('faceGuide');
  if (!video || loopId !== cameraLoop) return;
  if (video.readyState >= 2) {
    canvas.width = video.videoWidth; canvas.height = video.videoHeight; const faces = await Engine.detectOnly(video); const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (faces.length === 1) { const box = faces[0].detection.box; ctx.strokeStyle = '#39d98a'; ctx.lineWidth = 3; ctx.strokeRect(box.x, box.y, box.width, box.height); guide.classList.add('ready'); }
    else guide.classList.remove('ready');
  }
  if (loopId === cameraLoop) requestAnimationFrame(() => drawEnrollLoop(loopId));
}
function sampleDataFromResult(video, result) {
  const source = document.createElement('canvas'); const width = video.videoWidth, height = video.videoHeight; source.width = width; source.height = height; source.getContext('2d').drawImage(video, 0, 0, width, height);
  const box = result.detection.box; const pad = Math.max(box.width, box.height) * 0.25; const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad), size = Math.min(Math.max(box.width, box.height) + (pad * 2), width - x, height - y);
  const crop = document.createElement('canvas'); crop.width = 360; crop.height = 360; crop.getContext('2d').drawImage(source, x, y, size, size, 0, 0, 360, 360);
  return crop.toDataURL('image/jpeg', .9);
}
function validateAnalysis(analysis, samples) {
  if (!analysis.result) return analysis.faces > 1 ? 'Solo debe aparecer una cara en la imagen.' : 'No se detectó un rostro claro.';
  if (analysis.coverage < .13) return 'Acércate un poco más: el rostro quedó muy pequeño.';
  if (!Engine.isConsistent(analysis.result.descriptor, samples)) return 'Esta foto no coincide con la identidad que estás registrando.';
  return null;
}
async function captureCameraSample() {
  const video = document.getElementById('video'), status = document.getElementById('cameraStatus'), button = document.getElementById('captureButton');
  if (!video || enrollState.loading) return; enrollState.loading = true; button.disabled = true; status.textContent = 'Validando rostro y movimiento…';
  try {
    const analysis = await Engine.analyze(video); const error = validateAnalysis(analysis, enrollState.samples);
    if (error) throw new Error(error);
    if (!validPose(analysis.result)) throw new Error('Aún no completaste el movimiento: ' + challenge().toLowerCase() + '.');
    enrollState.samples.push({ photo: sampleDataFromResult(video, analysis.result), descriptor: Array.from(analysis.result.descriptor) }); enrollState.stage++;
    renderSamples();
    if (enrollState.stage >= 4) { status.textContent = 'Registro biométrico completo. Revisa las muestras y guarda la identidad.'; button.classList.add('hidden'); document.getElementById('saveButton').disabled = false; }
    else { document.getElementById('challengeText').textContent = challenge(); status.textContent = 'Muestra aceptada. ' + challenge(); button.innerHTML = `${icon('camera', 18)} Capturar muestra ${enrollState.stage + 1} de 4`; }
  } catch (error) { status.textContent = error.message; toast(error.message, 'error'); }
  finally { enrollState.loading = false; if (enrollState.stage < 4) button.disabled = false; }
}
async function processUploads(event) {
  const files = [...event.target.files]; const status = document.getElementById('uploadStatus'); if (!files.length) return;
  enrollState.samples = []; renderSamples(); status.textContent = 'Analizando fotografías…'; await Engine.loadModels();
  for (const file of files.slice(0, 12)) {
    const image = await fileImage(file); const analysis = await Engine.analyze(image); const error = validateAnalysis(analysis, enrollState.samples);
    if (error) { toast(`${file.name}: ${error}`, 'error'); continue; }
    enrollState.samples.push({ photo: await dataUrl(file), descriptor: Array.from(analysis.result.descriptor) }); renderSamples();
  }
  const total = enrollState.samples.length; status.textContent = total >= 3 ? `${total} muestras válidas y coherentes. Ya puedes guardar.` : `${total} muestra${total === 1 ? '' : 's'} válida${total === 1 ? '' : 's'}: necesitas al menos 3.`;
  document.getElementById('saveButton').disabled = total < 3;
}
function fileImage(file) { return new Promise((resolve, reject) => { const img = new Image(); const url = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = reject; img.src = url; }); }
function dataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function renderSamples() { const strip = document.getElementById('sampleStrip'); if (!strip) return; strip.innerHTML = enrollState.samples.length ? enrollState.samples.map((sample, index) => `<div class="sample-thumb"><img src="${sample.photo}" alt="Muestra ${index + 1}"><button aria-label="Eliminar muestra" onclick="removeDraftSample(${index})">${icon('close', 14)}</button><span>${index + 1}</span></div>`).join('') : '<span class="samples-empty">Las muestras válidas aparecerán aquí.</span>'; }
function removeDraftSample(index) { enrollState.samples.splice(index, 1); if (enrollState.mode === 'camera') { enrollState.stage = enrollState.samples.length; document.getElementById('challengeText').textContent = challenge(); const button = document.getElementById('captureButton'); button.classList.remove('hidden'); button.disabled = false; button.innerHTML = `${icon('camera', 18)} Capturar muestra ${enrollState.stage + 1} de 4`; document.getElementById('saveButton').disabled = true; } renderSamples(); }
async function saveEnrollment() {
  const name = document.getElementById('fName').value.trim(); const save = document.getElementById('saveButton');
  if (!name) return toast('Escribe el nombre de la persona antes de guardar.', 'error');
  if (enrollState.samples.length < 3) return toast('Necesitas al menos 3 muestras válidas.', 'error');
  save.disabled = true; save.textContent = 'Guardando en el proyecto…';
  try { const person = await Store.add({ name, code: document.getElementById('fCode').value.trim(), career: document.getElementById('fCareer').value.trim(), samples: enrollState.samples }); toast(`Registro de ${person.name} guardado en data/people.`); location.hash = '#/person/' + person.id; }
  catch (error) { toast(error.message, 'error'); save.disabled = false; save.textContent = 'Guardar identidad'; }
}

async function renderPerson(id) {
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><div class="loading-card">Cargando identidad…</div></main>`;
  try {
    const person = await Store.get(id); app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="profile-card"><div class="profile-top">${avatar(person, 'profile-avatar')}<div><p class="eyebrow">PERFIL BIOMÉTRICO</p><h1>${e(person.name)}</h1><p>${e(person.code || 'Sin código')} · ${e(person.career || 'Sin grupo')}</p></div><button class="icon-button danger" title="Eliminar persona" onclick="deletePerson('${e(person.id)}')">${icon('trash', 19)}</button></div><div class="profile-actions"><button class="button dark" onclick="location.hash='#/verify/${e(person.id)}'">${icon('scan', 17)} Verificar ahora</button><button class="button light" onclick="location.hash='#/enroll'">${icon('plus', 17)} Nuevo registro</button></div><div class="samples-heading"><div><h2>Muestras guardadas</h2><p>Se requiere un mínimo de tres muestras para conservar un registro confiable.</p></div><span>${person.samples.length} fotos</span></div><div class="profile-samples">${person.samples.map((sample, index) => `<figure><img src="${e(sample.photo)}" alt="Muestra biométrica ${index + 1}"><figcaption>Muestra ${index + 1}<button ${person.samples.length <= 3 ? 'disabled title="Conserva al menos 3 muestras"' : ''} onclick="deleteStoredSample('${e(person.id)}', ${index})">${icon('trash', 15)}</button></figcaption></figure>`).join('')}</div><div class="privacy-card">${icon('lock', 20)}<span><b>Almacenamiento local</b> Este perfil y sus fotografías se encuentran en <code>data/people</code> de esta copia del proyecto.</span></div></section></main>`;
  } catch (error) { renderServerError(error); }
}
async function deletePerson(id) { if (!confirm('¿Eliminar esta identidad y todas sus fotos? Esta acción no se puede deshacer.')) return; try { await Store.remove(id); toast('Identidad eliminada.'); location.hash = '#/panel'; } catch (error) { toast(error.message, 'error'); } }
async function deleteStoredSample(id, index) { if (!confirm('¿Eliminar esta muestra?')) return; try { await Store.removeSample(id, index); toast('Muestra eliminada.'); renderPerson(id); } catch (error) { toast(error.message, 'error'); } }

/* ---------------- IDENTIFICAR (1:N — "¿quién es esta persona?") ---------------- */
let identifyRunning = false;
async function renderIdentify() {
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="verify-card identify-card"><div class="identify-head"><div class="heading-icon">${icon('userSearch', 24)}</div><div><p class="eyebrow">IDENTIFICACIÓN 1:N</p><h1>¿Quién es esta persona?</h1><p>Escanea un rostro y el sistema lo compara contra <b>todas</b> las identidades registradas, sin elegir a nadie primero.</p></div></div><div class="camera-shell verify-camera"><video id="video" autoplay muted playsinline></video><canvas id="overlay"></canvas><div class="face-guide" id="faceGuide"><i></i><i></i><i></i><i></i></div><div class="scan-overlay"><span>BUSCANDO COINCIDENCIA</span></div></div><div class="verify-steps"><div id="vstep1" class="active"><i>1</i><span>Detectar rostro</span></div><div id="vstep2"><i>2</i><span>Extraer rasgos</span></div><div id="vstep3"><i>3</i><span>Buscar en el directorio</span></div></div><div class="verify-progress"><i id="verifyProgress"></i></div><p class="camera-status" id="verifyStatus">Iniciando cámara…</p><div class="liveness-meter" id="livenessMeter"><span>${icon('scan',14)} Prueba de vida</span><i><em id="livenessFill"></em></i></div><button class="button light full" onclick="location.hash='#/panel'">Cancelar</button></section></main>`;
  startIdentify();
}
async function startIdentify() {
  const status = document.getElementById('verifyStatus'); const loopId = ++cameraLoop;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no admite cámara.');
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    const video = document.getElementById('video'); if (!video || loopId !== cameraLoop) return; video.srcObject = currentStream; await video.play(); await Engine.loadModels(); identifyRunning = true; drawVerifyLoop(loopId); status.textContent = 'Ubica un solo rostro dentro del marco y parpadea con naturalidad…'; runIdentify(video);
  } catch (error) { status.innerHTML = `<b>No pudimos activar la cámara.</b> ${e(cameraMessage(error))}`; }
}
async function runIdentify(video) {
  const status = document.getElementById('verifyStatus'), progress = document.getElementById('verifyProgress'), livenessFill = document.getElementById('livenessFill');
  setVerifyStep(1, 'active'); progress.style.width = '12%';
  const descriptors = []; const earSamples = []; const started = performance.now(); let blinked = false;
  while (identifyRunning && performance.now() - started < 13000 && !(descriptors.length >= 3 && blinked)) {
    if (video.readyState >= 2) {
      const analysis = await Engine.analyze(video);
      if (analysis.result) earSamples.push(Engine.earFromLandmarks(analysis.result.landmarks));
      if (!blinked && Engine.blinkDetected(earSamples)) blinked = true;
      if (livenessFill) livenessFill.style.width = Math.min(100, Math.round((Engine.earRange(earSamples) / 0.035) * 100)) + '%';
      if (analysis.result && analysis.coverage >= .13 && descriptors.length < 3) { descriptors.push(analysis.result.descriptor); progress.style.width = `${12 + descriptors.length * 16}%`; }
      status.textContent = descriptors.length < 3
        ? `Rostro estable detectado (${descriptors.length}/3)… mira a la cámara con naturalidad`
        : (blinked ? 'Prueba de vida confirmada ✓ finalizando…' : 'Listo, confirmando que hay una persona real…');
    }
    await new Promise(resolve => setTimeout(resolve, 320));
  }
  if (!identifyRunning) return;
  if (descriptors.length < 3) return showIdentifyResult(null, null, 'No pudimos obtener tres lecturas estables. Revisa la iluminación y mantén un solo rostro en cámara.');
  if (!blinked) return showIdentifyResult(null, null, 'No detectamos señales de una persona real durante la lectura. Por seguridad, no se identifica a partir de fotos o pantallas — inténtalo de nuevo frente a la cámara, en persona.');
  setVerifyStep(1, 'done'); setVerifyStep(2, 'active'); progress.style.width = '55%'; status.textContent = 'Extrayendo patrón biométrico…'; await new Promise(resolve => setTimeout(resolve, 380));
  setVerifyStep(2, 'done'); setVerifyStep(3, 'active'); progress.style.width = '78%'; status.textContent = 'Buscando en el directorio…';
  let people = [];
  try { people = await Store.all(); } catch (error) { return showIdentifyResult(null, null, error.message); }
  let best = { person: null, distance: Infinity };
  for (const candidate of people) { const distance = descriptors.reduce((sum, d) => sum + Engine.distanceAgainstPerson(d, candidate), 0) / descriptors.length; if (distance < best.distance) best = { person: candidate, distance }; }
  await new Promise(resolve => setTimeout(resolve, 350));
  if (!identifyRunning) return; setVerifyStep(3, 'done'); progress.style.width = '100%';
  showIdentifyResult(best.person, best, null, Math.round(performance.now() - started));
}
function showIdentifyResult(person, best, reason, elapsed) {
  identifyRunning = false; stopCamera();
  if (reason) { app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="result-card reject"><div class="result-round">${icon('close', 34)}</div><p class="eyebrow">IDENTIFICACIÓN INCOMPLETA</p><h1>No se pudo identificar</h1><p>${e(reason)}</p><button class="button dark full" onclick="restartIdentify()">Reintentar</button></section></main>`; return; }
  const match = person && Engine.isMatch(best.distance);
  const confidence = person ? Engine.confidence(best.distance) : 0;
  sessionLog.push({ type: 'identify', match: !!match, confidence, ts: Date.now() });
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="result-card ${match ? 'approve' : 'reject'}"><div class="result-round">${match ? icon('shield', 34) : icon('userSearch', 34)}</div><p class="eyebrow">RESULTADO DE IDENTIFICACIÓN</p><h1>${match ? 'Persona identificada' : 'Nadie coincide lo suficiente'}</h1>${match ? `<div class="identify-match">${avatar(person, 'profile-avatar')}<div><b>${e(person.name)}</b><span>${e(person.code || 'Sin código')} · ${e(person.career || 'Sin grupo')}</span></div></div>` : `<p>El rostro no coincide con ninguna identidad registrada con suficiente confianza${person ? ` (la más cercana fue <b>${e(person.name)}</b>)` : ''}.</p>`}<div class="match-box"><div><span>Puntuación de similitud</span><b>${confidence}%</b></div><i><em style="width:${confidence}%"></em></i><small>Distancia biométrica: ${person ? best.distance.toFixed(3) : '—'} · umbral: ${Engine.MATCH_THRESHOLD}</small></div><div class="result-meta"><span>${icon('check', 16)} 3 lecturas estables</span><span>${icon('bolt', 16)} ${elapsed} ms</span><span>${icon('lock', 16)} comparación local</span></div><div class="result-actions"><button class="button dark" onclick="restartIdentify()">${icon('userSearch', 17)} Nueva identificación</button><button class="button light" onclick="location.hash='#/panel'">Volver al panel</button></div></section></main>`;
}

async function renderVerify(id) {
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><div class="loading-card">Preparando verificación…</div></main>`;
  try {
    const person = await Store.get(id); app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="verify-card"><div class="verify-person">${avatar(person)}<div><span>IDENTIDAD SELECCIONADA</span><b>${e(person.name)}</b><small>${e(person.code || 'Sin código')}</small></div></div><div class="camera-shell verify-camera"><video id="video" autoplay muted playsinline></video><canvas id="overlay"></canvas><div class="face-guide" id="faceGuide"><i></i><i></i><i></i><i></i></div><div class="scan-overlay"><span>ANÁLISIS BIOMÉTRICO</span></div></div><div class="verify-steps"><div id="vstep1" class="active"><i>1</i><span>Detectar rostro</span></div><div id="vstep2"><i>2</i><span>Extraer rasgos</span></div><div id="vstep3"><i>3</i><span>Comparar identidad</span></div></div><div class="verify-progress"><i id="verifyProgress"></i></div><p class="camera-status" id="verifyStatus">Iniciando cámara…</p><div class="liveness-meter" id="livenessMeter"><span>${icon('scan',14)} Prueba de vida</span><i><em id="livenessFill"></em></i></div><button class="button light full" onclick="location.hash='#/panel'">Cancelar</button></section></main>`; startVerification(person);
  } catch (error) { renderServerError(error); }
}
function setVerifyStep(number, state) { const element = document.getElementById('vstep' + number); if (!element) return; element.className = state; }
async function startVerification(person) {
  const status = document.getElementById('verifyStatus'); const loopId = ++cameraLoop;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no admite cámara.');
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    const video = document.getElementById('video'); if (!video || loopId !== cameraLoop) return; video.srcObject = currentStream; await video.play(); await Engine.loadModels(); verifyRunning = true; drawVerifyLoop(loopId); status.textContent = 'Ubica un solo rostro dentro del marco y parpadea con naturalidad…'; runVerification(video, person);
  } catch (error) { status.innerHTML = `<b>No pudimos activar la cámara.</b> ${e(cameraMessage(error))}`; }
}
async function drawVerifyLoop(loopId) { const video = document.getElementById('video'), canvas = document.getElementById('overlay'), guide = document.getElementById('faceGuide'); if (!video || loopId !== cameraLoop) return; if (video.readyState >= 2) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; const faces = await Engine.detectOnly(video); const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); if (faces.length === 1) { const box = faces[0].detection.box; ctx.strokeStyle = '#39d98a'; ctx.lineWidth = 3; ctx.strokeRect(box.x, box.y, box.width, box.height); guide?.classList.add('ready'); } else guide?.classList.remove('ready'); } if (loopId === cameraLoop) requestAnimationFrame(() => drawVerifyLoop(loopId)); }
async function runVerification(video, person) {
  const status = document.getElementById('verifyStatus'), progress = document.getElementById('verifyProgress'), livenessFill = document.getElementById('livenessFill'); setVerifyStep(1, 'active'); progress.style.width = '12%'; const descriptors = []; const earSamples = []; const started = performance.now(); let blinked = false;
  while (verifyRunning && performance.now() - started < 13000 && !(descriptors.length >= 3 && blinked)) {
    if (video.readyState >= 2) {
      const analysis = await Engine.analyze(video);
      if (analysis.result) earSamples.push(Engine.earFromLandmarks(analysis.result.landmarks));
      if (!blinked && Engine.blinkDetected(earSamples)) blinked = true;
      if (livenessFill) livenessFill.style.width = Math.min(100, Math.round((Engine.earRange(earSamples) / 0.035) * 100)) + '%';
      if (analysis.result && analysis.coverage >= .13 && descriptors.length < 3) { descriptors.push(analysis.result.descriptor); progress.style.width = `${12 + descriptors.length * 16}%`; }
      status.textContent = descriptors.length < 3
        ? `Rostro estable detectado (${descriptors.length}/3)… mira a la cámara con naturalidad`
        : (blinked ? 'Prueba de vida confirmada ✓ finalizando…' : 'Listo, confirmando que hay una persona real…');
    }
    await new Promise(resolve => setTimeout(resolve, 320));
  }
  if (!verifyRunning) return;
  if (descriptors.length < 3) return showVerificationResult(person, null, false, 'No pudimos obtener tres lecturas estables. Revisa la iluminación y mantén un solo rostro en cámara.');
  if (!blinked) return showVerificationResult(person, null, false, 'No detectamos señales de una persona real durante la lectura. Por seguridad, no se verifica a partir de fotos o pantallas — inténtalo de nuevo frente a la cámara, en persona.');
  setVerifyStep(1, 'done'); setVerifyStep(2, 'active'); progress.style.width = '62%'; status.textContent = 'Extrayendo patrón biométrico…'; await new Promise(resolve => setTimeout(resolve, 380));
  const targetDistance = descriptors.reduce((sum, descriptor) => sum + Engine.distanceAgainstPerson(descriptor, person), 0) / descriptors.length;
  setVerifyStep(2, 'done'); setVerifyStep(3, 'active'); progress.style.width = '84%'; status.textContent = 'Comparando con el registro seleccionado…';
  const people = await Store.all(); let nearest = { person: null, distance: Infinity };
  for (const candidate of people) { const distance = descriptors.reduce((sum, descriptor) => sum + Engine.distanceAgainstPerson(descriptor, candidate), 0) / descriptors.length; if (distance < nearest.distance) nearest = { person: candidate, distance }; }
  await new Promise(resolve => setTimeout(resolve, 350));
  if (!verifyRunning) return; setVerifyStep(3, 'done'); progress.style.width = '100%'; showVerificationResult(person, { distance: targetDistance, confidence: Engine.confidence(targetDistance), nearest, elapsed: Math.round(performance.now() - started) }, Engine.isMatch(targetDistance));
}
function showVerificationResult(person, data, match, reason = '') {
  verifyRunning = false; stopCamera();
  if (!data) { app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="result-card reject"><div class="result-round">${icon('close', 34)}</div><p class="eyebrow">VERIFICACIÓN INCOMPLETA</p><h1>No se pudo verificar</h1><p>${e(reason)}</p><button class="button dark full" onclick="restartVerification('${e(person.id)}')">Reintentar</button></section></main>`; return; }
  const other = !match && data.nearest.person && data.nearest.person.id !== person.id && Engine.isMatch(data.nearest.distance);
  sessionLog.push({ type: 'verify', match: !!match, confidence: data.confidence, ts: Date.now() });
  app.innerHTML = `${nav(true)}<main class="workspace narrow"><section class="result-card ${match ? 'approve' : 'reject'}"><div class="result-round">${match ? icon('shield', 34) : icon('close', 34)}</div><p class="eyebrow">RESULTADO DE VERIFICACIÓN</p><h1>${match ? 'Identidad verificada' : 'Identidad no coincide'}</h1><p>${match ? `La lectura facial coincide con el registro de <b>${e(person.name)}</b>.` : `El rostro detectado no coincide suficientemente con el registro de <b>${e(person.name)}</b>.`}</p>${other ? `<div class="nearest-warning">${icon('users', 18)} La lectura se parece más a <b>${e(data.nearest.person.name)}</b>. Se rechazó la verificación para evitar una suplantación.</div>` : ''}<div class="match-box"><div><span>Puntuación de similitud</span><b>${data.confidence}%</b></div><i><em style="width:${data.confidence}%"></em></i><small>Puntuación visual; distancia biométrica: ${data.distance.toFixed(3)} · umbral: ${Engine.MATCH_THRESHOLD}</small></div><div class="result-meta"><span>${icon('check', 16)} 3 lecturas estables</span><span>${icon('bolt', 16)} ${data.elapsed} ms</span><span>${icon('lock', 16)} comparación local</span></div><div class="result-actions"><button class="button dark" onclick="restartVerification('${e(person.id)}')">${icon('scan', 17)} Nueva verificación</button><button class="button light" onclick="location.hash='#/panel'">Volver al panel</button></div></section></main>`;
}
