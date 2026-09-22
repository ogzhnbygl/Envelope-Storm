import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildRoom, openEnvelope, judge, nextTeam, finish, publicRoom,
  sanitizeEnvelopes, normalizeTeams, clampInt, resizeEnvelopes, generateCode,
} from '../lib/game.js';

function makeGame() {
  return {
    id: 'g1', code: 'ABCD', name: 'Test',
    teams: [{ id: 'a', name: 'Kırmızı' }, { id: 'b', name: 'Mavi' }],
    envelopeCount: 4,
    envelopes: [
      { id: 'e1', type: 'image', imageId: 'img1', points: 100 },
      { id: 'e2', type: 'image', imageId: 'img1', points: 200 },
      { id: 'e3', type: 'tornado', imageId: null, points: 500 },
      { id: 'e4', type: 'image', imageId: 'img1', points: 100 },
    ],
  };
}

test('buildRoom sıfırlanmış durum üretir', () => {
  const room = buildRoom(makeGame());
  assert.equal(room.teams.length, 2);
  assert.ok(room.teams.every((t) => t.score === 0));
  assert.equal(room.envelopes.length, 4);
  assert.equal(room.currentTeam, 0);
  assert.equal(room.actionSeq, 0);
});

test('publicRoom açılmamış zarf içeriğini gizler', () => {
  const pub = publicRoom(buildRoom(makeGame()));
  assert.ok(pub.envelopes.every((e) => e.revealed === false && e.type === undefined && e.imageId === undefined));
});

test('openEnvelope görseli açar ve imageId gösterir', () => {
  const room = buildRoom(makeGame());
  const { action } = openEnvelope(room, 0);
  assert.equal(action.type, 'open');
  assert.equal(room.envelopes[0].revealed, true);
  assert.equal(room.lastOpened, 0);
  assert.equal(publicRoom(room).envelopes[0].imageId, 'img1');
});

test('judge correct puan ekler ve sırayı değiştirir', () => {
  const room = buildRoom(makeGame());
  openEnvelope(room, 0);
  judge(room, 'correct');
  assert.equal(room.teams[0].score, 100);
  assert.equal(room.currentTeam, 1);
  assert.equal(room.lastOpened, null);
});

test('judge incorrect: puanı olan gruptan düşer', () => {
  const room = buildRoom(makeGame());
  room.teams[0].score = 150;
  openEnvelope(room, 0); // 100 puanlık
  judge(room, 'incorrect');
  assert.equal(room.teams[0].score, 50);
});

test('judge incorrect: 0 altına inmez', () => {
  const room = buildRoom(makeGame());
  openEnvelope(room, 0); // 100 puanlık, skor zaten 0
  judge(room, 'incorrect');
  assert.equal(room.teams[0].score, 0);
});

test('tornado puanı sıfırlar ve sırayı değiştirir', () => {
  const room = buildRoom(makeGame());
  room.teams[0].score = 150;
  const { action } = openEnvelope(room, 2); // tornado
  assert.equal(action.type, 'tornado');
  assert.equal(room.teams[0].score, 0);
  assert.equal(room.currentTeam, 1);
});

test('iki grup sırayla puan alır', () => {
  const room = buildRoom(makeGame());
  openEnvelope(room, 0); judge(room, 'correct'); // Kırmızı +100
  openEnvelope(room, 1); judge(room, 'correct'); // Mavi +200
  assert.equal(room.teams[0].score, 100);
  assert.equal(room.teams[1].score, 200);
  assert.equal(room.currentTeam, 0);
});

test('zaten açık zarf tekrar açılamaz', () => {
  const room = buildRoom(makeGame());
  openEnvelope(room, 0);
  assert.equal(openEnvelope(room, 0).action, null);
});

test('finish oyunu bitirir', () => {
  const room = buildRoom(makeGame());
  assert.equal(room.finished, false);
  finish(room);
  assert.equal(room.finished, true);
});

test('yardımcılar: clampInt / normalizeTeams / resizeEnvelopes / sanitizeEnvelopes', () => {
  assert.equal(clampInt('999', 12, 2, 24), 24);
  assert.equal(clampInt('abc', 12, 2, 24), 12);
  assert.equal(clampInt(5, 12, 2, 24), 5);
  // 2'den az grup verilirse varsayılanlara düşer
  const t1 = normalizeTeams([{ name: 'X' }]);
  assert.equal(t1.length, 2);
  assert.equal(t1[0].name, 'Grup A');
  // tam 2 grup verilirse isimler korunur
  const t2 = normalizeTeams([{ name: 'X' }, { name: 'Y' }]);
  assert.equal(t2[0].name, 'X');
  assert.equal(t2[1].name, 'Y');
  assert.equal(resizeEnvelopes([{ id: 'e1', type: 'image', imageId: null, points: 100 }], 3).length, 3);
  const envs = sanitizeEnvelopes([{ type: 'tornado', imageId: 'ignored', points: '500' }]);
  assert.equal(envs[0].type, 'tornado');
  assert.equal(envs[0].imageId, null);
  assert.equal(envs[0].points, 500);
});

test('generateCode 4 karakter üretir', () => {
  const c = generateCode(4);
  assert.equal(c.length, 4);
  assert.match(c, /^[A-Z2-9]+$/);
});
