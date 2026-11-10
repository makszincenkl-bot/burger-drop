// ЭФФЕКТ ВСПЫШКИ
function flashScreen(color) {
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;background:${color};z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.5s ease-out;`;
  document.body.appendChild(flash);
  setTimeout(() => flash.style.opacity = '0.7', 10); // Вспыхнуло
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 500);
  }, 400);
}

// ФИОЛЕТОВЫЙ БОНУС
function startBonus(){
  bonusMode=true; bonusStreak=1; 
  flashScreen('#9b4dca'); // Фиолетовая вспышка
  vibrate([200, 100, 200, 100, 500]);
  
  $('bonusBarWrap').classList.add('active'); updateBonusBar();
  resultEl.className='result bonus'; 
  resultEl.textContent='🟣 БОНУС! Удвоение!';
  resultEl.style.fontSize = '20px';
  resultEl.style.textShadow = '0 0 15px #c77dff';
  
  setTimeout(runPurpleStep, 1500);
}

// ЗОЛОТОЙ БОНУС
function startGoldBonus(){
  bonusMode=true; 
  flashScreen('#ffcc00'); // Золотая вспышка
  vibrate([300, 100, 300]);
  
  resultEl.className='result bonus'; 
  resultEl.textContent='🟡 ЗОЛОТОЙ БОНУС!';
  resultEl.style.fontSize = '20px';
  resultEl.style.textShadow = '0 0 15px #ffcc00';
  
  const bet = Math.floor(Number(betEl.value)) || 10;
  // ... дальше идет код логики выбора множителя и кейса (он у вас уже есть)