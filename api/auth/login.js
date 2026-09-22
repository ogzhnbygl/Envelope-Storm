import { getDb } from '../../lib/db.js';
import { verifyPassword } from '../../lib/auth.js';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre zorunlu' });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

    const isValid = await verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 gün

    await db.collection('sessions').insertOne({
      token,
      userId: user.id,
      expiresAt
    });

    const cookie = `envelope_session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ success: true, user: { id: user.id, name: user.name, email: user.email } });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
