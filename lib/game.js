import { randomUUID, randomBytes } from 'crypto';

export const genId = () => randomUUID();

// Karışıklığa yol açmayan alfabe: 0/O, 1/I/L yok
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(length = 4) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function uniqueCode(gamesCol) {
  let code;
  do { code = generateCode(4); } while (await gamesCol.findOne({ code }));
  return code;
}

export function clampInt(v, def, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function normalizeTeams(teams) {
  const arr = Array.isArray(teams) && teams.length >= 2 ? teams : [{ name: 'Grup A' }, { name: 'Grup B' }];
  return arr.slice(0, 2).map((t, i) => ({
    id: (t && t.id) || (i === 0 ? 'a' : 'b'),
    name: String((t && t.name) || (i === 0 ? 'Grup A' : 'Grup B')).slice(0, 40),
  }));
}

export function sanitizeEnvelopes(envelopes) {
  if (!Array.isArray(envelopes)) return [];
  return envelopes.map((e) => ({
    id: e.id || genId(),
    type: e.type === 'tornado' ? 'tornado' : 'image',
    imageId: e.type === 'image' && e.imageId ? String(e.imageId) : null,
    points: clampInt(e.points, 100, 0, 1000),
  }));
}

export function resizeEnvelopes(envelopes, count) {
  const list = (envelopes || []).slice(0, count);
  while (list.length < count) {
    list.push({ id: genId(), type: 'image', imageId: null, points: 100 });
  }
  return list;
}

export function summarizeGame(g) {
  return {
    id: g.id, code: g.code, name: g.name, envelopeCount: g.envelopeCount,
    teams: g.teams, createdAt: g.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Aktif oda (oturum) mantığı — saf fonksiyonlar, Mongo'dan bağımsız.
// Kalıcı şablon (games) → oda (rooms); skorlar ve zarf durumu odada tutulur.
// ---------------------------------------------------------------------------

export function buildRoom(game) {
  return {
    _id: game.code,
    code: game.code,
    gameId: game.id,
    name: game.name,
    teams: (game.teams || []).map((t) => ({ id: t.id, name: t.name, score: 0 })),
    currentTeam: 0,
    envelopes: (game.envelopes || []).map((e) => ({
      id: e.id || genId(),
      type: e.type === 'tornado' ? 'tornado' : 'image',
      imageId: e.imageId || null,
      points: Number(e.points) || 0,
      revealed: false,
    })),
    lastOpened: null,
    started: false,
    finished: false,
    actionSeq: 0,
    lastAction: null,
    updatedAt: Date.now(),
  };
}

export function openEnvelope(room, index) {
  if (room.lastOpened != null) return { room, action: null }; // Moderatör kararı bekleniyor
  const env = room.envelopes[index];
  if (!env || env.revealed) return { room, action: null };
  env.revealed = true;
  room.lastOpened = index;

  if (env.type === 'tornado') {
    const team = room.teams[room.currentTeam];
    team.score = 0;
    const action = { type: 'tornado', index, teamIndex: room.currentTeam };
    room.currentTeam = (room.currentTeam + 1) % room.teams.length;
    room.lastOpened = null;
    return { room, action };
  }
  return { room, action: { type: 'open', index, teamIndex: room.currentTeam } };
}

export function judge(room, outcome) {
  const idx = room.lastOpened;
  if (idx == null) return { room, action: null };
  const env = room.envelopes[idx];
  const team = room.teams[room.currentTeam];
  const points = env ? env.points : 0;
  if (outcome === 'correct') {
    team.score += points;
  } else if (outcome === 'incorrect') {
    team.score = Math.max(0, team.score - points);
  }
  const action = { type: 'judge', outcome, teamIndex: room.currentTeam, points };
  room.currentTeam = (room.currentTeam + 1) % room.teams.length;
  room.lastOpened = null;
  return { room, action };
}

export function nextTeam(room) {
  room.currentTeam = (room.currentTeam + 1) % room.teams.length;
  room.lastOpened = null;
  return { room, action: { type: 'team-change', teamIndex: room.currentTeam } };
}

export function finish(room) {
  room.finished = true;
  return { room, action: { type: 'finish' } };
}

// İstemciye gönderilecek güvenli görünüm: açılmamış zarfların içeriği gizlenir.
export function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    teams: room.teams.map((t) => ({ id: t.id, name: t.name, score: t.score })),
    currentTeam: room.currentTeam,
    lastOpened: room.lastOpened,
    started: room.started,
    finished: room.finished,
    actionSeq: room.actionSeq || 0,
    lastAction: room.lastAction || null,
    envelopes: room.envelopes.map((e) => {
      if (!e.revealed) return { id: e.id, points: e.points, revealed: false };
      const out = { id: e.id, points: e.points, revealed: true, type: e.type };
      if (e.type === 'image' && e.imageId) out.imageId = e.imageId;
      return out;
    }),
  };
}
