const codeInput = document.getElementById('code-input');
const err = document.getElementById('join-error');

function go(role) {
  const code = codeInput.value.trim().toUpperCase();
  err.textContent = '';
  if (!/^[A-Z0-9]{3,6}$/.test(code)) {
    err.textContent = 'Geçerli bir kod gir (3–6 karakter).';
    return;
  }
  fetch('/api/room/' + code)
    .then((r) => {
      if (!r.ok) { err.textContent = 'Bu kodla bir oyun bulunamadı.'; return; }
      location.href = '/' + role + '/' + code;
    })
    .catch(() => { err.textContent = 'Bağlantı hatası.'; });
}

document.getElementById('board-btn').addEventListener('click', () => go('board'));
document.getElementById('moderate-btn').addEventListener('click', () => go('moderate'));
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go('board'); });
codeInput.focus();
