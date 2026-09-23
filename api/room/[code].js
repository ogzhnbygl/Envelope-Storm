import { getDb } from '../../lib/db.js';
import { buildRoom, publicRoom, openEnvelope, judge, nextTeam, finish } from '../../lib/game.js';

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const games = db.collection('games');
    const rooms = db.collection('rooms');
    const code = String(req.query.code || '').toUpperCase();

    const game = await games.findOne({ code });
    if (!game) return res.status(404).json({ error: 'not_found', message: 'Oyun kodu bulunamadı.' });

    let room = await rooms.findOne({ _id: code });
    if (!room) {
      room = buildRoom(game);
      await rooms.insertOne(room).catch(() => { /* olası yarış — zaten var */ });
    }

    if (req.method === 'GET') {
      return res.status(200).json(publicRoom(room));
    }

    if (req.method === 'POST') {
      const { action, index, outcome } = req.body || {};
      let event = null;
      if (action === 'open-envelope') event = openEnvelope(room, index).action;
      else if (action === 'judge') event = judge(room, outcome).action;
      else if (action === 'next-team') event = nextTeam(room).action;
      else if (action === 'finish') event = finish(room).action;
      else if (action === 'start') { room.started = true; event = { type: 'start' }; }
      else if (action === 'pause') { room.started = false; event = { type: 'pause' }; }
      else if (action === 'reset') { room = buildRoom(game); event = { type: 'reset' }; }
      else return res.status(400).json({ error: 'unknown_action' });

      // Hiçbir değişiklik olmadıysa (örn. zaten açık zarf, zarf açılmadan karar) sessizce dön
      if (!event) return res.status(200).json({ state: publicRoom(room), action: null });

      room.updatedAt = Date.now();
      room.actionSeq = (room.actionSeq || 0) + 1;
      room.lastAction = event;
      await rooms.replaceOne({ _id: code }, room, { upsert: true });
      return res.status(200).json({ state: publicRoom(room), action: event });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'error' });
  }
}
