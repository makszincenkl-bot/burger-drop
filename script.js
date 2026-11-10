import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, collection, getDocs, query, where, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBT4O2-PZ-7k4-q1Rv8pQVjeRoBbGzQSao",
  authDomain: "burgerdrop.firebaseapp.com",
  projectId: "burgerdrop",
  storageBucket: "burgerdrop.firebasestorage.app",
  messagingSenderId: "289449763921",
  appId: "1:289449763921:web:608333109f3612d50c4470"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $=id=>document.getElementById(id);
let currentUser = null;
let unsubscribeSnap = null;

function current(){ return currentUser; }

function saveDB(){ 
  if(!currentUser) return;
  updateDoc(doc(db, "users", currentUser.uid), { coins: currentUser.coins }).catch(e => console.error(e));
}

// ==== ЗВУКИ И ВИБРАЦИЯ ====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'spin') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'win') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'lose') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  }
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ==== АНИМИРОВАННЫЙ ФОН ====
function initBg(){
  const layer = document.getElementById('bgLayer');
  
  // Добавляем свечение (glow)
  const g1 = document.createElement('div'); g1.className = 'bg-glow g1'; layer.appendChild(g1);
  const g2 = document.createElement('div'); g2.className = 'bg-glow g2'; layer.appendChild(g2);
  const g3 = document.createElement('div'); g3.className = 'bg-glow g3'; layer.appendChild(g3);

  function spawnElement(isWeapon) {
    const el = document.createElement('div');
    if (isWeapon) {
      const weapons = ['🔫','🔪','💣','🗡️'];
      el.className = 'bg-weapon';
      el.textContent = weapons[Math.floor(Math.random() * weapons.length)];
      el.style.fontSize = (40 + Math.random() * 40) + 'px';
    } else {
      const emojis = ['🍔','🍟','🥤','🧀','🥬','🍅','⭐','🍞'];
      el.className = 'bg-emoji';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.fontSize = (24 + Math.random() * 30) + 'px';
    }
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.top = '110vh';
    const duration = 10 + Math.random() * 15;
    el.style.transition = `transform ${duration}s linear, opacity 2s`;
    layer.appendChild(el);
    
    setTimeout(() => { el.style.transform = 'translateY(-130vh) rotate(360deg)'; }, 50);
    setTimeout(() => { el.remove(); spawnElement(Math.random() > 0.5); }, (duration * 1000) + 100);
  }
  for(let i = 0; i < 6; i++) spawnElement(false); 
  for(let i = 0; i < 4; i++) spawnElement(true);  
  for(let i = 0; i < 40; i++) {
    const s = document.createElement('div'); s.className = 'bg-star';
    s.style.left = (Math.random() * 100) + 'vw'; s.style.top = (Math.random() * 100) + 'vh';
    s.style.animationDelay = (Math.random() * 3) + 's'; layer.appendChild(s);
  }
}
initBg();

const authScreen=$('authScreen'),regScreen=$('regScreen'),gameScreen=$('gameScreen'),betEl=$('bet'),chanceEl=$('chance'),spinBtn=$('spinBtn'),wheelEl=$('wheel'),resultEl=$('result'),multPreview=$('multPreview'),winPreview=$('winPreview'),needleEl=$('needle'),hubText=$('hubText');

function updateBalance(){const u=current();if(!u)return;$('balance').textContent=u.coins;updatePreview()}
function showAuth(){gameScreen.style.display='none';regScreen.style.display='none';authScreen.style.display='flex'}
$('showReg').onclick=()=>{authScreen.style.display='none';regScreen.style.display='flex'};
$('showLogin').onclick=showAuth;

$('loginBtn').onclick=async()=>{
  const email=$('loginUser').value.trim(), pass=$('loginPass').value; $('loginErr').textContent='Загрузка...';
  try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { $('loginErr').textContent='Ошибка входа'; }
};

$('regBtn').onclick=async()=>{
  const email=$('regUser').value.trim(), pass=$('regPass').value;
  if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return}
  $('regErr').textContent='Создание...';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, isAdmin: false, forcedChance: null });
  } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email занят':'Проверьте данные'); }
};

$('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {