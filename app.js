/* ===== Casino Widget logic (Wheel + Apple of Fortune + Crash) ===== */
(() => {
  /* --- Telegram Web-App helpers --- */
  const tg = window.Telegram?.WebApp || {expand(){},ready(){},sendData:console.log,showAlert:alert};
  tg.expand(); tg.ready();

  /* --- DOM shortcuts --- */
  const $ = id => document.getElementById(id);

  /* --- URL params: bal / cost --- */
  const url       = new URL(location.href);
  let   balance   = +url.searchParams.get('bal')  || 0;
  const baseCost  = +url.searchParams.get('cost') || 1;
  const stakeInp  = $('stakeInput');
  const balanceEl = $('balance');
  const gameSel   = $('gameSelect');
  const actionBtn = $('actionBtn');

  /* ===== Casino Widget logic (вероятности в CONFIG) ===== */
(() => {
  const CONFIG = {
    /* --- WHEEL ---                0×  2×  0×  5×  0×  3×  10× 55× */
    wheelWeights : [200, 50, 200, 40, 200, 30,  5 ,  1], // чем больше число — тем чаще сектор
    /* --- APPLE OF FORTUNE --- */
    appleBombs   : 5,          // 1-24 «червяков» на поле 5×5
    /* --- CRASH --- */
    crashMin     : 1.5,        // старт/минимальный возможный крэш
    crashMax     : 5.0,        // максимальный, до которого точно успеет дорасти
    crashStep    : 0.05,       // прирост коэффициента за тик
    crashInterval: 200         // тик (мс)
  };

  const views = {wheel:$('wheelGame'), apple:$('appleGame'), crash:$('crashGame')};

  /* --- helpers --- */
  const stake = () => Math.max(1, +stakeInp.value || 1) * baseCost;
  const drawBalance = () => balanceEl.textContent = `Баланс: ${isNaN(balance)?'…':balance} 🪙`;
  stakeInp.addEventListener('input',drawBalance); drawBalance();

  /* --- game switch --- */
  gameSel.addEventListener('change',e=>{
    Object.values(views).forEach(v=>v.classList.remove('active'));
    views[e.target.value].classList.add('active');
  });

  /* ================= 1) WHEEL ================= */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'];
  const mult  =[ 0  , 2  , 0  , 5 , 0  , 3 , 10 , 55 ];
  const colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];
  function pickByWeight(weights){
    const sum = weights.reduce((s,w)=>s+w,0);
    let r = Math.random()*sum, acc = 0;
    for (let i=0;i<weights.length;i++){
      acc += weights[i];
      if (r < acc) return i;      // вернём индекс сектора
    }
    return weights.length-1;      // fallback
  }

  const wheel = new Winwheel({
    canvasId:'canvas',
    numSegments:labels.length,
    outerRadius:160,
    textFontSize:22,
    textFillStyle:'#fff',
    textOutlineWidth:0,
    lineWidth:0,
    segments:labels.map((t,i)=>({fillStyle:colors[i],text:t})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:onWheelStop}
  });
  const ctx=$('canvas').getContext('2d');
  const drawPointer=()=>{
    ctx.save();
    ctx.fillStyle='#ffea00';
    ctx.beginPath();ctx.moveTo(158,8);ctx.lineTo(162,8);ctx.lineTo(160,28);
    ctx.closePath();ctx.filter='drop-shadow(0 0 6px #ffea00)';ctx.fill();ctx.restore();
  }; drawPointer();

  let curStake=1;
  function startWheel(){
    disablePlay('Крутится…');
    wheel.stopAnimation(false);wheel.rotationAngle=0;wheel.draw();drawPointer();
    // случайный сектор
    const stopSeg = pickByWeight(CONFIG.wheelWeights) + 1; // +1: Winwheel в 1-индексации
    wheel.animation.stopAngle = wheel.getRandomForSegment(stopSeg);
    wheel.startAnimation();
  }
  function onWheelStop(){
    const idx = wheel.getIndicatedSegmentNumber()-1;
    finishRound(mult[idx]*curStake,'wheel');
  }

  /* ================= 2) APPLE OF FORTUNE ================= */
  const field  = $('appleField');
  const cashBtn= $('appleCashBtn');
  let apples   = [];   // DOM ссылки
  let bombsSet = new Set();
  let opened   = 0;
  let appleMul = 1.0;

  function prepareApple(){
    field.innerHTML='';apples=[];bombsSet.clear();opened=0;appleMul=1.0;
    cashBtn.textContent='Забрать ×1.00';cashBtn.style.display='none';

    // заполнение бомб
    while (bombsSet.size < CONFIG.appleBombs)
        bombsSet.add(Math.floor(Math.random()*25));

    for(let i=0;i<25;i++){
      const cell=document.createElement('div');
      cell.className='cell';
      cell.innerHTML='🍏';
      cell.onclick=()=>openApple(i);
      field.appendChild(cell);
      apples.push(cell);
    }
  }
  function openApple(idx){
    if(apples[idx].classList.contains('open')) return;

    apples[idx].classList.add('open');
    if(bombsSet.has(idx)){        // проигрыш
      apples[idx].textContent='🐛';
      gsap.to(apples[idx],{scale:1.2,yoyo:true,repeat:3,duration:0.15});
      cashBtn.style.display='none';
      setTimeout(()=>finishRound(0,'appleLoss'),600);
      return;
    }
    opened++;
    appleMul = +(1 + opened*0.2).toFixed(2); // 1.2, 1.4, …
    apples[idx].textContent='🍎';
    cashBtn.textContent=`Забрать ×${appleMul}`;
    cashBtn.style.display='block';
  }
  cashBtn.onclick=_=>{
    finishRound(curStake*appleMul,'appleWin');
  };

  /* ================= 3) CRASH ================= */
  const crashScreen=$('crashScreen');
  const crashBtn   =$('crashCashBtn');
  let crashTimer   =null;
  let crashMul     =1.0;
  let crashLimit   =2.0;

  function startCrash(){
    crashMul = 1.0;
    crashLimit = +(CONFIG.crashMin + Math.random() *
                  (CONFIG.crashMax - CONFIG.crashMin)).toFixed(2);
    crashScreen.textContent = 'x1.00';
    crashBtn.textContent    = 'Забрать x1.00';
    crashBtn.style.display='block';

    crashTimer = setInterval(()=>{
      crashMul = +(crashMul + CONFIG.crashStep).toFixed(2);
      crashScreen.textContent = `x${crashMul.toFixed(2)}`;
      crashBtn.textContent    = `Забрать x${crashMul.toFixed(2)}`;

      if (crashMul >= crashLimit) {
        clearInterval(crashTimer);
        crashBtn.style.display='none';
        gsap.to(crashScreen,{scale:1.3,yoyo:true,repeat:3,duration:0.15,onComplete:()=>{
          crashScreen.textContent='💥 CRASH';
          finishRound(0,'crashLoss');
        }});
      }
    },200);
  }
  crashBtn.onclick=_=>{
    clearInterval(crashTimer);
    crashBtn.style.display='none';
    finishRound(curStake*crashMul,'crashWin');
  };

  /* ================= buttons & rounds ================= */
  function disablePlay(txt){actionBtn.disabled=true;actionBtn.textContent=txt}
  function enablePlay(){actionBtn.disabled=false;actionBtn.textContent='Играть!'}

  actionBtn.onclick=_=>{
    if(balance<stake()){tg.showAlert('Недостаточно средств');return;}

    curStake=stake();
    balance-=curStake;drawBalance();
    tg.sendData(JSON.stringify({type:'bet',stake:curStake}));

    switch(gameSel.value){
      case 'wheel': startWheel(); break;
      case 'apple': prepareApple(); disablePlay('Открой яблочко'); break;
      case 'crash': startCrash();  disablePlay('Идёт раунд…');     break;
    }
  };

  function finishRound(payout,kind){
    balance += payout; drawBalance();
    tg.sendData(JSON.stringify({type:kind,stake:curStake,payout}));
    enablePlay();
  }
})();
