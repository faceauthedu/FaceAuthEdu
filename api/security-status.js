import { sql } from '../lib/db.js';
import {
  encryptionAlgorithm,
  hasExplicitEncryptionKey,
  isEncryptedValue
} from '../lib/biometric-crypto.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const rows = await sql`
      SELECT photo, descriptor
      FROM samples
      LIMIT 50
    `;
    const encrypted = rows.filter(row =>
      isEncryptedValue(row.photo) && isEncryptedValue(row.descriptor)
    ).length;

    return res.status(200).json({
      enabled: rows.length === 0 || encrypted === rows.length,
      algorithm: encryptionAlgorithm,
      explicitKeyConfigured: hasExplicitEncryptionKey,
      recordsChecked: rows.length,
      encryptedRecords: encrypted
    });
  } catch (error) {
    console.error('API /security-status:', error);
    return res.status(500).json({ error: 'No se pudo comprobar el estado de seguridad.' });
  }
}
