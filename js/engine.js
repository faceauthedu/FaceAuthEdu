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

const Store = (() => {
  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
    return body;
  }
  return {
    all: async () => (await request('/api/people')).people,
    get: async (id) => (await request(`/api/people/${encodeURIComponent(id)}`)).person,
    add: async (person) => (await request('/api/people', { method: 'POST', body: JSON.stringify(person) })).person,
    remove: async (id) => request(`/api/people/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    removeSample: async (id, index) => (await request(`/api/people/${encodeURIComponent(id)}/samples/${index}`, { method: 'DELETE' })).person,
  };
})();
