function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = 'Hata';
    try { msg = (await r.json()).error || msg; } catch { /* yut */ }
    throw new Error(msg);
  }
  return r.json();
}

function codeFromPath() {
  return decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '').toUpperCase();
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Bir aksiyonu sunucuya gönder, yeni durumu döndür (anında geri bildirim)
async function roomAction(code, payload) {
  const r = await fetch('/api/room/' + code, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = 'Hata';
    try { msg = (await r.json()).error || msg; } catch { /* yut */ }
    throw new Error(msg);
  }
  return r.json(); // { state, action }
}

// Diğer cihazın değişikliklerini yakalamak için polling (senkron)
function pollRoom(code, onState, onNotFound) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await fetch('/api/room/' + code, { cache: 'no-store' });
      if (r.ok) onState(await r.json());
      else if (r.status === 404 && onNotFound) onNotFound();
    } catch { /* geçici ağ hatası — sonraki turda tekrar */ }
    setTimeout(tick, 1200);
  };
  tick();
  return () => { stopped = true; };
}
