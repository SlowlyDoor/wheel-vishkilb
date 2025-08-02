/* ===== Casino Widget (Wheel + Apple + Crash) v2 + Admin panel ===== */
(() => {
  /* --- Telegram helpers --- */
  const tg = window.Telegram?.WebApp ||
            {expand(){},ready(){},sendData:console.log,showAlert:alert};
  tg.expand(); tg.ready();

  /* --- ADMIN: замените на свой Telegram-ID --- */
  const ADMIN_ID = 123456789;                 // ← сюда ваш id
  const userId   = tg.initDataUnsafe?.user?.id || null;
  const isAdmin  = userId === ADMIN_ID;

  /* --- DOM helpers --- */
  const $ = id => document.getElementById(id);

  /* --- CONFIG (подкрутка) --- */
  const CONFIG = {
    wheelWeights : [200, 50, 200, 40, 200, 30,   5,  1], /* 0×-55× */
    appleRig     : 3,     // реальных червяков = выбранных + appleRig
    crashMin     : 1.5,
    crashMax     : 5.0,
    crashStep    : 0.05,
    crashInterval: 200
  };

  /* --- URL params: balance / cost --- */
  const url       = new URL(location.href);
  let   balance   = +url.searchParams.get('bal')  || 0;
  const baseCost  = +url.searchParams.get('cost') || 1;

  /* --- Elements --- */
  const stakeInp  = $('stakeInput');
  const balanceEl = $('balance');
  const gameSel   = $('gameSelect');
  const actionBtn = $('actionBtn');
  const plusStake = $('plusStake');
  const minusStake= $('minusStake');
  const bombPick  = $('bombPick');     // select 1-20 для Apple
  const forceSeg  = $('forceSeg');     // select в админ-панели

  /* заполнить селект «червяков» 1-20 */
  for (let i = 1; i <= 20; i++) {
    const o = document.createElement('option');
    o.value = i; o.textContent = i;
    bombPick.appendChild(o);
  }
  bombPick.value = 5;

  /* --- Баланс / ставка --- */
  const stake = () => Math.max(1, +stakeInp.value || 1) * baseCost;
  const fmt   = n => n.toFixed(2);
  const drawBalance = () => balanceEl.textContent = `Баланс: ${fmt(balance)} 🪙`;
  drawBalance();

  plusStake.onclick  = () => { stakeInp.stepUp(); drawBalance(); };
  minusStake.onclick = () => { stakeInp.stepDown(); drawBalance(); };
  stakeInp.oninput   = drawBalance;

  /* --- Панель админа --- */
  if (isAdmin) {
    const panel = $('adminPanel');
    if (panel && forceSeg) {
      panel.style.display = 'flex';

      /* заполняем варианты секторов 0×-55× */
      const labels = ['0×','2×','0×','5×','0×','3×','10×','55×'];
      labels.forEach((txt, idx) => {
        const o = document.createElement('option');
        o.value = idx; o.textContent = txt;
        forceSeg.appendChild(o);
      });
    }
  }

  /* --- переключение игр --- */
  const views = {wheel: $('wheelGame'), apple: $('appleGame'), crash: $('crashGame')};
  gameSel.onchange = e => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[e.target.value].classList.add('active');
  };

  /* ================================================================= *
   *                               1) Wheel                            *
   * ================================================================= */
  const labels=['0×','2×','0×','5×','0×','3×','10×','55×'];
  const mult  =[ 0  , 2  , 0  , 5 , 0  , 3 , 10 , 55 ];
  const colors=['#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00','#d400ff','#ffea00'];

  const pickByWeight = w => {
    const sum = w.reduce((a,b)=>a+b,0);
    let r = Math.random()*sum, acc = 0;
    for (let i=0;i<w.length;i++){ acc += w[i]; if (r < acc) return i; }
    return w.length-1;
  };

  const wheel = new Winwheel({
    canvasId:'canvas',numSegments:labels.length,outerRadius:160,
    textFontSize:22,textFillStyle:'#fff',textOutlineWidth:0,lineWidth:0,
    segments:labels.map((t,i)=>({fillStyle:colors[i],text:t})),
    animation:{type:'spinToStop',duration:8,spins:8,callbackFinished:onWheelStop}
  });
  const ctx = $('canvas').getContext('2d');
  const drawPointer = () => {
    ctx.save(); ctx.fillStyle='#ffea00';
    ctx.beginPath(); ctx.moveTo(158,8); ctx.lineTo(162,8); ctx.lineTo(160,28);
    ctx.closePath(); ctx.filter='drop-shadow(0 0 6px #ffea00)'; ctx.fill(); ctx.restore();
  }; drawPointer();

  let curStake = 1;

  function startWheel(){
    disablePlay('Крутится…');
    wheel.stopAnimation(false); wheel.rotationAngle = 0; wheel.draw(); drawPointer();

    /* ► сектор: либо «форс» адм-панели, либо весы */
    let stopSeg;
    if (isAdmin && forceSeg && forceSeg.value !== '') {
      stopSeg = +forceSeg.value + 1;               // Winwheel 1-индексация
    } else {
      stopSeg = pickByWeight(CONFIG.wheelWeights) + 1;
    }
    wheel.animation.stopAngle = wheel.getRandomForSegment(stopSeg);
    wheel.startAnimation();
  }
  function onWheelStop(){
    const idx = wheel.getIndicatedSegmentNumber() - 1;
    finishRound(mult[idx] * curStake, 'wheel');
  }

  /* ================================================================= *
   *                            2) Apple of Fortune                    *
   * ================================================================= */
  const field   = $('appleField');
  const cashBtn = $('appleCashBtn');
  let apples=[], bombsReal=new Set(), bombsDisplay=new Set(),
      bombsShown=0, opened=0, appleMul=1;

  function prepareApple(){
    field.innerHTML='';
    apples=[]; bombsReal.clear(); bombsDisplay.clear();
    opened=0; appleMul=1;

    bombsShown = +bombPick.value;                                // сколько увидит игрок
    const totalBombs = Math.min(24, bombsShown + CONFIG.appleRig);

    while (bombsReal.size < totalBombs)
      bombsReal.add(Math.floor(Math.random()*25));

    /* какие из них показываем при проигрыше */
    const shuffled = [...bombsReal].sort(()=>0.5-Math.random());
    bombsDisplay = new Set(shuffled.slice(0, bombsShown));

    cashBtn.style.display='none'; cashBtn.textContent='Забрать ×1.00';

    for (let i=0;i<25;i++){
      const cell=document.createElement('div');
      cell.className='cell'; cell.textContent='🍏';
      cell.onclick=()=>openApple(i);
      field.appendChild(cell); apples.push(cell);
    }
  }

  function openApple(idx){
    if (apples[idx].classList.contains('open')) return;

    apples[idx].classList.add('open');

    if (bombsReal.has(idx)){             /* проиграли */
      if (!bombsDisplay.has(idx)){       /* «лишняя» бомба попалась первой */
        const [rep] = bombsDisplay;
        bombsDisplay.delete(rep); bombsDisplay.add(idx);
      }
      bombsDisplay.forEach(i=>{
        apples[i].classList.add('open'); apples[i].textContent='🐛';
      });
      gsap.to(apples[idx],{scale:1.2,yoyo:true,repeat:3,duration:0.15});
      cashBtn.style.display='none';
      setTimeout(()=>finishRound(0,'appleLoss'),600);
      return;
    }

    opened++;
    appleMul = +(1 + opened*0.2).toFixed(2);
    apples[idx].textContent='🍎';
    cashBtn.textContent=`Забрать ×${appleMul.toFixed(2)}`;
    cashBtn.style.display='block';
  }
  cashBtn.onclick = () => finishRound(curStake*appleMul,'appleWin');

  /* ================================================================= *
   *                               3) Crash                            *
   * ================================================================= */
  const crashScreen = $('crashScreen');
  const crashBtn    = $('crashCashBtn');
  let crashTimer=null, crashMul=1, crashLimit=2;

  function startCrash(){
    crashMul = 1;
    crashLimit = +(CONFIG.crashMin + Math.random() *
                (CONFIG.crashMax - CONFIG.crashMin)).toFixed(2);
    crashScreen.textContent='x1.00';
    crashBtn.textContent   ='Забрать x1.00';
    crashBtn.style.display='block';

    crashTimer=setInterval(()=>{
      crashMul = +(crashMul + CONFIG.crashStep).toFixed(2);
      crashScreen.textContent=`x${crashMul.toFixed(2)}`;
      crashBtn.textContent   =`Забрать x${crashMul.toFixed(2)}`;

      if (crashMul >= crashLimit){
        clearInterval(crashTimer); crashBtn.style.display='none';
        gsap.to(crashScreen,{scale:1.3,yoyo:true,repeat:3,duration:0.15,onComplete:()=>{
          crashScreen.textContent='💥 CRASH';
          finishRound(0,'crashLoss');
        }});
      }
    }, CONFIG.crashInterval);
  }
  crashBtn.onclick = () => {
    clearInterval(crashTimer); crashBtn.style.display='none';
    finishRound(curStake*crashMul,'crashWin');
  };

  /* ================================================================= *
   *                 кнопка «Играть!»  /  финал раунда                 *
   * ================================================================= */
  function disablePlay(txt){ actionBtn.disabled=true; actionBtn.textContent=txt; }
  function enablePlay(){ actionBtn.disabled=false; actionBtn.textContent='Играть!'; }

  actionBtn.onclick = () => {
    if (balance < stake()){ tg.showAlert('Недостаточно средств'); return; }

    curStake = stake();
    balance -= curStake; drawBalance();
    tg.sendData(JSON.stringify({type:'bet',stake:curStake}));

    switch (gameSel.value){
      case 'wheel': startWheel();   break;
      case 'apple': prepareApple(); disablePlay('Открой яблочко'); break;
      case 'crash': startCrash();   disablePlay('Идёт раунд…');    break;
    }
  };

  function finishRound(payout,kind){
    payout  = +payout.toFixed(2);
    balance = +(balance + payout).toFixed(2);
    drawBalance();
    tg.sendData(JSON.stringify({type:kind,stake:curStake,payout}));
    enablePlay();
  }
})();
