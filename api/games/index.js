import { getDb } from '../../lib/db.js';
import { genId, uniqueCode, clampInt, normalizeTeams, summarizeGame } from '../../lib/game.js';

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const games = db.collection('games');

    if (req.method === 'GET') {
      const list = await games.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(list.map(summarizeGame));
    }

    if (req.method === 'POST') {
      const { name, teams, envelopeCount } = req.body || {};
      const count = clampInt(envelopeCount, 12, 2, 24);
      const game = {
        id: genId(),
        code: await uniqueCode(games),
        name: String(name || 'Yeni Oyun').slice(0, 100),
        teams: normalizeTeams(teams),
        envelopeCount: count,
        envelopes: Array.from({ length: count }, () => ({
          id: genId(), type: 'image', imageId: null, points: 100,
        })),
        createdAt: new Date().toISOString(),
      };
      await games.insertOne(game);
      return res.status(201).json(game);
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'error' });
  }
}
