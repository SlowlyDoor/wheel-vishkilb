/* app.js */
(() => {
  /* ============  служебные функции  ============ */
  const tg = window.Telegram?.WebApp || { expand(){}, sendData:console.log };
  tg.expand();

  // Читаем query-параметры ?bal=###&cost=#
  const params = new URLSearchParams(location.search);
  const balanceStart = parseInt(params.get('bal')) || null;   // null → неизвестно
  const spinCost     = parseInt(params.get('cost')) || 1;     // по-умолчанию 1

  // Отрисовываем баланс / цену
  document.getElementById('balance').textContent =
    `Баланс: ${balanceStart ?? '…'} 🪙`;
  document.getElementById('info').textContent =
    `Стоимость спина: ${spinCost} 🪙`;

  /* ============  Конфигурация колеса  ============ */
  const segments = ["0 🪙","2 🪙","0 🪙",
                    "2 🪙","0 🪙","2 🪙",
                    "55 🪙 JACKPOT"];
  const weights  = [200 , 100 , 200 ,
                    100 , 200 , 100 ,
                    1];
  const colours  = ["#f44336","#e91e63","#9c27b0",
                    "#673ab7","#3f51b5","#2196f3",
                    "#009688"];

  /* ============  Winwheel  ============ */
  const wheel = new Winwheel({
    canvasId    : 'canvas',
    numSegments : segments.length,
    pointerAngle: 0,
    outerRadius : 150,
    segments    : segments.map((text,i)=>({
                      fillStyle: colours[i % colours.length],
                      text
                   })),
    textFontSize: 18,
    animation: {
      type            : 'spinToStop',
      duration        : 8,   // секунд (⬆︎ было 5)
      spins           : 8,   // оборотов (⬆︎ было 6)
      callbackFinished: seg => {
        const idx = wheel.getIndicatedSegmentNumber() - 1;
        tg.sendData(JSON.stringify({ type:'spinResult', idx }));
      }
    }
  });

  /* ============  Запускаем крутку  ============ */
  const btn = document.getElementById('spinBtn');
  btn.addEventListener('click', () => {
    if (wheel.animation.spinning) return;           // защита от повторного клика

    // Выбор сектора по весам
    const total = weights.reduce((s,w)=>s+w,0);
    let r = Math.random()*total, acc = 0, idx = 0;
    for (let i=0;i<weights.length;i++){ acc+=weights[i]; if(r<acc){ idx=i; break; } }

    // Стартуем
    wheel.animation.stopAngle = wheel.getRandomForSegment(idx+1);
    wheel.startAnimation();

    // Локально уменьшаем баланс (если он был передан)
    if (balanceStart !== null) {
      balanceStart -= spinCost;
      document.getElementById('balance').textContent =
        `Баланс: ${balanceStart} 🪙`;
    }
  });
})();
