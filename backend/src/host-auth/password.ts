import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const pattern = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, 'hex'), 64, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function isPasswordHash(value: string): boolean {
  return pattern.test(value);
}

export async function hashHostPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyHostPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const match = pattern.exec(hash);
  if (!match) return false;
  return timingSafeEqual(
    await derive(password, match[1]),
    Buffer.from(match[2], 'hex'),
  );
}
