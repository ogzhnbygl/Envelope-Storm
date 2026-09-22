const code = codeFromPath();
const grid = document.getElementById('envelope-grid');
const scoreboardEl = document.getElementById('scoreboard');
const overlay = document.getElementById('overlay');

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
  if (a.type === 'tornado') {
    const team = state && state.teams && state.teams[a.teamIndex];
    showOverlay('🌪️', 'TORNADO!', `${team ? team.name : 'Grup'} — tüm puanlar silindi!`, true);
  }
}

function render() {
  document.getElementById('game-name').textContent = state.name;
  document.getElementById('code').textContent = state.code;
  renderScoreboard();
  renderGrid();
}

function renderScoreboard() {
  scoreboardEl.innerHTML = state.teams.map((t, i) => `
    <div class="team-card ${i === state.currentTeam ? 'active' : ''} ${i === 0 ? 'team-a' : 'team-b'}">
      <div class="team-name">${escapeHtml(t.name)}</div>
      <div class="team-score">${t.score}</div>
      ${i === state.currentTeam ? '<div class="turn-badge">SIRA</div>' : ''}
    </div>`).join('');
}

function renderGrid() {
  grid.innerHTML = state.envelopes.map((e, i) => {
    if (!e.revealed) {
      return `<button class="env" data-i="${i}" aria-label="Zarf ${i + 1}, ${e.points} puan">
        <div class="env-flap"></div>
        <div class="env-points-num">+${e.points}</div>
        <div class="env-hint">PUAN</div>
      </button>`;
    }
    if (e.type === 'tornado') {
      return `<div class="env revealed tornado-env"><div class="tornado-emoji">🌪️</div><div class="env-caption">TORNADO</div></div>`;
    }
    return `<div class="env revealed image-env">${e.imageId ? `<img src="/api/images/${e.imageId}" alt="görsel">` : '<div class="env-noimg">?</div>'}</div>`;
  }).join('');
}

grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.env[data-i]');
  if (!btn) return;
  try {
    onState((await roomAction(code, { action: 'open-envelope', index: +btn.dataset.i })).state);
  } catch (err) { /* sessizce */ }
});

// Silinmiş görsel yüklenemezse "?" göster
grid.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') {
    const ph = document.createElement('div');
    ph.className = 'env-noimg';
    ph.textContent = '?';
    e.target.replaceWith(ph);
  }
}, true);

function showOverlay(icon, title, sub, tornado) {
  document.getElementById('overlay-icon').textContent = icon;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').textContent = sub || '';
  overlay.classList.toggle('tornado', !!tornado);
  overlay.hidden = false;
  vibrate(tornado ? [200, 100, 200] : 120);
}
document.getElementById('overlay-close').addEventListener('click', () => { overlay.hidden = true; });

function showWinner() {
  const sorted = [...state.teams].sort((a, b) => b.score - a.score);
  const tie = sorted.length > 1 && sorted[0].score === sorted[1].score;
  showOverlay(
    tie ? '🤝' : '🏆',
    tie ? 'Berabere!' : `${sorted[0].name} kazandı!`,
    tie ? `Skor: ${sorted[0].score} — ${sorted[1].score}` : `Final skoru: ${sorted[0].score} — ${sorted[1].score}`
  );
}

function onNotFound() {
  document.body.innerHTML = '<div class="fatal">Oyun bulunamadı. Lütfen kodu kontrol et.</div>';
}

pollRoom(code, onState, onNotFound);
