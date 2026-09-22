import { getDb } from '../../lib/db.js';
import { clampInt, normalizeTeams, sanitizeEnvelopes, resizeEnvelopes } from '../../lib/game.js';

export default async function handler(req, res) {
  try {
    const db = await getDb();
    const games = db.collection('games');
    const id = String(req.query.id || '');

    if (req.method === 'GET') {
      const g = await games.findOne({ id });
      if (!g) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(g);
    }

    if (req.method === 'PUT') {
      const g = await games.findOne({ id });
      if (!g) return res.status(404).json({ error: 'not_found' });
      const { name, teams, envelopes, envelopeCount } = req.body || {};
      if (name !== undefined) g.name = String(name).slice(0, 100);
      if (teams !== undefined) g.teams = normalizeTeams(teams);
      if (envelopes !== undefined) g.envelopes = sanitizeEnvelopes(envelopes);
      if (envelopeCount !== undefined) g.envelopeCount = clampInt(envelopeCount, 12, 2, 24);
      if (g.envelopes.length !== g.envelopeCount) {
        g.envelopes = resizeEnvelopes(g.envelopes, g.envelopeCount);
      }
      g.updatedAt = new Date().toISOString();
      await games.replaceOne({ id }, g);
      return res.status(200).json(g);
    }

    if (req.method === 'DELETE') {
      const g = await games.findOne({ id });
      if (!g) return res.status(404).json({ error: 'not_found' });
      await games.deleteOne({ id });
      await db.collection('rooms').deleteOne({ _id: g.code });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'error' });
  }
}
