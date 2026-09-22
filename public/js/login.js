const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errEl = document.getElementById('auth-error');
const toggleBtn = document.getElementById('toggle-register');
const submitBtn = form.querySelector('button[type="submit"]');

let isRegister = false;
let nameInput = null;

toggleBtn.addEventListener('click', (e) => {
  e.preventDefault();
  isRegister = !isRegister;
  errEl.textContent = '';
  
  if (isRegister) {
    document.querySelector('h1').textContent = 'Kayıt Ol';
    document.querySelector('p.muted').textContent = 'Yeni bir öğretmen hesabı oluşturun.';
    submitBtn.textContent = 'Kayıt Ol';
    toggleBtn.textContent = 'Giriş Yapın';
    toggleBtn.parentElement.firstChild.textContent = 'Zaten hesabınız var mı? ';
    
    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'name';
    nameInput.placeholder = 'Adınız Soyadınız';
    nameInput.required = true;
    nameInput.style.cssText = 'width:100%; padding:16px; border:2px solid var(--line); border-radius:12px; font-size:16px; outline:none; background:var(--bg2); margin-bottom:16px;';
    
    form.insertBefore(nameInput, emailInput);
  } else {
    document.querySelector('h1').textContent = 'Öğretmen Girişi';
    document.querySelector('p.muted').textContent = 'Oyunlarınızı yönetmek için giriş yapın.';
    submitBtn.textContent = 'Giriş Yap';
    toggleBtn.textContent = 'Kayıt Olun';
    toggleBtn.parentElement.firstChild.textContent = 'Hesabınız yok mu? ';
    
    if (nameInput) {
      nameInput.remove();
      nameInput = null;
    }
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = nameInput ? nameInput.value.trim() : undefined;
  
  errEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Bekleyin...';

  try {
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { email, password, name } : { email, password };
    
    const res = await api('POST', endpoint, payload);
    
    if (isRegister) {
      // Kayıt başarılıysa otomatik giriş yapmayı deneyelim
      await api('POST', '/api/auth/login', { email, password });
      window.location.href = '/admin';
    } else {
      window.location.href = '/admin';
    }
  } catch (error) {
    errEl.textContent = error.message || 'Bir hata oluştu.';
    submitBtn.disabled = false;
    submitBtn.textContent = isRegister ? 'Kayıt Ol' : 'Giriş Yap';
  }
});
