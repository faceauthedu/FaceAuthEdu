# FaceAuthEdu

Aplicación local de demostración para registro y verificación facial. El reconocimiento se ejecuta en el navegador con `face-api.js`; el servidor local guarda cada registro dentro de este proyecto, en `data/people/<persona_id>/`, y ahora también puede enviar correos automáticos desde el formulario de contacto.

## Ejecutar

Requiere Node.js 20 o superior. Las dependencias (`nodemailer`, `dotenv`) ya vienen instaladas en `node_modules/` dentro de este zip, así que puedes arrancar directo.

En Windows, abre `Iniciar-FaceAuthEdu.bat` con doble clic (instala dependencias solo si faltan).

```powershell
cd FaceAuthEdu
node server.js
```

Abre `http://localhost:8000` en Chrome o Edge y autoriza la cámara. No abras `index.html` directamente: la cámara, el guardado y el correo requieren el servidor local.

## Activar el correo automático del formulario

El formulario de "Solicita información" envía un correo automático a la dirección que la persona escriba (y una copia interna a tu Gmail), usando tu propia cuenta de Gmail.

1. Copia `.env.example` como `.env` en la raíz del proyecto.
2. En tu cuenta de Gmail (`faceauthedu@gmail.com`), activa la verificación en dos pasos si no la tienes.
3. Genera una "contraseña de aplicación" en <https://myaccount.google.com/apppasswords> (elige app "Correo" y dispositivo "Otro").
4. Pega esa contraseña (16 caracteres) en `.env`:

   ```env
   GMAIL_USER=faceauthedu@gmail.com
   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
   ```
5. Reinicia el servidor. Prueba el formulario: la persona recibe un correo de bienvenida y tú recibes una copia con sus datos.

Si `.env` no está configurado, el formulario avisa con un error claro y sigue mostrando WhatsApp/Instagram/correo como alternativas — nunca se rompe la página.

**Importante:** nunca subas tu `.env` real a GitHub (ya está en `.gitignore`). En Vercel, configura `GMAIL_USER` y `GMAIL_APP_PASSWORD` como variables de entorno del proyecto en vez de un archivo `.env`.

## Base de datos local

Al guardar una identidad se crea una carpeta como esta:

```text
data/people/
  andrea-salas_p_xxxxxx/
    foto_1.jpg
    foto_2.jpg
    foto_3.jpg
    foto_4.jpg
    data.json
```

`data/people` está ignorada en Git para no publicar fotografías ni vectores biométricos por accidente. Al clonar desde GitHub, el proyecto trae la estructura vacía y crea los registros localmente al ejecutarse.

## Qué hay de nuevo en esta versión

- **Formulario de contacto real**: envía y recibe correo automático (Gmail vía `nodemailer`), con WhatsApp e Instagram como alternativas siempre visibles.
- **Identificar persona (1:N)**: en el Panel, botón "Identificar a alguien" — escanea un rostro sin elegir a nadie antes y el sistema busca la coincidencia más cercana en todo el directorio.
- **Pie de página con enlaces reales**: WhatsApp (`wa.me/51951175185`), Instagram (`@faceauthedu`) y correo (`faceauthedu@gmail.com`), con iconos propios.
- **Testimonios interactivos**: carrusel con flechas, puntos, autoplay y swipe en móvil.
- **Animaciones estilo Face ID**: barrido tipo radar y pulso en el marco de la cámara al registrar/verificar/identificar, progreso animado, resultado con efecto de aparición.
- **Fondo con más vida**: formas difuminadas en movimiento lento detrás de cada sección, y aparición progresiva de tarjetas al hacer scroll.
- **Detección más precisa**: el detector facial ahora analiza la imagen a mayor resolución (416→512px), mejor para ángulos y rostros más pequeños en cámara.

## Controles de reconocimiento ya implementados

- Cámara con mensajes claros de permisos y disponibilidad.
- Mínimo de tres muestras por persona; la cámara guiada toma cuatro variando la orientación (prueba de presencia guiada).
- Una sola cara por muestra y control de tamaño mínimo del rostro.
- Comparación de consistencia durante el registro: una foto de otra persona se rechaza antes de guardar.
- **Prueba de vida por parpadeo (mejorada)**: mide la apertura de los ojos (Eye Aspect Ratio) durante toda la lectura, y ahora **espera hasta 13 segundos** a que ocurra un parpadeo natural en vez de cortar la lectura apenas se obtienen las 3 muestras — así no se corta la ventana antes de que puedas parpadear. Si nunca detecta un parpadeo real, rechaza el intento (evita fotos/pantallas). No requiere ningún modelo adicional: usa los mismos 68 puntos faciales que ya se calculaban.
- Verificación con tres lecturas estables, umbral biométrico y búsqueda de la identidad más cercana para señalar posibles suplantaciones.
- Identificación 1:N contra todo el directorio, sin preseleccionar a nadie.
- Eliminación de fotos antes de guardar y desde el perfil (conservando siempre tres muestras como mínimo).

**Importante sobre la prueba de vida:** esto es una heurística práctica (parpadeo real), no una prueba de vida certificada. Sigue sin ser infalible contra un ataque muy sofisticado (por ejemplo, un video que ya incluye parpadeos), pero bloquea el caso más común y fácil de intentar: mostrar una foto fija de la persona en un celular o impresa.

### Ideas para mejorar aún más el reconocimiento

- Aumentar a 5-6 muestras por persona con más variación de luz/ángulo (ahora mismo son 4 automáticas + hasta 12 si subes fotos).
- Sumar una prueba de parpadeo (además del giro de cabeza actual) para reforzar la prueba de presencia.
- Usar `SsdMobilenetv1` (más preciso pero más pesado) solo en el momento del registro, y `TinyFaceDetector` para la verificación en vivo (más rápido).
- Ajustar `MATCH_THRESHOLD`/`ENROLLMENT_THRESHOLD` en `js/engine.js` según tus pruebas reales: más bajo = más estricto.

## Importante

Esto es una demostración educativa, no un sistema de seguridad certificado ni una prueba de vida anti-spoofing profesional. No registra ni verifica a ninguna persona sin su consentimiento explícito. Para uso multiusuario o despliegue público se necesita autenticación, HTTPS, control de acceso y una base de datos/almacenamiento seguro del lado del servidor.
"# FaceAuthEdu" 
