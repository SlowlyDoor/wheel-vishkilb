/* app.js */
(() => {
  /* ---------- Telegram Web-App ---------- */
  const tg = window.Telegram?.WebApp
           || { expand(){}, sendData:console.log, showAlert:alert, close(){} };
  tg.expand();

  /* ---------- URL-параметры ---------- */
  const url      = new URL(location.href);
  let   balance  = parseInt(url.searchParams.get('bal')  || '0', 10);
  const baseCost = parseInt(url.searchParams.get('cost') || '1', 10);

  /* ---------- DOM ---------- */
  const balEl   = document.getElementById('balance');
  const stakeEl = document.getElementById('stakeInput');
  const infoEl  = document.getElementById('info');

  const stake = () =>
        Math.max(1, parseInt(stakeEl.value, 10) || 1) * baseCost;

  const drawUI = () => {
    balEl.textContent  = `Баланс: ${isNaN(balance) ? '…' : balance} 🪙`;
    infoEl.textContent = `Стоимость спина: ${stake()} 🪙`;
  };
  drawUI();

  /* ---------- колесо ---------- */
  const segs =  ['0×','2×','0×','2×','0×','2×','55×'];
  const mult =  [ 0 ,  2 ,  0 ,  2 ,  0 ,  2 ,  55 ];
  const wght =  [200,100,200,100,200,100,1];
  const clr  =  ['#e91e63','#3f51b5','#2196f3',
                 '#009688','#9c27b0','#f44336','#ffd700'];

  const wheel = new Winwheel({
    canvasId     : 'canvas',
    numSegments  : segs.length,
    outerRadius  : 150,
    pointerAngle : 0,
    textFontSize : 18,
    segments     : segs.map((t,i)=>({ fillStyle: clr[i], text: t })),
    animation    : {
      type            : 'spinToStop',
      duration        : 8,
      spins           : 8,
      callbackFinished: finishSpin
    }
  });

  /* ---------- рисуем фиксированный указатель ---------- */
  const ctx = document.getElementById('canvas').getContext('2d');
  const drawPointer = () => {
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(140, 5);
    ctx.lineTo(160, 5);
    ctx.lineTo(150, 23);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawPointer();

  /* ---------- кнопка ---------- */
  const btn          = document.getElementById('spinBtn');
  let   currentStake = 1;
  let   locked       = false;

  const setBtnIdle     = () => { btn.disabled = false; btn.textContent = 'Крутить!'; };
  const setBtnSpinning = () => { btn.disabled = true;  btn.textContent = 'Крутится…'; };

  btn.onclick = () => {
    if (locked) return;                // защита от быстрого дабл-клика
    currentStake = stake();

    if (!isNaN(balance) && balance < currentStake) {
      tg.showAlert('Недостаточно средств');
      return;
    }

    // «списываем» ставку локально
    if (!isNaN(balance)) {
      balance -= currentStake;
      drawUI();
    }

    locked = true;
    setBtnSpinning();

    /* сброс колеса */
    wheel.stopAnimation(false);
    wheel.rotationAngle = 0;
    wheel.draw();
    drawPointer();

    /* выбор сектора с учётом весов */
    const sum = wght.reduce((s,w)=>s+w,0);
    let r = Math.random()*sum, acc = 0, idx = 0;
    for (let i=0;i<wght.length;i++) {
      acc += wght[i];
      if (r < acc) { idx = i; break; }
    }

    wheel.animation.stopAngle = wheel.getRandomForSegment(idx + 1);
    wheel.startAnimation();
    finishSpin();
  };

  stakeEl.addEventListener('input', drawUI);

  /* ---------- финиш ---------- */
  function finishSpin () {
    const idx    = wheel.getIndicatedSegmentNumber() - 1;
    const payout = mult[idx] * currentStake;

    if (!isNaN(balance)) {
      balance += payout;              // возвращаем выигрыш
      drawUI();
    }
    btn.textContent = currentStake + payout;
    tg.sendData(JSON.stringify({
      type  : 'spinResult',
      stake : currentStake,
      payout: payout
    }));

    /* даём клиенту чуть-чуть времени на отправку */
    setTimeout(() => tg.close(), 150);

    locked = false;
    setBtnIdle();
  }

})();
