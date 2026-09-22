import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import gamesIndex from '../api/games/index.js';
import gamesById from '../api/games/[id].js';
import imagesIndex from '../api/images/index.js';
import imagesById from '../api/images/[id].js';
import roomByCode from '../api/room/[code].js';

let mongod;
let gameId, code, imageId;

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'test';
});

after(async () => {
  await mongod?.stop();
});

function makeRes() {
  let statusCode = 200;
  let jsonBody = null;
  let endedBuf = undefined;
  const headers = {};
  const res = {
    status(c) { statusCode = c; return res; },
    setHeader(k, v) { headers[k] = v; return res; },
    json(o) { jsonBody = o; },
    end(buf) { endedBuf = buf; },
    _code: () => statusCode,
    _json: () => jsonBody,
    _buf: () => endedBuf,
    _headers: headers,
  };
  return res;
}

async function call(handler, method, body, query = {}) {
  const req = { method, query, body };
  const res = makeRes();
  await handler(req, res);
  return res;
}

test('oyun oluşturma (POST /api/games)', async () => {
  const res = await call(gamesIndex, 'POST', { name: 'Test', envelopeCount: 6, teams: [{ name: 'Kırmızı' }, { name: 'Mavi' }] });
  assert.equal(res._code(), 201);
  assert.ok(res._json().code);
  assert.equal(res._json().envelopes.length, 6);
  gameId = res._json().id;
  code = res._json().code;
});

test('görsel yükleme (POST /api/images)', async () => {
  const res = await call(imagesIndex, 'POST', { dataUrl: `data:image/png;base64,${PNG}`, originalName: 'test.png' });
  assert.equal(res._code(), 201);
  assert.ok(res._json().id);
  imageId = res._json().id;
});

test('görsel listeleme (GET /api/images)', async () => {
  const res = await call(imagesIndex, 'GET');
  assert.equal(res._code(), 200);
  assert.equal(res._json().length, 1);
});

test('oyun güncelleme — zarf içerikleri (PUT /api/games/:id)', async () => {
  const envelopes = [
    { type: 'image', imageId, points: 100 },
    { type: 'image', imageId, points: 200 },
    { type: 'tornado', imageId: null, points: 500 },
    { type: 'image', imageId, points: 100 },
    { type: 'image', imageId, points: 100 },
    { type: 'image', imageId, points: 100 },
  ];
  const res = await call(gamesById, 'PUT', { envelopes }, { id: gameId });
  assert.equal(res._code(), 200);
  assert.equal(res._json().envelopes[2].type, 'tornado');
});

test('oda anlık görüntüsü gizli içerik (GET /api/room/:code)', async () => {
  const res = await call(roomByCode, 'GET', undefined, { code });
  assert.equal(res._code(), 200);
  const s = res._json();
  assert.equal(s.envelopes.length, 6);
  // açılmamış zarflarda imageId/type sızmamalı
  assert.ok(s.envelopes.every((e) => e.revealed === false && e.type === undefined && e.imageId === undefined));
});

test('zarf açma → görsel görünür (POST action open-envelope)', async () => {
  const res = await call(roomByCode, 'POST', { action: 'open-envelope', index: 0 }, { code });
  const s = res._json().state;
  assert.equal(res._json().action.type, 'open');
  assert.equal(s.envelopes[0].revealed, true);
  assert.equal(s.envelopes[0].imageId, imageId);
});

test('doğru cevap → puan artar (judge correct)', async () => {
  const res = await call(roomByCode, 'POST', { action: 'judge', outcome: 'correct' }, { code });
  assert.equal(res._json().state.teams[0].score, 100);
});

test('sıra değişir → 2. grup puanı (open + judge)', async () => {
  await call(roomByCode, 'POST', { action: 'open-envelope', index: 1 }, { code });
  const res = await call(roomByCode, 'POST', { action: 'judge', outcome: 'correct' }, { code });
  assert.equal(res._json().state.teams[1].score, 200);
});

test('tornado → grubun puanı sıfırlanır', async () => {
  const res = await call(roomByCode, 'POST', { action: 'open-envelope', index: 2 }, { code });
  assert.equal(res._json().action.type, 'tornado');
  assert.equal(res._json().state.teams[0].score, 0);
});

test('reset → puanlar ve zarflar sıfırlanır', async () => {
  const res = await call(roomByCode, 'POST', { action: 'reset' }, { code });
  assert.equal(res._json().action.type, 'reset');
  assert.equal(res._json().state.teams.every((t) => t.score === 0), true);
  assert.equal(res._json().state.envelopes.every((e) => e.revealed === false), true);
});

test('görsel binary döndürülür (GET /api/images/:id)', async () => {
  const res = await call(imagesById, 'GET', undefined, { id: imageId });
  assert.equal(res._code(), 200);
  assert.equal(res._headers['Content-Type'], 'image/png');
  const buf = res._buf();
  assert.ok(buf && buf.length > 0);
});

test('silme işlemleri (DELETE)', async () => {
  const delImg = await call(imagesById, 'DELETE', undefined, { id: imageId });
  assert.equal(delImg._code(), 200);
  const delGame = await call(gamesById, 'DELETE', undefined, { id: gameId });
  assert.equal(delGame._code(), 200);
  const gone = await call(roomByCode, 'GET', undefined, { code });
  assert.equal(gone._code(), 404);
});
