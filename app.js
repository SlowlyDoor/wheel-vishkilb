/* app.js */
(() => {
  /* ---------- Telegram Web-App ---------- */
  const tg = window.Telegram?.WebApp || { expand(){}, sendData:console.log, showAlert:alert };
  tg.expand();

  /* ---------- URL-параметры ---------- */
  const url      = new URL(location.href);
  let   balance  = parseInt(url.searchParams.get('bal')  || '0', 10);
  const baseCost = parseInt(url.searchParams.get('cost') || '1', 10);

  /* ---------- DOM ---------- */
  const balEl   = document.getElementById('balance');
  const stakeEl = document.getElementById('stakeInput');
  const infoEl  = document.getElementById('info');

  const stake = () => Math.max(1, parseInt(stakeEl.value, 10) || 1) * baseCost;
  const drawUI = () => {
    balEl.textContent = `Баланс: ${isNaN(balance) ? '…' : balance} 🪙`;
    infoEl.textContent = `Стоимость спина: ${stake()} 🪙`;
  };
  drawUI();

  /* ---------- колесо ---------- */
  const segs   = ['0×','2×','0×','2×','0×','2×','55×'];
  const mult   = [ 0 ,  2 ,  0 ,  2 ,  0 ,  2 ,  55 ];
  const wght   = [200,100,200,100,200,100,1];
  const clr    = ['#e91e63','#3f51b5','#2196f3','#009688','#9c27b0','#f44336','#ffd700'];

  const wheel  = new Winwheel({
    canvasId : 'canvas',
    numSegments : segs.length,
    outerRadius : 150,
    pointerAngle: 0,
    textFontSize: 18,
    segments    : segs.map((t,i)=>({ fillStyle: clr[i], text: t })),
    animation   : {
      type   : 'spinToStop',
      duration: 8,
      spins   : 8,
      callbackFinished: finishSpin
    }
  });

  /* рисуем стрелку-указатель вниз */
  const ctx = document.getElementById('canvas').getContext('2d');
  const drawPointer = () => {
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(140, 5); ctx.lineTo(160, 5); ctx.lineTo(150, 23); ctx.closePath();
    ctx.fill(); ctx.restore();
  };
  drawPointer();

  /* ---------- кнопка ---------- */
  const btn          = document.getElementById('spinBtn');
  let   currentStake = 1;
  let   locked       = false;

  btn.onclick = () => {
    if (locked) return;           // уже крутится
    currentStake = stake();

    if (!isNaN(balance) && balance < currentStake) {
      tg.showAlert('Недостаточно средств');
      return;
    }

    if (!isNaN(balance)) {
      balance -= currentStake;    // снимаем ставку сразу
      drawUI();
    }

    locked = true;
    btn.disabled = true;
    btn.textContent = 'Крутится…';

    /* сброс колеса */
    wheel.stopAnimation(false);
    wheel.rotationAngle = 0;
    wheel.draw(); 
    drawPointer();

    /* выбираем сектор по весам */
    const sum = wght.reduce((s,w)=>s+w,0);
    let r = Math.random()*sum, acc = 0, idx = 0;
    for(let i=0;i<wght.length;i++){ acc+=wght[i]; if(r<acc){ idx=i; break; } }

    wheel.animation.stopAngle = wheel.getRandomForSegment(idx+1);
    wheel.startAnimation();
    
  };

  stakeEl.addEventListener('input', drawUI);

  /* ---------- callbackFinished ---------- */
  function finishSpin () {
    const idx    = wheel.getIndicatedSegmentNumber() - 1;
    const payout = mult[idx] * currentStake;

    if (!isNaN(balance)) {
      balance += payout;
      drawUI();
    }

    tg.sendData(JSON.stringify({
      type  : 'spinResult',
      stake : currentStake,
      payout: payout
    }));
    /* Дадим Telegram-клиенту время отправить update.
     Через 150 мс аккуратно закрываем мини-приложение. */
    setTimeout(() => tg.close(), 150);
    locked = false;
    btn.disabled = false;
    btn.textContent = 'Крутить!';
  }
  bot.send_message(msg.chat.id, f'Спин: {delta:+} 🪙 …')
  tg_answer = {'type':'unlock'}      # вернём любой ответ
})();
