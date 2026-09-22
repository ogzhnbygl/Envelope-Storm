import { getSessionUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', user: null });
    }
    return res.status(200).json({ user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
