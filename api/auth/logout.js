import { getDb } from '../../lib/db.js';
import { parseCookies } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['envelope_session'];

    if (token) {
      const db = await getDb();
      await db.collection('sessions').deleteOne({ token });
    }

    const cookie = `envelope_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
