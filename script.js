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
let isCoinMode = true;

function current(){ return currentUser; }

async function addCoins(amount) {
  if(!currentUser) return;
  try { await updateDoc(doc(db, "users", currentUser.uid), { coins: increment(amount) }); } 
  catch(e) { console.error("Ошибка базы:", e); }
}

async function saveInventory() {
  if(!currentUser) return;
  try { 
    await updateDoc(doc(db, "users", currentUser.uid), { 
      coins: currentUser.coins, 
      inventory: currentUser.inventory, 
      activeItem: currentUser.activeItem
    }); 
  } catch(e) { console.error("Ошибка сохранения инвентаря:", e); }
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
if($('regBtn')) $('regBtn').onclick=async()=>{ const email=$('regUser').value.trim(), pass=$('regPass').value; if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return} $('regErr').textContent='Создание...'; try { const cred = await createUserWithEmailAndPassword(auth, email, pass); await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, isAdmin: true, forcedChance: null, inventory: [], activeItem: null }); } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email занят':'Проверьте данные'); } };
if($('logoutBtn')) $('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if(snap.exists()){
        const d = snap.data();
        currentUser = { uid: user.uid, email: d.email, coins: d.coins??100, isAdmin: d.isAdmin || false, forcedChance: d.forcedChance??null, inventory: d.inventory??[], activeItem: d.activeItem??null };
        
        if(gameScreen && gameScreen.style.display === 'block') { 
            updateBalance(); 
            renderInventorySelect();
            renderInventory();
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
  updateBalance(); renderCases(); renderInventorySelect(); renderInventory(); if(u.isAdmin)fillAllSelects();
}

document.querySelectorAll('.tab[data-panel]').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab[data-panel]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('panel-'+t.dataset.panel).classList.add('active');}));

// ====== СПИСОК ПРЕДМЕТОВ (ЦЕНЫ УВЕЛИЧЕНЫ) ======
const ALL_ITEMS = [
  { name: 'P250 | Sand Dune', emoji: '🔫', val: 10, color: '#4b69ff' }, 
  { name: 'MP9 | Storm', emoji: '🔫', val: 20, color: '#4b69ff' }, 
  { name: 'Glock-18 | Water Elemental', emoji: '🔫', val: 30, color: '#4b69ff' }, 
  { name: 'Nova | Predator', emoji: '🔫', val: 40, color: '#4b69ff' }, 
  { name: 'SG 553 | Waves', emoji: '🔫', val: 60, color: '#4b69ff' },
  { name: 'MAC-10 | Candy Apple', emoji: '🔫', val: 100, color: '#8847ff' }, 
  { name: 'AK-47 | Safari Mesh', emoji: '🔫', val: 150, color: '#8847ff' }, 
  { name: 'AWP | Pit Viper', emoji: '🎯', val: 250, color: '#8847ff' }, 
  { name: 'M4A1-S | Basilisk', emoji: '🔫', val: 400, color: '#d32ce6' }, 
  { name: 'USP-S | Cortex', emoji: '🔫', val: 600, color: '#d32ce6' }, 
  { name: 'Desert Eagle | Printstream', emoji: '🔫', val: 1000, color: '#eb4b4b' },
  { name: 'AK-47 | Redline', emoji: '🔫', val: 1500, color: '#eb4b4b' }, 
  { name: 'M4A4 | Howl', emoji: '🔫', val: 2500, color: '#eb4b4b' }, 
  { name: 'AWP | Asiimov', emoji: '🎯', val: 3000, color: '#eb4b4b' }, 
  { name: 'AK-47 | Fire Serpent', emoji: '🔫', val: 5000, color: '#eb4b4b' },
  { name: 'Bayonet | Doppler', emoji: '🗡️', val: 8000, color: '#ffcc00' }, 
  { name: 'Flip Knife | Fade', emoji: '🔪', val: 10000, color: '#ffcc00' },
  { name: 'Stiletto Knife | Marble Fade', emoji: '⚔️', val: 15000, color: '#ffcc00' }, 
  { name: 'Butterfly Knife | Emerald', emoji: '🦋', val: 25000, color: '#ffcc00' }
];

// ====== ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА АПГРЕЙДЕРА ======
if($('btnModeCoins')) $('btnModeCoins').onclick = () => {
    isCoinMode = true;
    $('btnModeCoins').classList.add('active');
    $('btnModeItems').classList.remove('active');
    $('rowCoins').style.display = 'flex';
    $('rowItems').style.display = 'none';
    updateUpgraderPreview();
};

if($('btnModeItems')) $('btnModeItems').onclick = () => {
    isCoinMode = false;
    $('btnModeItems').classList.add('active');
    $('btnModeCoins').classList.remove('active');
    $('rowItems').style.display = 'flex';
    $('rowCoins').style.display = 'none';
    renderInventorySelect();
    updateUpgraderPreview();
};

function renderInventorySelect() {
  const sel = $('upgradeItemSelect'); if(!sel) return;
  const u = current();
  let currentVal = sel.value;
  
  sel.innerHTML = '<option value="">-- Выберите предмет --</option>';
  if(u && u.inventory && u.inventory.length > 0) {
    u.inventory.forEach(item => { 
        sel.innerHTML += `<option value="${item.name}">${item.emoji} ${item.name} (x${item.count}) - ${item.val}🪙</option>`; 
    });
  }
  
  if(currentVal && u && u.inventory.find(i=>i.name===currentVal)) {
      sel.value = currentVal;
  } else if (u && u.inventory.length > 0) {
      sel.value = u.inventory[0].name;
  }
}

if($('upgradeItemSelect')) $('upgradeItemSelect').onchange = () => { updateUpgraderPreview(); };

function getSelectedItem() {
  if(isCoinMode) return { name: 'Монеты', emoji: '🪙', isCoins: true };
  const val = $('upgradeItemSelect').value;
  const u = current();
  return u.inventory.find(i => i.name === val);
}

function drawWheel(chance){
  if(!$('wheel')) return;
  const gd=chance*3.6, gs=180-gd/2, ge=180+gd/2;
  let stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 180deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`;
  if(purpleActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#9b4dca 172.5deg,#c77dff 180deg,#7b2cbf 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  if(goldActive){ stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 172.5deg,#ffcc00 172.5deg,#ffea00 180deg,#b38f00 187.5deg,#7ee06b 187.5deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  $('wheel').style.background=`conic-gradient(from 0deg,${stops})`;
}

function getVisualChance() {
    if(isCoinMode) return Math.min(99,Math.max(.1,parseFloat($('chance').value)||50));
    return Math.min(99,Math.max(.1,parseFloat($('chanceItem').value)||50));
}

function getRealChance() {
    const u = current();
    if(u && u.forcedChance) return Number(u.forcedChance);
    return getVisualChance();
}

function updateUpgraderPreview() {
  const item = getSelectedItem();
  const chance = getVisualChance();
  const mult = 100 / chance;
  let bet = 0;
  
  if(item) {
      if(item.isCoins) bet = parseFloat($('upgradeBet').value) || 0;
      else bet = item.val;
  }
  
  if($('multPreview')) $('multPreview').textContent = 'x' + (mult >= 100 ? mult.toFixed(0) : mult.toFixed(2));
  if($('winPreview')) $('winPreview').textContent = '+' + Math.floor(bet * mult) + (item && item.isCoins ? ' 🪙' : ' (Предмет)');
  
  drawWheel(chance);
}

if($('chance')) $('chance').addEventListener('input', updateUpgraderPreview);
if($('chanceItem')) $('chanceItem').addEventListener('input', updateUpgraderPreview);
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

  const item = getSelectedItem();
  if(!item) { if($('result')) { $('result').textContent = 'Выберите предмет!'; $('result').className = 'result lose'; } return; }
  
  let betAmount = 0;
  if(item.isCoins) {
      betAmount = parseFloat($('upgradeBet').value) || 0;
      if(betAmount < 1 || u.coins < betAmount) { if($('result')) { $('result').textContent = 'Недостаточно монет!'; $('result').className = 'result lose'; } return; }
  } else {
      betAmount = item.val;
  }

  const visualChance = getVisualChance();
  const realChance = getRealChance();
  const mult = 100 / visualChance;

  spinning = true;
  if($('spinBtn')) $('spinBtn').disabled = true; if($('fastSpinBtn')) $('fastSpinBtn').disabled = true;

  if(item.isCoins) {
      u.coins -= betAmount; updateBalance(); await addCoins(-betAmount);
  } else {
      const idx = u.inventory.findIndex(i => i.name === item.name);
      if(idx !== -1) {
          u.inventory[idx].count--;
          if(u.inventory[idx].count <= 0) u.inventory.splice(idx, 1);
          renderInventorySelect(); renderInventory(); await saveInventory();
      }
  }

  if($('result')) $('result').textContent = '';
  
  purpleActive = false; goldActive = false;
  let roll = Math.random() * 100;
  if (roll < 10) purpleActive = true;
  else if (roll < 20) goldActive = true;

  let targetAngle = 0;
  let outcome = 'lose';

  if (purpleActive) { outcome = 'purple'; targetAngle = 180; }
  else if (goldActive) { outcome = 'gold'; targetAngle = 180; }
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
        startBonus(betAmount, item, mult); 
    } 
    else if (outcome==='gold') { 
        $('result').className='result bonus'; $('result').textContent='🟡 ЗОЛОТОЙ БОНУС!'; 
        startGoldBonus(betAmount, item, mult); 
    } 
    else if(outcome==='win'){
      if(item.isCoins) {
        const winAmt = Math.floor(betAmount * mult);
        u.coins += winAmt; updateBalance(); await addCoins(winAmt);
        $('result').className='result win'; $('result').textContent='🍔 УДАЧА! +' + winAmt + ' 🪙';
      } else {
        const targetVal = item.val * mult;
        let prize = ALL_ITEMS.find(i => i.val >= targetVal) || ALL_ITEMS[ALL_ITEMS.length-1];
        const old = u.inventory.find(i => i.name === prize.name);
        if(old) old.count++; else u.inventory.push({ name: prize.name, emoji: prize.emoji, val: prize.val, count: 1, color: prize.color });
        
        renderInventorySelect(); renderInventory(); await saveInventory();
        $('result').className='result win'; $('result').textContent = '🎁 УДАЧА! Выпало: ' + prize.emoji + ' ' + prize.name;
      }
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
function startBonus(baseBet, item, mult) {
  bonusMode = true; bonusStreak = 1; 
  playSound('win'); vibrate([200, 100, 200]);
  $('result').className='result bonus'; 
  $('result').textContent = '🟣 x' + bonusStreak;
  runPurpleStep(baseBet, item, mult);
}

function runPurpleStep(baseBet, item, mult) {
  const win = Math.random() < 0.5;
  const target = win ? 180 + (Math.random()-.5)*90 : Math.random()*180;
  
  if($('hubText')) $('hubText').textContent = '...';
  
  spinNeedle(target, async () => {
    if(win) { 
      bonusStreak++; 
      $('result').textContent = '🟣 x' + bonusStreak;
      setTimeout(() => runPurpleStep(baseBet, item, mult), 800); 
    } 
    else { 
      finishPurple(baseBet, item, mult); 
    }
  }, true);
}

async function finishPurple(baseBet, item, mult) {
  bonusMode = false;
  const u = current();
  const bonusMult = Math.pow(2, bonusStreak - 1);
  
  if(u) {
    if(item.isCoins) {
      const winAmt = baseBet * bonusMult;
      u.coins += winAmt; updateBalance(); await addCoins(winAmt);
      $('result').className='result win'; $('result').textContent = '🟣 БОНУС! Забрано: +' + winAmt + ' 🪙';
    } else {
      const targetVal = item.val * bonusMult;
      let prize = ALL_ITEMS.find(i => i.val >= targetVal) || ALL_ITEMS[ALL_ITEMS.length-1];
      const old = u.inventory.find(i => i.name === prize.name);
      if(old) old.count++; else u.inventory.push({ name: prize.name, emoji: prize.emoji, val: prize.val, count: 1, color: prize.color });
      renderInventorySelect(); renderInventory(); await saveInventory();
      $('result').className='result win'; $('result').textContent = '🟣 БОНУС! Забрано: ' + prize.emoji + ' ' + prize.name;
    }
  }
  if($('hubText')) $('hubText').className='hub-text';
  spinning = false;
  if($('spinBtn')) $('spinBtn').disabled = false; if($('fastSpinBtn')) $('fastSpinBtn').disabled = false;
}

function startGoldBonus(baseBet, item, mult) {
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
      if(item.isCoins) {
        const totalWin = Math.floor(baseBet * winner.mult);
        u.coins += totalWin; updateBalance(); await addCoins(totalWin);
        $('result').className='result win'; $('result').textContent=`🟡 ИКС x${winner.mult}! +${totalWin} 🪙`;
      } else {
        const targetVal = item.val * winner.mult;
        let prize = ALL_ITEMS.find(i => i.val >= targetVal) || ALL_ITEMS[ALL_ITEMS.length-1];
        const old = u.inventory.find(i => i.name === prize.name);
        if(old) old.count++; else u.inventory.push({ name: prize.name, emoji: prize.emoji, val: prize.val, count: 1, color: prize.color });
        renderInventorySelect(); renderInventory(); await saveInventory();
        $('result').className='result win'; $('result').textContent=`🟡 ИКС x${winner.mult}! +${prize.emoji} ${prize.name}`;
      }
    }
    b.textContent='ЗАБРАТЬ'; b.disabled=false; b.onclick=()=>{
       $('caseModal').classList.remove('active'); bonusMode=false; spinning=false;
       if($('spinBtn')) $('spinBtn').disabled=false; if($('fastSpinBtn')) $('fastSpinBtn').disabled=false;
       drawWheel(getVisualChance());
    };
    $('modalLog').textContent = `Выпал множитель x${winner.mult}!`;
  }, 3150);
}

// ====== ИНВЕНТАРЬ ======
function renderInventory() {
  const list = $('inventoryList');
  const u = current();
  if(!list || !u) return;
  
  if(!u.inventory || u.inventory.length === 0) {
    list.innerHTML = '<div style="color: #b8d8a8; font-size: 13px; text-align: center; padding: 20px;">Инвентарь пуст. Откройте кейсы!</div>';
    return;
  }
  
  let html = '';
  u.inventory.forEach(item => {
    html += `
      <div class="inv-item" style="border-left: 3px solid ${item.color || '#ffa500'}">
        <div class="icon">${item.emoji}</div>
        <div class="info">
          <div class="nm" style="color: ${item.color || '#fff'}">${item.name} ${item.count > 1 ? 'x' + item.count : ''}</div>
          <div class="lvl">Цена: ${item.val} 🪙 за шт.</div>
        </div>
      </div>
    `;
  });
  list.innerHTML = html;
}

if($('sellAllBtn')) $('sellAllBtn').onclick = async () => {
  const u = current();
  if(!u || !u.inventory || u.inventory.length === 0) return;
  
  let totalValue = 0;
  u.inventory.forEach(item => { totalValue += (item.val * item.count); });
  
  if(totalValue <= 0) return;
  
  u.coins += totalValue;
  u.inventory = [];
  
  updateBalance(); renderInventory(); renderInventorySelect(); await saveInventory(); await addCoins(totalValue);
  
  playSound('win'); vibrate(100);
  alert(`Вы продали весь инвентарь за ${totalValue} 🪙!`);
};

// ====== МИНЫ ======
let minesActive = false, minesGrid = [], minesOpened = 0, minesBet = 0, minesCount = 3;
function getMinesMultiplier() {
  if(!minesActive) return 1;
  const total = 25, safe = total - minesCount;
  let mult = 1;
  for(let i=0; i<minesOpened; i++) { mult *= (total - i) / (safe - i); }
  return mult * 0.97;
}

if($('minesStartBtn')) $('minesStartBtn').onclick = async () => {
  if(minesActive) return;
  const u = current(); if(!u) return;
  minesBet = parseInt($('minesBet').value);
  minesCount = parseInt($('minesCount').value);
  
  if(minesBet < 1 || u.coins < minesBet) { $('minesStatus').textContent = 'Мало монет!'; $('minesStatus').style.color = '#ff6b4a'; return; }
  
  u.coins -= minesBet; updateBalance(); await addCoins(-minesBet);
  
  minesActive = true; minesOpened = 0;
  $('minesStartBtn').style.display = 'none';
  $('minesCashoutBtn').style.display = 'block';
  $('minesCashoutBtn').textContent = `ЗАБРАТЬ (x1.00)`;
  $('minesStatus').textContent = '';
  
  minesGrid = Array(25).fill(false);
  let minesPlaced = 0;
  while(minesPlaced < minesCount) {
    let r = Math.floor(Math.random() * 25);
    if(!minesGrid[r]) { minesGrid[r] = true; minesPlaced++; }
  }
  
  const gridHTML = $('minesGrid'); gridHTML.innerHTML = '';
  for(let i=0; i<25; i++) {
    const cell = document.createElement('div');
    cell.className = 'mine-cell'; cell.dataset.index = i;
    cell.onclick = () => openMineCell(i, cell);
    gridHTML.appendChild(cell);
  }
};

function openMineCell(index, cell) {
  if(!minesActive || cell.classList.contains('opened')) return;
  cell.classList.add('opened');
  
  if(minesGrid[index]) {
    cell.classList.add('bomb'); cell.textContent = '💣';
    playSound('lose'); vibrate(300);
    $('minesStatus').textContent = 'Взрыв! Ставка сгорела.'; $('minesStatus').style.color = '#ff6b4a';
    minesActive = false;
    $('minesStartBtn').style.display = 'block'; $('minesCashoutBtn').style.display = 'none';
    document.querySelectorAll('.mine-cell').forEach((c, i) => {
      if(minesGrid[i] && !c.classList.contains('opened')) { c.classList.add('opened', 'bomb'); c.textContent = '💣'; }
    });
  } else {
    cell.classList.add('star'); cell.textContent = '⭐';
    minesOpened++;
    const mult = getMinesMultiplier();
    $('minesCashoutBtn').textContent = `ЗАБРАТЬ (x${mult.toFixed(2)})`;
    playSound('win'); vibrate(20);
    if(minesOpened === 25 - minesCount) cashoutMines();
  }
}

async function cashoutMines() {
  if(!minesActive || minesOpened === 0) return;
  const mult = getMinesMultiplier();
  const winAmt = Math.floor(minesBet * mult);
  const u = current();
  u.coins += winAmt; updateBalance(); await addCoins(winAmt);
  
  playSound('win'); vibrate([100, 50, 100]);
  $('minesStatus').textContent = `Выигрыш: +${winAmt} 🪙 (x${mult.toFixed(2)})`; $('minesStatus').style.color = '#7ee06b';
  
  minesActive = false;
  $('minesStartBtn').style.display = 'block'; $('minesCashoutBtn').style.display = 'none';
  document.querySelectorAll('.mine-cell').forEach((c, i) => {
    if(minesGrid[i] && !c.classList.contains('opened')) { c.classList.add('opened', 'bomb'); c.textContent = '💣'; }
  });
}
if($('minesCashoutBtn')) $('minesCashoutBtn').onclick = cashoutMines;

// ====== КРАШ ======
let crashActive = false, crashMult = 1, crashTimer = null, crashBet = 0, crashAutoStop = 0, crashHistory = [];
if($('crashStartBtn')) $('crashStartBtn').onclick = async () => {
  if(crashActive) return;
  const u = current(); if(!u) return;
  crashBet = parseInt($('crashBet').value);
  crashAutoStop = parseFloat($('crashAutoStop').value);
  
  if(crashBet < 1 || u.coins < crashBet) { $('crashStatus').textContent = 'Мало монет!'; $('crashStatus').style.color = '#ff6b4a'; return; }
  
  u.coins -= crashBet; updateBalance(); await addCoins(-crashBet);
  
  crashActive = true; crashMult = 1;
  $('crashStartBtn').style.display = 'none';
  $('crashCashoutBtn').style.display = 'block';
  $('crashCashoutBtn').textContent = `ЗАБРАТЬ (x1.00)`;
  $('crashStatus').textContent = 'Игра началась!'; $('crashStatus').style.color = '#b8d8a8';
  
  const crashPoint = 1 + (Math.random() * Math.random() * 10);
  
  crashTimer = setInterval(async () => {
    if(!crashActive) return;
    crashMult += 0.02;
    $('crashMultiplier').textContent = `x${crashMult.toFixed(2)}`;
    $('crashCashoutBtn').textContent = `ЗАБРАТЬ (x${crashMult.toFixed(2)})`;
    
    if(crashMult >= crashAutoStop) {
      cashoutCrash();
    }
    
    if(crashMult >= crashPoint) {
      crashActive = false; clearInterval(crashTimer);
      playSound('lose'); vibrate(300);
      $('crashStatus').textContent = `КРАШ на x${crashMult.toFixed(2)}! Ставка сгорела.`; $('crashStatus').style.color = '#ff6b4a';
      $('crashMultiplier').style.color = '#ff6b4a';
      $('crashStartBtn').style.display = 'block';
      $('crashCashoutBtn').style.display = 'none';
      
      crashHistory.unshift(crashMult);
      if(crashHistory.length > 10) crashHistory.pop();
      renderCrashHistory();
    }
  }, 100);
  $('crashMultiplier').style.color = '#7ee06b';
};

async function cashoutCrash() {
    if(!crashActive) return;
    crashActive = false;
    clearInterval(crashTimer);
    
    const u = current();
    const winAmt = Math.floor(crashBet * crashMult);
    u.coins += winAmt; updateBalance(); await addCoins(winAmt);
    
    playSound('win'); vibrate([100, 50, 100]);
    $('crashStatus').textContent = `Вы забрали на x${crashMult.toFixed(2)}! Выигрыш: +${winAmt} 🪙`; 
    $('crashStatus').style.color = '#7ee06b';
    $('crashStartBtn').style.display = 'block';
    $('crashCashoutBtn').style.display = 'none';
    
    crashHistory.unshift(crashMult);
    if(crashHistory.length > 10) crashHistory.pop();
    renderCrashHistory();
}

if($('crashCashoutBtn')) $('crashCashoutBtn').onclick = cashoutCrash;

function renderCrashHistory() {
    const box = $('crashHistory');
    if(!box) return;
    box.innerHTML = '';
    crashHistory.forEach(mult => {
        let color = mult >= 2 ? '#7ee06b' : '#ff6b4a';
        box.innerHTML += `<span style="background: #0000004d; color: ${color}; padding: 4px 8px; border-radius: 5px; font-weight: bold; font-size: 12px;">x${mult.toFixed(2)}</span>`;
    });
}

// ====== КЕЙСЫ (ОБНОВЛЕННЫЕ ЦЕНЫ И НОВЫЕ ПУШКИ) ======
const CASES = [
  { id: '1', name: 'Начальный', price: 50, emoji: '🔫', 
    items: [
      { name: 'P250 | Sand Dune', emoji: '🔫', w: 35, val: 10, color: '#4b69ff' },
      { name: 'MP9 | Storm', emoji: '🔫', w: 30, val: 20, color: '#4b69ff' },
      { name: 'Glock-18 | Water Elemental', emoji: '🔫', w: 20, val: 30, color: '#4b69ff' },
      { name: 'Nova | Predator', emoji: '🔫', w: 12, val: 40, color: '#4b69ff' },
      { name: 'SG 553 | Waves', emoji: '🔫', w: 3, val: 60, color: '#4b69ff' }
    ]
  },
  { id: '2', name: 'Синий', price: 100, emoji: '🔵', 
    items: [
      { name: 'MP9 | Storm', emoji: '🔫', w: 30, val: 20, color: '#4b69ff' },
      { name: 'Glock-18 | Water Elemental', emoji: '🔫', w: 30, val: 30, color: '#4b69ff' },
      { name: 'Nova | Predator', emoji: '🔫', w: 22, val: 40, color: '#4b69ff' },
      { name: 'SG 553 | Waves', emoji: '🔫', w: 12, val: 60, color: '#4b69ff' },
      { name: 'MAC-10 | Candy Apple', emoji: '🔫', w: 5, val: 100, color: '#8847ff' },
      { name: 'AK-47 | Safari Mesh', emoji: '🔫', w: 1, val: 150, color: '#8847ff' }
    ]
  },
  { id: '3', name: 'Фиолетовый', price: 200, emoji: '🟣', 
    items: [
      { name: 'SG 553 | Waves', emoji: '🔫', w: 35, val: 60, color: '#4b69ff' },
      { name: 'MAC-10 | Candy Apple', emoji: '🔫', w: 30, val: 100, color: '#8847ff' },
      { name: 'AK-47 | Safari Mesh', emoji: '🔫', w: 22, val: 150, color: '#8847ff' },
      { name: 'AWP | Pit Viper', emoji: '🎯', w: 9, val: 250, color: '#8847ff' },
      { name: 'M4A1-S | Basilisk', emoji: '🔫', w: 3.5, val: 400, color: '#d32ce6' },
      { name: 'USP-S | Cortex', emoji: '🔫', w: 0.5, val: 600, color: '#d32ce6' }
    ]
  },
  { id: '4', name: 'Розовый', price: 350, emoji: '🌸', 
    items: [
      { name: 'AK-47 | Safari Mesh', emoji: '🔫', w: 35, val: 150, color: '#8847ff' },
      { name: 'AWP | Pit Viper', emoji: '🎯', w: 30, val: 250, color: '#8847ff' },
      { name: 'M4A1-S | Basilisk', emoji: '🔫', w: 18, val: 400, color: '#d32ce6' },
      { name: 'USP-S | Cortex', emoji: '🔫', w: 12, val: 600, color: '#d32ce6' },
      { name: 'Desert Eagle | Printstream', emoji: '🔫', w: 4, val: 1000, color: '#eb4b4b' },
      { name: 'AK-47 | Redline', emoji: '🔫', w: 1, val: 1500, color: '#eb4b4b' }
    ]
  },
  { id: '5', name: 'Красный', price: 500, emoji: '🔴', 
    items: [
      { name: 'M4A1-S | Basilisk', emoji: '🔫', w: 35, val: 400, color: '#d32ce6' },
      { name: 'USP-S | Cortex', emoji: '🔫', w: 28, val: 600, color: '#d32ce6' },
      { name: 'Desert Eagle | Printstream', emoji: '🔫', w: 20, val: 1000, color: '#eb4b4b' },
      { name: 'AK-47 | Redline', emoji: '🔫', w: 12, val: 1500, color: '#eb4b4b' },
      { name: 'M4A4 | Howl', emoji: '🔫', w: 4, val: 2500, color: '#eb4b4b' },
      { name: 'AWP | Asiimov', emoji: '🎯', w: 1, val: 3000, color: '#eb4b4b' }
    ]
  },
  { id: '6', name: 'Ножевой', price: 1000, emoji: '🔪', 
    items: [
      { name: 'AK-47 | Redline', emoji: '🔫', w: 40, val: 1500, color: '#eb4b4b' },
      { name: 'M4A4 | Howl', emoji: '🔫', w: 30, val: 2500, color: '#eb4b4b' },
      { name: 'AWP | Asiimov', emoji: '🎯', w: 18, val: 3000, color: '#eb4b4b' },
      { name: 'AK-47 | Fire Serpent', emoji: '🔫', w: 8, val: 5000, color: '#eb4b4b' },
      { name: 'Bayonet | Doppler', emoji: '🗡️', w: 3, val: 8000, color: '#ffcc00' },
      { name: 'Flip Knife | Fade', emoji: '🔪', w: 1, val: 10000, color: '#ffcc00' }
    ]
  },
  { id: '7', name: 'Топ', price: 2000, emoji: '💎', 
    items: [
      { name: 'AWP | Asiimov', emoji: '🎯', w: 45, val: 3000, color: '#eb4b4b' },
      { name: 'AK-47 | Fire Serpent', emoji: '🔫', w: 25, val: 5000, color: '#eb4b4b' },
      { name: 'Bayonet | Doppler', emoji: '🗡️', w: 15, val: 8000, color: '#ffcc00' },
      { name: 'Flip Knife | Fade', emoji: '🔪', w: 8, val: 10000, color: '#ffcc00' },
      { name: 'Stiletto Knife | Marble Fade', emoji: '⚔️', w: 5, val: 15000, color: '#ffcc00' },
      { name: 'Butterfly Knife | Emerald', emoji: '🦋', w: 2, val: 25000, color: '#ffcc00' }
    ]
  }
];

let caseBusy = false;
function totalW(items){return items.reduce((s,i)=>s+i.w,0)}
function pickPrize(items){let r=Math.random()*totalW(items);for(const i of items){if(r<i.w)return i;r-=i.w}return items[items.length-1]}

function renderCases(){
  const grid=$('caseGrid'); if(!grid) return; grid.innerHTML='';
  CASES.forEach(c=>{
    const d=document.createElement('div'); d.className='case-tile';
    d.innerHTML=`<div class="emoji">${c.emoji}</div><div class="name">${c.name}</div><div class="price">${c.price} 🪙</div>`;
    d.onclick=()=>openCaseModal(c.id); grid.appendChild(d);
  });
}

function openCaseModal(id){
  const c=CASES.find(x=>x.id===id);if(!c)return;
  $('caseModal').classList.add('active'); $('modalLog').textContent='';
  $('modalTitle').textContent=`${c.emoji} ${c.name} (${c.price}🪙)`;
  const tw=totalW(c.items);
  $('modalContents').innerHTML=c.items.map(i=>`<div class="modal-item" style="border-left: 2px solid ${i.color || '#fff'}">${i.emoji} ${i.name} <b>${(i.w/tw*100).toFixed(1)}%</b> → ${i.val}🪙</div>`).join('');
  $('modalContents').style.display='flex';
  const b=$('modalOpenBtn'); b.textContent=`ОТКРЫТЬ ЗА ${c.price} 🪙`; b.disabled=false;
  b.onclick=()=>spinCase(c); $('modalRouletteWrap').innerHTML='';
}

window.closeModal=()=>{if(!caseBusy)$('caseModal').classList.remove('active')};

async function spinCase(c){
  const u=current(); 
  if(u.coins<c.price){$('modalLog').textContent='Мало монет!';return}
  if(caseBusy) return;
  caseBusy=true;
  
  u.coins-=c.price; updateBalance(); await addCoins(-c.price);
  
  const b=$('modalOpenBtn'); b.disabled=true; b.textContent='КРУТИМ...'; $('modalContents').style.display='none'; $('modalLog').textContent='';
  
  const winner=pickPrize(c.items);
  
  // --- СРАЗУ ЗАПИСЫВАЕМ В ИНВЕНТАРЬ И БАЗУ ---
  const old = u.inventory.find(i => i.name === winner.name);
  if(old) old.count += 1; else u.inventory.push({ name: winner.name, emoji: winner.emoji, val: winner.val, count: 1, color: winner.color });
  await saveInventory(); // Сохраняем СРАЗУ
  renderInventory(); // Обновляем UI
  renderInventorySelect();
  
  const cells=Array.from({length:40},()=>pickPrize(c.items)); cells[32]=winner;
  
  $('modalRouletteWrap').innerHTML='<div class="roulette-view"><div class="roulette-strip" id="strip"></div><div class="roulette-marker"></div></div>';
  const strip=$('strip'); 
  strip.innerHTML=cells.map(i=>`<div class="roulette-cell" style="border-bottom: 2px solid ${i.color || '#fff'}">${i.emoji}</div>`).join('');
  playSound('spin');
  
  setTimeout(()=>{
    const view=document.querySelector('.roulette-view');
    const offset=-(32*66)+(view.offsetWidth/2)-30;
    strip.style.transition='transform 3s cubic-bezier(.1,.8,.2,1)'; strip.style.transform=`translateX(${offset}px)`;
  },50);

  setTimeout(async ()=>{
    playSound('win'); vibrate(100);
    $('modalLog').textContent=`🎁 Выпало: ${winner.name} (${winner.val} 🪙)`;
    b.textContent='ЗАКРЫТЬ'; b.disabled=false; b.onclick=()=>{ closeModal(); caseBusy=false; };
  },3150);
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
  snap.forEach(doc => { const d = doc.data(); if(!d.isAdmin && selChance) selChance.innerHTML += `<option value="${doc.id}">${d.email}</option>`; });
}
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