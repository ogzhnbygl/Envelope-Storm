const code = codeFromPath();
const grid = document.getElementById('envelope-grid');
const scoreboardEl = document.getElementById('scoreboard');
const overlay = document.getElementById('overlay');

let state = null;
let lastSeq = null;

let pendingTornadoTeam = null;
let pendingTornadoScore = 0;

function onState(s) {
  const prev = state;
  const isChanged = !prev || prev.actionSeq !== s.actionSeq;
  state = s;
  if (lastSeq !== null && s.actionSeq > lastSeq && s.lastAction) {
    if (s.lastAction.type === 'tornado' && prev && prev.teams[s.lastAction.teamIndex]) {
      pendingTornadoTeam = s.lastAction.teamIndex;
      pendingTornadoScore = prev.teams[s.lastAction.teamIndex].score;
    }
    handleAction(s.lastAction);
  }
  lastSeq = s.actionSeq;
  if (isChanged) render();
  if (s.finished && (!prev || !prev.finished)) showWinner();
}

function handleAction(a) {
  if (a.type === 'tornado') {
    playTornadoAnimation(a.index, a.teamIndex);
  }
}

function playTornadoAnimation(envIndex, teamIndex) {
  vibrate([100, 50, 100]);
  const envEl = document.querySelector(`.env[data-i="${envIndex}"]`) || document.querySelectorAll('.env')[envIndex];
  const teamEl = document.querySelectorAll('.team-card')[teamIndex];
  if (!envEl || !teamEl) return;

  const envRect = envEl.getBoundingClientRect();
  const teamRect = teamEl.getBoundingClientRect();

  const tornado = document.createElement('div');
  tornado.className = 'floating-tornado';
  tornado.textContent = '🌪️';
  tornado.style.left = (envRect.left + envRect.width / 2) + 'px';
  tornado.style.top = (envRect.top + envRect.height / 2) + 'px';
  document.body.appendChild(tornado);

  tornado.offsetHeight; // Force reflow
  tornado.style.left = (teamRect.left + teamRect.width / 2) + 'px';
  tornado.style.top = (teamRect.top + teamRect.height / 2) + 'px';

  setTimeout(() => {
    tornado.remove();
    const scoreEl = document.getElementById(`score-${teamIndex}`);
    if (scoreEl) {
      scoreEl.classList.add('score-crash');
      setTimeout(() => {
        pendingTornadoTeam = null;
        renderScoreboard();
      }, 400); // Ortasında gerçek puana (0) geçiş yap
    } else {
      pendingTornadoTeam = null;
      renderScoreboard();
    }
  }, 1500);
}

function render() {
  document.getElementById('game-name').textContent = state.name;
  document.getElementById('code').textContent = state.code;
  
  if (!state.started) {
    document.getElementById('envelope-grid').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'block';
    scoreboardEl.style.opacity = '0.5';
  } else {
    document.getElementById('envelope-grid').style.display = '';
    document.getElementById('waiting-screen').style.display = 'none';
    scoreboardEl.style.opacity = '1';
  }

  renderScoreboard();
  renderGrid();
}

function renderScoreboard() {
  scoreboardEl.innerHTML = state.teams.map((t, i) => `
    <div class="team-card ${i === state.currentTeam ? 'active' : ''} ${i === 0 ? 'team-a' : 'team-b'}">
      <div class="team-name">${escapeHtml(t.name)}</div>
      <div class="team-score" id="score-${i}">${pendingTornadoTeam === i ? pendingTornadoScore : t.score}</div>
      ${i === state.currentTeam ? '<div class="turn-badge">SIRA</div>' : ''}
    </div>`).join('');
}

function renderGrid() {
  const count = state.envelopes.length;
  let cols = 4;
  if (count <= 12) cols = 4;
  else if (count <= 18) cols = 6;
  else cols = 6;
  
  const rows = Math.ceil(count / cols);
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  grid.innerHTML = state.envelopes.map((e, i) => {
    let inner = '';
    if (!e.revealed) {
      inner = `<button class="env" data-i="${i}" aria-label="Zarf ${i + 1}, ${e.points} puan">
        <div class="env-number">${i + 1}</div>
        <div class="env-flap"></div>
        <div class="env-points-num">+${e.points}</div>
        <div class="env-hint">PUAN</div>
      </button>`;
    } else if (e.type === 'tornado') {
      inner = `<div class="env revealed tornado-env"><div class="tornado-emoji">🌪️</div><div class="env-caption">TORNADO</div></div>`;
    } else {
      inner = `<div class="env revealed image-env">${e.imageId ? `<img src="/api/images/${e.imageId}" alt="görsel">` : '<div class="env-noimg">?</div>'}</div>`;
    }
    return `<div class="envelope-wrapper">${inner}</div>`;
  }).join('');
}

grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.env[data-i]');
  if (!btn) return;
  if (state && state.lastOpened != null) return; // Moderatör kararı bekleniyor
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
document.getElementById('overlay-close').addEventListener('click', () => { 
  overlay.hidden = true; 
  if (state && state.finished) {
    setTimeout(() => {
      roomAction(code, { action: 'reset' }).catch(() => {});
    }, 3000);
  }
});

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
