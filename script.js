import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ ВСТАВЬТЕ СВОИ ДАННЫЕ ИЗ FIREBASE
const firebaseConfig = {
  apiKey: "ТУТ_ВАШ_API_KEY",
  authDomain: "ТУТ_ВАШ_AUTH_DOMAIN",
  projectId: "ТУТ_ВАШ_PROJECT_ID",
  storageBucket: "ТУТ_ВАШ_STORAGE_BUCKET",
  messagingSenderId: "ТУТ_ВАШ_MESSAGING_SENDER_ID",
  appId: "ТУТ_ВАШ_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $=id=>document.getElementById(id);
let currentUser = null;
let unsubscribeSnap = null;
let allUsersCache = [];

function current(){ return currentUser; }
function saveDB(){ 
  if(!currentUser) return;
  updateDoc(doc(db, "users", currentUser.uid), {
    coins: currentUser.coins, inventory: currentUser.inventory, activeItem: currentUser.activeItem
  });
}

// ==== ГЕНЕРАЦИЯ ФОНА (Эмодзи + Оружие CS:GO) ====
function initBg(){
  const layer=document.getElementById('bgLayer');
  // Бургеры и еда
  const emojis=['🍔','🍟','🥤','🧀','🥬','🍅','⭐','🍞'];
  for(let i=0;i<6;i++){const el=document.createElement('div');el.className='bg-emoji';el.textContent=emojis[Math.floor(Math.random()*emojis.length)];el.style.left=(Math.random()*100)+'%';el.style.fontSize=(24+Math.random()*30)+'px';el.style.animationDuration=(14+Math.random()*16)+'s';el.style.animationDelay=(-Math.random()*20)+'s';layer.appendChild(el);}
  
  // Оружие
  const weapons=['🔫','🔪','💣']; // Пистолет, Нож, Бомба (эмодзи)
  for(let i=0;i<5;i++){
    const el=document.createElement('div');
    el.className='bg-weapon';
    el.textContent=weapons[Math.floor(Math.random()*weapons.length)];
    el.style.left=(Math.random()*100)+'%';
    el.style.fontSize=(40+Math.random()*40)+'px';
    el.style.animationDuration=(20+Math.random()*20)+'s';
    el.style.animationDelay=(-Math.random()*20)+'s';
    layer.appendChild(el);
  }
  
  // Звезды
  for(let i=0;i<40;i++){const s=document.createElement('div');s.className='bg-star';s.style.left=(Math.random()*100)+'%';s.style.top=(Math.random()*100)+'%';s.style.animationDelay=(Math.random()*3)+'s';layer.appendChild(s);}
}
initBg();

const authScreen=$('authScreen'),regScreen=$('regScreen'),gameScreen=$('gameScreen'),betEl=$('bet'),chanceEl=$('chance'),spinBtn=$('spinBtn'),wheelEl=$('wheel'),resultEl=$('result'),multPreview=$('multPreview'),winPreview=$('winPreview'),needleEl=$('needle'),hubText=$('hubText');

function activeStack(u=current()){if(!u||!u.activeItem)return null;return u.inventory.find(i=>i.name===u.activeItem.name)||null}
function currencyCount(u=current()){if(!u)return 0;const item=activeStack(u);return item?(item.count||0):u.coins}
function currencyIcon(u=current()){return u&&u.activeItem?u.activeItem.emoji:'🪙'}
function updateBalance(){const u=current();if(!u)return;$('balance').textContent=currencyCount(u);const icon=currencyIcon(u);$('globalCurrency').textContent=icon;$('winCurrency').textContent=icon;$('betIcon').textContent=icon;updatePreview()}
function spend(amount,u=current()){if(!u||amount>currencyCount(u))return false;const item=activeStack(u);if(item){item.count=(item.count||0)-amount;if(item.count<=0){u.inventory=u.inventory.filter(i=>i!==item);u.activeItem=null}}else if(!u.activeItem)u.coins-=amount;else return false;return true}
function credit(amount,u=current()){if(!u||amount<=0)return;if(u.activeItem){}else u.coins+=amount}

function showAuth(){gameScreen.style.display='none';regScreen.style.display='none';authScreen.style.display='flex'}
$('showReg').onclick=()=>{authScreen.style.display='none';regScreen.style.display='flex'};
$('showLogin').onclick=showAuth;

$('loginBtn').onclick=async()=>{
  const email=$('loginUser').value.trim(), pass=$('loginPass').value; $('loginErr').textContent='Загрузка...';
  try { await signInWithEmailAndPassword(auth, email, pass); } catch(e) { $('loginErr').textContent='Ошибка: неверный логин или пароль'; }
};

$('regBtn').onclick=async()=>{
  const email=$('regUser').value.trim(), pass=$('regPass').value;
  if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return}
  $('regErr').textContent='Создание...';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, inventory: [], activeItem: null, isAdmin: false, forcedChance: null });
  } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email уже занят':'Проверьте данные'); }
};

$('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if(snap.exists()){
        const d = snap.data();
        currentUser = { uid: user.uid, email: d.email, coins: d.coins??100, inventory: d.inventory??[], activeItem: d.activeItem??null, isAdmin: !!d.isAdmin, forcedChance: d.forcedChance??null };
        if(!gameScreen.style.display || gameScreen.style.display==='none'){ enterGame(); } else { updateBalance(); updatePreview(); renderInventory(); }
        if(currentUser.isAdmin) fillAllSelects();
      }
    });
  } else { currentUser = null; if(unsubscribeSnap) unsubscribeSnap(); showAuth(); }
});

function enterGame(){authScreen.style.display='none';regScreen.style.display='none';gameScreen.style.display='block';const u=current();$('userName').textContent=u.email+(u.isAdmin?' 🛡':'');$('adminTab').style.display=u.isAdmin?'inline-block':'none';updateBalance();updatePreview();renderCases();updateClickerUI();renderInventory();updateHub();if(u.isAdmin)fillAllSelects()}

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('panel-'+t.dataset.panel).classList.add('active');if(t.dataset.panel==='inventory')renderInventory();if(t.dataset.panel==='game'){purpleActive=false;updatePreview();drawWheel(getEffectiveChance());updateHub();}}));

let currentRotation=0, spinning=false, bonusMode=false, bonusStreak=0, purpleActive=false, goldActive=false;
const PURPLE_SPAN=15;

function getEffectiveChance(){const u=current();if(u&&u.forcedChance!==null&&u.forcedChance!==undefined)return Math.min(99,Math.max(.1,Number(u.forcedChance)));return Math.min(99,Math.max(.1,parseFloat(chanceEl.value)||50))}
function purpleGeometry(chance){const gd=chance*3.6,gs=180-gd/2,ge=180+gd/2,span=Math.min(PURPLE_SPAN,gd),center=Math.max(gs+span/2,Math.min(240,ge-span/2));return{start:center-span/2,end:center+span/2,center,span}}
function updateHub(){if(bonusMode){hubText.className='hub-text streak';hubText.textContent='x'+bonusStreak}else{hubText.className='hub-text';hubText.textContent=getEffectiveChance()+'%'}}

function drawWheel(chance){
  const gd=chance*3.6, gs=180-gd/2, ge=180+gd/2;
  let stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 180deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`;
  if(purpleActive){ const p=purpleGeometry(chance); stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b ${p.start}deg,#9b4dca ${p.start}deg,#c77dff ${p.center}deg,#7b2cbf ${p.end}deg,#7ee06b ${p.end}deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  if(goldActive){ const p=purpleGeometry(chance); stops=`#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b ${p.start}deg,#ffcc00 ${p.start}deg,#ffea00 ${p.center}deg,#b38f00 ${p.end}deg,#7ee06b ${p.end}deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg`; }
  wheelEl.style.background=`conic-gradient(from 0deg,${stops})`;
}

function updatePreview(){if(!betEl)return;const bet=Math.max(0,parseInt(betEl.value,10)||0),chance=getEffectiveChance(),mult=100/chance;multPreview.textContent='x'+(mult>=100?mult.toFixed(0):mult.toFixed(2));winPreview.textContent='+'+Math.floor(bet*mult);if(!purpleActive&&!goldActive&&!bonusMode)drawWheel(chance);updateHub()}
betEl.addEventListener('input',updatePreview);
chanceEl.addEventListener('input',()=>{purpleActive=false;goldActive=false;updatePreview();drawWheel(getEffectiveChance())});

function spinNeedle(targetAngle,onDone){const currentMod=((currentRotation%360)+360)%360,desired=((targetAngle%360)+360)%360,delta=(desired-currentMod+360)%360;currentRotation+=4*360+delta;needleEl.style.transform='rotate('+(currentRotation-90)+'deg)';setTimeout(onDone,2600)}

function chooseOutcome(chance){
  const angle=Math.random()*360, gs=180-chance*1.8, ge=180+chance*1.8;
  if(purpleActive){const p=purpleGeometry(chance);if(angle>=p.start&&angle<=p.end)return{outcome:'purple',angle}}
  if(goldActive){const p=purpleGeometry(chance);if(angle>=p.start&&angle<=p.end)return{outcome:'gold',angle}}
  if(angle>=gs&&angle<=ge)return{outcome:'win',angle};
  return{outcome:'lose',angle};
}

function activatePurple(chance){purpleActive=true;goldActive=false;drawWheel(chance)}
function activateGold(chance){goldActive=true;purpleActive=false;drawWheel(chance)}
function deactivateBonuses(){purpleActive=false;goldActive=false;drawWheel(getEffectiveChance())}

function finishSpin(chance){ spinning=false;spinBtn.disabled=false; if(!bonusMode){setTimeout(updateHub,1200);} updateBalance();renderInventory();saveDB(); }

// ФИОЛЕТОВЫЙ БОНУС
function startBonus(){
  bonusMode=true; bonusStreak=1; spinBtn.disabled=true; 
  $('bonusBarWrap').classList.add('active'); updateBonusBar();
  resultEl.className='result bonus'; resultEl.textContent='🟣 БОНУС! Удвоение!';
  setTimeout(runPurpleStep, 1500);
}
function updateBonusBar() { const bar = $('bonusBar'); const text = $('bonusBarText'); text.textContent = 'x' + bonusStreak; bar.style.width = Math.min(100, (bonusStreak / 6) * 100) + '%'; }
function runPurpleStep(){
  const u=current(); if(!u) { finishPurple(false); return; }
  const win = Math.random() < 0.5, target = win ? 180 + (Math.random()-.5)*90 : Math.random()*180;
  hubText.textContent='...';
  spinNeedle(target, () => {
    if(win){ bonusStreak++; updateBonusBar(); resultEl.className='result win'; resultEl.textContent='🔥 Удача! Удвоение!'; setTimeout(runPurpleStep, 800); } else { finishPurple(true); }
  });
}
function finishPurple(isWin){
  bonusMode=false; $('bonusBarWrap').classList.remove('active');
  const u=current();
  if(u && bonusStreak > 0){
    const bet = Math.floor(Number(betEl.value)) || 10;
    const winAmt = bet * Math.pow(2, bonusStreak - 1);
    if(isWin) { credit(winAmt, u); resultEl.className='result win'; resultEl.textContent=`🔥 БОНУС ЗАВЕРШЕН! Забрано: +${winAmt} ${currencyIcon(u)}`; } 
    else {
      const prevAmt = bonusStreak > 1 ? bet * Math.pow(2, bonusStreak - 2) : 0;
      credit(prevAmt, u);
      if (prevAmt > 0) { resultEl.className='result bonus'; resultEl.textContent=`Бонус окончен. Забрано: +${prevAmt} ${currencyIcon(u)}`; } 
      else { resultEl.className='result lose'; resultEl.textContent='Бонус сгорел на первом шаге.'; }
    }
    updateBalance();
  }
  drawWheel(getEffectiveChance()); spinning=false; spinBtn.disabled=false; saveDB();
}

// ЗОЛОТОЙ БОНУС
function startGoldBonus(){
  bonusMode=true; spinBtn.disabled=true;
  resultEl.className='result bonus'; resultEl.textContent='🟡 ЗОЛОТОЙ БОНУС!';
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

  setTimeout(()=>{
    const totalWin = Math.floor(bet * winner.mult);
    credit(totalWin, currentUser); updateBalance();
    b.textContent='ЗАБРАТЬ'; b.disabled=false; b.onclick=()=>{
       $('caseModal').classList.remove('active'); bonusMode=false; spinBtn.disabled=false;
       resultEl.className='result win'; resultEl.textContent=`🟡 ИКС x${winner.mult}! Выигрыш: +${totalWin} ${currencyIcon(currentUser)}`;
       drawWheel(getEffectiveChance()); saveDB();
    };
    $('modalLog').textContent = `Выпал множитель x${winner.mult}! Забирай свои монеты.`;
  }, 3150);
}

function doSpin(){
  const u=current(); if(!u||spinning||bonusMode)return;
  const bet=Math.floor(Number(betEl.value)),chance=getEffectiveChance();
  if(!Number.isFinite(bet)||bet<1){resultEl.className='result lose';resultEl.textContent='Ставка должна быть больше 0';return}
  if(bet>currencyCount(u)){resultEl.className='result lose';resultEl.textContent='Недостаточно '+currencyIcon(u);return}
  
  spinning=true;spinBtn.disabled=true;const wasItemMode=!!u.activeItem;
  spend(bet,u);updateBalance();saveDB();resultEl.textContent='';resultEl.className='result';
  
  const picked=chooseOutcome(chance);
  if(picked.outcome!=='win' && picked.outcome!=='lose') hubText.textContent='...';

  spinNeedle(picked.angle,()=>{
    if(picked.outcome==='purple'){ deactivateBonuses(); resultEl.className='result bonus';resultEl.textContent='🟣 БОНУС УДВОЕНИЯ!'; startBonus(); } 
    else if (picked.outcome==='gold') { deactivateBonuses(); resultEl.className='result bonus';resultEl.textContent='🟡 ЗОЛОТОЙ БОНУС!'; startGoldBonus(); } 
    else if(picked.outcome==='win'){
      if(wasItemMode){ const prize=awardItemPrize(u,bet);updateBalance();renderInventory(); resultEl.className='result win';resultEl.textContent=`🎁 УДАЧА! Выпало: ${prize.item.emoji} ${prize.item.name} ×${prize.count}`; } 
      else { const win=Math.floor(bet*100/chance);credit(win,u);updateBalance(); resultEl.className='result win';resultEl.textContent='🍔 УДАЧА! +'+win+' '+currencyIcon(u); }
      hubText.className='hub-text win';hubText.textContent='УДАЧА';finishSpin(chance);
    } else {
      resultEl.className='result lose';resultEl.textContent='😢 НЕУДАЧА: -'+bet+' '+currencyIcon(u);
      hubText.className='hub-text lose';hubText.textContent='НЕУДАЧА';finishSpin(chance);
    }
  });
}
spinBtn.onclick=doSpin;

// ================= АДМИНКА =================
async function fillAllSelects(){
  const snap = await getDocs(collection(db, "users"));
  allUsersCache = [];
  const selChance = $('adminChanceTarget');
  const selTroll = $('adminTrollTarget');
  selChance.innerHTML = ''; selTroll.innerHTML = '';
  
  snap.forEach(doc => {
    const d = doc.data();
    if(!d.isAdmin) {
       allUsersCache.push({uid: doc.id, email: d.email});
       const opt = `<option value="${doc.id}">${d.email}</option>`;
       selChance.innerHTML += opt;
       selTroll.innerHTML += opt;
    }
  });
}

$('adminGiveBtn').onclick = async () => {
  const email = $('adminTarget').value.trim(); const amount = parseInt($('adminCoins').value, 10);
  if(!email || !amount) return;
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if(snap.empty) { $('adminGiveLog').textContent = 'Игрок не найден'; return; }
    snap.forEach(async (d) => {
      const userData = d.data();
      await updateDoc(doc(db, "users", d.id), { coins: (userData.coins || 0) + amount });
    });
    $('adminGiveLog').textContent = 'Монеты выданы! Игрок увидит изменения сразу.';
  } catch(e) { $('adminGiveLog').textContent = 'Ошибка: ' + e.message; }
};

$('adminChanceBtn').onclick = async () => {
  const uid = $('adminChanceTarget').value; const v = parseFloat($('adminChanceValue').value);
  if(uid && v >= 0.1 && v <= 99) { await updateDoc(doc(db, "users", uid), { forcedChance: v }); $('adminChanceLog').textContent = 'Шанс задан!'; }
};
$('adminChanceResetBtn').onclick = async () => {
  const uid = $('adminChanceTarget').value;
  if(uid) { await updateDoc(doc(db, "users", uid), { forcedChance: null }); $('adminChanceLog').textContent = 'Сброшено!'; }
};

// НОВЫЕ ПРИКОЛЫ АДМИНА
$('adminGodBtn').onclick = async () => {
  const uid = $('adminTrollTarget').value;
  if(uid) { await updateDoc(doc(db, "users", uid), { coins: 1000000, forcedChance: 99 }); $('adminTrollLog').textContent = 'Игрок стал БОГОМ (1М монет, 99% шанс)!'; }
};
$('adminZeroBtn').onclick = async () => {
  const uid = $('adminTrollTarget').value;
  if(uid) { await updateDoc(doc(db, "users", uid), { coins: 0 }); $('adminTrollLog').textContent = 'Баланс обнулен.'; }
};
$('adminClearInvBtn').onclick = async () => {
  const uid = $('adminTrollTarget').value;
  if(uid) { await updateDoc(doc(db, "users", uid), { inventory: [], activeItem: null }); $('adminTrollLog').textContent = 'Инвентарь очищен.'; }
};
$('adminJackpotBtn').onclick = async () => {
  const uid = $('adminTrollTarget').value;
  if(uid) { await updateDoc(doc(db, "users", uid), { coins: 10000 }); $('adminTrollLog').textContent = 'Выдан ДЖЕКПОТ (10 000 монет)!'; }
};

// Вспомогательные функции (Кейсы, инвентарь, кликер)
function makeCase(id,name,price,emoji,items){items.forEach(i=>{i.coins=Math.min(i.coins,price*3)});return{id,name,price,emoji,items}}
const CASES=[
makeCase('1','Чикен',20,'🍔',[{emoji:'🍞',name:'Хлеб',weight:30,coins:2},{emoji:'🥬',name:'Салат',weight:25,coins:5},{emoji:'🍅',name:'Томат',weight:18,coins:10},{emoji:'🧅',name:'Лук',weight:12,coins:15},{emoji:'🐔',name:'Курица',weight:10,coins:25},{emoji:'🧀',name:'Сыр',weight:4,coins:40},{emoji:'🦱',name:'Волос',weight:1,coins:60}]),
makeCase('2','Чизбургер',30,'🧀',[{emoji:'🍞',name:'Хлеб',weight:28,coins:3},{emoji:'🥬',name:'Салат',weight:22,coins:8},{emoji:'🍅',name:'Томат',weight:18,coins:15},{emoji:'🧀',name:'Сыр',weight:15,coins:30},{emoji:'🥩',name:'Мясо',weight:10,coins:50},{emoji:'🌶️',name:'Перец',weight:6,coins:70},{emoji:'🦱',name:'Волос',weight:1,coins:90}]),
makeCase('3','Двойной',50,'🍔🍔',[{emoji:'🍞',name:'Хлеб',weight:25,coins:5},{emoji:'🥩',name:'Мясо',weight:22,coins:15},{emoji:'🧀',name:'Сыр',weight:20,coins:25},{emoji:'🥬',name:'Салат',weight:15,coins:40},{emoji:'🍅',name:'Томат',weight:10,coins:70},{emoji:'🥓',name:'Бекон',weight:6,coins:100},{emoji:'🦱',name:'Волос',weight:2,coins:150}]),
makeCase('4','Овощной',40,'🥗',[{emoji:'🥬',name:'Салат',weight:28,coins:4},{emoji:'🍅',name:'Томат',weight:25,coins:10},{emoji:'🥒',name:'Огурец',weight:20,coins:20},{emoji:'🧅',name:'Лук',weight:12,coins:35},{emoji:'🥑',name:'Авокадо',weight:9,coins:60},{emoji:'🌶️',name:'Перец',weight:5,coins:90},{emoji:'🦱',name:'Волос',weight:1,coins:120}]),
makeCase('5','Салат',35,'🥬',[{emoji:'🥬',name:'Листья',weight:32,coins:3},{emoji:'🥒',name:'Огурец',weight:25,coins:10},{emoji:'🍅',name:'Томат',weight:18,coins:22},{emoji:'🧅',name:'Лук',weight:12,coins:40},{emoji:'🥑',name:'Авокадо',weight:8,coins:60},{emoji:'🥓',name:'Бекон',weight:4,coins:90},{emoji:'🦱',name:'Волос',weight:1,coins:105}]),
makeCase('6','Биг Хит',80,'💥',[{emoji:'🍞',name:'Хлеб',weight:22,coins:10},{emoji:'🥩',name:'Мясо',weight:20,coins:25},{emoji:'🧀',name:'Сыр',weight:18,coins:50},{emoji:'🥓',name:'Бекон',weight:15,coins:80},{emoji:'🍅',name:'Томат',weight:12,coins:120},{emoji:'🌶️',name:'Перец',weight:8,coins:170},{emoji:'💎',name:'Алмаз',weight:4,coins:200},{emoji:'🦱',name:'Волос',weight:1,coins:240}]),
makeCase('7','Дв. Биг',120,'💥💥',[{emoji:'🍞',name:'Хлеб',weight:20,coins:15},{emoji:'🥩',name:'Мясо',weight:18,coins:40},{emoji:'🧀',name:'Сыр',weight:17,coins:80},{emoji:'🥓',name:'Бекон',weight:15,coins:130},{emoji:'🍅',name:'Томат',weight:12,coins:200},{emoji:'🌶️',name:'Перец',weight:9,coins:280},{emoji:'💎',name:'Алмаз',weight:6,coins:330},{emoji:'🦱',name:'Волос',weight:3,coins:360}]),
makeCase('8','Мега',150,'🍔',[{emoji:'🍞',name:'Хлеб',weight:18,coins:20},{emoji:'🥩',name:'Мясо',weight:17,coins:60},{emoji:'🧀',name:'Сыр',weight:16,coins:120},{emoji:'🥓',name:'Бекон',weight:14,coins:200},{emoji:'🍅',name:'Томат',weight:12,coins:300},{emoji:'🌶️',name:'Перец',weight:10,coins:380},{emoji:'💎',name:'Алмаз',weight:9,coins:420},{emoji:'🦱',name:'Волос',weight:4,coins:450}]),
makeCase('9','Король',200,'👑',[{emoji:'🍞',name:'Хлеб',weight:16,coins:30},{emoji:'🥩',name:'Мясо',weight:16,coins:100},{emoji:'🧀',name:'Сыр',weight:15,coins:200},{emoji:'🥓',name:'Бекон',weight:14,coins:300},{emoji:'🍅',name:'Томат',weight:13,coins:400},{emoji:'👑',name:'Корона',weight:10,coins:500},{emoji:'💎',name:'Алмаз',weight:12,coins:560},{emoji:'🦱',name:'Волос',weight:4,coins:600}]),
makeCase('10','Легенда',300,'🏆',[{emoji:'🍞',name:'Хлеб',weight:14,coins:50},{emoji:'🥩',name:'Мясо',weight:14,coins:150},{emoji:'🧀',name:'Сыр',weight:13,coins:300},{emoji:'🥓',name:'Бекон',weight:13,coins:450},{emoji:'🍅',name:'Томат',weight:12,coins:600},{emoji:'👑',name:'Корона',weight:12,coins:750},{emoji:'💎',name:'Алмаз',weight:14,coins:850},{emoji:'🦱',name:'Волос',weight:8,coins:900}])
];

let caseBusy=false;
function totalW(items){return items.reduce((s,i)=>s+i.weight,0)}
function pickPrize(items){let r=Math.random()*totalW(items);for(const i of items){if(r<i.weight)return i;r-=i.weight}return items[items.length-1]}
function renderCases(){const grid=$('caseGrid');grid.innerHTML='';CASES.forEach(c=>{const d=document.createElement('div');d.className='case-tile';d.innerHTML=`<div class="emoji">${c.emoji}</div><div class="name">${c.name}</div><div class="price">${c.price} 🪙</div>`;d.onclick=()=>openCaseModal(c.id);grid.appendChild(d)})}
function openCaseModal(id){const c=CASES.find(x=>x.id===id);if(!c)return;$('caseModal').classList.add('active');$('modalLog').textContent='';$('modalTitle').textContent=`${c.emoji} ${c.name} (${c.price}🪙)`;const tw=totalW(c.items);$('modalContents').innerHTML=c.items.map(i=>`<div class="modal-item${i.name==='Волос'?' rare':''}">${i.emoji} ${i.name} <b style="color:#7ee06b">${(i.weight/tw*100).toFixed(1)}%</b> → ${i.coins}🪙</div>`).join('');$('modalContents').style.display='flex';const b=$('modalOpenBtn');b.textContent=`ОТКРЫТЬ ЗА ${c.price} 🪙`;b.disabled=false;b.onclick=()=>spinCase(c);$('modalRouletteWrap').innerHTML=''}
window.closeModal=()=>{if(!caseBusy)$('caseModal').classList.remove('active')};
function spinCase(c){const u=current();if(u.coins<c.price){$('modalLog').textContent='Мало монет!';return}if(caseBusy)return;caseBusy=true;u.coins-=c.price;updateBalance();saveDB();const b=$('modalOpenBtn');b.disabled=true;b.textContent='КРУТИМ...';$('modalContents').style.display='none';$('modalLog').textContent='';const winner=pickPrize(c.items),cells=Array.from({length:40},()=>pickPrize(c.items));cells[32]=winner;$('modalRouletteWrap').innerHTML='<div class="roulette-view"><div class="roulette-strip" id="strip"></div><div class="roulette-marker"></div></div>';const strip=$('strip');strip.innerHTML=cells.map(i=>`<div class="roulette-cell ${i.name==='Волос'?'rare':''}">${i.emoji}</div>`).join('');setTimeout(()=>{const view=document.querySelector('.roulette-view'),offset=-(32*66)+(view.offsetWidth/2)-30;strip.style.transition='transform 3s cubic-bezier(.1,.8,.2,1)';strip.style.transform=`translateX(${offset}px)`},50);setTimeout(()=>{u.coins+=winner.coins;const old=u.inventory.find(i=>i.name===winner.name);if(old)old.count=(old.count||1)+1;else u.inventory.push({emoji:winner.emoji,name:winner.name,base:winner.coins,count:1});updateBalance();saveDB();renderInventory();$('modalLog').textContent=`🎁 Выпало: ${winner.emoji} ${winner.name} (+${winner.coins} 🪙)`;b.textContent='ЗАКРЫТЬ';b.disabled=false;b.onclick=closeModal;caseBusy=false},3150)}

function awardItemPrize(u,betAmount){const allItems=[];CASES.forEach(c=>c.items.forEach(i=>{if(i.name!=='Волос'&&i.coins>0&&!allItems.find(a=>a.name===i.name))allItems.push(i)}));const weighted=allItems.map(i=>({...i,weight:Math.max(1,Math.round(200/i.coins))}));const total=weighted.reduce((s,i)=>s+i.weight,0);let r=Math.random()*total,winner=weighted[0];for(const i of weighted){if(r<i.weight){winner=i;break}r-=i.weight}const mult=100/getEffectiveChance();const totalValue=Math.floor(betAmount*mult);let count=Math.max(1,Math.round(totalValue/(winner.coins||1)));count=Math.min(count,999);const old=u.inventory.find(i=>i.name===winner.name);if(old)old.count=(old.count||0)+count;else u.inventory.push({emoji:winner.emoji,name:winner.name,base:winner.coins,count:count});return {item:winner,count}}

function renderInventory(){const u=current();if(!u)return;const list=$('inventoryList');if(!u.inventory.length){list.innerHTML='<div class="empty-msg">Пусто. Открой кейсы!</div>';return}let html='';if(u.activeItem)html+='<button id="resetCurrencyBtn" style="background:#555;color:#fff;margin-bottom:10px">Вернуть монеты 🪙</button>';html+=u.inventory.map(i=>{const active=u.activeItem&&u.activeItem.name===i.name;return `<div class="inv-item" style="${active?'border-color:#7ee06b;background:#7ee06b1a':''}"><div class="icon">${i.emoji}</div><div class="info"><div class="nm">${i.name} ${i.count>1?'x'+i.count:''}</div><div class="lvl">Количество: ${i.count||0} шт. · Цена предмета: ${i.base}🪙</div></div><button onclick="setActiveCurrency('${i.name}')">${active?'Поставлено':'Поставить'}</button></div>`}).join('');list.innerHTML=html;if(u.activeItem)$('resetCurrencyBtn').onclick=()=>{u.activeItem=null;saveDB();updateBalance();renderInventory();$('invLog').textContent='Снова используем монеты.'}}
window.setActiveCurrency=name=>{const u=current(),item=u&&u.inventory.find(i=>i.name===name);if(!item)return;u.activeItem={name:item.name,emoji:item.emoji};saveDB();updateBalance();renderInventory();$('invLog').textContent=`Ставка теперь принимается предметом ${item.emoji}. Доступно: ${item.count} шт.`};

let clickCount=0,perClick=1,autoClickLevel=0,autoTimer=null;
function updateClickerUI(){$('perClick').textContent=perClick;$('clickCount').textContent=clickCount}
$('burgerClick').onclick=()=>{const u=current();if(!u)return;clickCount++;u.coins+=perClick;updateBalance();saveDB();updateClickerUI()};
$('buyAuto').onclick=()=>{if(autoClickLevel>=5)return;const cost=50*(autoClickLevel+1),u=current();if(u.coins<cost){$('clickerLog').textContent='Мало монет';return}u.coins-=cost;autoClickLevel++;perClick++;updateBalance();saveDB();updateClickerUI();if(!autoTimer)autoTimer=setInterval(()=>{const cu=current();if(cu){cu.coins+=perClick;updateBalance();saveDB();updateClickerUI()}},1000)};