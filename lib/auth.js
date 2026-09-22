import { scrypt, randomBytes } from 'crypto';
import { getDb } from './db.js';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve({ salt, hash: derivedKey.toString('hex') });
    });
  });
}

export async function verifyPassword(password, hash, salt) {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['envelope_session'];
  if (!token) return null;

  const db = await getDb();
  const session = await db.collection('sessions').findOne({ token });
  if (!session || session.expiresAt < Date.now()) return null;

  const user = await db.collection('users').findOne({ id: session.userId });
  if (!user) return null;

  return { id: user.id, email: user.email, name: user.name };
}
