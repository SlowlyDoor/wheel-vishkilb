/* app.js */
(() => {
  /* ---------- Telegram Web-App ---------- */
  const tg = window.Telegram?.WebApp || { expand(){}, sendData:console.log, showAlert:alert };
  tg.expand();

  /* ---------- параметры URL ---------- */
  const url       = new URL(location.href);
  let   balance   = parseInt(url.searchParams.get('bal')  || '0', 10);   // начальный баланс
  const baseCost  = parseInt(url.searchParams.get('cost') || '1', 10);   // базовая цена спина

  /* ---------- DOM ---------- */
  const balanceEl    = document.getElementById('balance');
  const stakeInputEl = document.getElementById('stakeInput');
  const infoEl       = document.getElementById('info');

  const stake = () => Math.max(1, parseInt(stakeInputEl.value, 10) || 1) * baseCost;

  const refreshUI = () => {
    balanceEl.textContent = `Баланс: ${isNaN(balance) ? '…' : balance} 🪙`;
    infoEl.textContent    = `Стоимость спина: ${stake()} 🪙`;
  };
  refreshUI();

  /* ---------- конфигурация колеса ---------- */
  const segments    = ['0×','2×','0×','2×','0×','2×','55×'];
  const multipliers = [ 0 ,  2 ,  0 ,  2 ,  0 ,  2 ,  55 ];   // числовые множители
  const weights     = [200,100,200,100,200,100,1];            // «веса» вероятности
  const colours     = ['#e91e63','#3f51b5','#2196f3',
                       '#009688','#9c27b0','#f44336','#ffd700'];

  const wheel = new Winwheel({
    canvasId     : 'canvas',
    numSegments  : segments.length,
    outerRadius  : 150,
    pointerAngle : 0,                  // «12 часов»
    textFontSize : 18,
    segments     : segments.map((txt,i)=>({ fillStyle: colours[i], text: txt })),
    animation    : {
      type            : 'spinToStop',
      duration        : 8,
      spins           : 8,
      callbackFinished: () => {
        const segIdx = wheel.getIndicatedSegmentNumber() - 1;   // 0-based
        const prize  = multipliers[segIdx] * currentStake;      // чистый выигрыш

        if (!isNaN(balance)) {
          balance += prize;             // ставка уже снята заранее
          refreshUI();
        }

        tg.sendData(JSON.stringify({
          type  : 'spinResult',
          stake : currentStake,
          payout: prize
        }));
      }
    }
  });

  /* жёлтый указатель рисуем поверх canvas */
  const ctx = document.getElementById('canvas').getContext('2d');
  function drawPointer() {
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(150 - 10, 5);  // левый угол
    ctx.lineTo(150 + 10, 5);  // правый угол
    ctx.lineTo(150,      23); // нижняя вершина (стрелка "вниз")
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  drawPointer();              // первичный вызов

  /* ---------- логика кнопки ---------- */
  const spinBtn      = document.getElementById('spinBtn');
  let   currentStake = 1;     // ставка активного спина

  spinBtn.addEventListener('click', () => {
    if (wheel.animation.spinning) return;            // защита от даблклика

    currentStake = stake();

    if (!isNaN(balance) && balance < currentStake) {
      tg.showAlert('Недостаточно средств');
      return;
    }

    /* сразу снимаем ставку */
    if (!isNaN(balance)) {
      balance -= currentStake;
      refreshUI();
    }

    /* сброс состояния колеса, чтобы следующий спин был плавным */
    wheel.stopAnimation(false);
    wheel.rotationAngle = 0;
    wheel.draw(); drawPointer();

    /* выбираем сектор с учётом весов */
    const total = weights.reduce((s,w)=>s+w,0);
    let   rnd   = Math.random()*total, acc=0, idx=0;
    for (let i=0;i<weights.length;i++){ acc += weights[i]; if (rnd < acc){ idx = i; break; } }

    wheel.animation.stopAngle = wheel.getRandomForSegment(idx + 1);
    wheel.startAnimation();
  });

  /* обновляем стоимость спина при изменении ввода */
  stakeInputEl.addEventListener('input', refreshUI);
})();
