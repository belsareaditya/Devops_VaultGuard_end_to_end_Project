/* ====== AUTH ====== */
const AUTH_KEY  = 'vaultguard_auth_v1';
const TOKEN_KEY = 'vaultguard_token_v1';
function ensureDefaultAuth(){
  if (!localStorage.getItem(AUTH_KEY)){
    localStorage.setItem(AUTH_KEY, JSON.stringify({username:'admin', password:'admin'}));
  }
}
function getAuth(){ ensureDefaultAuth(); return JSON.parse(localStorage.getItem(AUTH_KEY)); }

const loginScreen = document.getElementById('loginScreen');
const appScreen   = document.getElementById('appScreen');

function showApp(){ loginScreen.style.display='none'; appScreen.style.display='block'; }
function showLogin(){ appScreen.style.display='none'; loginScreen.style.display='grid'; }

if (localStorage.getItem(TOKEN_KEY)) { showApp(); } else { showLogin(); }

document.getElementById('loginForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const remember = document.getElementById('rememberMe').checked;
  const {username, password} = getAuth();
  if (u === username && p === password){
    if (remember) localStorage.setItem(TOKEN_KEY, '1');
    showApp();
    updateLockUI();
    render();
    e.target.reset();
  } else {
    alert('Invalid credentials. (Default is admin / admin)');
  }
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

/* ====== LOCK CONTROL ====== */
const UNLOCK_KEY = 'vaultguard_unlocked_v1';
if (localStorage.getItem(UNLOCK_KEY) === null) localStorage.setItem(UNLOCK_KEY,'0');
const lockToggleBtn = document.getElementById('lockToggle');

function isUnlocked(){ return localStorage.getItem(UNLOCK_KEY)==='1'; }
function setUnlocked(v){ localStorage.setItem(UNLOCK_KEY, v?'1':'0'); updateLockUI(); }
function updateLockUI(){
  const unlocked = isUnlocked();
  document.body.classList.toggle('controls-locked', !unlocked);
  lockToggleBtn.classList.toggle('unlocked', unlocked);
  lockToggleBtn.innerHTML = unlocked
    ? '<i class="fa-solid fa-lock-open"></i> <span id="lockLabel">Unlocked</span>'
    : '<i class="fa-solid fa-lock"></i> <span id="lockLabel">Locked</span>';
}
lockToggleBtn.addEventListener('click', ()=> setUnlocked(!isUnlocked()));
updateLockUI();

/* ====== VAULTGUARD ====== */
const KEY = 'vaultguard_credentials_v1';
const readAll = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const writeAll = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));

const form = document.getElementById('credForm');
const siteEl = document.getElementById('site');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('emptyState');
const editIdEl = document.getElementById('editId');
const saveText = document.getElementById('saveText');
const cancelEditBtn = document.getElementById('cancelEdit');

function render() {
  const items = readAll();
  listEl.innerHTML = '';
  if (!items.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.dataset.id = item.id;

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="name">${escapeHtml(item.site)}</div>
      <div class="field"><strong>Email:</strong> <span class="value" data-type="email" data-visible="false">${mask(item.email)}</span></div>
      <div class="field"><strong>Password:</strong> <span class="value" data-type="password" data-visible="false">${bullets(item.password.length)}</span></div>
    `;

    const right = document.createElement('div');
    right.className = 'actions';
    right.innerHTML = `
      <button class="icon-btn" data-action="view" title="Show/Hide credentials"><i class="fa-solid fa-eye"></i></button>
      <button class="icon-btn" data-action="edit" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
      <button class="icon-btn" data-action="delete" title="Delete"><i class="fa-solid fa-xmark"></i></button>
    `;

    card.appendChild(left); card.appendChild(right); listEl.appendChild(card);
  }
  updateLockUI();
}

function mask(str){
  if (!str) return '';
  const [user, domain=''] = String(str).split('@');
  const safeUser = user.length <= 2 ? user[0] + '*' : user.slice(0,2) + '***';
  return domain ? `${safeUser}@${domain.replace(/./g,'*')}` : `${safeUser}***`;
}
function bullets(len){ return '<span class="bullets">' + '•'.repeat(Math.max(8,len)) + '</span>'; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const site = siteEl.value.trim();
  const email = emailEl.value.trim();
  const password = passEl.value;
  if(!site || !email || !password) return;

  const all = readAll();
  const editId = editIdEl.value;

  if (editId){
    const idx = all.findIndex(x => x.id === editId);
    if (idx !== -1){
      all[idx] = {...all[idx], site, email, password, updatedAt: Date.now()};
      writeAll(all);
      exitEditMode(); render(); return;
    }
  }

  const id = cryptoRandomId();
  all.unshift({ id, site, email, password, createdAt: Date.now() });
  writeAll(all);
  form.reset();
  render();
});

function enterEditMode(item){
  if (!isUnlocked()) { alert('Unlock controls to edit.'); return; }
  siteEl.value = item.site; emailEl.value = item.email; passEl.value  = item.password;
  editIdEl.value = item.id; saveText.textContent = 'Update'; cancelEditBtn.style.display = 'inline-flex'; siteEl.focus();
}
function exitEditMode(){ editIdEl.value=''; saveText.textContent='Save'; cancelEditBtn.style.display='none'; form.reset(); }
cancelEditBtn.addEventListener('click', exitEditMode);

listEl.addEventListener('click', (e)=>{
  const btn = e.target.closest('.icon-btn'); if (!btn) return;
  const card = btn.closest('.card'); const id = card.dataset.id; const action = btn.dataset.action;

  if (action === 'delete'){
    if (!isUnlocked()) { alert('Unlock controls to delete.'); return; }
    if (!confirm('Delete this credential?')) return;
    writeAll(readAll().filter(x => x.id !== id));
    if (editIdEl.value === id) exitEditMode();
    render();
  }
  if (action === 'edit'){
    const item = readAll().find(x => x.id === id); if (item) enterEditMode(item);
  }
  if (action === 'view'){
    if (!isUnlocked()) { alert('Unlock controls to view credentials.'); return; }
    toggleView(card, id, btn);
  }
});

function toggleView(card, id, btn){
  const item = readAll().find(x=>x.id===id); if (!item) return;
  const spans = card.querySelectorAll('.value');
  const isVisible = spans[0]?.dataset.visible === 'true';

  if (isVisible){
    spans.forEach(s=>{
      s.dataset.visible='false';
      if (s.dataset.type==='email') s.innerHTML = mask(item.email);
      if (s.dataset.type==='password') s.innerHTML = bullets(item.password.length);
    });
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>'; btn.title='Show credentials';
  } else {
    spans.forEach(s=>{
      s.dataset.visible='true';
      if (s.dataset.type==='email') s.textContent = item.email;
      if (s.dataset.type==='password') s.textContent = item.password;
    });
    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>'; btn.title='Hide credentials';
  }
}
function cryptoRandomId(){ return (window.crypto?.randomUUID ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36)); }

if (localStorage.getItem(TOKEN_KEY)) render();
