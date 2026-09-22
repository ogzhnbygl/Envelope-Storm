import { getDb } from '../../lib/db.js';
import { getSessionUser } from '../../lib/auth.js';
import { genId } from '../../lib/game.js';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (istemci yüklerken zaten küçültür)

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const images = db.collection('images');

    if (req.method === 'GET') {
      const list = await images.find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(list.map((i) => ({
        id: i.id, originalName: i.originalName, mime: i.mime, size: i.size, createdAt: i.createdAt,
      })));
    }

    if (req.method === 'POST') {
      const { dataUrl, originalName } = req.body || {};
      if (typeof dataUrl !== 'string' || !dataUrl) return res.status(400).json({ error: 'no_image' });
      const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'bad_image' });
      const mime = m[1];
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length) return res.status(400).json({ error: 'empty_image' });
      if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'image_too_large', message: 'Görsel çok büyük (max 2MB).' });

      const img = {
        id: genId(),
        userId: user.id,
        originalName: String(originalName || 'görsel').slice(0, 200),
        mime,
        size: buf.length,
        data: buf,
        createdAt: new Date().toISOString(),
      };
      await images.insertOne(img);
      return res.status(201).json({
        id: img.id, originalName: img.originalName, mime: img.mime, size: img.size, createdAt: img.createdAt,
      });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'error' });
  }
}
