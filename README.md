# FaceAuthEdu

Aplicación de demostración para registro y verificación facial. El reconocimiento se ejecuta 100% en el navegador con `face-api.js` (TensorFlow.js) — detección, extracción de rasgos, comparación biométrica y prueba de vida por variación ocular, todo del lado del cliente.

Funciona igual **en tu PC** (con `local-server.js`) y **desplegado en Vercel** (con las funciones en `/api`). Sigue leyendo para entender qué cambió y por qué.

## ⚠️ Cambio importante: dónde se guardan los registros

Antes, un servidor local guardaba cada persona como una carpeta en `data/people/`. Eso **no funciona en Vercel**: Vercel no ofrece un disco persistente para escribir archivos entre visitas (cada función corre en un entorno temporal que se borra), así que cualquier cosa guardada ahí desaparece casi de inmediato. Por eso, al subir el proyecto tal cual, ni siquiera cargaba (`"Archivo no encontrado"`).

La solución actual guarda los registros en **Neon PostgreSQL**, conectado desde las funciones de Vercel. Las fotos y los vectores se cifran con AES-256-GCM antes de insertarse en la base de datos; la comparación facial sigue ejecutándose en el navegador. Esto significa:

- ✅ Funciona igual de bien en local y en Vercel, sin diferencias de comportamiento.
- ✅ Los datos biométricos se cifran en reposo con AES-256-GCM y la comparación facial se realiza localmente en el navegador.
- ✅ Las identidades están disponibles desde distintos dispositivos porque la base de datos es compartida.
- ⚠️ El navegador recibe los datos necesarios para realizar la comparación. Para producción institucional conviene añadir autenticación de operadores, control de acceso y rotación formal de claves.

El formulario de contacto (correo automático) sí es igual de funcional en ambos lados, porque no depende de guardar nada — solo envía un correo en el momento.

## 1. Probarlo en tu PC

Requiere Node.js 20+. En Windows, doble clic en `Iniciar-FaceAuthEdu.bat` (instala dependencias la primera vez). O manualmente:

```powershell
cd FaceAuthEdu
node local-server.js
```

Abre `http://localhost:8000` en Chrome o Edge y autoriza la cámara. No abras `index.html` directamente con doble clic — la cámara necesita `http://`, no `file://`.

## 2. Desplegar en Vercel

1. Sube el proyecto a GitHub (sin `node_modules/`, sin `.env` — ya están en `.gitignore`).
2. En vercel.com → "Add New… → Project" → importa el repo.
3. Framework Preset: **Other**. No hace falta Build Command ni Output Directory — el `vercel.json` incluido ya le dice a Vercel que solo construya `/api/*.js` como funciones y sirva el resto como sitio estático.
4. Antes de darle Deploy (o después, en Settings → Environment Variables), agrega:
   - `GMAIL_USER` = `faceauthedu@gmail.com`
   - `GMAIL_APP_PASSWORD` = tu contraseña de aplicación de Gmail (ver siguiente sección)
   - `BIOMETRIC_ENCRYPTION_KEY` = una clave aleatoria larga para cifrar fotos y vectores
5. Deploy. La URL que te da Vercel ya sirve todo por HTTPS, así que la cámara funciona sin configurar nada extra.

Si cambias el correo del formulario de contacto más adelante, solo actualiza esas dos variables de entorno en Vercel — no hace falta tocar código.

La ruta `GET /api/security-status` permite verificar el estado sin devolver fotos ni claves. La interfaz muestra `Cifrado verificado · AES-256-GCM` cuando todos los registros comprobados están cifrados. Configura `BIOMETRIC_ENCRYPTION_KEY` explícitamente en Vercel; si falta, el proyecto usa temporalmente `DATABASE_URL` como respaldo para no dejar inaccesibles los datos existentes.

## Activar el correo automático del formulario

El formulario de "Solicita información" envía un correo a quien lo llena (y una copia interna a tu Gmail), usando tu propia cuenta de Gmail vía `nodemailer`.

1. En tu cuenta de Gmail, activa la verificación en dos pasos si no la tienes.
2. Genera una "contraseña de aplicación" en <https://myaccount.google.com/apppasswords> (app "Correo", dispositivo "Otro").
3. **En local:** copia `.env.example` como `.env` y pega ahí `GMAIL_USER` y `GMAIL_APP_PASSWORD`.
4. **En Vercel:** pega esas mismas dos variables en Settings → Environment Variables del proyecto (nunca subas `.env` a GitHub).

Si no está configurado, el formulario avisa con un mensaje claro y WhatsApp/Instagram quedan como alternativa — nunca se rompe la página.

## Estructura del proyecto

```text
index.html, css/, js/, models/, assets/   → sitio estático (se sirve solo, sin backend)
api/contact.js                            → función serverless de Vercel (envío de correo)
lib/mailer.js                             → lógica de correo compartida por server.js y api/contact.js
local-server.js                           → SOLO para desarrollo local (node local-server.js)
vercel.json                               → le dice a Vercel qué construir (evita que intente ejecutar server.js)
```

## Reconocimiento facial: qué controles tiene

- Cámara con mensajes claros de permisos y disponibilidad.
- Registro con 4 tomas guiadas (o entre 3 y 12 fotos subidas), validando que todas sean la misma persona antes de guardar.
- Comparación por distancia biométrica contra el promedio de las muestras registradas.
- **Prueba de vida**: mide la variación natural del ojo (Eye Aspect Ratio) durante la lectura, con una barra visible en pantalla. Una foto o pantalla estática no tiene esa variación y el sistema la rechaza — no requiere ningún modelo adicional, usa los mismos 68 puntos faciales que ya se calculaban.
- Identificación 1:N contra todo el directorio, sin preseleccionar a nadie.
- Eliminar fotos individuales o el registro completo desde el perfil de cada persona.

**Importante:** esto es una demostración educativa, no un sistema de seguridad certificado. La prueba de vida es una heurística práctica (bloquea el caso más común: mostrar una foto fija), no una prueba anti-spoofing profesional. No registra ni verifica a nadie sin su consentimiento explícito.
