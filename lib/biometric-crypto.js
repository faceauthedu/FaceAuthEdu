import crypto from 'node:crypto';

const keySource = process.env.BIOMETRIC_ENCRYPTION_KEY || process.env.DATABASE_URL;

if (!keySource) {
  throw new Error('Configura BIOMETRIC_ENCRYPTION_KEY o DATABASE_URL.');
}

const key = crypto.createHash('sha256').update(keySource).digest();

export function encryptValue(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plainText = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plainText), cipher.final()]);

  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url')
  });
}

export function decryptValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value;

  let payload;
  try {
    payload = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return value;
  }

  if (!payload || payload.v !== 1 || !payload.iv || !payload.tag || !payload.data) {
    return value;
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(payload.iv, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const plainText = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final()
    ]);
    return JSON.parse(plainText.toString('utf8'));
  } catch {
    throw new Error('No se pudo descifrar un dato biométrico.');
  }
}
