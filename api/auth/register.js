import { getDb } from '../../lib/db.js';
import { hashPassword } from '../../lib/auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Eksik bilgi' });
    }

    const db = await getDb();
    const users = db.collection('users');

    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Bu e-posta ile zaten kayıtlı bir hesap var.' });
    }

    const { salt, hash } = await hashPassword(password);
    
    const newUser = {
      id: randomUUID(),
      email,
      name,
      passwordHash: hash,
      salt,
      createdAt: Date.now()
    };

    await users.insertOne(newUser);
    return res.status(200).json({ success: true, message: 'Kayıt başarılı.' });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
