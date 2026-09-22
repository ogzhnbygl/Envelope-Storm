const code = codeFromPath();
const scoreboardEl = document.getElementById('scoreboard');
const logEl = document.getElementById('log');
const openHint = document.getElementById('open-hint');
const judgeCorrect = document.getElementById('judge-correct');
const judgeIncorrect = document.getElementById('judge-incorrect');
const banner = document.getElementById('banner');

let state = null;
let lastSeq = null;

function onState(s) {
  const prev = state;
  const isChanged = !prev || prev.actionSeq !== s.actionSeq;
  state = s;
  if (lastSeq !== null && s.actionSeq > lastSeq && s.lastAction) handleAction(s.lastAction);
  lastSeq = s.actionSeq;
  if (isChanged) render();
  if (s.finished && (!prev || !prev.finished)) showWinner();
}

function handleAction(a) {
  if (a.type === 'open') { log(`Zarf #${a.index + 1} açıldı`); vibrate(60); }
  else if (a.type === 'tornado') { log(`🌪️ ${teamName(a.teamIndex)} — tüm puanlar silindi!`); vibrate([200, 100, 200]); }
  else if (a.type === 'judge') {
    log(`${teamName(a.teamIndex)} ${a.outcome === 'correct' ? 'doğru ✓ (+' + a.points + ')' : 'yanlış ✗ (−' + a.points + ')'}`);
    vibrate(a.outcome === 'correct' ? 80 : [120, 60, 120]);
  }
  else if (a.type === 'team-change') { log(`Sıra: ${teamName(a.teamIndex)}`); }
  else if (a.type === 'reset') { log('Oyun sıfırlandı 🔄'); }
}

function render() {
  document.getElementById('game-name').textContent = state.name;
  document.getElementById('code').textContent = state.code;
  scoreboardEl.innerHTML = state.teams.map((t, i) => `
    <div class="team-card ${i === state.currentTeam ? 'active' : ''} ${i === 0 ? 'team-a' : 'team-b'}">
      <div class="team-name">${escapeHtml(t.name)}</div>
      <div class="team-score">${t.score}</div>
      ${i === state.currentTeam ? '<div class="turn-badge">SIRA</div>' : ''}
    </div>`).join('');

  const open = state.lastOpened != null;
  judgeCorrect.disabled = !open;
  judgeIncorrect.disabled = !open;
  openHint.textContent = open
    ? `Zarf #${state.lastOpened + 1} açık — cevabı değerlendir`
    : 'Sıradaki öğrenci bir zarf seçsin…';
}

function teamName(i) {
  return state && state.teams && state.teams[i] ? state.teams[i].name : 'Grup';
}

function log(msg) {
  const d = document.createElement('div');
  d.className = 'log-item';
  d.textContent = msg;
  logEl.prepend(d);
  while (logEl.children.length > 40) logEl.lastChild.remove();
}

function showWinner() {
  const sorted = [...state.teams].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;
  document.getElementById('banner-title').textContent = tie ? 'Berabere! 🤝' : `${sorted[0].name} kazandı! 🏆`;
  document.getElementById('banner-text').textContent = tie
    ? `Skor: ${sorted[0].score} — ${sorted[1].score}`
    : `Final skoru: ${sorted[0].score} — ${sorted[1].score}`;
  banner.hidden = false;
}
document.getElementById('banner-close').addEventListener('click', () => { 
  banner.hidden = true; 
  if (state && state.finished) {
    setTimeout(() => {
      doAction({ action: 'reset' });
    }, 3000);
  }
});

async function doAction(payload) {
  try { onState((await roomAction(code, payload)).state); }
  catch (e) { log('Hata: ' + e.message); }
}

judgeCorrect.addEventListener('click', () => doAction({ action: 'judge', outcome: 'correct' }));
judgeIncorrect.addEventListener('click', () => doAction({ action: 'judge', outcome: 'incorrect' }));
document.getElementById('next-team').addEventListener('click', () => doAction({ action: 'next-team' }));
document.getElementById('reset').addEventListener('click', () => {
  if (confirm('Oyunu sıfırlayıp tüm puanları ve açılan zarfları geri almak istediğine emin misin?')) {
    doAction({ action: 'reset' });
  }
});
document.getElementById('finish').addEventListener('click', () => {
  if (confirm('Oyunu bitirmek istediğine emin misin?')) doAction({ action: 'finish' });
});

function onNotFound() {
  document.body.innerHTML = '<div class="fatal">Oyun bulunamadı.</div>';
}

pollRoom(code, onState, onNotFound);

// Moderatör bağlandığında oyunu başlat
roomAction(code, { action: 'start' }).catch(() => {});
