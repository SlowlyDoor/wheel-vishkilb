/* Telegram WebApp SDK приходит от Telegram автоматически в mini-app.
   Если тестируете локально – подключите https://telegram.org/js/telegram-web-app.js */
const tg = window.Telegram?.WebApp || {   // fallback, чтобы не падало в обычном браузере
  expand(){}, sendData:console.log
};
tg.expand();            // разворачиваем на всю высоту

// ------ Конфигурация колеса ------
const segments = ["0 🪙","2 🪙","0 🪙",
                  "2 🪙","0 🪙","2 🪙",
                  "55 🪙 JACKPOT"];
const weights  = [200 , 100 , 200 ,
                  100 , 200 , 100 ,
                  1];
const colours  = ["#f44336","#e91e63","#9c27b0",
                  "#673ab7","#3f51b5","#2196f3",
                  "#009688"];

// ------ Создаём Winwheel ------
const wheel = new Winwheel({
  canvasId   : 'canvas',
  numSegments: segments.length,
  pointerAngle: 0,                // стрелка вверху
  segments   : segments.map((text,i)=>({
                  fillStyle: colours[i % colours.length],
                  text
               })),
  textFontSize: 18,
  animation: {
    type       : 'spinToStop',
    duration   : 5,               // секунд
    spins      : 6,
    callbackFinished: (indicatedSegment) => {
      const idx = wheel.getIndicatedSegmentNumber()-1; // 0-based
      tg.sendData(JSON.stringify({type:'spinResult', idx}));
    }
  }
});

// ------ Старт анимации по кнопке ------
document.getElementById('spinBtn').addEventListener('click', () => {
  if (wheel.animation.spinning) return;   // защита от дабл-клика

  // Выбираем сектор по весам
  const total = weights.reduce((s,w)=>s+w,0);
  let r = Math.random() * total, acc = 0, idx = 0;
  for (let i=0; i<weights.length; i++){
    acc += weights[i];
    if (r < acc){ idx = i; break; }
  }

  // Устанавливаем угол остановки на нужный сектор
  wheel.animation.stopAngle = wheel.getRandomForSegment(idx+1);
  wheel.startAnimation();
});
