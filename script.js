import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot, collection, getDocs, query, where, increment, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
let unsubscribeTickets = null;
let unsubscribeAdminTickets = null;
let unsubscribePlayersList = null;

function current(){ return currentUser; }

window.onerror = function(msg) {
  let err = document.getElementById('globalErr');
  if(!err) {
    err = document.createElement('div');
    err.id = 'globalErr';
    err.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#ff4a4a;color:#fff;padding:10px;font-size:12px;z-index:99999;text-align:center;font-weight:bold;';
    document.body.appendChild(err);
  }
  err.innerText = "ОШИБКА: " + msg;
};

async function addCoins(amount) {
  if(!currentUser) return;
  try { await updateDoc(doc(db, "users", currentUser.uid), { coins: increment(amount) }); } 
  catch(e) { console.error("Ошибка базы:", e); }
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
  if(!layer) return;
  const g1 = document.createElement('div'); g1.className = 'bg-glow g1'; layer.appendChild(g1);
  const g2 = document.createElement('div'); g2.className = 'bg-glow g2'; layer.appendChild(g2);
  const g3 = document.createElement('div'); g3.className = 'bg-glow g3'; layer.appendChild(g3);
  function spawnElement(isWeapon) {
    const el = document.createElement('div');
    if (isWeapon) { const weapons = ['🔫','🔪','💣','🗡️']; el.className = 'bg-weapon'; el.textContent = weapons[Math.floor(Math.random() * weapons.length)]; el.style.fontSize = (40 + Math.random() * 40) + 'px'; } 
    else { const emojis = ['🔫','🎯','🔪','🗡️','🦋','⚔️']; el.className = 'bg-emoji'; el.textContent = emojis[Math.floor(Math.random() * emojis.length)]; el.style.fontSize = (24 + Math.random() * 30) + 'px'; }
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

const authScreen=$('authScreen'),regScreen=$('regScreen'),gameScreen=$('gameScreen');

function updateBalance(){ const u=current(); if(!u)return; if($('balance')) $('balance').textContent = u.coins; updateUpgraderPreview(); }
function showAuth(){ if(gameScreen) gameScreen.style.display='none'; if(regScreen) regScreen.style.display='none'; if(authScreen) authScreen.style.display='flex'; }
if($('showReg')) $('showReg').onclick=()=>{if(authScreen)authScreen.style.display='none';if(regScreen)regScreen.style.display='flex'};
if($('showLogin')) $('showLogin').onclick=showAuth;

if($('loginBtn')) $('loginBtn').onclick=async()=>{ const email=$('loginUser').value.trim(), pass=$('loginPass').value; $('loginErr').textContent='Загрузка...'; try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { $('loginErr').textContent='Ошибка входа'; } };
if($('regBtn')) $('regBtn').onclick=async()=>{ const email=$('regUser').value.trim(), pass=$('regPass').value; if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return} $('regErr').textContent='Создание...'; try { const cred = await createUserWithEmailAndPassword(auth, email, pass); await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, isAdmin: false, forcedChance: null, inventory: [], activeItem: null }); } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email занят':'Проверьте данные'); } };
if($('logoutBtn')) $('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if(snap.exists()){
        const d = snap.data();
        currentUser = { uid: user.uid, email: d.email, coins: d.coins??100, isAdmin: d.isAdmin || false, forcedChance: d.forcedChance??null };
        
        if(gameScreen && gameScreen.style.display === 'block') { 
            updateBalance(); 
        } else { 
            enterGame(); 
        }
        if(currentUser.isAdmin) fillAllSelects();
        listenToMyTickets();
        if(currentUser.isAdmin) listenToAllTickets();
      }
    });
  } else { currentUser = null; if(unsubscribeSnap) unsubscribeSnap(); showAuth(); }
});

function enterGame(){
  if(authScreen) authScreen.style.display='none'; if(regScreen) regScreen.style.display='none'; if(gameScreen) gameScreen.style.display='block';
  const u=current(); if($('userName')) $('userName').textContent=u.email+(u.isAdmin?' 🛡':''); 
  if($('adminTab')) $('adminTab').style.display=u.isAdmin?'inline-block':'none';
  updateBalance(); if(u.isAdmin)fillAllSelects();
}

document.querySelectorAll('.tab[data-panel]').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab[data-panel]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('panel-'+t.dataset.panel).classList.add('active');}));

function drawWheel(chance){
  if(!$('wheel')) return;
  const gd=chance*3.6, gs=180-gd/2, ge=180+gd/2;
  let stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 180deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`;
  if(purpleActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#9b4dca 172.5deg,#c77dff 180deg,#7b2cbf 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  if(goldActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#ffcc00 172.5deg,#ffea00 180deg,#b38f00 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  $('wheel').style.background=`conic-gradient(from 0deg,${stops})`;
}

function getVisualChance() { return Math.min(99,Math.max(.1,parseFloat($('chance').value)||50)); }
function getRealChance() { const u = current(); if(u && u.forcedChance) return Number(u.forcedChance); return getVisualChance(); }

function updateUpgraderPreview() {
  const bet = parseFloat($('upgradeBet').value) || 0;
  const chance = getVisualChance();
  const mult = 100 / chance;
  if($('multPreview')) $('multPreview').textContent = 'x' + (mult >= 100 ? mult.toFixed(0) : mult.toFixed(2));
  if($('winPreview')) $('winPreview').textContent = '+' + Math.floor(bet * mult) + ' 🪙';
  drawWheel(chance);
}

if($('chance')) $('chance').addEventListener('input', updateUpgraderPreview);
if($('upgradeBet')) $('upgradeBet').addEventListener('input', updateUpgraderPreview);

let currentRotation = 0, spinning = false, bonusMode = false, bonusStreak = 0, purpleActive = false, goldActive = false;

function spinNeedle(targetAngle,onDone,fast){
  const currentMod=((currentRotation%360)+360)%360,desired=((targetAngle%360)+360)%360,delta=(desired-currentMod+360)%360;
  currentRotation+= (fast?2:4)*360+delta; 
  if($('needle')) $('needle').style.transform='rotate('+(currentRotation-90)+'deg)';
  setTimeout(onDone, fast ? 1000 : 5000); 
}

async function doUpgrade(isFast){
  const u = current();
  if(!u || spinning || bonusMode) return;

  let betAmount = parseFloat($('upgradeBet').value) || 0;
  if(betAmount < 1 || u.coins < betAmount) { if($('result')) { $('result').textContent = 'Недостаточно монет!'; $('result').className = 'result lose'; } return; }

  const visualChance = getVisualChance();
  const realChance = getRealChance();
  const mult = 100 / visualChance;

  spinning = true;
  if($('spinBtn')) $('spinBtn').disabled = true; if($('fastSpinBtn')) $('fastSpinBtn').disabled = true;

  u.coins -= betAmount; updateBalance(); await addCoins(-betAmount);

  if($('result')) $('result').textContent = '';
  
  purpleActive = false; goldActive = false;
  let roll = Math.random() * 100;
  
  // Бонусы появляются с шансом 10%, но шанс попадания 20%
  let bonusHit = false;
  if (roll < 10) {
    purpleActive = true;
    if (Math.random() * 100 < 20) bonusHit = true;
  } else if (roll < 20) {
    goldActive = true;
    if (Math.random() * 100 < 20) bonusHit = true;
  }

  let targetAngle = 0;
  let outcome = 'lose';

  if (purpleActive && bonusHit) { outcome = 'purple'; targetAngle = 180; }
  else if (goldActive && bonusHit) { outcome = 'gold'; targetAngle = 180; }
  else {
      const gs=180-visualChance*1.8, ge=180+visualChance*1.8;
      targetAngle = Math.random() * 360;
      if (targetAngle >= 172.5 && targetAngle <= 187.5) targetAngle = 200; 
      if (Math.random() * 100 < realChance) outcome = 'win';
  }

  drawWheel(visualChance); 
  if(outcome !== 'win' && outcome !== 'lose' && $('hubText')) $('hubText').textContent='...';

  spinNeedle(targetAngle, async ()=>{
    purpleActive = false; goldActive = false;
    drawWheel(visualChance);

    if(outcome==='purple'){ 
        $('result').className='result bonus'; $('result').textContent='🟣 БОНУС УДВОЕНИЯ!'; 
        startBonus(betAmount); 
    } 
    else if (outcome==='gold') { 
        $('result').className='result bonus'; $('result').textContent='🟡 ЗОЛОТОЙ БОНУС!'; 
        startGoldBonus(betAmount); 
    } 
    else if(outcome==='win'){
        const winAmt = Math.floor(betAmount * mult);
        u.coins += winAmt; updateBalance(); await addCoins(winAmt);
        $('result').className='result win'; $('result').textContent='🍔 УДАЧА! +' + winAmt + ' 🪙';
      spinning = false;
      if($('spinBtn')) $('spinBtn').disabled = false; if($('fastSpinBtn')) $('fastSpinBtn').disabled = false;
    } else {
      playSound('lose'); vibrate(200);
      $('result').className='result lose'; $('result').textContent='😢 НЕУДАЧА! Вы проиграли.';
      spinning = false;
      if($('spinBtn')) $('spinBtn').disabled = false; if($('fastSpinBtn')) $('fastSpinBtn').disabled = false;
    }
  }, isFast);
}

if($('spinBtn')) $('spinBtn').onclick = () => doUpgrade(false);
if($('fastSpinBtn')) $('fastSpinBtn').onclick = () => doUpgrade(true);

// БОНУСЫ
function startBonus(baseBet) {
  bonusMode = true; bonusStreak = 1; 
  playSound('win'); vibrate([200, 100, 200]);
  $('result').className='result bonus'; 
  $('result').textContent = '🟣 x' + bonusStreak;
  runPurpleStep(baseBet);
}

function runPurpleStep(baseBet) {
  const win = Math.random() < 0.5;
  const target = win ? 180 + (Math.random()-.5)*90 : Math.random()*180;
  
  if($('hubText')) $('hubText').textContent = '...';
  
  spinNeedle(target, async () => {
    if(win) { 
      bonusStreak++; 
      $('result').textContent = '🟣 x' + bonusStreak;
      setTimeout(() => runPurpleStep(baseBet), 800); 
    } 
    else { 
      finishPurple(baseBet); 
    }
  }, true);
}

async function finishPurple(baseBet) {
  bonusMode = false;
  const u = current();
  const bonusMult = Math.pow(2, bonusStreak - 1);
  
  if(u) {
      const winAmt = baseBet * bonusMult;
      u.coins += winAmt; updateBalance(); await addCoins(winAmt);
      $('result').className='result win'; $('result').textContent = '🟣 БОНУС! Забрано: +' + winAmt + ' 🪙';
  }
  if($('hubText')) $('hubText').className='hub-text';
  spinning = false;
  if($('spinBtn')) $('spinBtn').disabled = false; if($('fastSpinBtn')) $('fastSpinBtn').disabled = false;
}

function startGoldBonus(baseBet) {
  bonusMode = true; 
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

  setTimeout(async () => {
    const u = current();
    if(u) {
        const totalWin = Math.floor(baseBet * winner.mult);
        u.coins += totalWin; updateBalance(); await addCoins(totalWin);
        $('result').className='result win'; $('result').textContent=`🟡 ИКС x${winner.mult}! +${totalWin} 🪙`;
    }
    b.textContent='ЗАБРАТЬ'; b.disabled=false; b.onclick=()=>{
       $('caseModal').classList.remove('active'); bonusMode=false; spinning=false;
       if($('spinBtn')) $('spinBtn').disabled=false; if($('fastSpinBtn')) $('fastSpinBtn').disabled=false;
       drawWheel(getVisualChance());
    };
    $('modalLog').textContent = `Выпал множитель x${winner.mult}!`;
  }, 3150);
}

// ====== ПОДДЕРЖКА ======
if($('supportBtn')) $('supportBtn').onclick = () => {
  $('supportModal').classList.add('active');
  if(current() && current().isAdmin) {
    $('playerChatView').style.display = 'none'; $('adminChatView').style.display = 'flex';
  } else {
    $('playerChatView').style.display = 'flex'; $('adminChatView').style.display = 'none';
  }
};

function listenToMyTickets() {
  if(unsubscribeTickets) unsubscribeTickets();
  const u = current(); if(!u) return;
  const q = query(collection(db, "tickets"), where("uid", "==", u.uid));
  unsubscribeTickets = onSnapshot(q, (snap) => {
    const box = $('supportMessages'); if(!box) return;
    if(!snap.empty) box.innerHTML = '';
    let msgs = []; snap.forEach(d => msgs.push(d.data()));
    msgs.sort((a,b) => (a.time || 0) - (b.time || 0));
    if(msgs.length > 0) {
      msgs.forEach(m => {
        const isAdmin = m.from === 'admin';
        box.innerHTML += `<div style="align-self: ${isAdmin ? 'flex-start' : 'flex-end'}; max-width: 80%; background: ${isAdmin ? '#2196F3' : '#4ca832'}; color: #fff; padding: 8px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 5px; word-break: break-word;">${isAdmin ? '<b>Поддержка:</b><br>' : ''}${m.text}</div>`;
      });
      box.scrollTop = box.scrollHeight;
    }
  });
}

if($('supportSendBtn')) $('supportSendBtn').onclick = async () => {
  const u = current(); const text = $('supportInput').value.trim();
  if(!u || !text) return;
  await addDoc(collection(db, "tickets"), { uid: u.uid, email: u.email, text: text, from: 'player', time: Date.now() });
  $('supportInput').value = '';
};

function listenToAllTickets() {
  if(unsubscribeAdminTickets) unsubscribeAdminTickets();
  const u = current(); if(!u || !u.isAdmin) return;
  unsubscribeAdminTickets = onSnapshot(collection(db, "tickets"), (snap) => {
    const sel = $('adminTicketSelect'); if(!sel) return;
    let usersMap = new Map();
    snap.forEach(d => { const m = d.data(); usersMap.set(m.uid, m.email); });
    const currentVal = sel.value;
    let options = '<option value="">-- Выберите игрока --</option>';
    usersMap.forEach((email, uid) => { options += `<option value="${uid}">${email}</option>`; });
    sel.innerHTML = options; sel.value = currentVal;
  });
}

if($('adminTicketSelect')) $('adminTicketSelect').onchange = async (e) => {
  const targetUid = e.target.value; const box = $('adminTicketsList');
  if(!targetUid) { box.innerHTML = ''; return; }
  const q = query(collection(db, "tickets"), where("uid", "==", targetUid));
  const snap = await getDocs(q);
  let msgs = []; snap.forEach(d => msgs.push(d.data()));
  msgs.sort((a,b) => (a.time || 0) - (b.time || 0));
  box.innerHTML = '';
  msgs.forEach(m => {
    const isAdmin = m.from === 'admin';
    box.innerHTML += `<div style="margin-bottom: 8px; text-align: ${isAdmin ? 'right' : 'left'};"><span style="display: inline-block; background: ${isAdmin ? '#2196F3' : '#333'}; padding: 5px 10px; border-radius: 8px; color: #fff;">${isAdmin ? '<b>Вы:</b> ' : '<b>Игрок:</b> '}${m.text}</span></div>`;
  });
  box.scrollTop = box.scrollHeight;
};

if($('adminTicketSendBtn')) $('adminTicketSendBtn').onclick = async () => {
  const u = current(); const targetUid = $('adminTicketSelect').value; const text = $('adminTicketInput').value.trim();
  if(!u || !u.isAdmin || !targetUid || !text) return;
  await addDoc(collection(db, "tickets"), { uid: targetUid, email: 'admin', text: text, from: 'admin', time: Date.now() });
  $('adminTicketInput').value = '';
  $('adminTicketSelect').dispatchEvent(new Event('change'));
};

// ====== АДМИНКА ======
async function fillAllSelects(){
  const snap = await getDocs(collection(db, "users"));
  const selChance = $('adminChanceTarget'); if(selChance) selChance.innerHTML = '';
  const list = $('adminPlayersList'); if(list) list.innerHTML = '';
  
  snap.forEach(doc => { 
    const d = doc.data(); 
    if(!d.isAdmin && selChance) selChance.innerHTML += `<option value="${doc.id}">${d.email}</option>`; 
    
    // Список игроков для управления
    if(list) {
      let status = '🔴 Оффлайн';
      // Простая проверка онлайна (если coins менялись недавно, но мы не храним время, поэтому просто выведем)
      // Для реального онлайна нужна проверка lastSeen, но пока оставим заглушку
      list.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid #ffffff1a;">
          <div>${d.email}<br><span style="color:#ffcc66;">${d.coins} 🪙</span></div>
          <button class="small" style="width:auto; padding: 4px 8px; font-size: 10px;" onclick="changePlayerBalance('${doc.id}', '${d.email}', ${d.coins})">ИЗМЕНИТЬ</button>
        </div>
      `;
    }
  });
}

window.changePlayerBalance = async (uid, email, currentBalance) => {
  const newBalance = prompt(`Изменение баланса для ${email}\nТекущий: ${currentBalance}\nВведите новый баланс:`);
  if(newBalance !== null && !isNaN(newBalance) && newBalance >= 0) {
    await updateDoc(doc(db, "users", uid), { coins: Number(newBalance) });
    $('adminPlayersLog').textContent = `Баланс ${email} изменен на ${newBalance}`;
    fillAllSelects();
  }
};

if($('adminGiveBtn')) $('adminGiveBtn').onclick = async () => {
  const email=$('adminTarget').value.trim(), amt=parseInt($('adminCoins').value);
  if(!email||!amt) return;
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if(snap.empty){$('adminGiveLog').textContent='Не найден';return}
  snap.forEach(async d => { await updateDoc(doc(db,"users",d.id),{coins:increment(amt)}); });
  $('adminGiveLog').textContent='Выдано!';
};
if($('adminChanceBtn')) $('adminChanceBtn').onclick = async () => { const id=$('adminChanceTarget').value, val=parseFloat($('adminChanceValue').value); if(id && val>0) { await updateDoc(doc(db,"users",id),{forcedChance:val}); $('adminChanceLog').textContent='Шанс задан!'; } };
if($('adminChanceResetBtn')) $('adminChanceResetBtn').onclick = async () => { const id=$('adminChanceTarget').value; if(id) { await updateDoc(doc(db,"users",id),{forcedChance:null}); $('adminChanceLog').textContent='Сброшено!'; } };

// ====== ПОПОЛНЕНИЕ ======
if($('btnCrypto')) $('btnCrypto').onclick = () => { 
    const box = $('cryptoBox'); 
    box.style.display = box.style.display === 'none' ? 'block' : 'none'; 
};

if($('copyTonBtn')) $('copyTonBtn').onclick = () => { 
    const addr = $('tonAddress'); 
    addr.select(); 
    addr.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(addr.value); 
    $('copyTonBtn').textContent = 'СКОПИРОВАНО'; 
    setTimeout(()=>$('copyTonBtn').textContent='КОПИЯ', 2000); 
};

if($('btnSbp')) $('btnSbp').onclick = () => alert('СБП временно недоступно. Напишите в поддержку или телеграм @pruneslo');

// Калькулятор USDT
if($('cryptoCoinsInput')) {
    $('cryptoCoinsInput').addEventListener('input', (e) => {
        let coins = parseInt(e.target.value) || 0;
        if(coins < 0) coins = 0;
        let usdt = (coins / 100) * 0.9;
        if($('cryptoUsdtAmount')) $('cryptoUsdtAmount').textContent = usdt.toFixed(2) + ' USDT';
    });
}