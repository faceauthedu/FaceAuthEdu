import 'dotenv/config';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sendContactEmail, isEmail } from './lib/mailer.js';
import { sql } from './lib/db.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(
  process.env.FACEAUTH_PORT ||
  process.env.PORT ||
  8000
);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bin': 'application/octet-stream'
};

const send = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  res.end(JSON.stringify(body));
};

async function body(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > 10 * 1024 * 1024) {
      throw new Error('Solicitud demasiado grande.');
    }

    chunks.push(chunk);
  }

  return JSON.parse(
    Buffer.concat(chunks).toString('utf8') || '{}'
  );
}

/* ============================================================
   PERSONAS
   ============================================================ */

async function getAllPeople() {

  const people = await sql`
    SELECT
      id,
      name,
      code,
      career,
      avatar,
      created_at
    FROM people
    ORDER BY created_at DESC
  `;

  const samples = await sql`
    SELECT
      person_id,
      photo,
      descriptor
    FROM samples
    ORDER BY id ASC
  `;

  const samplesByPerson = new Map();

  for (const sample of samples) {

    if (!samplesByPerson.has(sample.person_id)) {
      samplesByPerson.set(sample.person_id, []);
    }

    samplesByPerson
      .get(sample.person_id)
      .push(sample);
  }

  return people.map(person => ({
    id: person.id,
    name: person.name,
    code: person.code || '',
    career: person.career || '',
    avatar: person.avatar || null,
    createdAt: person.created_at,
    samples: (
      samplesByPerson.get(person.id) || []
    ).map(sample => ({
      photo: sample.photo,
      descriptor: Array.isArray(sample.descriptor)
        ? sample.descriptor
        : []
    }))
  }));
}

async function getPerson(id) {

  const people = await sql`
    SELECT
      id,
      name,
      code,
      career,
      avatar,
      created_at
    FROM people
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!people.length) {
    throw new Error(
      'No se encontró la persona solicitada.'
    );
  }

  const samples = await sql`
    SELECT
      photo,
      descriptor
    FROM samples
    WHERE person_id = ${id}
    ORDER BY id ASC
  `;

  return {
    id: people[0].id,
    name: people[0].name,
    code: people[0].code || '',
    career: people[0].career || '',
    avatar: people[0].avatar || null,
    createdAt: people[0].created_at,

    samples: samples.map(sample => ({
      photo: sample.photo,
      descriptor: Array.isArray(sample.descriptor)
        ? sample.descriptor
        : []
    }))
  };
}

async function addPerson(incoming) {

  const id = String(incoming.id || '').trim();
  const name = String(incoming.name || '').trim();

  const code = String(incoming.code || '')
    .trim()
    .slice(0, 60);

  const career = String(incoming.career || '')
    .trim()
    .slice(0, 100);

  const samples = Array.isArray(incoming.samples)
    ? incoming.samples
    : [];

  if (!id) {
    throw new Error('ID de persona inválido.');
  }

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
      !sample ||
      typeof sample.photo !== 'string' ||
      !Array.isArray(sample.descriptor) ||
      sample.descriptor.length !== 128
    ) {
      throw new Error(
        'Una muestra facial no tiene un formato válido.'
      );
    }
  }

  await sql`
    INSERT INTO people (
      id,
      name,
      code,
      career,
      avatar
    )
    VALUES (
      ${id},
      ${name},
      ${code},
      ${career},
      ${samples[0].photo}
    )
  `;

  for (const sample of samples) {

    await sql`
      INSERT INTO samples (
        person_id,
        photo,
        descriptor
      )
      VALUES (
        ${id},
        ${sample.photo},
        ${JSON.stringify(sample.descriptor)}::jsonb
      )
    `;
  }

  return getPerson(id);
}

async function deletePerson(id) {

  const result = await sql`
    DELETE FROM people
    WHERE id = ${id}
    RETURNING id
  `;

  if (!result.length) {
    throw new Error(
      'No se encontró la persona solicitada.'
    );
  }
}

async function removeSample(id, index) {

  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Muestra inválida.');
  }

  const samples = await sql`
    SELECT
      id,
      photo
    FROM samples
    WHERE person_id = ${id}
    ORDER BY id ASC
  `;

  if (!samples.length) {
    throw new Error('No existen muestras.');
  }

  if (samples.length <= 3) {
    throw new Error(
      'Conserva al menos tres muestras para mantener un registro fiable.'
    );
  }

  if (index >= samples.length) {
    throw new Error('Muestra inválida.');
  }

  const sampleId = samples[index].id;

  await sql`
    DELETE FROM samples
    WHERE id = ${sampleId}
  `;

  const remaining = await sql`
    SELECT photo
    FROM samples
    WHERE person_id = ${id}
    ORDER BY id ASC
  `;

  await sql`
    UPDATE people
    SET avatar = ${remaining[0].photo}
    WHERE id = ${id}
  `;

  return getPerson(id);
}

/* ============================================================
   API
   ============================================================ */

async function api(req, res, pathname) {

  /* ---------------- CONTACTO ---------------- */

  if (
    req.method === 'POST' &&
    pathname === '/api/contact'
  ) {

    const incoming = await body(req);

    const name = String(incoming.name || '')
      .trim()
      .slice(0, 100);

    const institution = String(
      incoming.institution || ''
    )
      .trim()
      .slice(0, 120);

    const email = String(incoming.email || '')
      .trim()
      .slice(0, 160);

    const message = String(incoming.message || '')
      .trim()
      .slice(0, 500);

    if (!name || !message) {
      return send(res, 400, {
        error: 'Completa tu nombre y un mensaje.'
      });
    }

    if (!isEmail(email)) {
      return send(res, 400, {
        error: 'Ingresa un correo válido.'
      });
    }

    try {

      await sendContactEmail({
        name,
        institution,
        email,
        message
      });

      return send(res, 200, {
        ok: true
      });

    } catch (error) {

      return send(res, 502, {
        error: error.message
      });
    }
  }

  /* ---------------- PERSONAS ---------------- */

  if (
    req.method === 'GET' &&
    pathname === '/api/persons'
  ) {

    const people = await getAllPeople();

    return send(res, 200, people);
  }

  if (
    req.method === 'POST' &&
    pathname === '/api/persons'
  ) {

    try {

      const incoming = await body(req);

      const person = await addPerson(incoming);

      return send(res, 201, person);

    } catch (error) {

      console.error(error);

      if (error.code === '23505') {
        return send(res, 409, {
          error: 'Ya existe esta persona.'
        });
      }

      return send(res, 400, {
        error: error.message
      });
    }
  }

  /* ---------------- PERSONA INDIVIDUAL ---------------- */

  const personMatch = pathname.match(
    /^\/api\/persons\/([^/]+)$/
  );

  if (personMatch) {

    const id = decodeURIComponent(
      personMatch[1]
    );

    if (req.method === 'GET') {

      try {

        const person = await getPerson(id);

        return send(res, 200, person);

      } catch (error) {

        return send(res, 404, {
          error: error.message
        });
      }
    }

    if (req.method === 'DELETE') {

      try {

        await deletePerson(id);

        return send(res, 200, {
          ok: true
        });

      } catch (error) {

        return send(res, 404, {
          error: error.message
        });
      }
    }

    if (req.method === 'PATCH') {

      try {

        const incoming = await body(req);

        if (
          incoming.action !== 'removeSample'
        ) {
          return send(res, 400, {
            error: 'Acción no válida.'
          });
        }

        const index = Number(
          incoming.index
        );

        const person = await removeSample(
          id,
          index
        );

        return send(res, 200, person);

      } catch (error) {

        return send(res, 400, {
          error: error.message
        });
      }
    }
  }

  return send(res, 404, {
    error: 'Ruta no encontrada.'
  });
}

/* ============================================================
   SERVIDOR
   ============================================================ */

const server = http.createServer(
  async (req, res) => {

    try {

      const url = new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
      );

      if (
        url.pathname.startsWith('/api/')
      ) {
        return await api(
          req,
          res,
          url.pathname
        );
      }

      const requested =
        url.pathname === '/'
          ? '/index.html'
          : decodeURIComponent(url.pathname);

      const filename = path.resolve(
        ROOT,
        `.${requested}`
      );

      if (
        !filename.startsWith(
          ROOT + path.sep
        )
      ) {
        return send(
          res,
          403,
          {
            error: 'Acceso denegado.'
          }
        );
      }

      const data =
        await fs.readFile(filename);

      res.writeHead(200, {
        'Content-Type':
          mime[
            path.extname(filename)
              .toLowerCase()
          ] ||
          'application/octet-stream'
      });

      res.end(data);

    } catch (error) {

      if (error.code === 'ENOENT') {
        return send(res, 404, {
          error: 'Archivo no encontrado.'
        });
      }

      console.error(error);

      return send(res, 500, {
        error:
          error.message ||
          'Error interno.'
      });
    }
  }
);

server.listen(
  PORT,
  () => {
    console.log(
      `FaceAuthEdu disponible en http://localhost:${PORT}`
    );
  }
);