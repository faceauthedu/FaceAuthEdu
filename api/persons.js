import { sql } from '../lib/db.js';

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizePerson(row, samples) {
  return {
    id: row.id,
    name: row.name,
    code: row.code || '',
    career: row.career || '',
    avatar: row.avatar || null,
    createdAt: row.created_at,
    samples: samples.map(sample => ({
      photo: sample.photo,
      descriptor: Array.isArray(sample.descriptor)
        ? sample.descriptor
        : []
    }))
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
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

        samplesByPerson.get(sample.person_id).push(sample);
      }

      return res.status(200).json(
        people.map(person =>
          normalizePerson(
            person,
            samplesByPerson.get(person.id) || []
          )
        )
      );
    }

    if (req.method === 'POST') {
      const incoming = req.body || {};

      const id = String(incoming.id || '').trim();
      const name = String(incoming.name || '').trim();
      const code = String(incoming.code || '').trim().slice(0, 60);
      const career = String(incoming.career || '').trim().slice(0, 100);
      const samples = Array.isArray(incoming.samples)
        ? incoming.samples
        : [];

      if (!id || !/^p_[a-z0-9]+$/i.test(id)) {
        return sendError(res, 400, 'ID de persona inválido.');
      }

      if (!name || name.length > 100) {
        return sendError(res, 400, 'Ingresa un nombre válido.');
      }

      if (samples.length < 3 || samples.length > 12) {
        return sendError(
          res,
          400,
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
          return sendError(
            res,
            400,
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

      return res.status(201).json({
        id,
        name,
        code,
        career,
        avatar: samples[0].photo,
        createdAt: new Date().toISOString(),
        samples
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendError(res, 405, 'Método no permitido.');
  } catch (error) {
    console.error('API /persons:', error);

    if (error.code === '23505') {
      return sendError(res, 409, 'Ya existe una persona con ese ID.');
    }

    return sendError(
      res,
      500,
      error.message || 'Error interno del servidor.'
    );
  }
}