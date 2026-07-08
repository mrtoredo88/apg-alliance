import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT = { N: 16384, r: 8, p: 1 };

export function requireStrongAdminPassword(password) {
  const value = String(password || '');
  if (value.length < 10 || !/[A-ZА-Я]/.test(value) || !/[a-zа-я]/.test(value) || !/\d/.test(value)) {
    const error = new Error('Пароль администратора должен быть не короче 10 символов и содержать буквы разного регистра и цифру.');
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export function createPasswordRecord(password) {
  const value = requireStrongAdminPassword(password);
  const salt = randomBytes(24).toString('base64url');
  const hash = scryptSync(value, salt, KEY_LENGTH, SCRYPT).toString('base64url');
  return {
    algorithm: 'scrypt',
    hash,
    salt,
    keyLength: KEY_LENGTH,
    params: SCRYPT,
  };
}

export function verifyPasswordRecord(password, record = {}) {
  if (record.algorithm !== 'scrypt' || !record.hash || !record.salt) return false;
  const params = record.params || SCRYPT;
  const keyLength = Number(record.keyLength || KEY_LENGTH);
  const expected = Buffer.from(String(record.hash), 'base64url');
  const actual = scryptSync(String(password || ''), String(record.salt), keyLength, params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
