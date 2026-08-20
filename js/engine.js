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
   Almacén de identidades — API + Neon PostgreSQL.
   Mantiene la misma interfaz usada por app.js.
   ============================================================ */

const Store = (() => {

  const API = '/api/persons';

  function normalizePerson(person) {
    return {
      id: person.id,
      name: person.name,
      code: person.code || '',
      career: person.career || '',
      avatar: person.avatar || null,
      createdAt: person.createdAt,
      samples: Array.isArray(person.samples)
        ? person.samples.map(sample => ({
            photo: sample.photo,
            descriptor: Array.isArray(sample.descriptor)
              ? sample.descriptor
              : []
          }))
        : []
    };
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        body.error || 'No se pudo completar la operación.'
      );
    }

    return body;
  }

  const genId = () =>
    `p_${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  return {

    async all() {
      const people = await request(API);
      return people.map(normalizePerson);
    },

    async get(id) {
      const person = await request(
        `${API}/${encodeURIComponent(id)}`
      );

      return normalizePerson(person);
    },

    async add(person) {

      const name = String(person.name || '').trim();

      const samples = Array.isArray(person.samples)
        ? person.samples
        : [];

      if (!name || name.length > 100) {
        throw new Error('Ingresa un nombre válido.');
      }

      if (samples.length < 3 || samples.length > 12) {
        throw new Error(
          'El registro requiere entre 3 y 12 muestras faciales.'
        );
      }

      for (const sample of samples) {
        if (
          !sample.photo ||
          !Array.isArray(sample.descriptor) ||
          sample.descriptor.length !== 128
        ) {
          throw new Error(
            'Una muestra facial no tiene un formato válido.'
          );
        }
      }

      const record = {
        id: genId(),
        name,
        code: String(person.code || '')
          .trim()
          .slice(0, 60),
        career: String(person.career || '')
          .trim()
          .slice(0, 100),
        samples
      };

      const saved = await request(API, {
        method: 'POST',
        body: JSON.stringify(record)
      });

      return normalizePerson(saved);
    },

    async remove(id) {
      await request(
        `${API}/${encodeURIComponent(id)}`,
        {
          method: 'DELETE'
        }
      );
    },

    async removeSample(id, index) {

      const person = await request(
        `${API}/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'removeSample',
            index
          })
        }
      );

      return normalizePerson(person);
    }

  };

})();