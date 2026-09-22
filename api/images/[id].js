import { getDb } from '../../lib/db.js';

function toBuffer(b) {
  if (Buffer.isBuffer(b)) return b;
  // MongoDB sürücüsü Buffer'ı BSON Binary olarak döndürür; tam boyutlu baytlar
  // için .value(true) kullan (ham .buffer dolgu/pool içerebilir).
  if (b && typeof b.value === 'function') {
    const v = b.value(true);
    if (Buffer.isBuffer(v)) return v;
  }
  if (b && Buffer.isBuffer(b.buffer)) return Buffer.from(b.buffer);
  if (b && b.buffer) return Buffer.from(b.buffer);
  return null;
}

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const images = db.collection('images');
    const id = String(req.query.id || '');

    if (req.method === 'GET') {
      const img = await images.findOne({ id });
      if (!img) return res.status(404).end();
      const buf = toBuffer(img.data);
      if (!buf) return res.status(500).end();
      res.status(200);
      res.setHeader('Content-Type', img.mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(buf);
    }

    if (req.method === 'DELETE') {
      await images.deleteOne({ id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'error' });
  }
}
