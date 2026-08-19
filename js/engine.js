/* FaceAuthEdu: motor biométrico local y cliente de persistencia. */
const Engine = (() => {
  const MODEL_URL = 'models';
  const MATCH_THRESHOLD = 0.48;
  const ENROLLMENT_THRESHOLD = 0.44;
  let modelsReady = false;

  const options = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.55 });

  async function loadModels() {
    if (modelsReady) return;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsReady = true;
  }

  async function analyze(input) {
    await loadModels();
    const faces = await faceapi.detectAllFaces(input, options()).withFaceLandmarks().withFaceDescriptors();
    if (faces.length !== 1) return { result: null, faces: faces.length, quality: 0 };
    const result = faces[0];
    const w = input.videoWidth || input.naturalWidth || input.width || 1;
    const h = input.videoHeight || input.naturalHeight || input.height || 1;
    const box = result.detection.box;
    const coverage = Math.min(box.width / w, box.height / h);
    const quality = Math.max(0, Math.min(100, (result.detection.score * 55) + (Math.min(coverage / 0.33, 1) * 45)));
    return { result, faces: 1, quality, coverage };
  }

  async function detectOnly(input) {
    const faces = await faceapi.detectAllFaces(input, options()).withFaceLandmarks();
    return faces;
  }

  function euclideanDistance(a, b) { return faceapi.euclideanDistance(a, b); }

  // ---- Prueba de vida básica: variación natural del ojo (Eye Aspect Ratio) ----
  // Una foto o pantalla mostrando un rostro estático no tiene NINGÚN movimiento ocular real:
  // el EAR se mantiene prácticamente plano cuadro a cuadro. Una persona real, incluso sin
  // parpadear a propósito, siempre tiene variación natural (parpadeos, micro-movimientos).
  // En vez de exigir un ciclo estricto "cerrado→abierto" (frágil ante el ruido del modelo
  // de landmarks, sobre todo con lentes), medimos el RANGO de variación: mucho más robusto.
  const EAR_RANGE_MIN = 0.035; // diferencia mínima entre el punto más "cerrado" y el más "abierto"
  function distance2D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function eyeAspectRatio(points) {
    if (!points || points.length < 6) return null;
    return (distance2D(points[1], points[5]) + distance2D(points[2], points[4])) / (2 * distance2D(points[0], points[3]));
  }
  function earFromLandmarks(landmarks) {
    if (!landmarks) return null;
    const left = eyeAspectRatio(landmarks.getLeftEye());
    const right = eyeAspectRatio(landmarks.getRightEye());
    if (left == null || right == null) return null;
    return (left + right) / 2;
  }
  function earRange(earSamples) {
    const valid = (earSamples || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
    if (valid.length < 5) return 0;
    return Math.max(...valid) - Math.min(...valid);
  }
  function blinkDetected(earSamples) { return earRange(earSamples) >= EAR_RANGE_MIN; }

  function descriptorsOf(person) { return person.descriptors || (person.samples || []).map(sample => sample.descriptor); }
  function bestDistance(descriptor, samples) {
    return samples.reduce((best, item) => Math.min(best, euclideanDistance(descriptor, new Float32Array(item.descriptor || item))), Infinity);
  }
  function bestDistanceAgainstPerson(descriptor, person) {
    return bestDistance(descriptor, descriptorsOf(person));
  }
  function distanceAgainstPerson(descriptor, person) {
    const vectors = descriptorsOf(person);
    if (!vectors.length) return Infinity;
    const prototype = new Float32Array(128);
    for (const item of vectors) {
      const vector = item.descriptor || item;
      for (let i = 0; i < 128; i++) prototype[i] += vector[i] / vectors.length;
    }
    return euclideanDistance(descriptor, prototype);
  }
  function isConsistent(descriptor, samples) {
    return !samples.length || bestDistance(descriptor, samples) <= ENROLLMENT_THRESHOLD;
  }
  function confidence(distance) {
    return Math.max(0, Math.min(99, Math.round(Math.exp(-0.8 * distance) * 100)));
  }
  function isMatch(distance) { return distance <= MATCH_THRESHOLD; }

  return {
    loadModels, analyze, detectOnly, euclideanDistance, bestDistanceAgainstPerson, distanceAgainstPerson,
    isConsistent, confidence, isMatch, earFromLandmarks, earRange, blinkDetected,
    get ready() { return modelsReady; },
    MATCH_THRESHOLD, ENROLLMENT_THRESHOLD,
  };
})();

/* ============================================================
   Almacén de identidades — IndexedDB del navegador.
   Funciona igual en local y en Vercel (no depende de un servidor
   con disco persistente, que Vercel no ofrece). Misma interfaz que
   antes (all/get/add/remove/removeSample) para no tocar el resto
   de app.js.
   ============================================================ */
const Store = (() => {
  const DB_NAME = 'faceauthedu';
  const DB_VERSION = 1;
  const STORE = 'people';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('No se pudo abrir el almacenamiento del navegador.'));
    });
    return dbPromise;
  }
  async function tx(mode) { const db = await openDB(); return db.transaction(STORE, mode).objectStore(STORE); }
  const genId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return {
    async all() {
      const store = await tx('readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
        req.onerror = () => reject(req.error);
      });
    },
    async get(id) {
      const store = await tx('readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => req.result ? resolve(req.result) : reject(new Error('No se encontró la persona solicitada.'));
        req.onerror = () => reject(req.error);
      });
    },
    async add(person) {
      const name = String(person.name || '').trim();
      const samples = Array.isArray(person.samples) ? person.samples : [];
      if (!name || name.length > 100) throw new Error('Ingresa un nombre válido.');
      if (samples.length < 3 || samples.length > 12) throw new Error('El registro requiere entre 3 y 12 muestras faciales.');
      for (const sample of samples) {
        if (!sample.photo || !Array.isArray(sample.descriptor) || sample.descriptor.length !== 128) throw new Error('Una muestra facial no tiene un formato válido.');
      }
      const record = {
        id: genId(), name, code: String(person.code || '').trim().slice(0, 60), career: String(person.career || '').trim().slice(0, 100),
        samples, avatar: samples[0].photo, createdAt: new Date().toISOString(),
      };
      const store = await tx('readwrite');
      return new Promise((resolve, reject) => { const req = store.add(record); req.onsuccess = () => resolve(record); req.onerror = () => reject(req.error); });
    },
    async remove(id) {
      const store = await tx('readwrite');
      return new Promise((resolve, reject) => { const req = store.delete(id); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); });
    },
    async removeSample(id, index) {
      const person = await this.get(id);
      if (!Number.isInteger(index) || index < 0 || index >= person.samples.length) throw new Error('Muestra inválida.');
      if (person.samples.length <= 3) throw new Error('Conserva al menos tres muestras para mantener un registro fiable.');
      person.samples.splice(index, 1);
      person.avatar = person.samples[0].photo;
      const store = await tx('readwrite');
      return new Promise((resolve, reject) => { const req = store.put(person); req.onsuccess = () => resolve(person); req.onerror = () => reject(req.error); });
    },
  };
})();
