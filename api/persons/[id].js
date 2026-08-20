import { sql } from '../../lib/db.js';

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
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
    throw new Error('No se encontró la persona solicitada.');
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

export default async function handler(req, res) {
  const id = String(req.query.id || '').trim();

  if (!id) {
    return sendError(res, 400, 'ID de persona requerido.');
  }

  try {
    if (req.method === 'GET') {
      const person = await getPerson(id);
      return res.status(200).json(person);
    }

    if (req.method === 'DELETE') {
      const result = await sql`
        DELETE FROM people
        WHERE id = ${id}
        RETURNING id
      `;

      if (!result.length) {
        return sendError(
          res,
          404,
          'No se encontró la persona solicitada.'
        );
      }

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const action = req.body?.action;

      if (action !== 'removeSample') {
        return sendError(res, 400, 'Acción no válida.');
      }

      const index = Number(req.body?.index);

      if (!Number.isInteger(index) || index < 0) {
        return sendError(res, 400, 'Índice de muestra inválido.');
      }

      const samples = await sql`
        SELECT
          id,
          photo,
          descriptor
        FROM samples
        WHERE person_id = ${id}
        ORDER BY id ASC
      `;

      if (!samples.length) {
        return sendError(res, 404, 'No existen muestras.');
      }

      if (samples.length <= 3) {
        return sendError(
          res,
          400,
          'Conserva al menos tres muestras para mantener un registro fiable.'
        );
      }

      if (index >= samples.length) {
        return sendError(res, 400, 'Muestra inválida.');
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

      return res.status(200).json(
        await getPerson(id)
      );
    }

    res.setHeader('Allow', 'GET, DELETE, PATCH');
    return sendError(res, 405, 'Método no permitido.');
  } catch (error) {
    console.error(`API /persons/${id}:`, error);

    if (error.message === 'No se encontró la persona solicitada.') {
      return sendError(res, 404, error.message);
    }

    return sendError(
      res,
      500,
      error.message || 'Error interno del servidor.'
    );
  }
}