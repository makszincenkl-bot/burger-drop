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

async function addCoins(amount) {
  if(!currentUser) return;
  try { await updateDoc(doc(db, "users", currentUser.uid), { coins: increment(amount) }); } 
  catch(e) { console.error("Ошибка базы:", e); }
}

function flashScreen(color) {
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;background:${color};z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.5s ease-out;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.style.opacity = '0.7', 10);
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 500); }, 400);
}

function playSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'spin') { osc.type = 'triangle'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3); osc.start(); osc.stop(audioCtx.currentTime + 0.3); } 
    else if (type === 'win') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1); osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4); osc.start(); osc.stop(audioCtx.currentTime + 0.4); } 
    else if (type === 'lose') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4); osc.start(); osc.stop(audioCtx.currentTime + 0.4); }
  } catch(e) {}
}
function vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }

function initBg(){
  const layer = document.getElementById('bgLayer');
  const g1 = document.createElement('div'); g1.className = 'bg-glow g1'; layer.appendChild(g1);
  const g2 = document.createElement('div'); g2.className = 'bg-glow g2'; layer.appendChild(g2);
  const g3 = document.createElement('div'); g3.className = 'bg-glow g3'; layer.appendChild(g3);
  function spawnElement(isWeapon) {
    const el = document.createElement('div');
    if (isWeapon) { const weapons = ['🔫','🔪','💣','🗡️']; el.className = 'bg-weapon'; el.textContent = weapons[Math.floor(Math.random() * weapons.length)]; el.style.fontSize = (40 + Math.random() * 40) + 'px'; } 
    else { const emojis = ['🍔','🍟','🥤','🧀','🥬','🍅','⭐','🍞']; el.className = 'bg-emoji'; el.textContent = emojis[Math.floor(Math.random() * emojis.length)]; el.style.fontSize = (24 + Math.random() * 30) + 'px'; }
    el.style.left = (Math.random() * 100) + 'vw'; el.style.top = '110vh';
    const duration = 10 + Math.random() * 15; el.style.transition = `transform ${duration}s linear, opacity 2s`;
    layer.appendChild(el);
    setTimeout(() => { el.style.transform = 'translateY(-130vh) rotate(360deg)'; }, 50);
    setTimeout(() => { el.remove(); spawnElement(Math.random() > 0.5); }, (duration * 1000) + 100);
  }
  for(let i = 0; i < 6; i++) spawnElement(false); 
  for(let i = 0; i < 4; i++) spawnElement(true);  
  for(let i = 0; i < 40; i++) { const s = document.createElement('div'); s.className = 'bg-star'; s.style.left = (Math.random() * 100) + 'vw'; s.style.top = (Math.random() * 100) + 'vh'; s.style.animationDelay = (Math.random() * 3) + 's'; layer.appendChild(s); }
}
initBg();

const authScreen=$('authScreen'),regScreen=$('regScreen'),gameScreen=$('gameScreen'),betEl=$('bet'),chanceEl=$('chance'),spinBtn=$('spinBtn'),wheelEl=$('wheel'),resultEl=$('result'),multPreview=$('multPreview'),winPreview=$('winPreview'),needleEl=$('needle'),hubText=$('hubText');

function updateBalance(){const u=current();if(!u)return;$('balance').textContent=u.coins;updatePreview()}
function showAuth(){gameScreen.style.display='none';regScreen.style.display='none';authScreen.style.display='flex'}
$('showReg').onclick=()=>{authScreen.style.display='none';regScreen.style.display='flex'};
$('showLogin').onclick=showAuth;

$('loginBtn').onclick=async()=>{ const email=$('loginUser').value.trim(), pass=$('loginPass').value; $('loginErr').textContent='Загрузка...'; try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { $('loginErr').textContent='Ошибка входа'; } };
$('regBtn').onclick=async()=>{ const email=$('regUser').value.trim(), pass=$('regPass').value; if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return} $('regErr').textContent='Создание...'; try { const cred = await createUserWithEmailAndPassword(auth, email, pass); await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, isAdmin: true, forcedChance: null }); } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email занят':'Проверьте данные'); } };
$('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if(snap.exists()){
        const d = snap.data();
        currentUser = { uid: user.uid, email: d.email, coins: d.coins??100, isAdmin: true, forcedChance: d.forcedChance??null };
        if(gameScreen.style.display === 'block') { updateBalance(); } else { enterGame(); }
        if(currentUser.isAdmin) fillAllSelects();
      }
    });
  } else { currentUser = null; if(unsubscribeSnap) unsubscribeSnap(); showAuth(); }
});

function enterGame(){authScreen.style.display='none';regScreen.style.display='none';gameScreen.style.display='block';const u=current();$('userName').textContent=u.email+(u.isAdmin?' 🛡':'');$('adminTab').style.display=u.isAdmin?'inline-block':'none';updateBalance();renderCases();updateClickerUI();updateHub();if(u.isAdmin)fillAllSelects()}

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('panel-'+t.dataset.panel).classList.add('active');if(t.dataset.panel==='game'){purpleActive=false;goldActive=false;updatePreview();drawWheel(getEffectiveChance());}}));

let currentRotation=0, spinning=false, bonusMode=false, bonusStreak=0, purpleActive=false, goldActive=false;
const PURPLE_SPAN=15;

function getEffectiveChance(){const u=current();if(u&&u.forcedChance!==null&&u.forcedChance!==undefined)return Number(u.forcedChance);return Math.min(99,Math.max(.1,parseFloat(chanceEl.value)||50))}
function updateHub(){if(bonusMode){hubText.className='hub-text streak';hubText.textContent='x'+bonusStreak}else{hubText.className='hub-text';hubText.textContent=getEffectiveChance()+'%'}}

function drawWheel(chance){
  const gd=chance*3.6, gs=180-gd/2, ge=180+gd/2;
  let stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 180deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`;
  if(purpleActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#9b4dca 172.5deg,#c77dff 180deg,#7b2cbf 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  if(goldActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#ffcc00 172.5deg,#ffea00 180deg,#b38f00 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  wheelEl.style.background=`conic-gradient(from 0deg,${stops})`;
}

function updatePreview(){if(!betEl)return;const bet=Math.max(0,parseInt(betEl.value,10)||0),chance=getEffectiveChance(),mult=100/chance;multPreview.textContent='x'+(mult>=100?mult.toFixed(0):mult.toFixed(2));winPreview.textContent='+'+Math.floor(bet*mult);if(!purpleActive&&!goldActive&&!bonusMode)drawWheel(chance);updateHub()}
betEl.addEventListener('input',updatePreview);
chanceEl.addEventListener('input',()=>{purpleActive=false;goldActive=false;updatePreview();drawWheel(getEffectiveChance())});

function spinNeedle(targetAngle,onDone,fast){
  const currentMod=((currentRotation%360)+360)%360,desired=((targetAngle%360)+360)%360,delta=(desired-currentMod+360)%360;
  currentRotation+= (fast?2:4)*360+delta; needleEl.style.transform='rotate('+(currentRotation-90)+'deg)';
  setTimeout(onDone, fast ? 1000 : 5000); 
}

async function doSpin(isFast){
  const u=current(); if(!u||spinning||bonusMode)return;
  const bet=Math.floor(Number(betEl.value)),chance=getEffectiveChance();
  if(bet<1){resultEl.className='result lose';resultEl.textContent='Ставка > 0';return}
  if(bet>u.coins){resultEl.className='result lose';resultEl.textContent='Мало монет';return}
  
  spinning=true; const normalBtn = $('spinBtn'), fastBtn = $('fastSpinBtn');
  normalBtn.disabled=true; if(fastBtn) fastBtn.disabled=true;

  u.coins-=bet; updateBalance(); await addCoins(-bet);
  resultEl.textContent='';
  
  playSound('spin');
  let roll = Math.random() * 100;
  purpleActive = false; goldActive = false;
  if (roll < 15) { purpleActive = true; }
  else if (roll < 30) { goldActive = true; }
  
  let targetAngle = 0;
  let outcome = 'lose';

  if (purpleActive) { outcome = 'purple'; targetAngle = 180; }
  else if (goldActive) { outcome = 'gold'; targetAngle = 180; }
  else {
    const gs=180-chance*1.8, ge=180+chance*1.8;
    targetAngle = Math.random() * 360;
    if (targetAngle >= 172.5 && targetAngle <= 187.5) targetAngle = 200; 
    if (targetAngle >= gs && targetAngle <= ge) outcome = 'win';
  }

  drawWheel(chance); 
  if(outcome !== 'win' && outcome !== 'lose') hubText.textContent='...';

  spinNeedle(targetAngle, async ()=>{
    purpleActive = false; goldActive = false;
    drawWheel(getEffectiveChance());

    if(outcome==='purple'){ resultEl.className='result bonus';resultEl.textContent='🟣 БОНУС УДВОЕНИЯ!'; startBonus(); } 
    else if (outcome==='gold') { resultEl.className='result bonus';resultEl.textContent='🟡 ЗОЛОТОЙ БОНУС!'; startGoldBonus(); } 
    else if(outcome==='win'){
      const winAmt=Math.floor(bet*100/chance);
      u.coins+=winAmt; updateBalance(); await addCoins(winAmt);
      playSound('win'); vibrate([100, 50, 100]);
      resultEl.className='result win';resultEl.textContent='🍔 УДАЧА! +'+winAmt+' 🪙';
      hubText.className='hub-text win';hubText.textContent='УДАЧА';
      spinning=false; normalBtn.disabled=false; if(fastBtn) fastBtn.disabled=false;
      setTimeout(()=>{hubText.className='hub-text';updateHub()},1500);
    } else {
      playSound('lose'); vibrate(200);
      resultEl.className='result lose';resultEl.textContent='😢 НЕУДАЧА: -'+bet+' 🪙';
      hubText.className='hub-text lose';hubText.textContent='НЕУДАЧА';
      spinning=false; normalBtn.disabled=false; if(fastBtn) fastBtn.disabled=false;
      setTimeout(()=>{hubText.className='hub-text';updateHub()},1500);
    }
  }, isFast);
}

$('spinBtn').onclick=()=>doSpin(false);
$('fastSpinBtn').onclick=()=>doSpin(true);

// БОНУСЫ
function startBonus(){
  bonusMode=true; bonusStreak=1; 
  flashScreen('#9b4dca'); vibrate([200, 100, 200, 100, 500]);
  $('bonusBarWrap').classList.add('active'); updateBonusBar();
  resultEl.className='result bonus'; resultEl.textContent='🟣 БОНУС! Удвоение!';
  resultEl.style.fontSize = '20px'; resultEl.style.textShadow = '0 0 15px #c77dff';
  setTimeout(runPurpleStep, 1500);
}
function updateBonusBar() { const bar = $('bonusBar'); const text = $('bonusBarText'); text.textContent = 'x' + bonusStreak; bar.style.width = Math.min(100, (bonusStreak / 6) * 100) + '%'; }
function runPurpleStep(){
  const u=current(); if(!u) { finishPurple(false); return; }
  const win = Math.random() < 0.5, target = win ? 180 + (Math.random()-.5)*90 : Math.random()*180;
  hubText.textContent='...';
  spinNeedle(target, async () => {
    if(win){ bonusStreak++; updateBonusBar(); resultEl.className='result win'; resultEl.textContent='🔥 Удача! Удвоение!'; setTimeout(runPurpleStep, 800); } 
    else { finishPurple(true); }
  }, true);
}
async function finishPurple(isWin){
  bonusMode=false; $('bonusBarWrap').classList.remove('active');
  const u=current();
  if(u && bonusStreak > 0){
    const bet = Math.floor(Number(betEl.value)) || 10;
    const winAmt = bet * Math.pow(2, bonusStreak - 1);
    if(isWin) { u.coins+=winAmt; await addCoins(winAmt); resultEl.className='result win'; resultEl.textContent=`🔥 БОНУС ЗАВЕРШЕН! Забрано: +${winAmt} 🪙`; } 
    else {
      const prevAmt = bonusStreak > 1 ? bet * Math.pow(2, bonusStreak - 2) : 0;
      if(prevAmt > 0) { u.coins+=prevAmt; await addCoins(prevAmt); resultEl.className='result bonus'; resultEl.textContent=`Бонус окончен. Забрано: +${prevAmt} 🪙`; } 
      else { resultEl.className='result lose'; resultEl.textContent='Бонус сгорел на первом шаге.'; }
    }
    updateBalance();
  }
  drawWheel(getEffectiveChance()); spinning=false; $('spinBtn').disabled=false; $('fastSpinBtn').disabled=false;
}

function startGoldBonus(){
  bonusMode=true; 
  flashScreen('#ffcc00'); vibrate([300, 100, 300]);
  resultEl.className='result bonus'; resultEl.textContent='🟡 ЗОЛОТОЙ БОНУС!';
  resultEl.style.fontSize = '20px'; resultEl.style.textShadow = '0 0 15px #ffcc00';
  const bet = Math.floor(Number(betEl.value)) || 10;
  const items = [{mult: 1.5, chance: 50}, {mult: 2, chance: 25}, {mult: 3, chance: 15}, {mult: 5, chance: 9}, {mult: 10, chance: 1}];
  let r = Math.random() * 100, winner = items[0];
  for(let i of items) { if (r < i.chance) { winner = i; break; } r -= i.chance; }

  $('caseModal').classList.add('active'); $('modalTitle').textContent = '🟡 ЗОЛОТОЙ КЕЙС'; $('modalContents').style.display='none'; $('modalLog').textContent = '';
  const b = $('modalOpenBtn'); b.disabled = true; b.textContent = 'КРУТИМ...';
  $('modalRouletteWrap').innerHTML = '<div class="roulette-view"><div class="roulette-strip" id="strip"></div><div class="roulette-marker"></div></div>';
  
  const strip = $('strip'); const cells = [];
  for(let i=0; i<40; i++) { cells.push(items[Math.floor(Math.random()*items.length)].mult); }
  cells[32] = winner.mult;
  strip.innerHTML = cells.map(m => `<div class="roulette-cell" style="color:#ffcc00;font-weight:900;font-size:20px;">x${m}</div>`).join('');
  
  setTimeout(()=>{ const view=document.querySelector('.roulette-view'), offset=-(32*66)+(view.offsetWidth/2)-30; strip.style.transition='transform 3s cubic-bezier(.1,.8,.2,1)'; strip.style.transform=`translateX(${offset}px)`; }, 50);

  setTimeout(async ()=>{
    const totalWin = Math.floor(bet * winner.mult);
    currentUser.coins+=totalWin; await addCoins(totalWin); updateBalance();
    b.textContent='ЗАБРАТЬ'; b.disabled=false; b.onclick=()=>{
       $('caseModal').classList.remove('active'); bonusMode=false; $('spinBtn').disabled=false; $('fastSpinBtn').disabled=false;
       resultEl.className='result win'; resultEl.textContent=`🟡 ИКС x${winner.mult}! Выигрыш: +${totalWin} 🪙`;
       drawWheel(getEffectiveChance()); 
    };
    $('modalLog').textContent = `Выпал множитель x${winner.mult}!`;
  }, 3150);
}

// ВСЕ 10 КЕЙСОВ
const CASES=[
{id:'1',name:'Чикен',price:20,emoji:'🍔',items:[{emoji:'🍞',name:'Хлеб',w:30,val:2},{emoji:'🥬',name:'Салат',w:25,val:5},{emoji:'🍅',name:'Томат',w:18,val:10},{emoji:'🧅',name:'Лук',w:12,val:15},{emoji:'🐔',name:'Курица',w:10,val:25},{emoji:'🧀',name:'Сыр',w:4,val:40},{emoji:'🦱',name:'Волос',w:1,val:60}]},
{id:'2',name:'Чизбургер',price:30,emoji:'🧀',items:[{emoji:'🍞',name:'Хлеб',w:28,val:3},{emoji:'🥬',name:'Салат',w:22,val:8},{emoji:'🍅',name:'Томат',w:18,val:15},{emoji:'🧀',name:'Сыр',w:15,val:30},{emoji:'🥩',name:'Мясо',w:10,val:50},{emoji:'🌶️',name:'Перец',w:6,val:70},{emoji:'🦱',name:'Волос',w:1,val:90}]},
{id:'3',name:'Двойной',price:50,emoji:'🍔🍔',items:[{emoji:'🍞',name:'Хлеб',w:25,val:5},{emoji:'🥩',name:'Мясо',w:22,val:15},{emoji:'🧀',name:'Сыр',w:20,val:25},{emoji:'🥬',name:'Салат',w:15,val:40},{emoji:'🍅',name:'Томат',w:10,val:70},{emoji:'🥓',name:'Бекон',w:6,val:100},{emoji:'🦱',name:'Волос',w:2,val:150}]},
{id:'4',name:'Овощной',price:40,emoji:'🥗',items:[{emoji:'🥬',name:'Салат',w:28,val:4},{emoji:'🍅',name:'Томат',w:25,val:10},{emoji:'🥒',name:'Огурец',w:20,val:20},{emoji:'🧅',name:'Лук',w:12,val:35},{emoji:'🥑',name:'Авокадо',w:9,val:60},{emoji:'🌶️',name:'Перец',w:5,val:90},{emoji:'🦱',name:'Волос',w:1,val:120}]},
{id:'5',name:'Салат',price:35,emoji:'🥬',items:[{emoji:'🥬',name:'Листья',w:32,val:3},{emoji:'🥒',name:'Огурец',w:25,val:10},{emoji:'🍅',name:'Томат',w:18,val:22},{emoji:'🧅',name:'Лук',w:12,val:40},{emoji:'🥑',name:'Авокадо',w:8,val:60},{emoji:'🥓',name:'Бекон',w:4,val:90},{emoji:'🦱',name:'Волос',w:1,val:105}]},
{id:'6',name:'Биг Хит',price:80,emoji:'💥',items:[{emoji:'🍞',name:'Хлеб',w:22,val:10},{emoji:'🥩',name:'Мясо',w:20,val:25},{emoji:'🧀',name:'Сыр',w:18,val:50},{emoji:'🥓',name:'Бекон',w:15,val:80},{emoji:'🍅',name:'Томат',w:12,val:120},{emoji:'🌶️',name:'Перец',w:8,val:170},{emoji:'💎',name:'Алмаз',w:4,val:200},{emoji:'🦱',name:'Волос',w:1,val:240}]},
{id:'7',name:'Дв. Биг',price:120,emoji:'💥💥',items:[{emoji:'🍞',name:'Хлеб',w:20,val:15},{emoji:'🥩',name:'Мясо',w:18,val:40},{emoji:'🧀',name:'Сыр',w:17,val:80},{emoji:'🥓',name:'Бекон',w:15,val:130},{emoji:'🍅',name:'Томат',w:12,val:200},{emoji:'🌶️',name:'Перец',w:9,val:280},{emoji:'💎',name:'Алмаз',w:6,val:330},{emoji:'🦱',name:'Волос',w:3,val:360}]},
{id:'8',name:'Мега',price:150,emoji:'🍔',items:[{emoji:'🍞',name:'Хлеб',w:18,val:20},{emoji:'🥩',name:'Мясо',w:17,val:60},{emoji:'🧀',name:'Сыр',w:16,val:120},{emoji:'🥓',name:'Бекон',w:14,val:200},{emoji:'🍅',name:'Томат',w:12,val:300},{emoji:'🌶️',name:'Перец',w:10,val:380},{emoji:'💎',name:'Алмаз',w:9,val:420},{emoji:'🦱',name:'Волос',w:4,val:450}]},
{id:'9',name:'Король',price:200,emoji:'👑',items:[{emoji:'🍞',name:'Хлеб',w:16,val:30},{emoji:'🥩',name:'Мясо',w:16,val:100},{emoji:'🧀',name:'Сыр',w:15,val:200},{emoji:'🥓',name:'Бекон',w:14,val:300},{emoji:'🍅',name:'Томат',w:13,val:400},{emoji:'👑',name:'Корона',w:10,val:500},{emoji:'💎',name:'Алмаз',w:12,val:560},{emoji:'🦱',name:'Волос',w:4,val:600}]},
{id:'10',name:'Легенда',price:300,emoji:'🏆',items:[{emoji:'🍞',name:'Хлеб',w:14,val:50},{emoji:'🥩',name:'Мясо',w:14,val:150},{emoji:'🧀',name:'Сыр',w:13,val:300},{emoji:'🥓',name:'Бекон',w:13,val:450},{emoji:'🍅',name:'Томат',w:12,val:600},{emoji:'👑',name:'Корона',w:12,val:750},{emoji:'💎',name:'Алмаз',w:14,val:850},{emoji:'🦱',name:'Волос',w:8,val:900}]}
];

function totalW(items){return items.reduce((s,i)=>s+i.w,0)}
function pickPrize(items){let r=Math.random()*totalW(items);for(const i of items){if(r<i.w)return i;r-=i.w}return items[items.length-1]}
function renderCases(){const grid=$('caseGrid');grid.innerHTML='';CASES.forEach(c=>{const d=document.createElement('div');d.className='case-tile';d.innerHTML=`<div class="emoji">${c.emoji}</div><div class="name">${c.name}</div><div class="price">${c.price} 🪙</div>`;d.onclick=()=>openCaseModal(c.id);grid.appendChild(d)})}
function openCaseModal(id){const c=CASES.find(x=>x.id===id);if(!c)return;$('caseModal').classList.add('active');$('modalLog').textContent='';$('modalTitle').textContent=`${c.emoji} ${c.name} (${c.price}🪙)`;const tw=totalW(c.items);$('modalContents').innerHTML=c.items.map(i=>`<div class="modal-item">${i.emoji} ${i.name} <b>${(i.w/tw*100).toFixed(1)}%</b> → ${i.val}🪙</div>`).join('');$('modalContents').style.display='flex';const b=$('modalOpenBtn');b.textContent=`ОТКРЫТЬ ЗА ${c.price} 🪙`;b.disabled=false;b.onclick=()=>spinCase(c);$('modalRouletteWrap').innerHTML=''}
window.closeModal=()=>{$('caseModal').classList.remove('active')};
async function spinCase(c){
  const u=current(); 
  if(u.coins<c.price){$('modalLog').textContent='Мало монет!';return}
  u.coins-=c.price; updateBalance(); await addCoins(-c.price);
  const b=$('modalOpenBtn');b.disabled=true;b.textContent='КРУТИМ...';$('modalContents').style.display='none';$('modalLog').textContent='';
  const winner=pickPrize(c.items),cells=Array.from({length:40},()=>pickPrize(c.items));cells[32]=winner;
  $('modalRouletteWrap').innerHTML='<div class="roulette-view"><div class="roulette-strip" id="strip"></div><div class="roulette-marker"></div></div>';
  const strip=$('strip');strip.innerHTML=cells.map(i=>`<div class="roulette-cell">${i.emoji}</div>`).join('');playSound('spin');
  setTimeout(()=>{const view=document.querySelector('.roulette-view'),offset=-(32*66)+(view.offsetWidth/2)-30;strip.style.transition='transform 3s cubic-bezier(.1,.8,.2,1)';strip.style.transform=`translateX(${offset}px)`},50);
  setTimeout(async ()=>{
    u.coins+=winner.val; updateBalance(); await addCoins(winner.val);
    playSound('win');vibrate(100);
    $('modalLog').textContent=`🎁 Выпало: ${winner.emoji} ${winner.name} (+${winner.val} 🪙)`;
    b.textContent='ЗАКРЫТЬ';b.disabled=false;b.onclick=closeModal;
  },3150);
}

// КЛИКЕР
let clicks=0,perClick=1,autoLevel=0,timer=null;
function updateClickerUI(){$('perClick').textContent=perClick;$('clickCount').textContent=clicks}
$('burgerClick').onclick=async ()=>{const u=current();if(!u)return;clicks++;u.coins+=perClick;updateBalance();updateClickerUI();vibrate(20);await addCoins(perClick);};
$('buyAuto').onclick=async ()=>{if(autoLevel>=5)return;const cost=50*(autoLevel+1),u=current();if(u.coins<cost){$('clickerLog').textContent='Мало монет';return}u.coins-=cost;autoLevel++;perClick++;updateBalance();updateClickerUI();await addCoins(-cost);if(!timer)timer=setInterval(async ()=>{const cu=current();if(cu){cu.coins+=perClick;updateBalance();updateClickerUI();await addCoins(perClick);}},1000)};

// ПОЛНОЦЕННАЯ АДМИНКА
async function fillAllSelects(){
  const snap = await getDocs(collection(db, "users"));
  const sel = $('adminTrollTarget'); sel.innerHTML = '';
  snap.forEach(doc => { const d = doc.data(); if(!d.isAdmin) sel.innerHTML += `<option value="${doc.id}">${d.email}</option>`; });
}
$('adminGiveBtn').onclick = async () => {
  const email=$('adminTarget').value.trim(), amt=parseInt($('adminCoins').value);
  if(!email||!amt) return;
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if(snap.empty){$('adminGiveLog').textContent='Не найден';return}
  snap.forEach(async d => { await updateDoc(doc(db,"users",d.id),{coins:increment(amt)}); });
  $('adminGiveLog').textContent='Выдано!';
};
$('adminGodBtn').onclick = async () => { const id=$('adminTrollTarget').value; if(id){ await updateDoc(doc(db,"users",id),{coins:1000000}); $('adminTrollLog').textContent='БОГ!'; } };
$('adminZeroBtn').onclick = async () => { const id=$('adminTrollTarget').value; if(id){ await updateDoc(doc(db,"users",id),{coins:0}); $('adminTrollLog').textContent='Обнулен'; } };

onAuthStateChanged(auth, user => { if(!user) showAuth(); });