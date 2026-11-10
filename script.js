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

// Сохранение с выводом ошибки на экран
function saveDB(){ 
  if(!currentUser) return;
  updateDoc(doc(db, "users", currentUser.uid), { coins: currentUser.coins })
  .catch(e => {
    // Выводим ошибку прямо над балансом
    let errBox = $('dbErrorBox');
    if(!errBox) {
      errBox = document.createElement('div');
      errBox.id = 'dbErrorBox';
      errBox.style.cssText = 'background:#ff4a4a; color:#fff; padding:8px; border-radius:8px; margin-bottom:10px; font-size:12px; font-weight:bold;';
      document.querySelector('.game').prepend(errBox);
    }
    errBox.textContent = 'ОШИБКА: ' + e.message;
  });
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
$('regBtn').onclick=async()=>{ const email=$('regUser').value.trim(), pass=$('regPass').value; if(pass.length<6){$('regErr').textContent='Пароль минимум 6 символов';return} $('regErr').textContent='Создание...'; try { const cred = await createUserWithEmailAndPassword(auth, email, pass); await setDoc(doc(db, "users", cred.user.uid), { email: email, coins: 100, isAdmin: false, forcedChance: null }); } catch(e) { $('regErr').textContent='Ошибка: ' + (e.code==='auth/email-already-in-use'?'Email занят':'Проверьте данные'); } };
$('logoutBtn').onclick=()=>signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    if(unsubscribeSnap) unsubscribeSnap();
    unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if(snap.exists()){
        const d = snap.data();
        currentUser = { uid: user.uid, email: d.email, coins: d.coins??100, isAdmin: !!d.isAdmin, forcedChance: d.forcedChance??null };
        if(gameScreen.style.display === 'block') { updateBalance(); } else { enterGame(); }
        if(currentUser.isAdmin) fillAllSelects();
      }
    });
  } else { currentUser = null; if(unsubscribeSnap) unsubscribeSnap(); showAuth(); }
});

function enterGame(){authScreen.style.display='none';regScreen.style.display='none';gameScreen.style.display='block';const u=current();$('userName').textContent=u.email+(u.isAdmin?' 🛡':'');$('adminTab').style.display=u.isAdmin?'inline-block':'none';updateBalance();renderCases();updateClickerUI();updateHub();if(u.isAdmin)fillAllSelects()}

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('panel-'+t.dataset.panel).classList.add('active');if(t.dataset.panel==='game'){updatePreview();drawWheel(getEffectiveChance());}}));

let currentRotation=0, spinning=false;
function getEffectiveChance(){const u=current();if(u&&u.forcedChance!==null&&u.forcedChance!==undefined)return Number(u.forcedChance);return Math.min(99,Math.max(.1,parseFloat(chanceEl.value)||50))}
function updateHub(){hubText.textContent=getEffectiveChance()+'%'}
function drawWheel(chance){const gd=chance*3.6,gs=180-gd/2,ge=180+gd/2;wheelEl.style.background=`conic-gradient(from 0deg,#2a1a0a 0deg,#3a2410 ${gs}deg,#4ca832 ${gs}deg,#7ee06b 180deg,#3d8f27 ${ge}deg,#1a0f05 ${ge}deg,#2a1a0a 360deg)`}
function updatePreview(){if(!betEl)return;const bet=Math.max(0,parseInt(betEl.value,10)||0),chance=getEffectiveChance(),mult=100/chance;multPreview.textContent='x'+(mult>=100?mult.toFixed(0):mult.toFixed(2));winPreview.textContent='+'+Math.floor(bet*mult);drawWheel(chance);updateHub()}
betEl.addEventListener('input',updatePreview);
chanceEl.addEventListener('input',updatePreview);

function spinNeedle(targetAngle,onDone,fast){
  const currentMod=((currentRotation%360)+360)%360,desired=((targetAngle%360)+360)%360,delta=(desired-currentMod+360)%360;
  currentRotation+= (fast?2:4)*360+delta; needleEl.style.transform='rotate('+(currentRotation-90)+'deg)';
  setTimeout(onDone, fast ? 1000 : 4000); 
}

function doSpin(isFast){
  const u=current(); if(!u||spinning)return;
  const bet=Math.floor(Number(betEl.value)),chance=getEffectiveChance();
  if(bet<1){resultEl.className='result lose';resultEl.textContent='Ставка > 0';return}
  if(bet>u.coins){resultEl.className='result lose';resultEl.textContent='Мало монет';return}
  
  spinning=true; const normalBtn = $('spinBtn'), fastBtn = $('fastSpinBtn');
  normalBtn.disabled=true; if(fastBtn) fastBtn.disabled=true;
  u.coins-=bet; updateBalance(); saveDB(); resultEl.textContent='';
  
  playSound('spin');
  const angle=Math.random()*360, gs=180-chance*1.8, ge=180+chance*1.8;
  const win = (angle>=gs && angle<=ge);
  
  spinNeedle(angle,()=>{
    if(win){
      const winAmt=Math.floor(bet*100/chance);
      u.coins+=winAmt; 
      updateBalance(); 
      saveDB(); // Сохраняем выигрыш
      playSound('win'); vibrate([100, 50, 100]);
      resultEl.className='result win'; resultEl.textContent='🍔 УДАЧА! +'+winAmt+' 🪙';
      hubText.className='hub-text win'; hubText.textContent='УДАЧА';
    } else {
      playSound('lose'); vibrate(200);
      resultEl.className='result lose'; resultEl.textContent='😢 НЕУДАЧА: -'+bet+' 🪙';
      hubText.className='hub-text lose'; hubText.textContent='НЕУДАЧА';
    }
    spinning=false; normalBtn.disabled=false; if(fastBtn) fastBtn.disabled=false;
    setTimeout(()=>{hubText.className='hub-text';updateHub()},1500);
  }, isFast);
}

$('spinBtn').onclick=()=>doSpin(false);
$('fastSpinBtn').onclick=()=>doSpin(true);

const CASES=[
{id:'1',name:'Чикен',price:20,emoji:'🍔',items:[{emoji:'🍞',name:'Хлеб',w:30,val:2},{emoji:'🥬',name:'Салат',w:25,val:5},{emoji:'🍅',name:'Томат',w:18,val:10},{emoji:'🧅',name:'Лук',w:12,val:15},{emoji:'🐔',name:'Курица',w:10,val:25},{emoji:'🧀',name:'Сыр',w:4,val:40},{emoji:'🦱',name:'Волос',w:1,val:60}]},
{id:'2',name:'Чизбургер',price:30,emoji:'🧀',items:[{emoji:'🍞',name:'Хлеб',w:28,val:3},{emoji:'🥬',name:'Салат',w:22,val:8},{emoji:'🍅',name:'Томат',w:18,val:15},{emoji:'🧀',name:'Сыр',w:15,val:30},{emoji:'🥩',name:'Мясо',w:10,val:50},{emoji:'🌶️',name:'Перец',w:6,val:70},{emoji:'🦱',name:'Волос',w:1,val:90}]}
];

function totalW(items){return items.reduce((s,i)=>s+i.w,0)}
function pickPrize(items){let r=Math.random()*totalW(items);for(const i of items){if(r<i.w)return i;r-=i.w}return items[items.length-1]}
function renderCases(){const grid=$('caseGrid');grid.innerHTML='';CASES.forEach(c=>{const d=document.createElement('div');d.className='case-tile';d.innerHTML=`<div class="emoji">${c.emoji}</div><div class="name">${c.name}</div><div class="price">${c.price} 🪙</div>`;d.onclick=()=>openCaseModal(c.id);grid.appendChild(d)})}
function openCaseModal(id){const c=CASES.find(x=>x.id===id);if(!c)return;$('caseModal').classList.add('active');$('modalLog').textContent='';$('modalTitle').textContent=`${c.emoji} ${c.name} (${c.price}🪙)`;const tw=totalW(c.items);$('modalContents').innerHTML=c.items.map(i=>`<div class="modal-item">${i.emoji} ${i.name} <b>${(i.w/tw*100).toFixed(1)}%</b> → ${i.val}🪙</div>`).join('');$('modalContents').style.display='flex';const b=$('modalOpenBtn');b.textContent=`ОТКРЫТЬ ЗА ${c.price} 🪙`;b.disabled=false;b.onclick=()=>spinCase(c);$('modalRouletteWrap').innerHTML=''}
window.closeModal=()=>{$('caseModal').classList.remove('active')};
function spinCase(c){
  const u=current(); 
  if(u.coins<c.price){$('modalLog').textContent='Мало монет!';return}
  u.coins-=c.price; updateBalance(); saveDB();
  const b=$('modalOpenBtn');b.disabled=true;b.textContent='КРУТИМ...';$('modalContents').style.display='none';$('modalLog').textContent='';
  const winner=pickPrize(c.items),cells=Array.from({length:40},()=>pickPrize(c.items));cells[32]=winner;
  $('modalRouletteWrap').innerHTML='<div class="roulette-view"><div class="roulette-strip" id="strip"></div><div class="roulette-marker"></div></div>';
  const strip=$('strip');strip.innerHTML=cells.map(i=>`<div class="roulette-cell">${i.emoji}</div>`).join('');playSound('spin');
  setTimeout(()=>{const view=document.querySelector('.roulette-view'),offset=-(32*66)+(view.offsetWidth/2)-30;strip.style.transition='transform 3s cubic-bezier(.1,.8,.2,1)';strip.style.transform=`translateX(${offset}px)`},50);
  setTimeout(()=>{
    u.coins+=winner.val; 
    updateBalance(); 
    saveDB(); // Сохраняем выигрыш в кейсе
    playSound('win');vibrate(100);
    $('modalLog').textContent=`🎁 Выпало: ${winner.emoji} ${winner.name} (+${winner.val} 🪙)`;
    b.textContent='ЗАКРЫТЬ';b.disabled=false;b.onclick=closeModal;
  },3150);
}

let clicks=0,perClick=1,autoLevel=0,timer=null;
function updateClickerUI(){$('perClick').textContent=perClick;$('clickCount').textContent=clicks}
$('burgerClick').onclick=()=>{const u=current();if(!u)return;clicks++;u.coins+=perClick;updateBalance();saveDB();updateClickerUI();vibrate(20)};
$('buyAuto').onclick=()=>{if(autoLevel>=5)return;const cost=50*(autoLevel+1),u=current();if(u.coins<cost){$('clickerLog').textContent='Мало монет';return}u.coins-=cost;autoLevel++;perClick++;updateBalance();saveDB();updateClickerUI();if(!timer)timer=setInterval(()=>{const cu=current();if(cu){cu.coins+=perClick;updateBalance();saveDB();updateClickerUI()}},1000)};

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