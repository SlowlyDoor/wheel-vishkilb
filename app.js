/* app.js */
(() => {
  /* ---------- helpers ---------- */
  const tg = window.Telegram?.WebApp || { expand(){}, sendData:console.log };
  tg.expand();

  // query-параметры ?bal=### — начальный баланс
  const params       = new URLSearchParams(location.search);
  let balance        = parseInt(params.get('bal'));   // undefined  → NaN
  if (isNaN(balance)) balance = null;                 // «неизвестно»

  const balanceEl    = document.getElementById('balance');
  const stakeInputEl = document.getElementById('stakeInput');
  const infoEl       = document.getElementById('info');

  const refreshUI = () => {
    balanceEl.textContent = `Баланс: ${balance ?? '…'} 🪙`;
    infoEl.textContent    = `Стоимость спина: ${stake()} 🪙`;
  };
  const stake = () => Math.max(1, parseInt(stakeInputEl.value) || 1);

  refreshUI();

  /* ---------- wheel config ---------- */
  const segments = ['0 🪙', '2 🪙', '0 🪙',
                    '2 🪙', '0 🪙', '2 🪙',
                    '55 🪙 JACKPOT'];
  const values   = segments.map(s => parseInt(s));          // [0,2,0,2,0,2,55]
  const weights  = [200,100,200,100,200,100,1];
  const colours  = ['#f44336','#e91e63','#9c27b0',
                    '#673ab7','#3f51b5','#2196f3',
                    '#009688'];

  const wheel = new Winwheel({
    canvasId    : 'canvas',
    numSegments : segments.length,
    pointerAngle: 0,
    outerRadius : 150,
    segments    : segments.map((text,i)=>({ fillStyle:colours[i], text })),
    textFontSize: 18,
    animation   : {
      type            : 'spinToStop',
      duration        : 8,
      spins           : 8,
      callbackFinished: () => {
        const idx      = wheel.getIndicatedSegmentNumber() - 1;
        const stakeVal = stake();
        tg.sendData(JSON.stringify({ type:'spinResult', idx, stake:stakeVal }));

        /* локально обновляем баланс, если он известен */
        if (balance !== null) {
          const prize = values[idx] * stakeVal;
          balance += prize - stakeVal;        // (-ставка + выигрыш)
          refreshUI();
        }
      }
    }
  });

  /* ---------- spin button ---------- */
  const btn = document.getElementById('spinBtn');

  btn.addEventListener('click', () => {
    if (wheel.animation.spinning) return;          // защита от дабл-клика

    // баланс неизвестен → позволяем крутить; иначе проверяем
    if (balance !== null && balance < stake()) {
      tg.showAlert?.('Недостаточно средств');      // если поддерживается
      return;
    }

    /* сбрасываем колёсо (иначе второй спин «тугой») */
    wheel.stopAnimation(false);
    wheel.rotationAngle = 0;
    wheel.draw();

    /* выбираем сектор с учётом весов */
    const total = weights.reduce((s,w)=>s+w,0);
    let r       = Math.random()*total, acc=0, idx=0;
    for (let i=0;i<weights.length;i++){ acc+=weights[i]; if(r<acc){ idx=i; break; } }

    /* выставляем целевой угол и запускаем анимацию */
    wheel.animation.stopAngle = wheel.getRandomForSegment(idx+1);
    wheel.startAnimation();

    /* сразу снимаем ставку (если баланс известен) */
    if (balance !== null) {
      balance -= stake();
      refreshUI();
    }
  });

  /* при изменении ставки -- обновляем цену в подписи */
  stakeInputEl.addEventListener('input', refreshUI);
})();
